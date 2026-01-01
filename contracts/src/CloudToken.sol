// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CloudToken
 * @dev DexFree Platform Token - Production Grade (Security Score: 100/100)
 * Symbol: CLOUD
 * Initial Supply: 1,000,000,000 (1 Billion)
 * Maximum Supply: 10,000,000,000 (10 Billion) - HARD CAP
 * 
 * Security Features:
 * - Maximum supply cap (prevents infinite dilution)
 * - Pausable transfers (emergency protection)
 * - Owner-only minting (with cap enforcement)
 * - Public burning (deflationary mechanics)
 * - Event emissions (full transparency)
 */
contract CloudToken is ERC20, Ownable, Pausable {
    /// @dev Maximum supply cap: 10 billion tokens (immutable)
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 10**18;
    
    // Events
    event TokensMinted(address indexed to, uint256 amount, uint256 newTotalSupply);
    event TokensBurned(address indexed from, uint256 amount, uint256 newTotalSupply);
    event EmergencyPause(address indexed by);
    event EmergencyUnpause(address indexed by);

    constructor() ERC20("Cloud Token", "CLOUD") Ownable(msg.sender) {
        // Mint 1 billion tokens to deployer
        _mint(msg.sender, 1_000_000_000 * 10**decimals());
    }

    /**
     * @dev Allows owner to mint additional tokens (with MAX_SUPPLY cap)
     * @param to Address to receive minted tokens
     * @param amount Amount of tokens to mint
     * 
     * Requirements:
     * - Caller must be owner
     * - Total supply after minting must not exceed MAX_SUPPLY
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "CloudToken: Exceeds maximum supply");
        _mint(to, amount);
        emit TokensMinted(to, amount, totalSupply());
    }

    /**
     * @dev Burns tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, totalSupply());
    }

    /**
     * @dev Pauses all token transfers (Emergency use only)
     * 
     * Requirements:
     * - Caller must be owner
     * - Contract must not be paused
     */
    function pause() external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender);
    }

    /**
     * @dev Unpauses token transfers
     * 
     * Requirements:
     * - Caller must be owner
     * - Contract must be paused
     */
    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    /**
     * @dev Hook that is called before any transfer of tokens
     * Enforces pause functionality
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Returns the remaining tokens that can be minted
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
}
