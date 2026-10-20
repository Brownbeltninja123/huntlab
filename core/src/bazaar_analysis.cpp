#include "huntlab/analysis/bazaar_analysis.hpp"

#include <algorithm>
#include <limits>
#include <optional>
#include <utility>

namespace huntlab::analysis {
namespace {

constexpr std::int32_t maximum_displayed_roi_basis_points = 50'000; // 500%

struct Fill {
    std::int64_t total_microcoins{};
    domain::Quantity quantity{};
};

class IndexedBook {
  public:
    explicit IndexedBook(const std::vector<domain::PriceLevel>& levels) : levels_(levels) {
        for (const auto& level : levels_) {
            if (level.amount <= 0 || level.unit_price.microcoins <= 0 ||
                depth_ > std::numeric_limits<domain::Quantity>::max() - level.amount) {
                break;
            }
            depth_ += level.amount;
            cumulative_quantity_.push_back(depth_);

            const auto prior_cost =
                cumulative_cost_.empty() ? std::optional<std::int64_t>{0} : cumulative_cost_.back();
            if (!prior_cost || level.amount > std::numeric_limits<std::int64_t>::max() /
                                                  level.unit_price.microcoins) {
                cumulative_cost_.push_back(std::nullopt);
                continue;
            }
            const auto level_cost = level.amount * level.unit_price.microcoins;
            if (*prior_cost > std::numeric_limits<std::int64_t>::max() - level_cost) {
                cumulative_cost_.push_back(std::nullopt);
                continue;
            }
            cumulative_cost_.push_back(*prior_cost + level_cost);
        }
    }

    [[nodiscard]] domain::Quantity depth() const {
        return depth_;
    }
    [[nodiscard]] bool has_thin_top_level() const {
        return !levels_.empty() && depth_ > 0 && levels_.front().order_count == 1 &&
               static_cast<long double>(levels_.front().amount) /
                       static_cast<long double>(depth_) >=
                   0.8L;
    }
    [[nodiscard]] std::int64_t visible_order_count() const {
        std::int64_t count = 0;
        for (const auto& level : levels_) {
            count += level.order_count;
        }
        return count;
    }
    [[nodiscard]] const std::vector<domain::Quantity>& boundaries() const {
        return cumulative_quantity_;
    }

    [[nodiscard]] std::optional<Fill> fill(domain::Quantity requested) const {
        if (requested <= 0 || requested > depth_) {
            return std::nullopt;
        }
        const auto position =
            std::lower_bound(cumulative_quantity_.begin(), cumulative_quantity_.end(), requested);
        const auto index = static_cast<std::size_t>(position - cumulative_quantity_.begin());
        const auto quantity_before =
            index == 0 ? domain::Quantity{0} : cumulative_quantity_[index - 1];
        const auto cost_before =
            index == 0 ? std::optional<std::int64_t>{0} : cumulative_cost_[index - 1];
        if (!cost_before) {
            return std::nullopt;
        }
        const auto within_level = requested - quantity_before;
        const auto price = levels_[index].unit_price.microcoins;
        if (within_level > std::numeric_limits<std::int64_t>::max() / price) {
            return std::nullopt;
        }
        const auto partial_cost = within_level * price;
        if (*cost_before > std::numeric_limits<std::int64_t>::max() - partial_cost) {
            return std::nullopt;
        }
        return Fill{*cost_before + partial_cost, requested};
    }

