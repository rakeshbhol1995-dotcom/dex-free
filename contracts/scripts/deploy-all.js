const hre = require("hardhat");

async function main() {
    const networkName = hre.network.name;
    console.log(`\n🚀 Starting Deployment to: ${networkName.toUpperCase()} 🚀`);
    console.log("==================================================");

    const [deployer] = await hre.ethers.getSigners();
    console.log(`👨‍💻 Deployer: ${deployer.address}`);
    console.log(`💰 Balance:  ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);

    // --------------------------------------------------------
    // 1. Deploy Cloud Token (Protocol Token)
    // --------------------------------------------------------
    console.log("\n1️⃣  Deploying CloudToken...");
    const CloudToken = await hre.ethers.getContractFactory("CloudToken");
    const cloudToken = await CloudToken.deploy(); // Mint 1B to deployer
    await cloudToken.waitForDeployment();
    const cloudAddress = await cloudToken.getAddress();
    console.log(`✅ CloudToken deployed to: ${cloudAddress}`);

    // --------------------------------------------------------
    // 2. Setup Dependencies for FairLaunch
    // --------------------------------------------------------
    console.log("\n2️⃣  Setting up FairLaunch Dependencies...");

    let routerAddress;
    let priceFeedAddress;
    // Default: Deployer receives fees
    const feeTo = deployer.address;

    if (networkName === "base") {
        routerAddress = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // Uniswap V2
        priceFeedAddress = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // ETH/USD
    } else if (networkName === "polygon") {
        routerAddress = "0xedf6066a2b290C18578Ad31D8dCCe9C050632dcc"; // QuickSwap
        priceFeedAddress = "0xAB594600376Ec9fD91F8E885dADF0C6379ad4f15"; // MATIC/USD
    } else {
        // Sepolia / Localhost fallback
        console.log("⚠️  Using Testnet/Local Addresses");
        routerAddress = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // Base Sepolia Uniswap
        priceFeedAddress = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1"; // ETH/USD Sepolia
    }

    console.log(`   Router: ${routerAddress}`);
    console.log(`   FeeTo:  ${feeTo}`);

    // --------------------------------------------------------
    // 3. Deploy FairLaunch
    // --------------------------------------------------------
    console.log("\n3️⃣  Deploying FairLaunch...");
    const FairLaunch = await hre.ethers.getContractFactory("FairLaunch");
    const fairLaunch = await FairLaunch.deploy(routerAddress, feeTo, priceFeedAddress);
    await fairLaunch.waitForDeployment();
    const fairLaunchAddress = await fairLaunch.getAddress();
    console.log(`✅ FairLaunch deployed to: ${fairLaunchAddress}`);

    // --------------------------------------------------------
    // 4. Summary
    // --------------------------------------------------------
    console.log("\n🎉 DEPLOYMENT COMPLETE 🎉");
    console.log("--------------------------------------------------");
    console.log(`Network:     ${networkName}`);
    console.log(`CloudToken:  ${cloudAddress}`);
    console.log(`FairLaunch:  ${fairLaunchAddress}`);
    console.log("--------------------------------------------------");

    // --------------------------------------------------------
    // 5. Verification Hint
    // --------------------------------------------------------
    console.log("\nTo Verify:");
    console.log(`npx hardhat verify --network ${networkName} ${cloudAddress}`);
    console.log(`npx hardhat verify --network ${networkName} ${fairLaunchAddress} "${routerAddress}" "${feeTo}" "${priceFeedAddress}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
