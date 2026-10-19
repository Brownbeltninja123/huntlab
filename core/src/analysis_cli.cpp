#include "huntlab/analysis/bazaar_analysis.hpp"

#include <array>
#include <charconv>
#include <iostream>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>

namespace {

template <typename Integer> bool parse_integer(std::string_view value, Integer& result) {
    const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), result);
    return error == std::errc{} && end == value.data() + value.size();
}

bool parse_levels(std::string_view text, std::vector<huntlab::domain::PriceLevel>& levels) {
    std::size_t start = 0;
    while (start < text.size()) {
        const auto end = text.find(';', start);
        const auto record =
            text.substr(start, end == std::string_view::npos ? text.size() - start : end - start);
        const auto first = record.find(':');
        const auto second = first == std::string_view::npos ? first : record.find(':', first + 1);
        if (first == std::string_view::npos || second == std::string_view::npos) {
            return false;
        }
        huntlab::domain::PriceLevel level;
        if (!parse_integer(record.substr(0, first), level.unit_price.microcoins) ||
            !parse_integer(record.substr(first + 1, second - first - 1), level.amount) ||
            !parse_integer(record.substr(second + 1), level.order_count) || level.amount <= 0 ||
            level.unit_price.microcoins <= 0 || level.order_count < 0) {
            return false;
        }
        levels.push_back(level);
        if (end == std::string_view::npos) {
            break;
        }
        start = end + 1;
    }
    return true;
}

} // namespace

int main() {
    std::string line;
    if (!std::getline(std::cin, line)) {
        std::cerr << "missing protocol header\n";
        return 2;
    }
    std::istringstream header(line);
    std::string version;
    std::string tax_text;
    std::string capital_text;
    std::string quantity_text;
    std::string weekly_text;
    std::string horizon_text;
    std::string share_text;
    if (!std::getline(header, version, '\t') || version != "v3" ||
        !std::getline(header, tax_text, '\t') || !std::getline(header, capital_text, '\t') ||
        !std::getline(header, quantity_text, '\t') || !std::getline(header, weekly_text, '\t') ||
        !std::getline(header, horizon_text, '\t') || !std::getline(header, share_text)) {
        std::cerr << "invalid protocol header\n";
        return 2;
    }

    huntlab::analysis::BazaarSettings settings;
    if (!parse_integer(tax_text, settings.sale_tax_basis_points) ||
        !parse_integer(capital_text, settings.available_capital.microcoins) ||
        !parse_integer(quantity_text, settings.maximum_quantity) ||
        !parse_integer(weekly_text, settings.minimum_weekly_volume) ||
        !parse_integer(horizon_text, settings.sale_horizon_hours) ||
        !parse_integer(share_text, settings.volume_share_basis_points) ||
        settings.sale_tax_basis_points < 0 || settings.sale_tax_basis_points > 10'000 ||
        settings.available_capital.microcoins < 0 || settings.maximum_quantity <= 0 ||
        settings.minimum_weekly_volume < 0 || settings.sale_horizon_hours < 1 ||
        settings.sale_horizon_hours > 168 || settings.volume_share_basis_points < 1 ||
        settings.volume_share_basis_points > 10'000) {
        std::cerr << "invalid settings\n";
        return 2;
    }

    huntlab::domain::MarketSnapshot snapshot;
    while (std::getline(std::cin, line)) {
        if (line.empty()) {
            continue;
        }
        std::array<std::string_view, 5> fields;
        std::size_t field_start = 0;
        bool valid_row = true;
        for (std::size_t index = 0; index < fields.size() - 1; ++index) {
            const auto tab = line.find('\t', field_start);
            if (tab == std::string::npos) {
                valid_row = false;
                break;
            }
            fields[index] = std::string_view(line).substr(field_start, tab - field_start);
            field_start = tab + 1;
        }
        if (!valid_row || line.find('\t', field_start) != std::string::npos) {
            std::cerr << "invalid product record\n";
            return 2;
        }
        fields.back() = std::string_view(line).substr(field_start);
        if (fields[0] != "P") {
            std::cerr << "invalid product record\n";
            return 2;
        }
        huntlab::domain::ProductMarket product;
        product.product_id = fields[1];
        if (product.product_id.empty() ||
            !parse_integer(fields[2], product.conservative_weekly_volume) ||
            product.conservative_weekly_volume < -1 ||
            !parse_levels(fields[3], product.sell_offers) ||
            !parse_levels(fields[4], product.buy_orders)) {
            std::cerr << "invalid product data\n";
            return 2;
        }
        snapshot.products.push_back(std::move(product));
    }

    const auto opportunities = huntlab::analysis::analyze_bazaar(snapshot, settings);
    for (const auto& opportunity : opportunities) {
        std::cout << "O\t" << opportunity.product_id << '\t' << opportunity.quantity << '\t'
                  << opportunity.acquisition_cost.microcoins << '\t'
                  << opportunity.gross_proceeds.microcoins << '\t'
                  << opportunity.sale_fee.microcoins << '\t' << opportunity.net_profit_microcoins
                  << '\t' << opportunity.roi_basis_points << '\t'
                  << opportunity.acquisition_vwap.microcoins << '\t'
                  << opportunity.disposal_vwap.microcoins << '\t' << opportunity.weekly_volume_cap
                  << '\t' << opportunity.risk_flags << '\t'
                  << opportunity.estimated_profit_per_hour_microcoins << '\t'
                  << opportunity.gross_profit.microcoins << '\t'
                  << opportunity.acquisition_visible_depth << '\t'
                  << opportunity.disposal_visible_depth << '\t' << opportunity.filled_quantity
                  << '\t' << opportunity.unfilled_quantity << '\t'
                  << opportunity.binding_constraint_flags << '\t'
                  << opportunity.conservative_weekly_volume << '\n';
    }
    return 0;
}
