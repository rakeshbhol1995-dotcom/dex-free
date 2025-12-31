// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title FairLaunchToken
 * @dev ERC20 token created through the FairLaunch platform
 * @notice This token can only be minted by the FairLaunch contract
 */
contract FairLaunchToken is ERC20, Ownable {
    /**
     * @dev Constructor for FairLaunchToken
     * @param name Token name
     * @param symbol Token symbol
     * @param _owner Owner address (FairLaunch contract)
     */
    constructor(string memory name, string memory symbol, address _owner) ERC20(name, symbol) Ownable(_owner) {}

    /**
     * @dev Mints tokens to specified address
     * @param to Recipient address
     * @param amount Amount to mint
     * @notice Only callable by owner (FairLaunch contract)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

/**
 * @title FairLaunch
 * @dev Bonding curve token launchpad with automated graduation to Uniswap
 * @notice Creates fair launch tokens with bonding curve pricing and automatic DEX listing
 * @custom:security-contact security@dexfree.io
 */
contract FairLaunch is Ownable, ReentrancyGuard, Pausable {
    struct TokenInfo {
        address tokenAddress;
        string name;
        string symbol;
        address creator;
        uint256 fundingRaised;
        uint256 tokenReserve;
        uint256 ethReserve; 
        bool graduated;
        bool isPremium;
        bool burnLp; 
        uint256 lockDuration;
        uint256 lpUnlockTime;
        uint256 maxWalletPercent;
        uint256 creatorLpBalance; // Track creator's LP tokens
    }

    mapping(address => TokenInfo) public tokens;
    mapping(address => uint256) public lastBuyTime; // Flash loan protection
    mapping(address => uint256) public pendingFees; // Pull pattern for fees
    
    address[] public allTokens;
    uint256 public constant MAX_TOKENS = 10000; // Prevent unbounded array
    
    // Constants & Config
    uint256 public constant FEE_BPS = 20; // 0.2% Protocol Fee
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant INITIAL_VIRTUAL_TOKEN_RES = 1_073_000_000 * 10**18;
    uint256 public constant FUNDING_GOAL = 30 ether;
    uint256 public constant COOLDOWN_PERIOD = 2 minutes; // Flash loan protection
    uint256 public constant MAX_BUY_AMOUNT = 10 ether; // Prevent manipulation
    
    // Addresses
    address public uniswapRouter;
    address public feeTo;
    AggregatorV3Interface internal priceFeed;

    /// @notice Emitted when a new token is created
    event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, bool isPremium, bool burnLp, uint256 lockDuration, uint256 maxWalletPercent);
    
    /// @notice Emitted when tokens are purchased
    event TokensBought(address indexed tokenAddress, address indexed buyer, uint256 amountIn, uint256 tokensOut);
    
    /// @notice Emitted when tokens are sold
    event TokensSold(address indexed tokenAddress, address indexed seller, uint256 tokensIn, uint256 amountOut);
    
    /// @notice Emitted when a token graduates to Uniswap
    event Graduated(address indexed tokenAddress, address indexed pair, uint256 liquidityAmount, uint256 unlockTime);
    
    /// @notice Emitted when LP tokens are withdrawn
    event LpWithdrawn(address indexed tokenAddress, address indexed creator, uint256 amount);
    
    /// @notice Emitted when premium services are unlocked
    event PremiumServicesUnlocked(address indexed tokenAddress, string serviceType);
    
    /// @notice Emitted when fees are withdrawn
    event FeeWithdrawn(address indexed recipient, uint256 amount);
    
    /// @notice Emitted during emergency withdrawals
    event EmergencyWithdraw(address indexed token, address indexed recipient, uint256 amount);
    
    /// @notice Emitted when contract is paused
    event ContractPaused(address indexed by);
    
    /// @notice Emitted when contract is unpaused
    event ContractUnpaused(address indexed by);
    
    /// @notice Emitted when router address is updated
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    
    /// @notice Emitted when fee recipient is updated
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    constructor(address _router, address _feeTo, address _priceFeed) Ownable(msg.sender) {
        require(_router != address(0), "Invalid router");
        require(_feeTo != address(0), "Invalid fee recipient");
        uniswapRouter = _router;
        feeTo = _feeTo;
        if (_priceFeed != address(0)) {
            priceFeed = AggregatorV3Interface(_priceFeed);
        }
    }

    // 1. Create Token
    function createToken(
        string memory name, 
        string memory symbol, 
        bool _isPremium, 
        bool _burnLp, 
        uint256 _lockDuration, 
        uint256 _maxWalletPercent
    ) external payable nonReentrant whenNotPaused {
        // Input validation
        require(bytes(name).length > 0 && bytes(name).length <= 50, "Invalid name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Invalid symbol length");
        require(allTokens.length < MAX_TOKENS, "Too many tokens");
        require(_maxWalletPercent >= 50 && _maxWalletPercent <= 10000, "Max Wallet invalid (0.5% - 100%)");
        
        FairLaunchToken newToken = new FairLaunchToken(name, symbol, address(this));
        newToken.mint(address(this), TOTAL_SUPPLY);

        tokens[address(newToken)] = TokenInfo({
            tokenAddress: address(newToken),
            name: name,
            symbol: symbol,
            creator: msg.sender,
            fundingRaised: 0,
            tokenReserve: INITIAL_VIRTUAL_TOKEN_RES,
            ethReserve: 30 ether,
            graduated: false,
            isPremium: _isPremium,
            burnLp: _burnLp,
            lockDuration: _lockDuration,
            lpUnlockTime: 0,
            maxWalletPercent: _maxWalletPercent,
            creatorLpBalance: 0
        });
        
        allTokens.push(address(newToken));
        emit TokenCreated(address(newToken), msg.sender, name, symbol, _isPremium, _burnLp, _lockDuration, _maxWalletPercent);
        
        if (_isPremium) {
            emit PremiumServicesUnlocked(address(newToken), "INIT_MARKETING");
        }

        // Initial buy if ETH sent
        if (msg.value > 0) {
            _buyTokens(address(newToken), 0, msg.sender, msg.value);
        }
    }

    // 2. Buy Tokens with Flash Loan Protection
    function buyTokens(address tokenAddress, uint256 minTokensOut) external payable nonReentrant whenNotPaused {
        _buyTokens(tokenAddress, minTokensOut, msg.sender, msg.value);
    }

    function _buyTokens(address tokenAddress, uint256 minTokensOut, address buyer, uint256 msgValue) internal {
        TokenInfo storage token = tokens[tokenAddress];
        require(!token.graduated, "Token has graduated");
        require(msgValue > 0, "No ETH sent");
        require(msgValue <= MAX_BUY_AMOUNT, "Amount too large");
        
        // Flash loan protection - cooldown period
        require(block.timestamp >= lastBuyTime[buyer] + COOLDOWN_PERIOD, "Cooldown active");
        lastBuyTime[buyer] = block.timestamp;

        uint256 fee = (msgValue * FEE_BPS) / 10000;
        uint256 amountIn = msgValue - fee;
        
        // AMM calculation with overflow protection
        uint256 numerator = token.tokenReserve * amountIn;
        uint256 denominator = token.ethReserve + amountIn;
        require(denominator > 0, "Invalid calculation");
        uint256 tokensOut = numerator / denominator;
        
        require(tokensOut >= minTokensOut, "Slippage too high");
        require(token.tokenReserve > tokensOut + (100 * 10**18), "Reserve limit reached");

        // Max wallet check
        FairLaunchToken t = FairLaunchToken(tokenAddress);
        uint256 buyerBalance = t.balanceOf(buyer);
        uint256 maxWalletAmount = (TOTAL_SUPPLY * token.maxWalletPercent) / 10000;
        require(buyerBalance + tokensOut <= maxWalletAmount, "Exceeds Max Wallet Limit");

        // Update reserves
        token.ethReserve += amountIn;
        token.tokenReserve -= tokensOut;
        token.fundingRaised += amountIn;

        // Collect fee (pull pattern)
        pendingFees[feeTo] += fee;

        // Transfer tokens
        t.transfer(buyer, tokensOut);
        
        emit TokensBought(tokenAddress, buyer, msgValue, tokensOut);

        // Check for graduation (but don't auto-graduate)
        if (token.fundingRaised >= FUNDING_GOAL) {
            emit PremiumServicesUnlocked(tokenAddress, "READY_TO_GRADUATE");
        }
    }

    // 3. Sell Tokens
    function sellTokens(address tokenAddress, uint256 tokenAmount, uint256 minEthOut) external nonReentrant whenNotPaused {
        TokenInfo storage token = tokens[tokenAddress];
        require(!token.graduated, "Token has graduated");
        require(tokenAmount > 0, "Amount must be > 0");

        FairLaunchToken t = FairLaunchToken(tokenAddress);
        require(t.balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");

        // AMM calculation
        uint256 numerator = token.ethReserve * tokenAmount;
        uint256 denominator = token.tokenReserve + tokenAmount;
        require(denominator > 0, "Invalid calculation");
        uint256 ethOut = numerator / denominator;
        
        uint256 fee = (ethOut * FEE_BPS) / 10000;
        uint256 amountOut = ethOut - fee;

        require(amountOut >= minEthOut, "Slippage too high");
        require(address(this).balance >= amountOut, "Contract low on liquidity");

        // Update reserves
        token.tokenReserve += tokenAmount;
        token.ethReserve -= ethOut;
        token.fundingRaised -= ethOut;

        // Transfer tokens in
        t.transferFrom(msg.sender, address(this), tokenAmount);

        // Collect fee
        pendingFees[feeTo] += fee;

        // Transfer ETH out
        (bool success, ) = payable(msg.sender).call{value: amountOut}("");
        require(success, "ETH transfer failed");

        emit TokensSold(tokenAddress, msg.sender, tokenAmount, amountOut);
    }

    // 4. Manual Graduation (Prevents Frontrunning)
    function graduate(address tokenAddress) external nonReentrant whenNotPaused {
        TokenInfo storage token = tokens[tokenAddress];
        require(msg.sender == token.creator, "Only creator can graduate");
        require(!token.graduated, "Already graduated");
        require(token.fundingRaised >= FUNDING_GOAL, "Funding goal not reached");
        
        _graduate(tokenAddress);
    }

    function _graduate(address tokenAddress) internal {
        TokenInfo storage token = tokens[tokenAddress];
        token.graduated = true;
        
        FairLaunchToken t = FairLaunchToken(tokenAddress);
        uint256 tokenBal = t.balanceOf(address(this));
        uint256 ethBal = address(this).balance; 

        // Dynamic creator reward with bounds
        uint256 rewardAmount = getDynamicRewardAmount();
        rewardAmount = rewardAmount > 0.1 ether ? 0.1 ether : rewardAmount; // Max 0.1 ETH
        rewardAmount = rewardAmount < 0.01 ether ? 0.01 ether : rewardAmount; // Min 0.01 ETH
        
        if (ethBal >= rewardAmount) {
            ethBal -= rewardAmount;
            (bool rewardSuccess, ) = payable(token.creator).call{value: rewardAmount}("");
            require(rewardSuccess, "Reward Transfer Failed");
        }
        
        uint256 liquidityEth = ethBal > token.fundingRaised ? token.fundingRaised : ethBal; 

        // Premium fee
        if (token.isPremium) {
            uint256 premiumFee = (token.fundingRaised * 5) / 100;
            if (liquidityEth >= premiumFee) {
                liquidityEth -= premiumFee;
                pendingFees[feeTo] += premiumFee;
                emit PremiumServicesUnlocked(tokenAddress, "FULL_SUITE_ACTIVATED");
            }
        }

        t.approve(uniswapRouter, tokenBal);

        address lpReceiver;
        if (token.burnLp) {
            lpReceiver = address(0x000000000000000000000000000000000000dEaD);
        } else {
            lpReceiver = address(this);
            token.lpUnlockTime = block.timestamp + token.lockDuration;
        }

        // Reduced slippage to 1%
        uint256 minTokenLiquidity = (tokenBal * 99) / 100;
        uint256 minEthLiquidity = (liquidityEth * 99) / 100;

        // Add liquidity
        (,, uint256 liquidity) = IUniswapV2Router02(uniswapRouter).addLiquidityETH{value: liquidityEth}(
            tokenAddress,
            tokenBal,
            minTokenLiquidity,
            minEthLiquidity,
            lpReceiver, 
            block.timestamp
        );

        // Track LP balance for creator
        if (!token.burnLp) {
            token.creatorLpBalance = liquidity;
        }

        emit Graduated(tokenAddress, lpReceiver, liquidityEth, token.lpUnlockTime);
    }

    function getDynamicRewardAmount() public view returns (uint256) {
        if (address(priceFeed) == address(0)) {
            return 0.02 ether; // Fallback
        }

        try priceFeed.latestRoundData() returns (
            uint80 roundId, 
            int256 price, 
            uint256, 
            uint256 updatedAt, 
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid Oracle Price");
            require(block.timestamp - updatedAt <= 3600, "Price too old"); // 1 hour staleness check
            require(answeredInRound >= roundId, "Stale price");
            
            uint256 ethPrice = uint256(price);
            require(ethPrice >= 100 * 10**8 && ethPrice <= 100000 * 10**8, "ETH price out of bounds");
            
            uint256 rewardEth = (70 * 10**26) / ethPrice;
            
            // Bounds check
            if (rewardEth > 0.1 ether) return 0.1 ether;
            if (rewardEth < 0.01 ether) return 0.01 ether;
            
            return rewardEth;
        } catch {
            return 0.02 ether;
        }
    }

    // 5. Withdraw LP (Fixed - Per Creator Tracking)
    function withdrawLp(address tokenAddress) external nonReentrant {
        TokenInfo storage token = tokens[tokenAddress];
        require(msg.sender == token.creator, "Only creator can withdraw");
        require(!token.burnLp, "Liquidity was burned");
        require(token.graduated, "Token not graduated");
        require(block.timestamp >= token.lpUnlockTime, "Liquidity is still locked");
        require(token.creatorLpBalance > 0, "No LP to withdraw");

        address pairAddress = IUniswapV2Factory(IUniswapV2Router02(uniswapRouter).factory())
            .getPair(tokenAddress, IUniswapV2Router02(uniswapRouter).WETH());
        require(pairAddress != address(0), "Pair not found");

        IERC20 lpToken = IERC20(pairAddress);
        uint256 balance = token.creatorLpBalance;
        token.creatorLpBalance = 0;

        require(lpToken.transfer(msg.sender, balance), "LP transfer failed");
        
        emit LpWithdrawn(tokenAddress, msg.sender, balance);
    }

    // 6. Withdraw Fees (Pull Pattern)
    function withdrawFees() external nonReentrant {
        uint256 amount = pendingFees[msg.sender];
        require(amount > 0, "No fees to withdraw");
        
        pendingFees[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Fee withdrawal failed");
        
        emit FeeWithdrawn(msg.sender, amount);
    }

    // 7. Emergency Functions
    /**
     * @dev Pauses all token trading
     * @notice Only callable by owner in emergency situations
     */
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }

    /**
     * @dev Unpauses token trading
     * @notice Only callable by owner
     */
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @dev Updates the Uniswap router address
     * @param newRouter New router address
     * @notice Only callable by owner
     */
    function updateRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        address oldRouter = uniswapRouter;
        uniswapRouter = newRouter;
        emit RouterUpdated(oldRouter, newRouter);
    }
    
    /**
     * @dev Updates the fee recipient address
     * @param newFeeRecipient New fee recipient address
     * @notice Only callable by owner
     */
    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid recipient");
        address oldRecipient = feeTo;
        feeTo = newFeeRecipient;
        emit FeeRecipientUpdated(oldRecipient, newFeeRecipient);
    }

    function emergencyWithdrawToken(address token, address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).transfer(recipient, amount);
        emit EmergencyWithdraw(token, recipient, amount);
    }

    function emergencyWithdrawETH(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH withdrawal failed");
        emit EmergencyWithdraw(address(0), recipient, amount);
    }

    // 8. View Functions
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    receive() external payable {}
}
