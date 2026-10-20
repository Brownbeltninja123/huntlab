#include "huntlab/analysis/fusion_analysis.hpp"

#include <iostream>
#include <stdexcept>

int main() {
    try {
        huntlab::domain::MarketSnapshot snapshot;
        snapshot.products.push_back({"A", {{{100}, 5, 2}}, {}, 1'000'000});
        snapshot.products.push_back({"B", {{{200}, 5, 2}}, {}, 1'000'000});
        snapshot.products.push_back({"OUT", {}, {{{500}, 10, 3}}, 1'000'000});
        huntlab::analysis::FusionRecipe recipe{"OUT:A:B:2", "OUT", 2, "A", 1, "B", 1};
        huntlab::analysis::BazaarSettings settings{0, {10'000}, 5, 0, 24, 500};
        const auto opportunities = huntlab::analysis::analyze_fusion(snapshot, {recipe}, settings);
        if (opportunities.size() != 1 || opportunities[0].operation_count != 5 ||
            opportunities[0].output_quantity != 10 ||
            opportunities[0].acquisition_cost.microcoins != 1'500 ||
            opportunities[0].first_input_cost.microcoins != 500 ||
            opportunities[0].second_input_cost.microcoins != 1'000 ||
            opportunities[0].gross_proceeds.microcoins != 5'000 ||
            opportunities[0].net_profit_microcoins != 3'500) {
            throw std::runtime_error(
                "fusion optimizer did not apply input/output quantities and depth correctly");
        }
        settings.available_capital.microcoins = 299;
        if (!huntlab::analysis::analyze_fusion(snapshot, {recipe}, settings).empty()) {
            throw std::runtime_error("fusion optimizer accepted an unaffordable batch");
        }
        snapshot.products[0].conservative_weekly_volume = 1'000'000;
        settings.available_capital.microcoins = 10'000;
        huntlab::analysis::FusionRecipe repeated{"OUT:A:A:1", "OUT", 1, "A", 1, "A", 2};
        const auto repeatedResult =
            huntlab::analysis::analyze_fusion(snapshot, {repeated}, settings);
        if (repeatedResult.size() != 1 || repeatedResult[0].operation_count != 1 ||
            repeatedResult[0].acquisition_cost.microcoins != 300 ||
            repeatedResult[0].first_input_cost.microcoins != 300 ||
            repeatedResult[0].second_input_cost.microcoins != 0) {
            throw std::runtime_error("same-shard recipe double-counted order-book depth or cost");
        }
        std::cout << "Fusion core checks passed.\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
    return 0;
}
