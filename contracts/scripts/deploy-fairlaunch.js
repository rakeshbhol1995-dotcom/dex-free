const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying FairLaunch with account:", deployer.address);

    // 1. Read existing deployment info
    const addressPath = path.join(__dirname, "../deployed_addresses.json");
    let deployedData = {};
    if (fs.existsSync(addressPath)) {
        deployedData = JSON.parse(fs.readFileSync(addressPath, "utf8"));
    } else {
        console.warn("⚠ No deployed_addresses.json found. Ensure Router is deployed first.");
        // Fallback for testing? No, we need Router.
    }

    // Chain-Specific Router Addresses
    let routerAddress;

    if (network.name === "base") {
        // Base Mainnet: Uniswap V2
        routerAddress = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";
        console.log("Using Uniswap V2 Router (Base Mainnet)");
    } else if (network.name === "baseSepolia") {
        // Base Sepolia: Use deployed router if available, else Uniswap testnet
        routerAddress = deployedData.router || "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";
        console.log("Using Router (Base Sepolia):", routerAddress);
    } else {
        // Polygon / Localhost: DexFree Router
        routerAddress = deployedData.router;
        if (!routerAddress) {
            throw new Error("DexFree Router not found in deployed_addresses.json. Run deploy.js first.");
        }
        console.log("Using DexFree Router (Polygon/Localhost):", routerAddress);
    }

    const feeTo = deployer.address; // Developer Wallet
    console.log("Fee Receiver:", feeTo);

    // 2. Deploy FairLaunch
    // Chainlink Price Feed Addresses
    let priceFeedAddress;
    if (network.name === "base") {
        priceFeedAddress = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // ETH/USD Mainnet
    } else if (network.name === "baseSepolia") {
        priceFeedAddress = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1"; // ETH/USD Sepolia
    } else {
        console.warn("⚠ Local Network detected. Deploying Mock Price Feed...");
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        // 8 decimals, 3000 * 10^8 (Initial Price $3000)
        const mockPriceFeed = await MockV3Aggregator.deploy(8, 300000000000);
        await mockPriceFeed.waitForDeployment();
        priceFeedAddress = mockPriceFeed.target;
        console.log("Mock Price Feed deployed to:", priceFeedAddress);
    }

    const FairLaunch = await ethers.getContractFactory("FairLaunch");
    const fairLaunch = await FairLaunch.deploy(routerAddress, feeTo, priceFeedAddress);

    await fairLaunch.waitForDeployment();

    console.log("FairLaunch deployed to:", fairLaunch.target);

    // 3. Update JSON
    deployedData.fairLaunch = fairLaunch.target;
    fs.writeFileSync(addressPath, JSON.stringify(deployedData, null, 2));
    console.log("Updated deployed_addresses.json");

    // 4. Verify (Optional, skipping for local speed)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