  private:
    const std::vector<domain::PriceLevel>& levels_;
    std::vector<domain::Quantity> cumulative_quantity_;
    std::vector<std::optional<std::int64_t>> cumulative_cost_;
    domain::Quantity depth_{};
};

[[nodiscard]] std::optional<std::int64_t> sale_fee(std::int64_t proceeds,
                                                   std::int32_t basis_points) {
    if (basis_points < 0 || basis_points > 10'000 || proceeds < 0) {
        return std::nullopt;
    }
    // Round tax up to one microcoin so an estimate never understates fees.
    constexpr std::int64_t denominator = 10'000;
    if (basis_points != 0 &&
        proceeds > (std::numeric_limits<std::int64_t>::max() - (denominator - 1)) / basis_points) {
        return std::nullopt;
    }
    if (basis_points == 0) {
        return 0;
    }
    return (proceeds * basis_points + denominator - 1) / denominator;
}

} // namespace

std::vector<Opportunity> analyze_bazaar(const domain::MarketSnapshot& snapshot,
                                        const BazaarSettings& settings) {
    std::vector<Opportunity> results;
    if (settings.maximum_quantity <= 0 || settings.available_capital.microcoins < 0 ||
        settings.sale_tax_basis_points < 0 || settings.sale_tax_basis_points > 10'000 ||
        settings.minimum_weekly_volume < 0 || settings.sale_horizon_hours < 1 ||
        settings.sale_horizon_hours > 168 || settings.volume_share_basis_points < 1 ||
        settings.volume_share_basis_points > 10'000) {
        return results;
    }

    for (const auto& product : snapshot.products) {
        if (product.product_id.empty() || product.sell_offers.empty() ||
            product.buy_orders.empty() || product.conservative_weekly_volume < 0 ||
            product.conservative_weekly_volume < settings.minimum_weekly_volume) {
            continue;
        }
        const IndexedBook acquisition_book(product.sell_offers);
        const IndexedBook disposal_book(product.buy_orders);
        const auto depth_limited_quantity = std::min(
            {settings.maximum_quantity, acquisition_book.depth(), disposal_book.depth()});
        // Bound projected sales to a configurable share of observed weekly
        // throughput over the chosen holding window. Saturate at the user's
        // maximum quantity before multiplying to avoid integer overflow.
        constexpr std::int64_t denominator = 168LL * 10'000;
        const auto factor = static_cast<std::int64_t>(settings.sale_horizon_hours) *
                            settings.volume_share_basis_points;
        const auto threshold = (settings.maximum_quantity * denominator + factor - 1) / factor;
        const auto weekly_cap = product.conservative_weekly_volume >= threshold
                                    ? settings.maximum_quantity
                                    : (product.conservative_weekly_volume * factor) / denominator;
        const auto pre_capital_quantity = std::min(depth_limited_quantity, weekly_cap);
        if (pre_capital_quantity <= 0) {
            continue;
        }

        // Acquisition cost is monotonic. Find the capital cap independently so
        // the response can explain whether budget, rather than depth or volume,
        // limited the chosen quantity.
        const auto capital_search_limit =
            std::min(settings.maximum_quantity, acquisition_book.depth());
        domain::Quantity capital_cap = 0;
        auto lower = domain::Quantity{1};
        auto upper = capital_search_limit;
        while (lower <= upper) {
            const auto candidate = lower + (upper - lower) / 2;
            const auto fill = acquisition_book.fill(candidate);
            if (fill && fill->total_microcoins <= settings.available_capital.microcoins) {
                capital_cap = candidate;
                lower = candidate + 1;
            } else {
                upper = candidate - 1;
            }
        }
        const bool capital_is_binding = capital_cap < pre_capital_quantity;
        const auto quantity = std::min(pre_capital_quantity, capital_cap);
        if (quantity <= 0) {
            continue;
        }

        // Within fixed price levels, net proceeds are linear in quantity.
        // Therefore the best total-profit batch lies at an order-level
        // boundary; checking all boundaries finds the best executable size.
        std::vector<domain::Quantity> candidates{1, quantity};
        for (const auto boundary : acquisition_book.boundaries()) {
            if (boundary <= quantity)
                candidates.push_back(boundary);
        }
        for (const auto boundary : disposal_book.boundaries()) {
            if (boundary <= quantity)
                candidates.push_back(boundary);
        }
        std::sort(candidates.begin(), candidates.end());
        candidates.erase(std::unique(candidates.begin(), candidates.end()), candidates.end());

        std::optional<Opportunity> best;
        for (const auto candidate_quantity : candidates) {
            const auto acquisition = acquisition_book.fill(candidate_quantity);
            const auto disposal = disposal_book.fill(candidate_quantity);
            if (!acquisition || !disposal ||
                acquisition->total_microcoins > settings.available_capital.microcoins) {
                continue;
            }
            const auto fee = sale_fee(disposal->total_microcoins, settings.sale_tax_basis_points);
            if (!fee)
                continue;
            const auto net = disposal->total_microcoins - *fee - acquisition->total_microcoins;
            if (net <= 0 || acquisition->total_microcoins <= 0)
                continue;

            const auto roi_value = static_cast<long double>(net) * 10'000.0L /
                                   static_cast<long double>(acquisition->total_microcoins);
            // Very large ROI on a single instantaneous snapshot is usually an
            // anomalous or crossed order book, not a repeatable flip. Exclude it
            // instead of presenting it as an executable opportunity. This also
            // keeps the int32 ROI saturation sentinel out of the API entirely.
            if (roi_value >= maximum_displayed_roi_basis_points) {
                continue;
            }
            Opportunity candidate;
            candidate.product_id = product.product_id;
            candidate.quantity = candidate_quantity;
            candidate.acquisition_cost = {acquisition->total_microcoins};
            candidate.gross_proceeds = {disposal->total_microcoins};
            candidate.gross_profit = {disposal->total_microcoins - acquisition->total_microcoins};
            candidate.sale_fee = {*fee};
            candidate.net_profit_microcoins = net;
            candidate.roi_basis_points = static_cast<std::int32_t>(roi_value);
            candidate.acquisition_vwap = {
                acquisition->total_microcoins / candidate_quantity +
                (acquisition->total_microcoins % candidate_quantity != 0 ? 1 : 0)};
            candidate.disposal_vwap = {disposal->total_microcoins / candidate_quantity};
            candidate.warnings = {
                "Uses current top-30 order summaries; full-depth fill is an estimate.",
                "Immediate execution consumes seller offers and buyer orders; market changes can reduce proceeds."};
            candidate.weekly_volume_cap = weekly_cap;
            candidate.conservative_weekly_volume = product.conservative_weekly_volume;
            candidate.acquisition_visible_depth = acquisition_book.depth();
            candidate.disposal_visible_depth = disposal_book.depth();
            candidate.filled_quantity = candidate_quantity;
            candidate.unfilled_quantity = 0;
            if (acquisition_book.visible_order_count() < 3 ||
                disposal_book.visible_order_count() < 3) {
                candidate.risk_flags |= 1U; // thin visible book
            }
            if (acquisition_book.has_thin_top_level() || disposal_book.has_thin_top_level()) {
                candidate.risk_flags |= 2U; // one order dominates a side's visible depth
            }
            if (candidate.roi_basis_points >= 5'000) {
                candidate.risk_flags |= 4U; // anomalously wide immediate spread
            }
            if (acquisition_book.depth() < settings.maximum_quantity) {
                candidate.risk_flags |= 8U; // acquisition depth cannot support requested batch
            }
            if (disposal_book.depth() < settings.maximum_quantity) {
                candidate.risk_flags |= 16U; // exit depth cannot support requested batch
            }
            if (candidate_quantity == settings.maximum_quantity) {
                candidate.binding_constraint_flags |= user_maximum_quantity;
            }
            if (candidate_quantity == weekly_cap &&
                product.conservative_weekly_volume < threshold) {
                candidate.binding_constraint_flags |= weekly_volume;
            }
            if (candidate_quantity == acquisition_book.depth()) {
                candidate.binding_constraint_flags |= acquisition_depth;
            }
            if (candidate_quantity == disposal_book.depth()) {
                candidate.binding_constraint_flags |= disposal_depth;
            }
            if (capital_is_binding && candidate_quantity == capital_cap) {
                candidate.binding_constraint_flags |= available_capital;
            }
            if (candidate_quantity < quantity) {
                candidate.binding_constraint_flags |= profit_maximizing_quantity;
            }
            // Bazaar Meta's headline estimates coins/hour from the previous
            // week's instant buy/sell throughput. Keep the same useful unit,
            // but project only the configured share of observed throughput,
            // constrained by executable depth and the batch's realized edge.
            const auto projected_hourly_profit =
                static_cast<long double>(net) * product.conservative_weekly_volume *
                settings.volume_share_basis_points /
                (static_cast<long double>(candidate_quantity) * 168.0L * 10'000.0L);
            candidate.estimated_profit_per_hour_microcoins = static_cast<std::int64_t>(
                std::min(projected_hourly_profit,
                         static_cast<long double>(std::numeric_limits<std::int64_t>::max())));
            if (!best || candidate.net_profit_microcoins > best->net_profit_microcoins ||
                (candidate.net_profit_microcoins == best->net_profit_microcoins &&
                 candidate.roi_basis_points > best->roi_basis_points)) {
                best = std::move(candidate);
            }
        }
        if (best)
            results.push_back(std::move(*best));
    }
    std::sort(results.begin(), results.end(), [](const auto& left, const auto& right) {
        if (left.net_profit_microcoins != right.net_profit_microcoins) {
            return left.net_profit_microcoins > right.net_profit_microcoins;
        }
        return left.product_id < right.product_id;
    });
    return results;
}

} // namespace huntlab::analysis
