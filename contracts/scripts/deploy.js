const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy Factory
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(deployer.address);
    // await factory.waitForDeployment(); // Hardhat v6? No, ethers v6
    // Check ethers version. Hardhat toolbox 5 installs ethers v6.
    // In v6: await factory.waitForDeployment(); factory.target
    // In v5: await factory.deployed(); factory.address
    // I'll assume v6 based on "hardhat-toolbox 5".
    await factory.waitForDeployment();
    console.log("UniswapV2Factory deployed to:", factory.target);

    // 2. Deploy WETH
    const WETH = await ethers.getContractFactory("WETH");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();
    console.log("WETH deployed to:", weth.target);

    // 3. Deploy Router
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factory.target, weth.target);
    await router.waitForDeployment();
    console.log("UniswapV2Router02 deployed to:", router.target);

    // 4. Deploy 20 Mock Tokens
    const tokens = [
        { symbol: "USDT", name: "Tether USD" },
        { symbol: "USDC", name: "USD Coin" },
        { symbol: "DAI", name: "Dai Stablecoin" },
        { symbol: "WBTC", name: "Wrapped BTC" },
        { symbol: "LINK", name: "Chainlink" },
        { symbol: "UNI", name: "Uniswap" },
        { symbol: "AAVE", name: "Aave" },
        { symbol: "CRV", name: "Curve DAO" },
        { symbol: "SHIB", name: "Shiba Inu" },
        { symbol: "PEPE", name: "Pepe" },
        { symbol: "DOGE", name: "Dogecoin" },
        { symbol: "FLOKI", name: "Floki" },
        { symbol: "BONK", name: "Bonk" },
        { symbol: "SAND", name: "The Sandbox" },
        { symbol: "MANA", name: "Decentraland" },
        { symbol: "AXS", name: "Axie Infinity" },
        { symbol: "GALA", name: "Gala" },
        { symbol: "LDO", name: "Lido DAO" },
        { symbol: "GRT", name: "The Graph" },
        { symbol: "RENDER", name: "Render Token" }
    ];

    const deployedTokens = [];
    const MockERC20 = await ethers.getContractFactory("MockERC20");

    for (const t of tokens) {
        const token = await MockERC20.deploy(t.name, t.symbol);
        await token.waitForDeployment();
        console.log(`Deployed ${t.symbol} to ${token.target}`);
        deployedTokens.push({ symbol: t.symbol, address: token.target, contract: token });
    }

    // 5. Create Pairs & Add Liquidity
    console.log("\nCreating Pairs and Adding Liquidity...");
    const amountToken = ethers.parseEther("1000"); // 1000 Tokens
    const amountETH = ethers.parseEther("10");     // 10 ETH (MATIC)

    for (const t of deployedTokens) {
        // Approve Router
        await t.contract.approve(router.target, amountToken);

        // Add Liquidity
        // addLiquidityETH automatically creates the pair if it doesn't exist
        await router.addLiquidityETH(
            t.address,
            amountToken,
            0, // amountTokenMin
            0, // amountETHMin
            deployer.address,
            Math.floor(Date.now() / 1000) + 60 * 10, // 10 mins deadline
            { value: amountETH }
        );
        console.log(`Added liquidity for ${t.symbol}/WETH`);
    }

    console.log("\nLogging addresses to deployed_addresses.json...");
    const data = {
        factory: factory.target,
        router: router.target,
        weth: weth.target,
        tokens: deployedTokens.map(t => ({ symbol: t.symbol, address: t.address }))
    };

    fs.writeFileSync(
        path.join(__dirname, "../deployed_addresses.json"),
        JSON.stringify(data, null, 2)
    );
    console.log("Done!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
