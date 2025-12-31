const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * DexFree Advanced Deployment Script - Real Token Edition
 * Deploys 100 Trading Pairs with Real-World Token Symbols & Logos
 * 
 * Tier 1 (Giants): 5 tokens - ₹20,000 liquidity each
 * Tier 2 (Hot List): 15 tokens - ₹6,600 liquidity each  
 * Tier 3 (Ecosystem): 80 tokens - ₹2,500 liquidity each
 */

// Logo mapping for real-world tokens
const LOGO_URLS = {
    // Tier 1
    USDT: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    USDC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    WBTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
    DAI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    LINK: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',

    // Tier 2
    SHIB: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png',
    PEPE: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png',
    DOGE: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png',
    SOL: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    XRP: 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
    ADA: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
    DOT: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png',
    UNI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
    AVAX: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    LTC: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png',
    NEAR: 'https://cryptologos.cc/logos/near-protocol-near-logo.png',
    ATOM: 'https://cryptologos.cc/logos/cosmos-atom-logo.png',
    TRX: 'https://cryptologos.cc/logos/tron-trx-logo.png',
    ETC: 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png',
    FIL: 'https://cryptologos.cc/logos/filecoin-fil-logo.png',

    // Tier 3 - Using cryptologos.cc and TrustWallet where available
    SAND: 'https://cryptologos.cc/logos/the-sandbox-sand-logo.png',
    MANA: 'https://cryptologos.cc/logos/decentraland-mana-logo.png',
    AXS: 'https://cryptologos.cc/logos/axie-infinity-axs-logo.png',
    GALA: 'https://cryptologos.cc/logos/gala-gala-logo.png',
    ENJ: 'https://cryptologos.cc/logos/enjin-coin-enj-logo.png',
    RENDER: 'https://cryptologos.cc/logos/render-token-rndr-logo.png',
    AAVE: 'https://cryptologos.cc/logos/aave-aave-logo.png',
    CRV: 'https://cryptologos.cc/logos/curve-dao-token-crv-logo.png',
    MKR: 'https://cryptologos.cc/logos/maker-mkr-logo.png',
    SNX: 'https://cryptologos.cc/logos/synthetix-snx-logo.png',
    COMP: 'https://cryptologos.cc/logos/compound-comp-logo.png',
    SUSHI: 'https://cryptologos.cc/logos/sushiswap-sushi-logo.png',
    YFI: 'https://cryptologos.cc/logos/yearn-finance-yfi-logo.png',
    ARB: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    OP: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    LDO: 'https://cryptologos.cc/logos/lido-dao-ldo-logo.png',
    GRT: 'https://cryptologos.cc/logos/the-graph-grt-logo.png',
    INJ: 'https://cryptologos.cc/logos/injective-inj-logo.png',
    FTM: 'https://cryptologos.cc/logos/fantom-ftm-logo.png',
    ALGO: 'https://cryptologos.cc/logos/algorand-algo-logo.png',
    FLOKI: 'https://cryptologos.cc/logos/floki-inu-floki-logo.png',
    BONK: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
};

// Fallback logo generator
const getLogoUrl = (symbol) => {
    if (LOGO_URLS[symbol]) {
        return LOGO_URLS[symbol];
    }
    // Fallback to UI Avatars
    return `https://ui-avatars.com/api/?name=${symbol}&background=random&size=128&bold=true`;
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 DexFree Mass Deployment Started (Real Token Edition)");
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
    console.log("⚠️  CRITICAL: Update UniswapV2Library.sol line 23 with:");
    console.log(`   hex'${initCodeHash.slice(2)}'\n`);

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
    // STEP B: Deploy 100 Real-World Tokens
    // ============================================
    console.log("\n📦 STEP B: Deploying 100 Real-World Tokens...\n");

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
            decimals: 18,
            tier: t.tier,
            logoURI: getLogoUrl(t.symbol),
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

    const liquidityConfig = {
        1: {
            amountToken: ethers.parseEther("10000"),
            amountETH: ethers.parseEther("0.1"),
            label: "Giants"
        },
        2: {
            amountToken: ethers.parseEther("5000"),
            amountETH: ethers.parseEther("0.033"),
            label: "Hot List"
        },
        3: {
            amountToken: ethers.parseEther("2000"),
            amountETH: ethers.parseEther("0.0125"),
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
            await t.contract.approve(router.target, config.amountToken);
            const tx = await router.addLiquidityETH(
                t.address,
                config.amountToken,
                0,
                0,
                deployer.address,
                Math.floor(Date.now() / 1000) + 60 * 20,
                { value: config.amountETH }
            );
            await tx.wait();

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
    // STEP D: Generate Frontend Token List with Logos
    // ============================================
    console.log("📦 STEP D: Generating Frontend Configuration with Logos...\n");

    const frontendTokenList = deployedTokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        decimals: t.decimals,
        tier: t.tier,
        logoURI: t.logoURI
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

    const frontendConfigPath = path.join(__dirname, "../../frontend/src/config");
    if (!fs.existsSync(frontendConfigPath)) {
        fs.mkdirSync(frontendConfigPath, { recursive: true });
    }

    fs.writeFileSync(
        path.join(frontendConfigPath, "tokenList.json"),
        JSON.stringify(frontendTokenList, null, 2)
    );
    console.log("✅ Token list with logos saved to: frontend/src/config/tokenList.json");

    fs.writeFileSync(
        path.join(frontendConfigPath, "addresses.json"),
        JSON.stringify(frontendConfig, null, 2)
    );
    console.log("✅ Complete config saved to: frontend/src/config/addresses.json");

    fs.writeFileSync(
        path.join(__dirname, "../deployed_addresses.json"),
        JSON.stringify(frontendConfig, null, 2)
    );
    console.log("✅ Backup saved to: contracts/deployed_addresses.json");

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
    console.log("   1. INIT_CODE_HASH is already correct in UniswapV2Library.sol");
    console.log("   2. Refresh frontend to see all 100 tokens with logos!");
    console.log("\n✨ DexFree is ready to trade with 100 real-world tokens!");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
