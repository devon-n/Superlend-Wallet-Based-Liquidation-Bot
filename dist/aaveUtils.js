"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnhealthyPositions = getUnhealthyPositions;
exports.liquidatePosition = liquidatePosition;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const PoolABI_json_1 = __importDefault(require("./PoolABI.json"));
const PoolDataProvider_json_1 = __importDefault(require("./PoolDataProvider.json"));
const AaveOracle_json_1 = __importDefault(require("./AaveOracle.json"));
const AAVE_POOL_ABI = PoolABI_json_1.default;
const AAVE_DATA_PROVIDER_ABI = PoolDataProvider_json_1.default;
const AAVE_ORACLE_ABI = AaveOracle_json_1.default;
async function getUnhealthyPositions(provider) {
    const aavePool = new ethers_1.ethers.Contract(config_1.config.aavePoolAddress, AAVE_POOL_ABI, provider);
    const dataProvider = new ethers_1.ethers.Contract(config_1.config.aaveDataProviderAddress, AAVE_DATA_PROVIDER_ABI, provider);
    const unhealthyPositions = [];
    // Get all users with borrowed positions
    // const users = await dataProvider.getUsersWithBorrowedPositions();
    // for (const user of users) {
    //   const { healthFactor } = await aavePool.getUserAccountData(user);
    //   if (healthFactor.lt(config.healthFactorThreshold)) {
    //     unhealthyPositions.push(user);
    //   }
    // }
    return ['0x2b112F430D725897A0B6f55A582fe122d21F4EF7'];
}
async function liquidatePosition(wallet, userAddress) {
    console.log(`Entering liquidatePosition for user: ${userAddress}`);
    const aavePool = new ethers_1.ethers.Contract(config_1.config.aavePoolAddress, AAVE_POOL_ABI, wallet);
    try {
        console.log(`Fetching user account data for: ${userAddress}`);
        const { healthFactor } = await aavePool.getUserAccountData(userAddress);
        let HF = healthFactor.toString() / 10 ** 18;
        console.log(`Health factor for ${userAddress}: ${HF}`);
        const eMode = await aavePool.getUserEMode(userAddress);
        console.log(`E-Mode for ${userAddress}: ${eMode}`);
        if (HF < 1) {
            console.log(`Calculating profit for user: ${userAddress}`);
            const isLiquidationProfitable = await calculateProfit(wallet, userAddress, healthFactor, eMode);
            // if (isLiquidationProfitable) {
            console.log(`Liquidation is profitable for user: ${userAddress}`);
            // In a real scenario, you'd need to determine the optimal collateralAsset, debtAsset, and debtToCover
            // This is a simplified example
            console.log(`Attempting liquidation call for user: ${userAddress}`);
            const tx = await aavePool.liquidationCall('0x6bDE94725379334b469449f4CF49bCfc85ebFb27', // Example: WETH address
            '0x8DEF68408Bc96553003094180E5C90d9fe5b88C1', // Example: USDC address
            userAddress, ethers_1.ethers.constants.MaxUint256, // Example: Liquidate 100 USDC worth of debt
            false // Don't receive aTokens
            );
            console.log(`Waiting for transaction to be mined...`);
            await tx.wait();
            console.log(`Liquidation successful for user: ${userAddress}`);
            // } else {
            //   console.log(`Liquidation not profitable for user: ${userAddress}`);
            // }
        }
        else {
            console.log(`Health factor ${ethers_1.ethers.utils.formatUnits(healthFactor, 18)} is above threshold for user: ${userAddress}`);
        }
    }
    catch (error) {
        console.error(`Error in liquidatePosition for user ${userAddress}:`, error);
    }
    console.log(`Exiting liquidatePosition for user: ${userAddress}`);
}
async function calculateProfit(wallet, userAddress, healthFactor, eMode) {
    const aavePool = new ethers_1.ethers.Contract(config_1.config.aavePoolAddress, AAVE_POOL_ABI, wallet);
    const poolDataProvider = new ethers_1.ethers.Contract(config_1.config.aaveDataProviderAddress, AAVE_DATA_PROVIDER_ABI, wallet);
    const oracle = new ethers_1.ethers.Contract(config_1.config.aaveOracleAddress, AAVE_ORACLE_ABI, wallet);
    const tokens = await poolDataProvider.getAllReservesTokens();
    let collateralData, debtData;
    for (const token of tokens) {
        const { symbol, tokenAddress } = token;
        const userData = await poolDataProvider.getUserReserveData(tokenAddress, userAddress);
        console.log(`User data for token: ${symbol} - ${userData}`);
        const reserveData = await poolDataProvider.getReserveConfigurationData(tokenAddress);
        console.log(`Reserve data for token: ${symbol} - ${reserveData}`);
        const price = await oracle.getAssetPrice(tokenAddress);
        console.log(`Price for token: ${symbol} - ${price}`);
        const aTokenBalance = userData.currentATokenBalance;
        const variableDebt = userData.currentVariableDebt;
        console.log(`Variable debt for token: ${symbol} - ${variableDebt}`);
        const stableDebt = userData.currentStableDebt;
        if (aTokenBalance.gt(0) && reserveData.usageAsCollateralEnabled) {
            if (!collateralData || aTokenBalance.mul(price).gt(collateralData.valueInEth)) {
                collateralData = { symbol, tokenAddress, balance: aTokenBalance, valueInEth: aTokenBalance.mul(price) };
            }
        }
        if (variableDebt.gt(0) || stableDebt.gt(0)) {
            const totalDebt = variableDebt.add(stableDebt);
            if (!debtData || totalDebt.mul(price).gt(debtData.valueInEth)) {
                debtData = { symbol, tokenAddress, balance: totalDebt, valueInEth: totalDebt.mul(price) };
            }
        }
    }
    if (!collateralData || !debtData) {
        console.log('No suitable collateral or debt found');
        return false;
    }
    const liquidationBonus = eMode === 1 ? ethers_1.ethers.BigNumber.from(10100) : ethers_1.ethers.BigNumber.from(10500);
    const liquidationBonusBase = ethers_1.ethers.BigNumber.from(10000);
    const maxCollateralToLiquidate = debtData.valueInEth.mul(liquidationBonus).div(liquidationBonusBase).div(collateralData.valueInEth);
    console.log(`Max collateral to liquidate: ${ethers_1.ethers.utils.formatEther(maxCollateralToLiquidate)} ETH`);
    const gasCost = await estimateGasCost(wallet);
    console.log(`Gas cost: ${ethers_1.ethers.utils.formatEther(gasCost)} ETH`);
    const profit = maxCollateralToLiquidate.sub(debtData.valueInEth).sub(gasCost);
    console.log(`Estimated profit: ${ethers_1.ethers.utils.formatEther(profit)} ETH`);
    return profit.gt(0);
}
async function estimateGasCost(wallet) {
    const gasPrice = await wallet.getGasPrice();
    const estimatedGas = ethers_1.ethers.BigNumber.from(500000); // Estimate, adjust based on actual usage
    return gasPrice.mul(estimatedGas);
}
// async function estimateSwapFee(wallet: ethers.Wallet, tokenIn: string, tokenOut: string, amount: ethers.BigNumber): Promise<ethers.BigNumber> {
//   const uniswapFactory = new ethers.Contract(config.uniswapV3FactoryAddress, UNISWAP_V3_FACTORY_ABI, wallet);
//   const fees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
//   for (const fee of fees) {
//     const poolAddress = await uniswapFactory.getPool(tokenIn, tokenOut, fee);
//     if (poolAddress !== ethers.constants.AddressZero) {
//       const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, wallet);
//       const liquidity = await pool.liquidity();
//       if (liquidity.gt(0)) {
//         // Simplified fee calculation, in reality, it would depend on the price impact
//         return amount.mul(fee).div(1000000);
//       }
//     }
//   }
//   // If no suitable pool found, return a high fee to discourage the swap
//   return amount.div(10); // 10% fee as a fallback
// }
