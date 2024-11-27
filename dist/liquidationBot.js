"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const config_1 = require("./config");
const aaveUtils_1 = require("./aaveUtils");
async function main() {
    console.log('Liquidation bot started');
    const provider = new ethers_1.ethers.providers.JsonRpcProvider(config_1.config.rpcUrl);
    const wallet = new ethers_1.ethers.Wallet(config_1.config.privateKey, provider);
    console.log('Wallet connected');
    while (true) {
        try {
            console.log('Checking for unhealthy positions...');
            const unhealthyPositions = await (0, aaveUtils_1.getUnhealthyPositions)();
            console.log(`Found ${unhealthyPositions.length} unhealthy positions`);
            for (const userAddress of unhealthyPositions) {
                console.log(`Attempting to liquidate position: ${userAddress}`);
                await (0, aaveUtils_1.liquidatePosition)(wallet, userAddress.userAddress, userAddress.totalDebtValueInUsd, userAddress.leadingCollateralReserve, userAddress.leadingDebtReserve);
            }
            console.log('Waiting before next check...');
        }
        catch (error) {
            console.error('Error in main loop:', error);
        }
    }
}
main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
