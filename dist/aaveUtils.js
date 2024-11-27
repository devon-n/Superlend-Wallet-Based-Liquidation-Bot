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
const client_1 = require("@libsql/client");
const AAVE_POOL_ABI = PoolABI_json_1.default;
const AAVE_DATA_PROVIDER_ABI = PoolDataProvider_json_1.default;
const AAVE_ORACLE_ABI = AaveOracle_json_1.default;
async function getUnhealthyPositions() {
    const client = (0, client_1.createClient)({
        url: "http://localhost:8080"
    });
    try {
        const result = await client.execute({
            sql: "SELECT user_address, health_factor, totalDebtValueInUsd, leadingCollateralReserve, leadingDebtReserve FROM USER_7",
            args: []
        });
        const unhealthyPositions = result.rows.map(row => ({
            userAddress: row.user_address,
            healthFactor: row.health_factor,
            totalDebtValueInUsd: row.totalDebtValueInUsd,
            leadingCollateralReserve: row.leadingCollateralReserve,
            leadingDebtReserve: row.leadingDebtReserve
        }));
        console.log("unhealthyPositions", unhealthyPositions);
        return unhealthyPositions;
    }
    catch (error) {
        console.error('Error fetching unhealthy positions:', error);
        return [];
    }
    finally {
        await client.close();
    }
}
async function liquidatePosition(wallet, userAddress, totalDebtValueInUsd, leadingCollateralReserve, leadingDebtReserve) {
    console.log(`Entering liquidatePosition for user: ${userAddress}`);
    const aavePool = new ethers_1.ethers.Contract(config_1.config.aavePoolAddress, AAVE_POOL_ABI, wallet);
    try {
        console.log(`Fetching user account data for: ${userAddress}`);
        const { healthFactor } = await aavePool.getUserAccountData(userAddress);
        const adjustedHealthFactor = healthFactor.div(ethers_1.ethers.BigNumber.from(10).pow(18));
        console.log(`Health factor for ${userAddress}: ${healthFactor.toString()}`);
        const eMode = await aavePool.getUserEMode(userAddress);
        console.log(`E-Mode for ${userAddress}: ${eMode}`);
        if ((adjustedHealthFactor.lt(ethers_1.ethers.BigNumber.from(1)) && totalDebtValueInUsd > 0.01)) {
            console.log(`Calculating profit for user: ${userAddress}`);
            console.log(`Liquidation is profitable for user: ${userAddress}`);
            console.log(`Attempting liquidation call for user: ${userAddress}`);
            console.log("max uint", ethers_1.ethers.constants.MaxUint256);
            const usdcContract = new ethers_1.ethers.Contract(leadingDebtReserve, ['function approve(address spender, uint256 amount) public returns (bool)'], wallet);
            const approveTx = await usdcContract.approve(config_1.config.aavePoolAddress, ethers_1.ethers.constants.MaxUint256);
            console.log('Waiting for approval transaction to be mined...');
            await approveTx.wait(1);
            console.log('Approval transaction confirmed');
            const tx = await aavePool['liquidationCall(address,address,address,uint256,bool)'](leadingCollateralReserve, leadingDebtReserve, userAddress, '1000000000000000000', false);
            console.log(`Waiting for transaction to be mined...`);
            tx.wait(2);
            console.log(`Liquidation successful for user: ${userAddress}`);
        }
        else {
            console.log(`Health factor ${ethers_1.ethers.utils.formatUnits(healthFactor, 18)} is above threshold for user: ${userAddress}`);
        }
    }
    catch (error) {
        console.error(`Error in liquidatePosition for user ${userAddress}:`, error);
    }
    console.log(`Exiting liquidatePosition for user: ${userAddress}`);
    // sleep for 1 minute
    await new Promise(resolve => setTimeout(resolve, 60000));
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
    const liquidationBonus = eMode.eq(1) ? ethers_1.ethers.BigNumber.from(10100) : ethers_1.ethers.BigNumber.from(10500);
    const liquidationBonusBase = ethers_1.ethers.BigNumber.from(10000);
    console.log("debt-data", debtData.balance.toString());
    console.log("collateral-data", collateralData.balance.toString());
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
