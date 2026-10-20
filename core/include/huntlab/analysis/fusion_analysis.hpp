#pragma once

#include "huntlab/analysis/bazaar_analysis.hpp"

#include <string>
#include <vector>

namespace huntlab::analysis {

struct FusionRecipe {
    std::string recipe_id;
    std::string output_product_id;
    domain::Quantity output_quantity{};
    std::string first_input_product_id;
    domain::Quantity first_input_quantity{};
    std::string second_input_product_id;
    domain::Quantity second_input_quantity{};
    domain::Quantity first_input_weekly_volume{-1};
    domain::Quantity second_input_weekly_volume{-1};
};

struct FusionOpportunity {
    std::string recipe_id;
    std::string output_product_id;
    std::string first_input_product_id;
    std::string second_input_product_id;
    domain::Quantity operation_count{};
    domain::Quantity output_quantity{};
    domain::Coins acquisition_cost;
    domain::Coins first_input_cost;
    domain::Coins second_input_cost;
    domain::Coins gross_proceeds;
    domain::Coins sale_fee;
    std::int64_t net_profit_microcoins{};
    std::int32_t roi_basis_points{};
    std::int64_t estimated_profit_per_hour_microcoins{};
};

[[nodiscard]] std::vector<FusionOpportunity>
analyze_fusion(const domain::MarketSnapshot& snapshot, const std::vector<FusionRecipe>& recipes,
               const BazaarSettings& settings);

} // namespace huntlab::analysis
