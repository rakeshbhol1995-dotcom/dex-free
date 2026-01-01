# 🚀 Custom Perpetuals Implementation Guide - Step by Step
## Build Perpetual Markets for ANY Token with Pyth Network

> **Goal:** Enable perpetual futures trading for ANY token on DexFree  
> **Timeline:** 8 weeks  
> **Tech Stack:** Pyth Network + Solidity + Next.js + TypeScript

---

## 📋 Phase 1: Setup & Dependencies (Week 1)

### Step 1.1: Install Pyth SDK

**For Frontend (Next.js):**

```bash
cd frontend
npm install @pythnetwork/pyth-evm-js @pythnetwork/hermes-client
```

**For Smart Contracts:**

```bash
cd contracts
npm install @pythnetwork/pyth-sdk-solidity
```

### Step 1.2: Get Pyth Price Feed IDs

Visit: https://pyth.network/developers/price-feed-ids

**Major tokens already on Pyth:**
- BTC/USD: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- ETH/USD: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`
- SOL/USD: `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`

**For custom tokens:** You'll create your own price feeds!

---

## 📊 Phase 2: Price Aggregation Service (Week 1-2)

### Step 2.1: Create Price Aggregator

Create: `backend/services/priceAggregator.ts`

```typescript
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// Uniswap V2 Pair ABI (minimal)
const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

export class PriceAggregator {
  private provider: ethers.Provider;
  private supabase: any;

  constructor(rpcUrl: string, supabaseUrl: string, supabaseKey: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get token price from Uniswap V2 pair
   */
  async getTokenPriceFromDEX(
    pairAddress: string,
    tokenAddress: string,
    decimals: number = 18
  ): Promise<{
    price: number;
    liquidity: number;
    volume24h: number;
    confidence: number;
  }> {
    try {
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);

      // Get reserves
      const [reserve0, reserve1] = await pairContract.getReserves();
      const token0 = await pairContract.token0();
      const token1 = await pairContract.token1();

      // Determine which reserve is our token
      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
      const tokenReserve = isToken0 ? reserve0 : reserve1;
      const usdcReserve = isToken0 ? reserve1 : reserve0;

      // Calculate price (assuming paired with USDC)
      const price = Number(usdcReserve) / Number(tokenReserve);

      // Calculate liquidity (both sides in USD)
      const liquidity = Number(usdcReserve) * 2;

      // Get 24h volume from database
      const volume24h = await this.get24hVolume(pairAddress);

      // Calculate confidence based on liquidity and volume
      const confidence = this.calculateConfidence(liquidity, volume24h);

      return {
        price,
        liquidity,
        volume24h,
        confidence,
      };
    } catch (error) {
      console.error('Error getting price from DEX:', error);
      throw error;
    }
  }

  /**
   * Get 24h trading volume from database
   */
  private async get24hVolume(pairAddress: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('swap_events')
      .select('amount_usd')
      .eq('pair_address', pairAddress)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Error fetching volume:', error);
      return 0;
    }

    return data.reduce((sum, swap) => sum + swap.amount_usd, 0);
  }

  /**
   * Calculate confidence interval based on liquidity and volume
   */
  private calculateConfidence(liquidity: number, volume24h: number): number {
    // Higher liquidity and volume = lower confidence interval (more accurate)
    // Formula: confidence = base / sqrt(liquidity * volume)
    const base = 1000000; // Adjust this based on your needs
    const confidence = base / Math.sqrt(liquidity * volume24h);

    // Cap between 0.001 (0.1%) and 0.1 (10%)
    return Math.max(0.001, Math.min(0.1, confidence));
  }

  /**
   * Aggregate prices from multiple sources (if available)
   */
  async aggregatePrice(tokenAddress: string, pairs: string[]): Promise<{
    price: number;
    confidence: number;
    timestamp: number;
  }> {
    const prices = await Promise.all(
      pairs.map(pair => this.getTokenPriceFromDEX(pair, tokenAddress))
    );

    // Volume-weighted average price
    const totalVolume = prices.reduce((sum, p) => sum + p.volume24h, 0);
    const weightedPrice = prices.reduce(
      (sum, p) => sum + (p.price * p.volume24h) / totalVolume,
      0
    );

    // Average confidence
    const avgConfidence = prices.reduce((sum, p) => sum + p.confidence, 0) / prices.length;

    return {
      price: weightedPrice,
      confidence: avgConfidence,
      timestamp: Date.now(),
    };
  }
}
```

### Step 2.2: Create Price Publisher Service

Create: `backend/services/pythPublisher.ts`

```typescript
import { PriceAggregator } from './priceAggregator';
import { createClient } from '@supabase/supabase-js';

