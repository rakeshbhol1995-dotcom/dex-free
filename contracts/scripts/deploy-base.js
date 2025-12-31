const hre = require("hardhat");

async function main() {
    console.log("Deploying FairLaunch to Base...");

    const FairLaunch = await hre.ethers.getContractFactory("FairLaunch");
    const fairLaunch = await FairLaunch.deploy();

    await fairLaunch.waitForDeployment();

    const address = await fairLaunch.getAddress();
    console.log(`FairLaunch deployed to: ${address}`);

    // Wait for block confirmations before verification
    console.log("Waiting for block confirmations...");
    await fairLaunch.deploymentTransaction().wait(5);

    console.log("Verifying contract on Basescan...");
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
        console.log("Verification successful");
    } catch (error) {
        console.log("Verification failed:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
