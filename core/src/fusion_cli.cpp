#include "huntlab/analysis/fusion_analysis.hpp"

#include <array>
#include <charconv>
#include <iostream>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>

namespace {
template <typename T> bool number(std::string_view value, T& out) {
    const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), out);
    return error == std::errc{} && end == value.data() + value.size();
}
bool levels(std::string_view text, std::vector<huntlab::domain::PriceLevel>& out) {
    std::size_t start = 0;
    while (start < text.size()) {
        const auto end = text.find(';', start);
        auto row =
            text.substr(start, end == std::string_view::npos ? text.size() - start : end - start);
        const auto a = row.find(':');
        const auto b = a == std::string_view::npos ? a : row.find(':', a + 1);
        huntlab::domain::PriceLevel level;
        if (a == std::string_view::npos || b == std::string_view::npos ||
            !number(row.substr(0, a), level.unit_price.microcoins) ||
            !number(row.substr(a + 1, b - a - 1), level.amount) ||
            !number(row.substr(b + 1), level.order_count) || level.unit_price.microcoins <= 0 ||
            level.amount <= 0 || level.order_count < 0)
            return false;
        out.push_back(level);
        if (end == std::string_view::npos)
            break;
        start = end + 1;
    }
    return true;
}
} // namespace

int main() {
    std::string line;
    if (!std::getline(std::cin, line))
        return 2;
    std::istringstream header(line);
    std::array<std::string, 7> h;
    for (std::size_t i = 0; i < h.size(); ++i)
        if (!std::getline(header, h[i], i + 1 == h.size() ? '\n' : '\t'))
            return 2;
    huntlab::analysis::BazaarSettings settings;
    if (h[0] != "v2f" || !number(h[1], settings.sale_tax_basis_points) ||
        !number(h[2], settings.available_capital.microcoins) ||
        !number(h[3], settings.maximum_quantity) || !number(h[4], settings.minimum_weekly_volume) ||
        !number(h[5], settings.sale_horizon_hours) ||
        !number(h[6], settings.volume_share_basis_points) || settings.sale_tax_basis_points < 0 ||
        settings.sale_tax_basis_points > 10'000 || settings.available_capital.microcoins < 0 ||
        settings.maximum_quantity <= 0 || settings.minimum_weekly_volume < 0 ||
        settings.sale_horizon_hours < 1 || settings.sale_horizon_hours > 168 ||
        settings.volume_share_basis_points < 1 || settings.volume_share_basis_points > 10'000)
        return 2;
    huntlab::domain::MarketSnapshot snapshot;
    std::vector<huntlab::analysis::FusionRecipe> recipes;
    while (std::getline(std::cin, line)) {
        if (line.empty())
            continue;
        std::vector<std::string_view> f;
        std::size_t from = 0;
        while (true) {
            const auto at = line.find('\t', from);
            f.emplace_back(std::string_view(line).substr(
                from, at == std::string::npos ? line.size() - from : at - from));
            if (at == std::string::npos)
                break;
            from = at + 1;
        }
        if (f[0] == "P") {
            if (f.size() != 5)
                return 2;
            huntlab::domain::ProductMarket p;
            p.product_id = f[1];
            if (!number(f[2], p.conservative_weekly_volume) || !levels(f[3], p.sell_offers) ||
                !levels(f[4], p.buy_orders))
                return 2;
            snapshot.products.push_back(std::move(p));
        } else if (f[0] == "R") {
            if (f.size() != 8)
                return 2;
            // R	key	output	yield	input1	qty1	input2	qty2
            huntlab::analysis::FusionRecipe r;
            r.recipe_id = f[1];
            r.output_product_id = f[2];
            r.first_input_product_id = f[4];
            r.second_input_product_id = f[6];
            if (!number(f[3], r.output_quantity) || !number(f[5], r.first_input_quantity) ||
                !number(f[7], r.second_input_quantity))
                return 2;
            recipes.push_back(std::move(r));
        } else
            return 2;
    }
    for (const auto& opportunity : huntlab::analysis::analyze_fusion(snapshot, recipes, settings)) {
        std::cout << "F\t" << opportunity.recipe_id << '\t' << opportunity.output_product_id << '\t'
                  << opportunity.first_input_product_id << '\t'
                  << opportunity.second_input_product_id << '\t' << opportunity.operation_count
                  << '\t' << opportunity.output_quantity << '\t'
                  << opportunity.acquisition_cost.microcoins << '\t'
                  << opportunity.first_input_cost.microcoins << '\t'
                  << opportunity.second_input_cost.microcoins << '\t'
                  << opportunity.gross_proceeds.microcoins << '\t'
                  << opportunity.sale_fee.microcoins << '\t' << opportunity.net_profit_microcoins
                  << '\t' << opportunity.roi_basis_points << '\t'
                  << opportunity.estimated_profit_per_hour_microcoins << '\n';
    }
}
