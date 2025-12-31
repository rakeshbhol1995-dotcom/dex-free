const { ethers, upgrades } = require("hardhat");

/**
 * Upgrade Launchpad Contract
 * 
 * This script upgrades the Launchpad implementation to a new version
 * while keeping the same proxy address and preserving all data
 */
async function main() {
    console.log("🔄 Upgrading Launchpad Contract...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrading with account:", deployer.address);

    // Load existing deployment
    const fs = require('fs');
    const deploymentPath = `deployments/launchpad-${network.name}.json`;

    if (!fs.existsSync(deploymentPath)) {
        throw new Error("Deployment file not found! Deploy first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath));
    const PROXY_ADDRESS = deployment.proxyAddress;

    console.log("Proxy Address:", PROXY_ADDRESS);
    console.log("Current Implementation:", deployment.implementationAddress, "\n");

    // Deploy new implementation
    console.log("📦 Deploying LaunchpadV2 implementation...");
    const LaunchpadV2 = await ethers.getContractFactory("LaunchpadV2");

    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, LaunchpadV2);
    await upgraded.deployed();

    console.log("✅ Launchpad upgraded successfully!");

    // Get new implementation address
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(
        PROXY_ADDRESS
    );
    console.log("📝 New Implementation address:", newImplementationAddress);

    console.log("\n✅ Upgrade Complete!");
    console.log("\n📋 Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Proxy Address (unchanged): ", PROXY_ADDRESS);
    console.log("Old Implementation:        ", deployment.implementationAddress);
    console.log("New Implementation:        ", newImplementationAddress);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n💡 Important:");
    console.log("1. Proxy address remains the same:", PROXY_ADDRESS);
    console.log("2. All existing data is preserved");
    console.log("3. New functions from V2 are now available");
    console.log("4. Users don't need to do anything!");

    // Update deployment info
    deployment.implementationAddress = newImplementationAddress;
    deployment.upgradedAt = new Date().toISOString();
    deployment.version = "V2";

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n💾 Deployment info updated");

    // Verify upgrade
    console.log("\n🔍 Verifying upgrade...");
    const launchpad = await ethers.getContractAt("LaunchpadV2", PROXY_ADDRESS);

    // Test a view function to ensure it works
    const saleCounter = await launchpad.saleCounter();
    console.log("✅ Sale counter:", saleCounter.toString());
    console.log("✅ Upgrade verified successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
