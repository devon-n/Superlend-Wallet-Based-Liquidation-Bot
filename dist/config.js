"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const ethers_1 = require("ethers");
exports.config = {
    rpcUrl: 'https://node.mainnet.etherlink.com',
    privateKey: '8c472157d4f384a6665e1b495b79f80814f8d4e71527c1d6c7855f976ef58d89',
    aavePoolAddress: '0x3bD16D195786fb2F509f2E2D7F69920262EF114D',
    healthFactorThreshold: ethers_1.ethers.utils.parseUnits('1', 18),
    gasLimit: 500000,
    gasPrice: ethers_1.ethers.utils.parseUnits('50', 'gwei'),
    aaveDataProviderAddress: '0x99e8269dDD5c7Af0F1B3973A591b47E8E001BCac',
    aaveOracleAddress: '0xeCF313dE38aA85EF618D06D1A602bAa917D62525',
};
