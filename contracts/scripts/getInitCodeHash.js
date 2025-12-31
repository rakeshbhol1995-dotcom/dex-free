const { ethers } = require("hardhat");

async function main() {
    const factory = await ethers.getContractFactory("UniswapV2Pair");
    const bytecode = factory.bytecode;
    const hash = ethers.keccak256(bytecode);
    console.log("INIT_CODE_PAIR_HASH:", hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
