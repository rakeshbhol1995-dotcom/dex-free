// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CloudToken
 * @dev DexFree Platform Token
 * Symbol: CLOUD
 * Total Supply: 1,000,000,000 (1 Billion)
 */
contract CloudToken is ERC20, Ownable {
    constructor() ERC20("Cloud Token", "CLOUD") Ownable(msg.sender) {
        // Mint 1 billion tokens to deployer
        _mint(msg.sender, 1_000_000_000 * 10**decimals());
    }

    /**
     * @dev Allows owner to mint additional tokens if needed
     * @param to Address to receive minted tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
