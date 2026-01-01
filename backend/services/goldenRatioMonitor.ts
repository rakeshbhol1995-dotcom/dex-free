
import { ethers } from 'ethers';
import { getTokenOverview } from '../../frontend/src/lib/apis/birdeye'; // Import our Birdeye client
import lpPoolAbi from '../../contracts/artifacts/LPPool.json'; // Mock path for now

// Configuration
const LP_POOL_ADDRESS = process.env.LP_POOL_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

// Initialize Contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY!, provider);
const lpPoolContract = new ethers.Contract(LP_POOL_ADDRESS!, lpPoolAbi, wallet);

// Golden Ratio Constant
const MAX_OI_TO_LIQUIDITY_RATIO = 0.5; // 50%

export async function updateMarketRiskParams(marketId: string, tokenAddress: string) {
    try {
        console.log(`[Risk Monitor] Checking liquidity for ${tokenAddress}...`);

        // 1. Get Real-time Spot Liquidity
        const tokenData = await getTokenOverview(tokenAddress);

        if (!tokenData || !tokenData.liquidity) {
            console.error(`[Risk Monitor] Failed to fetch liquidity for ${tokenAddress}`);
            return;
        }

        const spotLiquidity = parseFloat(tokenData.liquidity);
        console.log(`[Risk Monitor] Spot Liquidity: $${spotLiquidity.toLocaleString()}`);

        // 2. Calculate Max Open Interest (The Golden Ratio)
        const maxOI = spotLiquidity * MAX_OI_TO_LIQUIDITY_RATIO;
        console.log(`[Risk Monitor] Golden Ratio Limit: $${maxOI.toLocaleString()}`);

        // 3. Update Smart Contract
        console.log(`[Risk Monitor] Updating LPPool contract...`);

        // In production we would use the actual bytes32 market ID
        const marketIdBytes = ethers.id(marketId);

        const tx = await lpPoolContract.setMaxOpenInterest(marketIdBytes, ethers.parseUnits(maxOI.toString(), 6));
        await tx.wait();

        console.log(`[Risk Monitor] SUCCESS: Updated Max OI for ${marketId} to $${maxOI.toLocaleString()}`);

    } catch (error) {
        console.error('[Risk Monitor] Error updating risk params:', error);
    }
}

// 4. Run Loop (Every 5 minutes)
export function startRiskMonitor() {
    setInterval(() => {
        // List of active custom markets
        const activeMarkets = [
            { id: 'PEPE-USD', address: '0x...' },
            { id: 'BONK-USD', address: '0x...' },
        ];

        activeMarkets.forEach(market => {
            updateMarketRiskParams(market.id, market.address);
        });
    }, 5 * 60 * 1000);
}
