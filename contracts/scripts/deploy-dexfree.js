const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying DexFree with account:", deployer.address);
    console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // 1. Deploy WETH (Wrapped MATIC for Polygon)
    console.log("\n📦 Deploying WETH...");
    const WETH = await ethers.getContractFactory("WETH");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();
    console.log("✅ WETH deployed to:", weth.target);

    // 2. Deploy Factory
    console.log("\n🏭 Deploying UniswapV2Factory...");
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(deployer.address); // feeTo = deployer
    await factory.waitForDeployment();
    console.log("✅ Factory deployed to:", factory.target);

    // 3. Deploy Router
    console.log("\n🛣️  Deploying UniswapV2Router02...");
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factory.target, weth.target);
    await router.waitForDeployment();
    console.log("✅ Router deployed to:", router.target);

    // 4. Get Init Code Hash (Important for pair creation)
    const initCodeHash = await factory.INIT_CODE_PAIR_HASH();
    console.log("🔑 Init Code Hash:", initCodeHash);

    // 5. Save addresses
    const deploymentData = {
        network: network.name,
        factory: factory.target,
        router: router.target,
        weth: weth.target,
        initCodeHash: initCodeHash,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, "../dexfree-addresses.json");
    fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
    console.log("\n💾 Addresses saved to:", outputPath);

    console.log("\n✨ DexFree Deployment Complete! ✨");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Factory:", factory.target);
    console.log("Router:", router.target);
    console.log("WETH:", weth.target);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
