# DexFree 100-Pair Deployment Guide

## 🎯 Overview
This guide walks you through deploying DexFree with 100 trading pairs using a tiered liquidity strategy.

## 📋 Prerequisites
- Hardhat node running (`npx hardhat node`)
- Sufficient ETH in deployer account (~5-10 ETH for local testing)

## 🚀 Deployment Steps

### Step 1: Run Initial Deployment
```bash
cd contracts
npx hardhat run scripts/deploy-100-pairs.js --network localhost
```

**Expected Output:**
- Factory, Router, WETH addresses
- **INIT_CODE_HASH** (CRITICAL - save this!)
- 100 tokens deployed
- Error on liquidity addition (expected on first run)

### Step 2: Update INIT_CODE_HASH

1. Copy the `INIT_CODE_HASH` from terminal output
2. Open `contracts/src/libraries/UniswapV2Library.sol`
3. Go to **line 23**
4. Replace the existing hash with your new hash:

**BEFORE:**
```solidity
hex'2ff03fefd45717069972b2f6e880bcbcddb2d0a3e05b05bf17066df038706d99' // init code hash
```

**AFTER:**
```solidity
hex'YOUR_NEW_INIT_CODE_HASH_HERE' // init code hash
```

### Step 3: Restart Hardhat Node
```bash
# Stop current node (Ctrl+C)
npx hardhat node
```

### Step 4: Re-run Deployment
```bash
npx hardhat run scripts/deploy-100-pairs.js --network localhost
```

**Expected Output:**
- ✅ All 100 tokens deployed
- ✅ All 100 pairs created
- ✅ Liquidity added successfully
- ✅ Files generated:
  - `frontend/src/config/tokenList.json`
  - `frontend/src/config/addresses.json`

## 📊 Liquidity Tiers

### Tier 1: Giants (5 tokens)
- **Tokens**: USDT, USDC, WBTC, DAI, LINK
- **Liquidity**: 0.1 ETH per pair (~₹20,000)
- **Token Amount**: 10,000 tokens

### Tier 2: Hot List (15 tokens)
- **Tokens**: SHIB, PEPE, DOGE, SOL, XRP, ADA, DOT, UNI, AVAX, LTC, NEAR, ATOM, TRX, ETC, FIL
- **Liquidity**: 0.033 ETH per pair (~₹6,600)
- **Token Amount**: 5,000 tokens

### Tier 3: Ecosystem (80 tokens)
- **Categories**: AI (15), GameFi (15), Metaverse (15), DeFi (15), NFT (10), DAO (10)
- **Liquidity**: 0.0125 ETH per pair (~₹2,500)
- **Token Amount**: 2,000 tokens

**Total ETH Required**: ~5 ETH

## 🔧 Frontend Integration

### Option 1: Automatic (Recommended)
The deployment script auto-generates `tokenList.json`. Just restart your frontend:

```bash
cd frontend
npm run dev
```

### Option 2: Manual Integration
If you want custom logic, use the utilities:

```typescript
// In your component
import { getAllTokens, searchTokens, getTrendingTokens } from '@/config/tokenUtils';

// Get all 100 tokens
const tokens = getAllTokens();

// Search functionality
const results = searchTokens('PEPE');

// Get trending (Tier 1 + Top Tier 2)
const trending = getTrendingTokens();
```

## 🎨 Advanced Features Included

### 1. **Smart Token Search**
- Search by symbol, name, or address
- Tier-based filtering
- Auto-import custom tokens

### 2. **Trending Section**
- Auto-populated from Tier 1 + Hot Tier 2
- Mock price changes (can connect to real oracle)
- "HOT" badges for popular tokens

### 3. **Popular Pairs**
- Pre-configured WMATIC pairs
- Quick swap suggestions
- Tier-based recommendations

### 4. **Scalable Architecture**
- Easy to add more tokens
- Configurable liquidity tiers
- Automated pair creation

## 🐛 Troubleshooting

### Issue: "Insufficient funds"
**Solution**: Ensure deployer has at least 10 ETH on local network

### Issue: "Pair already exists"
**Solution**: Restart Hardhat node to reset state

### Issue: "INIT_CODE_HASH mismatch"
**Solution**: Double-check you updated line 23 in UniswapV2Library.sol

### Issue: "Transaction reverted"
**Solution**: Check gas limits and ensure Router has token approvals

## 📈 Next Steps

1. **Test Swaps**: Try swapping between different tier tokens
2. **Add Analytics**: Track volume, TVL per tier
3. **Price Feeds**: Integrate Chainlink oracles for real prices
4. **Liquidity Mining**: Add rewards for liquidity providers
5. **Governance**: Deploy DAO for protocol upgrades

## 🎉 Success Criteria

- ✅ 100 tokens deployed
- ✅ 100 pairs created
- ✅ All pairs have liquidity
- ✅ Frontend shows all tokens
- ✅ Swaps execute successfully
- ✅ 0% fees confirmed

## 📞 Support

If you encounter issues:
1. Check Hardhat console for errors
2. Verify INIT_CODE_HASH is correct
3. Ensure sufficient ETH balance
4. Restart both Hardhat node and frontend

---

**Built with ❤️ for DexFree - The 0% Fee Revolution**
