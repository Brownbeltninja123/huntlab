#include "huntlab/analysis/fusion_analysis.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <string>
#include <unordered_map>
#include <vector>

namespace huntlab::analysis {
namespace {

using Quantity = domain::Quantity;
using Coins = std::int64_t;

Quantity depth(const std::vector<domain::PriceLevel>& levels) {
    Quantity result = 0;
    for (const auto& level : levels) {
        if (level.amount > std::numeric_limits<Quantity>::max() - result)
            return std::numeric_limits<Quantity>::max();
        result += level.amount;
    }
    return result;
}

bool fill(const std::vector<domain::PriceLevel>& levels, Quantity quantity, Coins& total) {
    Quantity left = quantity;
    Coins sum = 0;
    for (const auto& level : levels) {
        if (level.amount <= 0 || level.unit_price.microcoins <= 0)
            return false;
        const Quantity used = std::min(left, level.amount);
        if (level.unit_price.microcoins > std::numeric_limits<Coins>::max() / used)
            return false;
        const Coins part = used * level.unit_price.microcoins;
        if (part > std::numeric_limits<Coins>::max() - sum)
            return false;
        sum += part;
        left -= used;
        if (left == 0)
            break;
    }
    if (left != 0 || sum > std::numeric_limits<Coins>::max())
        return false;
    total = static_cast<Coins>(sum);
    return true;
}

Quantity affordable_operations(const FusionRecipe& recipe, const domain::ProductMarket& first,
                               const domain::ProductMarket& second, Coins capital, Quantity upper) {
    const bool sameInput = recipe.first_input_product_id == recipe.second_input_product_id;
    Quantity low = 0;
    Quantity high = upper;
    while (low < high) {
        const Quantity mid = low + (high - low + 1) / 2;
        Coins first_cost{};
        Coins second_cost{};
        const bool valid =
            sameInput
                ? fill(first.sell_offers,
                       mid * (recipe.first_input_quantity + recipe.second_input_quantity),
                       first_cost)
                : fill(first.sell_offers, mid * recipe.first_input_quantity, first_cost) &&
                      fill(second.sell_offers, mid * recipe.second_input_quantity, second_cost);
        if (valid && second_cost <= std::numeric_limits<Coins>::max() - first_cost &&
            first_cost + second_cost <= capital)
            low = mid;
        else
            high = mid - 1;
    }
    return low;
}

void add_boundaries(std::vector<Quantity>& candidates,
                    const std::vector<domain::PriceLevel>& levels, Quantity per_operation,
                    Quantity maximum) {
    Quantity cumulative = 0;
    for (const auto& level : levels) {
        if (level.amount > std::numeric_limits<Quantity>::max() - cumulative)
            cumulative = maximum * per_operation;
        else
            cumulative += level.amount;
        const Quantity boundary = cumulative / per_operation;
        for (Quantity offset = -1; offset <= 1; ++offset) {
            if (boundary + offset > 0 && boundary + offset <= maximum)
                candidates.push_back(boundary + offset);
        }
    }
}

} // namespace

std::vector<FusionOpportunity> analyze_fusion(const domain::MarketSnapshot& snapshot,
                                              const std::vector<FusionRecipe>& recipes,
                                              const BazaarSettings& settings) {
    std::vector<FusionOpportunity> result;
    if (settings.sale_tax_basis_points < 0 || settings.sale_tax_basis_points > 10'000 ||
        settings.available_capital.microcoins <= 0 || settings.maximum_quantity <= 0 ||
        settings.minimum_weekly_volume < 0 || settings.sale_horizon_hours < 1 ||
        settings.sale_horizon_hours > 168 || settings.volume_share_basis_points < 1 ||
        settings.volume_share_basis_points > 10'000)
        return result;

    std::unordered_map<std::string, const domain::ProductMarket*> markets;
    markets.reserve(snapshot.products.size());
    for (const auto& product : snapshot.products)
        markets.emplace(product.product_id, &product);
    for (const auto& recipe : recipes) {
        if (recipe.recipe_id.empty() || recipe.output_quantity <= 0 ||
            recipe.first_input_quantity <= 0 || recipe.second_input_quantity <= 0)
            continue;
        const auto firstIt = markets.find(recipe.first_input_product_id);
        const auto secondIt = markets.find(recipe.second_input_product_id);
        const auto outputIt = markets.find(recipe.output_product_id);
        const auto* first = firstIt == markets.end() ? nullptr : firstIt->second;
        const auto* second = secondIt == markets.end() ? nullptr : secondIt->second;
        const auto* output = outputIt == markets.end() ? nullptr : outputIt->second;
        if (!first || !second || !output ||
            first->conservative_weekly_volume < settings.minimum_weekly_volume ||
            second->conservative_weekly_volume < settings.minimum_weekly_volume ||
            output->conservative_weekly_volume < settings.minimum_weekly_volume)
            continue;
        if (first->sell_offers.empty() || second->sell_offers.empty() || output->buy_orders.empty())
            continue;

        const bool sameInput = recipe.first_input_product_id == recipe.second_input_product_id;
        const Quantity combinedInputQuantity =
            recipe.first_input_quantity + recipe.second_input_quantity;
        Quantity maximum =
            std::min(settings.maximum_quantity,
                     depth(first->sell_offers) /
                         (sameInput ? combinedInputQuantity : recipe.first_input_quantity));
        if (!sameInput)
            maximum = std::min(maximum, depth(second->sell_offers) / recipe.second_input_quantity);
        maximum = std::min(maximum, depth(output->buy_orders) / recipe.output_quantity);
        const auto volume_cap = [&](Quantity weekly, Quantity per_operation) {
            const long double cap = static_cast<long double>(weekly) * settings.sale_horizon_hours *
                                    settings.volume_share_basis_points /
                                    (168.0L * 10'000.0L * static_cast<long double>(per_operation));
            return static_cast<Quantity>(std::min<long double>(
                std::floor(cap), static_cast<long double>(std::numeric_limits<Quantity>::max())));
        };
        maximum = std::min(
            maximum, volume_cap(first->conservative_weekly_volume,
                                sameInput ? combinedInputQuantity : recipe.first_input_quantity));
        if (!sameInput)
            maximum = std::min(maximum, volume_cap(second->conservative_weekly_volume,
                                                   recipe.second_input_quantity));
        maximum = std::min(maximum,
                           volume_cap(output->conservative_weekly_volume, recipe.output_quantity));
        if (maximum <= 0)
            continue;
        maximum = affordable_operations(recipe, *first, *second,
                                        settings.available_capital.microcoins, maximum);
        if (maximum <= 0)
            continue;

        std::vector<Quantity> candidates{maximum};
        candidates.reserve(1 + 9 * (first->sell_offers.size() + second->sell_offers.size() +
                                    output->buy_orders.size()));
        add_boundaries(candidates, first->sell_offers,
                       sameInput ? combinedInputQuantity : recipe.first_input_quantity, maximum);
        if (!sameInput)
            add_boundaries(candidates, second->sell_offers, recipe.second_input_quantity, maximum);
        add_boundaries(candidates, output->buy_orders, recipe.output_quantity, maximum);
        std::sort(candidates.begin(), candidates.end());
        candidates.erase(std::unique(candidates.begin(), candidates.end()), candidates.end());
        FusionOpportunity best{};
        for (const Quantity operations : candidates) {
            Coins first_cost{};
            Coins second_cost{};
            Coins proceeds{};
            if (!(sameInput
                      ? fill(first->sell_offers, operations * combinedInputQuantity, first_cost)
                      : fill(first->sell_offers, operations * recipe.first_input_quantity,
                             first_cost) &&
                            fill(second->sell_offers, operations * recipe.second_input_quantity,
                                 second_cost)) ||
                !fill(output->buy_orders, operations * recipe.output_quantity, proceeds))
                continue;
            if (second_cost > std::numeric_limits<Coins>::max() - first_cost)
                continue;
            const Coins cost = first_cost + second_cost;
            const Coins fee =
                (proceeds / 10'000) * settings.sale_tax_basis_points +
                ((proceeds % 10'000) * settings.sale_tax_basis_points + 9'999) / 10'000;
            const Coins afterFee = proceeds - fee;
            if (afterFee <= cost)
                continue;
            const Coins net = afterFee - cost;
            if (net <= best.net_profit_microcoins)
                continue;
            const auto firstWeeklyOperations =
                first->conservative_weekly_volume /
                (sameInput ? combinedInputQuantity : recipe.first_input_quantity);
            const auto secondWeeklyOperations =
                sameInput ? firstWeeklyOperations
                          : second->conservative_weekly_volume / recipe.second_input_quantity;
            const auto weeklyOperations =
                std::min({firstWeeklyOperations, secondWeeklyOperations,
                          output->conservative_weekly_volume / recipe.output_quantity});
            const long double hourlyEstimate =
                static_cast<long double>(net) * weeklyOperations *
                settings.volume_share_basis_points /
                (static_cast<long double>(operations) * 168.0L * 10'000.0L);
            const auto hourly = static_cast<std::int64_t>(std::min<long double>(
                hourlyEstimate,
                static_cast<long double>(std::numeric_limits<std::int64_t>::max())));
            const long double roi =
                static_cast<long double>(net) * 10'000.0L / static_cast<long double>(cost);
            best = {recipe.recipe_id,
                    recipe.output_product_id,
                    recipe.first_input_product_id,
                    recipe.second_input_product_id,
                    operations,
                    operations * recipe.output_quantity,
                    {cost},
                    {first_cost},
                    {second_cost},
                    {proceeds},
                    {fee},
                    net,
                    static_cast<std::int32_t>(std::min<long double>(
                        std::floor(roi),
                        static_cast<long double>(std::numeric_limits<std::int32_t>::max()))),
                    hourly};
        }
        if (best.operation_count > 0)
            result.push_back(std::move(best));
    }
    std::sort(result.begin(), result.end(), [](const auto& a, const auto& b) {
        if (a.estimated_profit_per_hour_microcoins != b.estimated_profit_per_hour_microcoins)
            return a.estimated_profit_per_hour_microcoins > b.estimated_profit_per_hour_microcoins;
        return a.net_profit_microcoins > b.net_profit_microcoins;
    });
    return result;
}

} // namespace huntlab::analysis
