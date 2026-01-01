// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title LPPool
 * @dev Manages liquidity for custom perpetual markets with ZERO admin risk.
 *      Admin takes 30% fee, LPs take 100% risk and earn 70% fees.
 */
contract LPPool is Ownable, ReentrancyGuard {
    
    // --- State Variables ---
    IERC20 public usdc;
    IPyth public pyth;
    
    struct Position {
        address trader;
        bytes32 marketId; // Token Symbol Hash
        bool isLong;
        uint256 size;     // Position size in USDC
        uint256 collateral; 
        uint256 entryPrice;
        uint256 leverage;
        uint256 timestamp;
    }

    mapping(bytes32 => uint256) public marketOpenInterestLong;
    mapping(bytes32 => uint256) public marketOpenInterestShort;
    mapping(bytes32 => uint256) public marketMaxOpenInterest; // Golden Ratio Limit
    
    uint256 public totalLiquidity;
    uint256 public constant MIN_COLLATERAL = 10 * 1e6; // $10 USDC
    uint256 public constant MAX_LEVERAGE = 50; 
    
    // Fee Split
    uint256 public constant PROTOCOL_FEE_BPS = 3000; // 30%
    uint256 public constant LP_FEE_BPS = 7000;       // 70%
    address public protocolFeeVault;

    mapping(bytes32 => Position) public positions; // Simplified for demo (key = positionId)

    // --- Events ---
    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed provider, uint256 amount);
    event PositionOpened(bytes32 indexed positionId, address indexed trader, bytes32 marketId, bool isLong, uint256 size, uint256 price);
    event PositionClosed(bytes32 indexed positionId, address indexed trader, int256 pnl, uint256 fee);

    constructor(address _usdc, address _pyth, address _feeVault) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        pyth = IPyth(_pyth);
        protocolFeeVault = _feeVault;
    }

    // --- LP Functions ---
    
    function addLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        totalLiquidity += amount;
        // Mint LP tokens logic here (Simplified: direct accounting)
        
        emit LiquidityAdded(msg.sender, amount);
    }

    // --- Trading Functions ---

    function openPosition(
        bytes32 marketId,
        bool isLong,
        uint256 collateral,
        uint256 leverage,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        require(leverage <= MAX_LEVERAGE, "Max leverage exceeded");
        require(collateral >= MIN_COLLATERAL, "Min collateral required");
        
        uint256 positionSize = collateral * leverage;
        
        // 1. Update Oracle Price
        uint256 updateFee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: updateFee}(priceUpdateData);
        
        // 2. Get Price
        // Assuming marketId maps to Pyth Price ID in a real registry
        // PythStructs.Price memory price = pyth.getPrice(marketId);
        // uint256 currentPrice = uint256(int256(price.price)); 
        uint256 currentPrice = 1000 * 1e8; // Mock price for compilation without full Pyth registry
        
        // 3. Golden Ratio Check (Crucial for Zero Risk)
        if (isLong) {
            require(marketOpenInterestLong[marketId] + positionSize <= marketMaxOpenInterest[marketId], "Golden Ratio: Max Long OI Reached");
            marketOpenInterestLong[marketId] += positionSize;
        } else {
            require(marketOpenInterestShort[marketId] + positionSize <= marketMaxOpenInterest[marketId], "Golden Ratio: Max Short OI Reached");
            marketOpenInterestShort[marketId] += positionSize;
        }

        // 4. Transfer Collateral
        require(usdc.transferFrom(msg.sender, address(this), collateral), "Transfer failed");

        // 5. Create Position
        bytes32 positionId = keccak256(abi.encodePacked(msg.sender, marketId, block.timestamp));
        positions[positionId] = Position({
            trader: msg.sender,
            marketId: marketId,
            isLong: isLong,
            size: positionSize,
            collateral: collateral,
            entryPrice: currentPrice,
            leverage: leverage,
            timestamp: block.timestamp
        });

        emit PositionOpened(positionId, msg.sender, marketId, isLong, positionSize, currentPrice);
    }

    // --- Admin Functions ---

    function setMaxOpenInterest(bytes32 marketId, uint256 limit) external onlyOwner {
        // This is updated dynamically by the Golden Ratio Monitor backend
        marketMaxOpenInterest[marketId] = limit;
    }
}
