const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * DexFree Advanced Deployment Script
 * Deploys 100 Trading Pairs with Tiered Liquidity Strategy
 * 
 * Tier 1 (Giants): 5 tokens - ₹20,000 liquidity each
 * Tier 2 (Hot List): 15 tokens - ₹6,600 liquidity each  
 * Tier 3 (Ecosystem): 80 tokens - ₹2,500 liquidity each
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 DexFree Mass Deployment Started");
    console.log("📍 Deployer Address:", deployer.address);
    console.log("💰 Deployer Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ============================================
    // STEP A: Deploy Core Contracts
    // ============================================
    console.log("📦 STEP A: Deploying Core Contracts...\n");

    // 1. Deploy Factory
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(deployer.address);
    await factory.waitForDeployment();
    console.log("✅ UniswapV2Factory deployed to:", factory.target);

    // 2. Calculate INIT_CODE_HASH
    const Pair = await ethers.getContractFactory("UniswapV2Pair");
    const initCodeHash = ethers.keccak256(Pair.bytecode);
    console.log("\n🔑 INIT_CODE_HASH:", initCodeHash);
    console.log("⚠️  CRITICAL: Update UniswapV2Library.sol line 23 with this hash!\n");

    // 3. Deploy WETH (Mock MATIC)
    const WETH = await ethers.getContractFactory("WETH");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();
    console.log("✅ WETH (Mock MATIC) deployed to:", weth.target);

    // 4. Deploy Router
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factory.target, weth.target);
    await router.waitForDeployment();
    console.log("✅ UniswapV2Router02 deployed to:", router.target);

    // ============================================
    // STEP B: Deploy 100 Tokens (Tiered)
    // ============================================
    console.log("\n📦 STEP B: Deploying 100 Tokens...\n");

    // Tier 1: The Giants (5 tokens)
    const tier1Tokens = [
        { symbol: "USDT", name: "Tether USD", tier: 1 },
        { symbol: "USDC", name: "USD Coin", tier: 1 },
        { symbol: "WBTC", name: "Wrapped Bitcoin", tier: 1 },
        { symbol: "DAI", name: "Dai Stablecoin", tier: 1 },
        { symbol: "LINK", name: "Chainlink", tier: 1 }
    ];

    // Tier 2: The Hot List (15 tokens)
    const tier2Tokens = [
        { symbol: "SHIB", name: "Shiba Inu", tier: 2 },
        { symbol: "PEPE", name: "Pepe", tier: 2 },
        { symbol: "DOGE", name: "Dogecoin", tier: 2 },
        { symbol: "SOL", name: "Solana", tier: 2 },
        { symbol: "XRP", name: "Ripple", tier: 2 },
        { symbol: "ADA", name: "Cardano", tier: 2 },
        { symbol: "DOT", name: "Polkadot", tier: 2 },
        { symbol: "UNI", name: "Uniswap", tier: 2 },
        { symbol: "AVAX", name: "Avalanche", tier: 2 },
        { symbol: "LTC", name: "Litecoin", tier: 2 },
        { symbol: "NEAR", name: "NEAR Protocol", tier: 2 },
        { symbol: "ATOM", name: "Cosmos", tier: 2 },
        { symbol: "TRX", name: "TRON", tier: 2 },
        { symbol: "ETC", name: "Ethereum Classic", tier: 2 },
        { symbol: "FIL", name: "Filecoin", tier: 2 }
    ];

    // Tier 3: The Ecosystem (80 tokens)
    const tier3Tokens = [];
    const categories = [
        { prefix: "AI", count: 15, name: "AI Token" },
        { prefix: "GAME", count: 15, name: "GameFi Token" },
        { prefix: "META", count: 15, name: "Metaverse Token" },
        { prefix: "DEFI", count: 15, name: "DeFi Token" },
        { prefix: "NFT", count: 10, name: "NFT Token" },
        { prefix: "DAO", count: 10, name: "DAO Token" }
    ];

    for (const cat of categories) {
        for (let i = 1; i <= cat.count; i++) {
            tier3Tokens.push({
                symbol: `${cat.prefix}${i}`,
                name: `${cat.name} ${i}`,
                tier: 3
            });
        }
    }

    // Combine all tokens
    const allTokens = [...tier1Tokens, ...tier2Tokens, ...tier3Tokens];
    console.log(`📊 Total Tokens to Deploy: ${allTokens.length}`);
    console.log(`   Tier 1 (Giants): ${tier1Tokens.length}`);
    console.log(`   Tier 2 (Hot List): ${tier2Tokens.length}`);
    console.log(`   Tier 3 (Ecosystem): ${tier3Tokens.length}\n`);

    // Deploy all tokens
    const deployedTokens = [];
    const MockERC20 = await ethers.getContractFactory("MockERC20");

    console.log("🔄 Deploying tokens...");
    for (let i = 0; i < allTokens.length; i++) {
        const t = allTokens[i];
        const token = await MockERC20.deploy(t.name, t.symbol);
        await token.waitForDeployment();

        deployedTokens.push({
            symbol: t.symbol,
            name: t.name,
            address: token.target,
            tier: t.tier,
            contract: token
        });

        if ((i + 1) % 10 === 0) {
            console.log(`   ✓ Deployed ${i + 1}/${allTokens.length} tokens...`);
        }
    }
    console.log(`✅ All ${deployedTokens.length} tokens deployed!\n`);

    // ============================================
    // STEP C: Add Liquidity (Tiered Budget)
    // ============================================
    console.log("📦 STEP C: Adding Liquidity with Tiered Strategy...\n");

    // Liquidity amounts based on tier
    // Simulating INR values: 1 ETH ≈ ₹200,000
    // Tier 1: ₹20,000 = 0.1 ETH per pair
    // Tier 2: ₹6,600 = 0.033 ETH per pair
    // Tier 3: ₹2,500 = 0.0125 ETH per pair

    const liquidityConfig = {
        1: {
            amountToken: ethers.parseEther("10000"), // 10,000 tokens
            amountETH: ethers.parseEther("0.1"),     // 0.1 ETH (₹20,000)
            label: "Giants"
        },
        2: {
            amountToken: ethers.parseEther("5000"),  // 5,000 tokens
            amountETH: ethers.parseEther("0.033"),   // 0.033 ETH (₹6,600)
            label: "Hot List"
        },
        3: {
            amountToken: ethers.parseEther("2000"),  // 2,000 tokens
            amountETH: ethers.parseEther("0.0125"),  // 0.0125 ETH (₹2,500)
            label: "Ecosystem"
        }
    };

    console.log("💧 Liquidity Configuration:");
    console.log(`   Tier 1 (${liquidityConfig[1].label}): ${ethers.formatEther(liquidityConfig[1].amountETH)} ETH per pair`);
    console.log(`   Tier 2 (${liquidityConfig[2].label}): ${ethers.formatEther(liquidityConfig[2].amountETH)} ETH per pair`);
    console.log(`   Tier 3 (${liquidityConfig[3].label}): ${ethers.formatEther(liquidityConfig[3].amountETH)} ETH per pair\n`);

    let totalETHNeeded = 0;
    for (const t of deployedTokens) {
        totalETHNeeded += parseFloat(ethers.formatEther(liquidityConfig[t.tier].amountETH));
    }
    console.log(`💰 Total ETH Required: ${totalETHNeeded.toFixed(4)} ETH\n`);

    console.log("🔄 Adding liquidity for all pairs...");
    const pairAddresses = [];

    for (let i = 0; i < deployedTokens.length; i++) {
        const t = deployedTokens[i];
        const config = liquidityConfig[t.tier];

        try {
            // Approve Router
            await t.contract.approve(router.target, config.amountToken);

            // Add Liquidity
            const tx = await router.addLiquidityETH(
                t.address,
                config.amountToken,
                0, // amountTokenMin
                0, // amountETHMin
                deployer.address,
                Math.floor(Date.now() / 1000) + 60 * 20, // 20 mins deadline
                { value: config.amountETH }
            );
            await tx.wait();

            // Get pair address
            const pairAddress = await factory.getPair(t.address, weth.target);
            pairAddresses.push({
                token0: t.address,
                token1: weth.target,
                pair: pairAddress,
                symbol: `${t.symbol}/WMATIC`
            });

            if ((i + 1) % 10 === 0) {
                console.log(`   ✓ Added liquidity for ${i + 1}/${deployedTokens.length} pairs...`);
            }
        } catch (error) {
            console.error(`   ❌ Failed to add liquidity for ${t.symbol}:`, error.message);
        }
    }
    console.log(`✅ Liquidity added for ${pairAddresses.length} pairs!\n`);

    // ============================================
    // STEP D: Generate Frontend Token List
    // ============================================
    console.log("📦 STEP D: Generating Frontend Configuration...\n");

    const frontendTokenList = deployedTokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        decimals: 18,
        tier: t.tier
    }));

    const frontendConfig = {
        factory: factory.target,
        router: router.target,
        weth: weth.target,
        initCodeHash: initCodeHash,
        tokens: frontendTokenList,
        pairs: pairAddresses,
        stats: {
            totalTokens: deployedTokens.length,
            totalPairs: pairAddresses.length,
            tier1Count: tier1Tokens.length,
            tier2Count: tier2Tokens.length,
            tier3Count: tier3Tokens.length,
            totalLiquidityETH: totalETHNeeded.toFixed(4)
        }
    };

    // Save to frontend config directory
    const frontendConfigPath = path.join(__dirname, "../../frontend/src/config");

    // Create directory if it doesn't exist
    if (!fs.existsSync(frontendConfigPath)) {
        fs.mkdirSync(frontendConfigPath, { recursive: true });
    }

    // Save token list
    fs.writeFileSync(
        path.join(frontendConfigPath, "tokenList.json"),
        JSON.stringify(frontendTokenList, null, 2)
    );
    console.log("✅ Token list saved to: frontend/src/config/tokenList.json");

    // Save complete addresses
    fs.writeFileSync(
        path.join(frontendConfigPath, "addresses.json"),
        JSON.stringify(frontendConfig, null, 2)
    );
    console.log("✅ Complete config saved to: frontend/src/config/addresses.json");

    // Also save to contracts directory (backward compatibility)
    fs.writeFileSync(
        path.join(__dirname, "../deployed_addresses.json"),
        JSON.stringify(frontendConfig, null, 2)
    );
    console.log("✅ Backup saved to: contracts/deployed_addresses.json");

    // ============================================
    // Deployment Summary
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📊 Deployment Summary:");
    console.log(`   Factory: ${factory.target}`);
    console.log(`   Router: ${router.target}`);
    console.log(`   WETH: ${weth.target}`);
    console.log(`   Total Tokens: ${deployedTokens.length}`);
    console.log(`   Total Pairs: ${pairAddresses.length}`);
    console.log(`   Total Liquidity: ${totalETHNeeded.toFixed(4)} ETH`);

    console.log("\n⚠️  NEXT STEPS:");
    console.log("   1. Update UniswapV2Library.sol line 23 with:");
    console.log(`      hex'${initCodeHash.slice(2)}'`);
    console.log("   2. Restart Hardhat node");
    console.log("   3. Re-run this deployment script");
    console.log("   4. Update frontend to use new tokenList.json");
    console.log("\n✨ DexFree is ready to trade with 100 pairs!");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
