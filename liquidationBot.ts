import { ethers } from 'ethers';
import { config } from './config';
import { getUnhealthyPositions, liquidatePosition } from './aaveUtils';

async function main() {
  console.log('Liquidation bot started');

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);

  console.log('Wallet connected');

  while (true) {
    try {
      console.log('Checking for unhealthy positions...');
      const unhealthyPositions = await getUnhealthyPositions();
      console.log(`Found ${unhealthyPositions.length} unhealthy positions`);

      for (const userAddress of unhealthyPositions) {
        console.log(`Attempting to liquidate position: ${userAddress}`);
        await liquidatePosition(wallet, userAddress.userAddress, userAddress.totalDebtValueInUsd, userAddress.leadingCollateralReserve, userAddress.leadingDebtReserve);
      }

      console.log('Waiting before next check...');
    } catch (error) {
      console.error('Error in main loop:', error);
    }
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});