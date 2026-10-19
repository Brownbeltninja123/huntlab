#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace huntlab::domain {

using SnapshotId = std::int64_t;
using UnixMillis = std::int64_t;
using Quantity = std::int64_t;

// Coin values are stored in microcoins (one million units per coin) so the
// JSON adapter can preserve decimal API precision without binary rounding.
struct Coins {
    std::int64_t microcoins{};
};

struct PriceLevel {
    Coins unit_price;
    Quantity amount{};
    std::int32_t order_count{};
};

struct ProductMarket {
    std::string product_id;
    // Sellers' offers, cheapest first: these are the acquisition side for an
    // instant buy. Normalization sorts these levels in the Hypixel adapter.
    std::vector<PriceLevel> sell_offers;
    // Buyers' orders, highest first: these are the disposal side for an
    // instant sell. Normalization sorts these levels in the Hypixel adapter.
    std::vector<PriceLevel> buy_orders;
    // Lower of the API's weekly buyer/seller traded-volume counters. -1 means
    // the source did not provide the history needed for an execution cap.
    Quantity conservative_weekly_volume{-1};
};

struct MarketSnapshot {
    SnapshotId id{};
    UnixMillis observed_at{};
    std::string source{"hypixel_bazaar"};
    bool stale{};
    std::vector<ProductMarket> products;
};

} // namespace huntlab::domain