interface CustomPriceFeed {
  tokenAddress: string;
  symbol: string;
  pairAddresses: string[];
  priceId?: string; // Pyth price feed ID (if exists)
  updateInterval: number; // seconds
  minPriceChange: number; // minimum % change to trigger update
}

export class PythPublisher {
  private aggregator: PriceAggregator;
  private supabase: any;
  private activeFeeds: Map<string, CustomPriceFeed> = new Map();
  private lastPrices: Map<string, number> = new Map();

  constructor(
    rpcUrl: string,
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.aggregator = new PriceAggregator(rpcUrl, supabaseUrl, supabaseKey);
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Register a new custom price feed
   */
  async registerPriceFeed(feed: CustomPriceFeed): Promise<void> {
    this.activeFeeds.set(feed.tokenAddress, feed);

    // Store in database
    await this.supabase.from('custom_price_feeds').upsert({
      token_address: feed.tokenAddress,
      symbol: feed.symbol,
      pair_addresses: feed.pairAddresses,
      price_id: feed.priceId,
      update_interval: feed.updateInterval,
      min_price_change: feed.minPriceChange,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });

    console.log(`✅ Registered price feed for ${feed.symbol}`);
  }

  /**
   * Start publishing prices for all active feeds
   */
  async startPublishing(): Promise<void> {
    // Load active feeds from database
    const { data: feeds } = await this.supabase
      .from('custom_price_feeds')
      .select('*')
      .eq('status', 'ACTIVE');

    for (const feed of feeds || []) {
      this.activeFeeds.set(feed.token_address, {
        tokenAddress: feed.token_address,
        symbol: feed.symbol,
        pairAddresses: feed.pair_addresses,
        priceId: feed.price_id,
        updateInterval: feed.update_interval,
        minPriceChange: feed.min_price_change,
      });
    }

    // Start update loop for each feed
    for (const [tokenAddress, feed] of this.activeFeeds) {
      this.startFeedUpdateLoop(tokenAddress, feed);
    }

    console.log(`🚀 Started publishing ${this.activeFeeds.size} price feeds`);
  }

  /**
   * Update loop for a single price feed
   */
  private async startFeedUpdateLoop(
    tokenAddress: string,
    feed: CustomPriceFeed
  ): Promise<void> {
    const updatePrice = async () => {
      try {
        // Get aggregated price
        const priceData = await this.aggregator.aggregatePrice(
          tokenAddress,
          feed.pairAddresses
        );

        // Check if price changed significantly
        const lastPrice = this.lastPrices.get(tokenAddress) || 0;
        const priceChange = Math.abs((priceData.price - lastPrice) / lastPrice);

        if (priceChange >= feed.minPriceChange || lastPrice === 0) {
          // Publish to Pyth (or your custom oracle)
          await this.publishPrice(feed.symbol, priceData);

          // Update last price
          this.lastPrices.set(tokenAddress, priceData.price);

          // Store in database
          await this.supabase.from('price_updates').insert({
            token_address: tokenAddress,
            symbol: feed.symbol,
            price: priceData.price,
            confidence: priceData.confidence,
            timestamp: new Date(priceData.timestamp).toISOString(),
          });

          console.log(
            `📊 Updated ${feed.symbol}: $${priceData.price.toFixed(6)} (±${(priceData.confidence * 100).toFixed(2)}%)`
          );
        }
      } catch (error) {
        console.error(`Error updating price for ${feed.symbol}:`, error);
      }
    };

    // Initial update
    await updatePrice();

    // Schedule periodic updates
    setInterval(updatePrice, feed.updateInterval * 1000);
  }

  /**
   * Publish price to Pyth Network (or custom oracle)
   */
  private async publishPrice(
    symbol: string,
    priceData: { price: number; confidence: number; timestamp: number }
  ): Promise<void> {
    // NOTE: For production, you need to become a Pyth publisher
    // or use Pyth Express Relay
    // For now, we'll store in our database to be consumed by smart contracts

    // In production, this would call Pyth API:
    // await pythAPI.publishPrice({
    //   symbol: `${symbol}/USD`,
    //   price: priceData.price,
    //   conf: priceData.confidence,
    //   timestamp: priceData.timestamp
    // });

    console.log(`📡 Published ${symbol}/USD: $${priceData.price}`);
  }
}
```

### Step 2.3: Start Price Publisher

Create: `backend/index.ts`

```typescript
import { PythPublisher } from './services/pythPublisher';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const publisher = new PythPublisher(
    process.env.RPC_URL!,
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  // Register custom price feeds
  await publisher.registerPriceFeed({
    tokenAddress: '0x...', // Your custom token
    symbol: 'CUSTOMTOKEN',
    pairAddresses: ['0x...'], // Uniswap V2 pair address
    updateInterval: 10, // Update every 10 seconds
    minPriceChange: 0.001, // Update if price changes >0.1%
  });

  // Start publishing
  await publisher.startPublishing();

  console.log('✅ Price publisher started!');
}

main().catch(console.error);
```

---

## 🔧 Phase 3: Smart Contracts (Week 3-4)

### Step 3.1: Custom Perpetual Market Contract

Create: `contracts/src/CustomPerpetualMarket.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CustomPerpetualMarket is ReentrancyGuard, Ownable {
    // Pyth oracle
    IPyth public pyth;
    bytes32 public priceId;
    
    // Market parameters
    string public symbol;
    address public collateralToken; // USDC
    uint256 public maxLeverage = 20;
    uint256 public liquidationFee = 100; // 1% (in basis points)
    uint256 public tradingFee = 20; // 0.2% (in basis points)
    
    // Funding rate parameters
    uint256 public fundingRateInterval = 8 hours;
    uint256 public lastFundingTime;
    int256 public cumulativeFundingRate;
    
    // Position struct
    struct Position {
        bool isLong;
        uint256 size; // Position size in USD
        uint256 collateral; // Collateral in USD
        uint256 leverage;
        uint256 entryPrice; // Price at entry (scaled by 1e8)
        int256 entryFundingRate;
        uint256 timestamp;
    }
    
    // User positions
    mapping(address => Position) public positions;
    
    // Total open interest
    uint256 public totalLongOpenInterest;
    uint256 public totalShortOpenInterest;
    
    // Events
    event PositionOpened(
        address indexed user,
        bool isLong,
        uint256 size,
        uint256 collateral,
        uint256 leverage,
        uint256 entryPrice
    );
    
    event PositionClosed(
        address indexed user,
        uint256 exitPrice,
        int256 pnl
    );
    
    event PositionLiquidated(
        address indexed user,
        address indexed liquidator,
        uint256 liquidationPrice
    );
    
    event FundingRateUpdated(
        int256 fundingRate,
        int256 cumulativeFundingRate
    );
    
    constructor(
        address _pyth,
        bytes32 _priceId,
        string memory _symbol,
        address _collateralToken
    ) {
        pyth = IPyth(_pyth);
        priceId = _priceId;
        symbol = _symbol;
        collateralToken = _collateralToken;
        lastFundingTime = block.timestamp;
    }
    
    /**
     * Open a new position
     */
    function openPosition(
        bool isLong,
        uint256 size,
        uint256 leverage,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        require(positions[msg.sender].size == 0, "Position already exists");
        require(leverage > 0 && leverage <= maxLeverage, "Invalid leverage");
        
        // Update funding rate
        updateFundingRate(priceUpdateData);
        
        // Get current price from Pyth
        uint256 currentPrice = getCurrentPrice(priceUpdateData);
        
        // Calculate required collateral
        uint256 requiredCollateral = (size * 1e18) / leverage;
        
        // Transfer collateral from user
        IERC20(collateralToken).transferFrom(
            msg.sender,
            address(this),
            requiredCollateral
        );
        
        // Calculate trading fee
        uint256 fee = (size * tradingFee) / 10000;
        
        // Create position
        positions[msg.sender] = Position({
            isLong: isLong,
            size: size - fee,
            collateral: requiredCollateral - fee,
            leverage: leverage,
            entryPrice: currentPrice,
            entryFundingRate: cumulativeFundingRate,
            timestamp: block.timestamp
        });
        
        // Update open interest
        if (isLong) {
            totalLongOpenInterest += size - fee;
        } else {
            totalShortOpenInterest += size - fee;
        }
        
        emit PositionOpened(
            msg.sender,
            isLong,
            size - fee,
            requiredCollateral - fee,
            leverage,
            currentPrice
        );
    }
    
    /**
     * Close position
     */
    function closePosition(
        bytes[] calldata priceUpdateData
    ) external nonReentrant {
        Position memory pos = positions[msg.sender];
        require(pos.size > 0, "No position");
        
        // Update funding rate
        updateFundingRate(priceUpdateData);
        
        // Get current price
        uint256 currentPrice = getCurrentPrice(priceUpdateData);
        
        // Calculate PnL
        int256 pnl = calculatePnL(pos, currentPrice);
        
        // Calculate funding payment
        int256 fundingPayment = calculateFundingPayment(pos);
        
        // Total PnL including funding
        int256 totalPnl = pnl - fundingPayment;
        
        // Calculate final amount
        uint256 finalAmount;
        if (totalPnl >= 0) {
            finalAmount = pos.collateral + uint256(totalPnl);
        } else {
            uint256 loss = uint256(-totalPnl);
            if (loss >= pos.collateral) {
                finalAmount = 0; // Total loss
            } else {
                finalAmount = pos.collateral - loss;
            }
        }
        
        // Calculate trading fee
        uint256 fee = (pos.size * tradingFee) / 10000;
        if (finalAmount > fee) {
            finalAmount -= fee;
        } else {
            finalAmount = 0;
        }
        
        // Update open interest
        if (pos.isLong) {
            totalLongOpenInterest -= pos.size;
        } else {
            totalShortOpenInterest -= pos.size;
        }
        
        // Delete position
        delete positions[msg.sender];
        
        // Transfer final amount to user
        if (finalAmount > 0) {
            IERC20(collateralToken).transfer(msg.sender, finalAmount);
        }
        
        emit PositionClosed(msg.sender, currentPrice, totalPnl);
    }
    
    /**
     * Liquidate position
     */
    function liquidatePosition(
        address user,
        bytes[] calldata priceUpdateData
    ) external nonReentrant {
        Position memory pos = positions[user];
        require(pos.size > 0, "No position");
        
        // Get current price
        uint256 currentPrice = getCurrentPrice(priceUpdateData);
        
        // Check if position should be liquidated
        require(shouldLiquidate(pos, currentPrice), "Position not liquidatable");
        
        // Calculate liquidation fee
        uint256 liqFee = (pos.collateral * liquidationFee) / 10000;
        
        // Update open interest
        if (pos.isLong) {
            totalLongOpenInterest -= pos.size;
        } else {
            totalShortOpenInterest -= pos.size;
        }
        
        // Delete position
        delete positions[user];
        
        // Pay liquidator
        IERC20(collateralToken).transfer(msg.sender, liqFee);
        
        emit PositionLiquidated(user, msg.sender, currentPrice);
    }
    
    /**
     * Update funding rate
     */
    function updateFundingRate(
        bytes[] calldata priceUpdateData
    ) public {
        if (block.timestamp < lastFundingTime + fundingRateInterval) {
            return; // Not time yet
        }
        
        // Get current price
        uint256 currentPrice = getCurrentPrice(priceUpdateData);
        
        // Calculate funding rate based on open interest imbalance
        int256 fundingRate = calculateFundingRate(currentPrice);
        
        // Update cumulative funding rate
        cumulativeFundingRate += fundingRate;
        lastFundingTime = block.timestamp;
        
        emit FundingRateUpdated(fundingRate, cumulativeFundingRate);
    }
    
    /**
     * Get current price from Pyth oracle
     */
    function getCurrentPrice(
        bytes[] calldata priceUpdateData
    ) public payable returns (uint256) {
        // Update price feeds
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        // Get price
        PythStructs.Price memory price = pyth.getPrice(priceId);
        
        // Convert to uint256 (price is int64)
        require(price.price > 0, "Invalid price");
        return uint256(uint64(price.price));
    }
    
    /**
     * Calculate PnL for a position
     */
    function calculatePnL(
        Position memory pos,
        uint256 currentPrice
    ) internal pure returns (int256) {
        int256 priceDiff;
        
        if (pos.isLong) {
            priceDiff = int256(currentPrice) - int256(pos.entryPrice);
        } else {
            priceDiff = int256(pos.entryPrice) - int256(currentPrice);
        }
        
        // PnL = (priceDiff / entryPrice) * size
        int256 pnl = (priceDiff * int256(pos.size)) / int256(pos.entryPrice);
        
        return pnl;
    }
    
    /**
     * Calculate funding payment
     */
    function calculateFundingPayment(
        Position memory pos
    ) internal view returns (int256) {
        int256 fundingRateDiff = cumulativeFundingRate - pos.entryFundingRate;
        
        // Longs pay when funding is positive, shorts pay when negative
        int256 payment = (fundingRateDiff * int256(pos.size)) / 1e18;
        
        return pos.isLong ? payment : -payment;
    }
    
    /**
     * Calculate funding rate based on OI imbalance
     */
    function calculateFundingRate(
        uint256 currentPrice
    ) internal view returns (int256) {
        if (totalLongOpenInterest == 0 && totalShortOpenInterest == 0) {
            return 0;
        }
        
        // Imbalance = (longOI - shortOI) / (longOI + shortOI)
        int256 imbalance = (
            int256(totalLongOpenInterest) - int256(totalShortOpenInterest)
        ) * 1e18 / int256(totalLongOpenInterest + totalShortOpenInterest);
        
        // Funding rate = imbalance * 0.01% (adjustable)
        int256 fundingRate = (imbalance * 10) / 10000;
        
        return fundingRate;
    }
    
    /**
     * Check if position should be liquidated
     */
    function shouldLiquidate(
        Position memory pos,
        uint256 currentPrice
    ) internal pure returns (bool) {
        int256 pnl = calculatePnL(pos, currentPrice);
        
        // Liquidate if loss >= 90% of collateral
        int256 maxLoss = -int256((pos.collateral * 90) / 100);
        
        return pnl <= maxLoss;
    }
    
    /**
     * Get position details
     */
    function getPosition(address user) external view returns (
        bool isLong,
        uint256 size,
        uint256 collateral,
        uint256 leverage,
        uint256 entryPrice,
        int256 entryFundingRate,
        uint256 timestamp
    ) {
        Position memory pos = positions[user];
        return (
            pos.isLong,
            pos.size,
            pos.collateral,
            pos.leverage,
            pos.entryPrice,
            pos.entryFundingRate,
            pos.timestamp
        );
    }
}
```

---

## ⏭️ NEXT STEPS

I've created the foundation! In the next message, I'll provide:

1. ✅ Frontend integration (React components)
2. ✅ Deployment scripts
3. ✅ Testing guide
4. ✅ Auto-market creation system

**This implementation guide is saved at:**
`c:\Users\BUNTY\Desktop\jeans factory\CUSTOM_PERPETUALS_IMPLEMENTATION.md`

Ready for the next part? 🚀
