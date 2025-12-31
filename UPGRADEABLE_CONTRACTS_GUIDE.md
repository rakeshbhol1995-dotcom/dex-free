# 🔄 Upgradeable Smart Contracts Guide

## ସମସ୍ୟା (Problem)

Smart contracts ଥରେ deploy ହେଲେ **immutable** (ବଦଳାଯାଇପାରିବ ନାହିଁ):
- ❌ Bug fix କରିପାରିବ ନାହିଁ
- ❌ New features add କରିପାରିବ ନାହିଁ  
- ❌ Logic update କରିପାରିବ ନାହିଁ

## ସମାଧାନ (Solution)

**Proxy Pattern** ବ୍ୟବହାର କରନ୍ତୁ:

```
User → Proxy Contract (ଠିକଣା ସ୍ଥିର) → Implementation Contract (ବଦଳାଯାଇପାରିବ)
```

---

## 📦 Setup

### 1. Install Dependencies

```bash
npm install --save-dev @openzeppelin/hardhat-upgrades
npm install @openzeppelin/contracts-upgradeable
```

### 2. Update hardhat.config.js

```javascript
require("@openzeppelin/hardhat-upgrades");

module.exports = {
  solidity: "0.8.20",
  // ... other config
};
```

---

## 🏗️ How It Works

### Architecture

```
┌─────────────────┐
│  Proxy Contract │  ← Users interact here (address never changes)
│  (Storage)      │
└────────┬────────┘
         │ delegatecall
         ↓
┌─────────────────┐
│ Implementation  │  ← Logic lives here (can be upgraded)
│ Contract V1     │
└─────────────────┘
         ↓ upgrade
┌─────────────────┐
│ Implementation  │  ← New logic (same storage)
│ Contract V2     │
└─────────────────┘
```

### Key Points

1. **Proxy**: Stores data, delegates calls to implementation
2. **Implementation**: Contains logic, no storage
3. **Admin**: Controls upgrades
4. **Users**: Always interact with proxy address

---

## 📝 Creating Upgradeable Contracts

### V1 Contract

```solidity
// LaunchpadV1.sol
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract LaunchpadV1 is Initializable, OwnableUpgradeable {
    uint256 public saleCounter;
    mapping(uint256 => Sale) public sales;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    // Use initialize() instead of constructor
    function initialize() public initializer {
        __Ownable_init();
        saleCounter = 0;
    }
    
    function createSale(...) external {
        // Logic
    }
    
    // Reserve storage slots for future versions
    uint256[50] private __gap;
}
```

### V2 Contract (Upgraded)

```solidity
// LaunchpadV2.sol
contract LaunchpadV2 is LaunchpadV1 {
    // New state variables (add at the end!)
    mapping(uint256 => bool) public saleVerified;
    
    // New functions
    function verifySale(uint256 _saleId) external onlyOwner {
        saleVerified[_saleId] = true;
    }
    
    // Can override existing functions
    function createSale(...) external override {
        // Enhanced logic
        super.createSale(...);
    }
}
```

---

## 🚀 Deployment

### Deploy V1

```bash
npx hardhat run scripts/deploy-upgradeable-launchpad.js --network base
```

**Output:**
```
Proxy Address:          0x1234... ← Users use this
Implementation Address: 0x5678... ← Logic contract
Admin Address:          0x9abc... ← Upgrade controller
```

### Upgrade to V2

```bash
npx hardhat run scripts/upgrade-launchpad.js --network base
```

**Result:**
- ✅ Proxy address stays same (0x1234...)
- ✅ All data preserved
- ✅ New functions available
- ✅ Users don't need to do anything!

---

## ⚠️ Important Rules

### ✅ DO

1. **Add new variables at the end**
   ```solidity
   // V1
   uint256 public saleCounter;
   
   // V2 - ✅ Correct
   uint256 public saleCounter;
   uint256 public newVariable; // Added at end
   ```

2. **Use `__gap` for future storage**
   ```solidity
   uint256[50] private __gap; // Reserve 50 slots
   ```

