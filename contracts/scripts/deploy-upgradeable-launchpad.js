const { ethers, upgrades } = require("hardhat");

/**
 * Deploy Upgradeable Launchpad Contract
 * 
 * This script deploys the Launchpad using OpenZeppelin's Transparent Proxy pattern
 * The proxy allows upgrading the implementation while keeping the same address
 */
async function main() {
    console.log("🚀 Deploying Upgradeable Launchpad...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString(), "\n");

    // Configuration
    const FEE_RECIPIENT = deployer.address; // Change to your fee recipient
    const PLATFORM_FEE = 200; // 2% (200 basis points)

    // Deploy LaunchpadV1 with proxy
    console.log("📦 Deploying LaunchpadV1 implementation...");
    const LaunchpadV1 = await ethers.getContractFactory("LaunchpadV1");

    const launchpad = await upgrades.deployProxy(
        LaunchpadV1,
        [FEE_RECIPIENT, PLATFORM_FEE],
        {
            initializer: 'initialize',
            kind: 'transparent' // or 'uups'
        }
    );

    await launchpad.deployed();

    console.log("✅ Launchpad Proxy deployed to:", launchpad.address);

    // Get implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(
        launchpad.address
    );
    console.log("📝 Implementation address:", implementationAddress);

    const adminAddress = await upgrades.erc1967.getAdminAddress(
        launchpad.address
    );
    console.log("🔐 Proxy Admin address:", adminAddress);

    console.log("\n✅ Deployment Complete!");
    console.log("\n📋 Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Proxy Address:          ", launchpad.address);
    console.log("Implementation Address: ", implementationAddress);
    console.log("Admin Address:          ", adminAddress);
    console.log("Fee Recipient:          ", FEE_RECIPIENT);
    console.log("Platform Fee:           ", PLATFORM_FEE / 100, "%");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n💡 Important Notes:");
    console.log("1. Users interact with Proxy Address:", launchpad.address);
    console.log("2. To upgrade, deploy new implementation and call upgradeTo()");
    console.log("3. Storage layout must be compatible in upgrades");
    console.log("4. Save these addresses for future upgrades!");

    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
        network: network.name,
        proxyAddress: launchpad.address,
        implementationAddress: implementationAddress,
        adminAddress: adminAddress,
        feeRecipient: FEE_RECIPIENT,
        platformFee: PLATFORM_FEE,
        deployedAt: new Date().toISOString()
    };

    fs.writeFileSync(
        `deployments/launchpad-${network.name}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n💾 Deployment info saved to deployments/launchpad-" + network.name + ".json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
