const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * DexFree Ultimate Deployment Script
 * Deploys: Factory, Router, 100 Tokens, DexToken, MasterChef, ReferralRewards
 * Sets up: 100 pairs, Tiered liquidity, Farming pools
 */

// Logo mapping (same as before)
const LOGO_URLS = {
    USDT: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    USDC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    WBTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
    DAI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    LINK: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',
    SHIB: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png',
    PEPE: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png',
    DOGE: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png',
    // Add more as needed...
};

const getLogoUrl = (symbol) => {
    return LOGO_URLS[symbol] || `https://ui-avatars.com/api/?name=${symbol}&background=random&size=128&bold=true`;
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 DexFree Ultimate Deployment Started");
    console.log("📍 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ============================================
    // STEP 1: Deploy Core DEX
    // ============================================
    console.log("📦 STEP 1: Deploying Core DEX Contracts...\n");

    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(deployer.address);
    await factory.waitForDeployment();
    console.log("✅ Factory:", factory.target);

    const Pair = await ethers.getContractFactory("UniswapV2Pair");
    const initCodeHash = ethers.keccak256(Pair.bytecode);
    console.log("🔑 INIT_CODE_HASH:", initCodeHash);

    const WETH = await ethers.getContractFactory("WETH");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();
    console.log("✅ WETH:", weth.target);

    const Router = await ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factory.target, weth.target);
    await router.waitForDeployment();
    console.log("✅ Router:", router.target);

    // ============================================
    // STEP 2: Deploy Token Economy
    // ============================================
    console.log("\n📦 STEP 2: Deploying Token Economy...\n");

    const DexToken = await ethers.getContractFactory("DexToken");
    const freeToken = await DexToken.deploy();
    await freeToken.waitForDeployment();
    console.log("✅ FREE Token:", freeToken.target);

    const freePerBlock = ethers.parseEther("100"); // 100 FREE per block
    const startBlock = await ethers.provider.getBlockNumber();

    const MasterChef = await ethers.getContractFactory("MasterChef");
    const masterChef = await MasterChef.deploy(
        freeToken.target,
        freePerBlock,
        startBlock
    );
    await masterChef.waitForDeployment();
    console.log("✅ MasterChef:", masterChef.target);

    // Transfer 50% of FREE to MasterChef for farming rewards
    const farmingAllocation = ethers.parseEther("500000000"); // 500M FREE
    await freeToken.transfer(masterChef.target, farmingAllocation);
    console.log("✅ Transferred 500M FREE to MasterChef");

    const ReferralRewards = await ethers.getContractFactory("ReferralRewards");
    const referralRewards = await ReferralRewards.deploy(freeToken.target);
    await referralRewards.waitForDeployment();
    console.log("✅ ReferralRewards:", referralRewards.target);

    // Transfer 10% of FREE to ReferralRewards
    const referralAllocation = ethers.parseEther("100000000"); // 100M FREE
    await freeToken.transfer(referralRewards.target, referralAllocation);
    console.log("✅ Transferred 100M FREE to ReferralRewards");

    // ============================================
    // STEP 3: Deploy 100 Tokens
    // ============================================
    console.log("\n📦 STEP 3: Deploying 100 Tokens...\n");

    const tier1Tokens = [
        { symbol: "USDT", name: "Tether USD", tier: 1 },
        { symbol: "USDC", name: "USD Coin", tier: 1 },
        { symbol: "WBTC", name: "Wrapped Bitcoin", tier: 1 },
        { symbol: "DAI", name: "Dai Stablecoin", tier: 1 },
        { symbol: "LINK", name: "Chainlink", tier: 1 }
    ];

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

    const tier3Symbols = [
        'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'ILV', 'IMX', 'RENDER', 'APE', 'BLUR',
        'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', '1INCH', 'SUSHI', 'YFI', 'BAL', 'RUNE',
        'ARB', 'OP', 'LDO', 'GRT', 'INJ', 'QNT', 'FTM', 'ALGO', 'HBAR', 'FLOKI',
        'BONK', 'WIF', 'MEME', 'BOME', 'SLERF', 'MEW', 'DEGEN', 'TURBO', 'AIDOGE', 'FET',
        'AGIX', 'OCEAN', 'WLD', 'TAO', 'AKT', 'GLM', 'EOS', 'XTZ', 'NEO', 'IOTA',
        'ZEC', 'DASH', 'BCH', 'CRO', 'OKB', 'KCS', 'TUSD', 'FRAX', 'LUSD', 'BAT',
        'ZRX', 'ENS', 'CHZ', 'MASK', 'GMX', 'DYDX', 'STX', 'MINA', 'EGLD', 'THETA',
        'VET', 'ICP', 'TON', 'KAS', 'SUI', 'SEI', 'APT', 'TIA', 'STRK', 'PYTH'
    ];

    const tier3Tokens = tier3Symbols.map(symbol => ({
        symbol,
        name: `${symbol} Token`,
        tier: 3
    }));

    const allTokens = [...tier1Tokens, ...tier2Tokens, ...tier3Tokens];
    console.log(`📊 Deploying ${allTokens.length} tokens...`);

    const deployedTokens = [];
    const MockERC20 = await ethers.getContractFactory("MockERC20");

    for (let i = 0; i < allTokens.length; i++) {
        const t = allTokens[i];
        const token = await MockERC20.deploy(t.name, t.symbol);
        await token.waitForDeployment();

        deployedTokens.push({
            symbol: t.symbol,
            name: t.name,
            address: token.target,
            decimals: 18,
            tier: t.tier,
            logoURI: getLogoUrl(t.symbol),
            contract: token
        });

        if ((i + 1) % 20 === 0) {
            console.log(`   ✓ ${i + 1}/${allTokens.length} tokens deployed`);
        }
    }
    console.log(`✅ All ${deployedTokens.length} tokens deployed!\n`);

    // ============================================
    // STEP 4: Create Pairs & Add Liquidity
    // ============================================
    console.log("📦 STEP 4: Creating Pairs & Adding Liquidity...\n");

    const liquidityConfig = {
        1: { amountToken: ethers.parseEther("10000"), amountETH: ethers.parseEther("0.1") },
        2: { amountToken: ethers.parseEther("5000"), amountETH: ethers.parseEther("0.033") },
        3: { amountToken: ethers.parseEther("2000"), amountETH: ethers.parseEther("0.0125") }
    };

    const pairAddresses = [];

    for (let i = 0; i < deployedTokens.length; i++) {
        const t = deployedTokens[i];
        const config = liquidityConfig[t.tier];

        try {
            await t.contract.approve(router.target, config.amountToken);
            await router.addLiquidityETH(
                t.address,
                config.amountToken,
                0, 0,
                deployer.address,
                Math.floor(Date.now() / 1000) + 60 * 20,
                { value: config.amountETH }
            );

            const pairAddress = await factory.getPair(t.address, weth.target);
            pairAddresses.push({
                token0: t.address,
                token1: weth.target,
                pair: pairAddress,
                symbol: `${t.symbol}/WMATIC`,
                tier: t.tier
            });

            if ((i + 1) % 20 === 0) {
                console.log(`   ✓ ${i + 1}/${deployedTokens.length} pairs created`);
            }
        } catch (error) {
            console.error(`   ❌ Failed for ${t.symbol}`);
        }
    }
    console.log(`✅ ${pairAddresses.length} pairs created!\n`);

    // ============================================
    // STEP 5: Enable Farming Pools
    // ============================================
    console.log("📦 STEP 5: Enabling Farming Pools...\n");

    const farmPools = [
        { symbol: "USDT/WMATIC", allocPoint: 40, tier: 1 },
        { symbol: "USDC/WMATIC", allocPoint: 40, tier: 1 },
        { symbol: "WBTC/WMATIC", allocPoint: 30, tier: 1 },
        { symbol: "DAI/WMATIC", allocPoint: 30, tier: 1 },
        { symbol: "LINK/WMATIC", allocPoint: 20, tier: 1 },
        { symbol: "PEPE/WMATIC", allocPoint: 15, tier: 2 },
        { symbol: "SHIB/WMATIC", allocPoint: 15, tier: 2 },
        { symbol: "DOGE/WMATIC", allocPoint: 10, tier: 2 }
    ];

    const enabledPools = [];
    for (const pool of farmPools) {
        const pairInfo = pairAddresses.find(p => p.symbol === pool.symbol);
        if (pairInfo) {
            await masterChef.add(pool.allocPoint, pairInfo.pair, false);
            enabledPools.push({
                ...pool,
                lpToken: pairInfo.pair,
                apr: "150%" // Placeholder
            });
            console.log(`   ✓ Added ${pool.symbol} (${pool.allocPoint} points)`);
        }
    }
    console.log(`✅ ${enabledPools.length} farming pools enabled!\n`);

    // ============================================
    // STEP 6: Generate Frontend Config
    // ============================================
    console.log("📦 STEP 6: Generating Frontend Config...\n");

    const config = {
        factory: factory.target,
        router: router.target,
        weth: weth.target,
        freeToken: freeToken.target,
        masterChef: masterChef.target,
        referralRewards: referralRewards.target,
        initCodeHash: initCodeHash,
        tokens: deployedTokens.map(t => ({
            symbol: t.symbol,
            name: t.name,
            address: t.address,
            decimals: t.decimals,
            tier: t.tier,
            logoURI: t.logoURI
        })),
        pairs: pairAddresses,
        farmPools: enabledPools
    };

    const frontendPath = path.join(__dirname, "../../frontend/src/config");
    if (!fs.existsSync(frontendPath)) {
        fs.mkdirSync(frontendPath, { recursive: true });
    }

    fs.writeFileSync(
        path.join(frontendPath, "addresses.json"),
        JSON.stringify(config, null, 2)
    );
    console.log("✅ Config saved to frontend/src/config/addresses.json");

    fs.writeFileSync(
        path.join(frontendPath, "tokenList.json"),
        JSON.stringify(config.tokens, null, 2)
    );
    console.log("✅ Token list saved");

    fs.writeFileSync(
        path.join(frontendPath, "farmPools.json"),
        JSON.stringify(enabledPools, null, 2)
    );
    console.log("✅ Farm pools saved");

    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEXFREE ULTIMATE DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📊 Summary:");
    console.log(`   Factory: ${factory.target}`);
    console.log(`   Router: ${router.target}`);
    console.log(`   FREE Token: ${freeToken.target}`);
    console.log(`   MasterChef: ${masterChef.target}`);
    console.log(`   Referral: ${referralRewards.target}`);
    console.log(`   Tokens: ${deployedTokens.length}`);
    console.log(`   Pairs: ${pairAddresses.length}`);
    console.log(`   Farm Pools: ${enabledPools.length}`);
    console.log("\n✨ Ready to farm and earn FREE tokens!");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
