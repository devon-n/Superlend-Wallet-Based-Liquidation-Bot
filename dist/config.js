"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const ethers_1 = require("ethers");
exports.config = {
    rpcUrl: 'https://node.ghostnet.etherlink.com',
    privateKey: '8c472157d4f384a6665e1b495b79f80814f8d4e71527c1d6c7855f976ef58d89',
    aavePoolAddress: '0xB0462c142FE3dEEDA33C6Dad2528C509A009136D',
    healthFactorThreshold: ethers_1.ethers.utils.parseUnits('1', 18), // 1.0 in Wei
    gasLimit: 500000,
    gasPrice: ethers_1.ethers.utils.parseUnits('50', 'gwei'), // Adjust as needed
    aaveDataProviderAddress: '0xb46D15E68Eb5a9b5712828D46293A690b2977464',
    aaveOracleAddress: '0x1a1aAcEe1a75d3bDAEB9EF27430b05c665d58891',
};
