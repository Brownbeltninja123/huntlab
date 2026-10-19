#pragma once

#include "huntlab/domain/market.hpp"

#include <cstdint>
#include <string>
#include <vector>

namespace huntlab::analysis {

struct BazaarSettings {
    std::int32_t sale_tax_basis_points{};
    domain::Coins available_capital{};
    domain::Quantity maximum_quantity{};
    domain::Quantity minimum_weekly_volume{10'000};
    std::int32_t sale_horizon_hours{24};
    std::int32_t volume_share_basis_points{500};
};

struct Opportunity {
    std::string product_id;
    domain::Quantity quantity{};
    domain::Coins acquisition_cost{};
    domain::Coins gross_proceeds{};
    domain::Coins gross_profit{};
    domain::Coins sale_fee{};
    std::int64_t net_profit_microcoins{};
    std::int32_t roi_basis_points{};
    std::int64_t estimated_profit_per_hour_microcoins{};
    domain::Coins acquisition_vwap{};
    domain::Coins disposal_vwap{};
    std::vector<std::string> warnings;
    domain::Quantity weekly_volume_cap{};
    domain::Quantity acquisition_visible_depth{};
    domain::Quantity disposal_visible_depth{};
    domain::Quantity filled_quantity{};
    domain::Quantity unfilled_quantity{};
    std::uint32_t risk_flags{};
    std::uint32_t binding_constraint_flags{};
    domain::Quantity conservative_weekly_volume{};
};

enum BindingConstraint : std::uint32_t {
    user_maximum_quantity = 1U,
    available_capital = 2U,
    acquisition_depth = 4U,
    disposal_depth = 8U,
    weekly_volume = 16U,
    profit_maximizing_quantity = 32U,
};

// Simulates buying against seller offers and selling into buyer orders.
// It consumes real normalized depth, is deterministic, and returns no result
// if the constrained batch is unprofitable or the books are incomplete.
[[nodiscard]] std::vector<Opportunity> analyze_bazaar(const domain::MarketSnapshot& snapshot,
                                                      const BazaarSettings& settings);

} // namespace huntlab::analysis
