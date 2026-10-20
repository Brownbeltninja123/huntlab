#include "huntlab/analysis/bazaar_analysis.hpp"

#include <iostream>
#include <stdexcept>
#include <string>

using namespace huntlab;

namespace {
void require(bool condition, const std::string& message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}
} // namespace

int main() {
    try {
        domain::MarketSnapshot snapshot;
        snapshot.id = 7;
        snapshot.observed_at = 1'800'000'000'000;
        snapshot.products.push_back(
            {"TEST_PRODUCT", {{{100'000'000}, 4, 1}}, {{{120'000'000}, 4, 1}}, 280'000});

        const auto result = analysis::analyze_bazaar(snapshot, {{500}, {1'000'000'000}, 4});
        require(result.size() == 1, "expected one opportunity");
        require(result[0].quantity == 4, "unexpected feasible quantity");
        require(result[0].acquisition_cost.microcoins == 400'000'000,
                "unexpected acquisition cost");
        require(result[0].gross_proceeds.microcoins == 480'000'000, "unexpected gross proceeds");
        require(result[0].sale_fee.microcoins == 24'000'000, "unexpected sale fee");
        require(result[0].net_profit_microcoins == 56'000'000, "unexpected net profit");
        require(result[0].estimated_profit_per_hour_microcoins == 1'166'666'666,
                "did not project the configured share of weekly throughput into hourly profit");
        require((result[0].risk_flags & 3U) == 3U,
                "did not flag thin or single-order-dominated visible depth");

        domain::MarketSnapshot constrained;
        constrained.products.push_back({"TEST_PRODUCT", {{{100}, 3, 1}}, {{{120}, 3, 1}}, 280'000});
        const auto depth_limited = analysis::analyze_bazaar(constrained, {{0}, {10'000}, 4});
        require(depth_limited.size() == 1 && depth_limited[0].quantity == 3,
                "did not constrain trade quantity to available book depth");
        require(analysis::analyze_bazaar(constrained, {{0}, {99}, 1}).empty(),
                "accepted over-budget trade");

        domain::MarketSnapshot volume_limited;
        volume_limited.products.push_back(
            {"VOLUME_PRODUCT", {{{100}, 100, 5}}, {{{120}, 100, 5}}, 2'800});
        const auto volume_capped =
            analysis::analyze_bazaar(volume_limited, {{0}, {10'000}, 100, 0});
        require(volume_capped.size() == 1 && volume_capped[0].quantity == 20 &&
                    volume_capped[0].weekly_volume_cap == 20,
                "did not cap the optimized batch to the configured share of recent volume");
        volume_limited.products[0].conservative_weekly_volume = 9'999;
        require(analysis::analyze_bazaar(volume_limited, {{0}, {10'000}, 100}).empty(),
                "did not filter a product below the minimum weekly traded volume");

        require(analysis::analyze_bazaar(constrained, {{10'001}, {1'000}, 1}).empty(),
                "accepted invalid tax");

        domain::MarketSnapshot saturated_roi;
        saturated_roi.products.push_back(
            {"SATURATED_ROI", {{{1}, 1, 1}}, {{{30'000'000}, 1, 1}}, 280'000});
        require(analysis::analyze_bazaar(saturated_roi, {{0}, {100}, 1, 0}).empty(),
                "returned an implausibly high ROI instead of filtering the candidate");

        domain::MarketSnapshot crossed_book;
        crossed_book.products.push_back({"ENCHANTED_REDSTONE_BLOCK",
                                         {{{10'500'000}, 29'000, 2}, {{10'000'000'000}, 20, 1}},
                                         {{{31'005'000'000}, 32, 1}}, 280'000});
        require(analysis::analyze_bazaar(crossed_book, {{125}, {100'000'000}, 100, 0}).empty(),
                "returned a crossed Bazaar book as a realistic flip");

        domain::MarketSnapshot varying_depth;
        varying_depth.products.push_back({"DEPTH_PRODUCT",
                                          {{{100}, 1, 1}, {{110}, 3, 1}},
                                          {{{120}, 1, 1}, {{90}, 3, 1}},
                                          280'000});
        const auto best_batch = analysis::analyze_bazaar(varying_depth, {{0}, {1'000}, 4});
        require(best_batch.size() == 1 && best_batch[0].quantity == 1,
                "did not select profitable sub-batch from order-level boundaries");

        std::cout << "All C++ core checks passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