3. **Inherit from previous version**
   ```solidity
   contract LaunchpadV2 is LaunchpadV1 { }
   ```

### ❌ DON'T

1. **Change variable order**
   ```solidity
   // V1
   uint256 public saleCounter;
   address public owner;
   
   // V2 - ❌ WRONG!
   address public owner;      // Swapped order
   uint256 public saleCounter;
   ```

2. **Change variable types**
   ```solidity
   // V1
   uint256 public saleCounter;
   
   // V2 - ❌ WRONG!
   uint128 public saleCounter; // Changed type
   ```

3. **Remove variables**
   ```solidity
   // V1
   uint256 public saleCounter;
   uint256 public oldVariable;
   
   // V2 - ❌ WRONG!
   uint256 public saleCounter;
   // oldVariable removed - breaks storage!
   ```

---

## 🔒 Security Considerations

### Proxy Admin

The proxy admin can upgrade the contract:

```solidity
// Only admin can upgrade
function upgradeTo(address newImplementation) external;
```

**Best Practices:**
- Use a multisig wallet as admin
- Implement timelock for upgrades
- Test upgrades on testnet first

### Storage Collisions

Always use `__gap` to prevent storage collisions:

```solidity
// V1
uint256[50] private __gap; // 50 slots reserved

// V2 - use 1 slot, 49 remaining
uint256 public newVariable;
uint256[49] private __gap; // 49 slots left
```

---

## 🧪 Testing Upgrades

```javascript
const { upgrades } = require("hardhat");

describe("Launchpad Upgrade", function() {
  it("Should upgrade from V1 to V2", async function() {
    // Deploy V1
    const V1 = await ethers.getContractFactory("LaunchpadV1");
    const proxy = await upgrades.deployProxy(V1, [args]);
    
    // Create a sale in V1
    await proxy.createSale(...);
    const saleCounter = await proxy.saleCounter();
    
    // Upgrade to V2
    const V2 = await ethers.getContractFactory("LaunchpadV2");
    const upgraded = await upgrades.upgradeProxy(proxy.address, V2);
    
    // Verify data preserved
    expect(await upgraded.saleCounter()).to.equal(saleCounter);
    
    // Test new function
    await upgraded.verifySale(0);
    expect(await upgraded.saleVerified(0)).to.be.true;
  });
});
```

---

## 📊 Comparison

| Feature | Non-Upgradeable | Upgradeable |
|---------|----------------|-------------|
| **Simplicity** | ✅ Simple | ❌ Complex |
| **Security** | ✅ Immutable | ⚠️ Admin risk |
| **Bug Fixes** | ❌ Impossible | ✅ Possible |
| **New Features** | ❌ Redeploy | ✅ Upgrade |
| **Gas Cost** | ✅ Lower | ❌ Higher |
| **User Impact** | ❌ Must migrate | ✅ Seamless |

---

## 💡 Recommendations

### For Launchpad/IDO:

1. **Token Contracts** → Non-upgradeable
   - Security critical
   - Simple logic
   - Trust important

2. **Launchpad Logic** → Upgradeable
   - Complex features
   - May need fixes
   - Can add features

3. **Fee Manager** → Upgradeable
   - May adjust fees
   - Add new payment methods

---

## 🔗 Resources

- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins)
- [Proxy Patterns](https://docs.openzeppelin.com/contracts/4.x/api/proxy)
- [Writing Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)

---

## 📞 Quick Commands

```bash
# Deploy V1
npx hardhat run scripts/deploy-upgradeable-launchpad.js --network base

# Upgrade to V2
npx hardhat run scripts/upgrade-launchpad.js --network base

# Verify on Basescan
npx hardhat verify --network base PROXY_ADDRESS

# Test upgrades
npx hardhat test test/LaunchpadUpgrade.test.js
```

---

**ମନେରଖ (Remember):**
- ✅ Proxy address = Users interact here
- ✅ Implementation = Logic (upgradeable)
- ✅ Storage layout = Must be compatible
- ✅ Test before mainnet!
