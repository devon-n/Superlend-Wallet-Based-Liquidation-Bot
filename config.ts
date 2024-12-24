import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config()

export const config = {
  rpcUrl: 'https://node.mainnet.etherlink.com',
  privateKey: process.env.PRIVATE_KEY as string,
  aavePoolAddress: '0x3bD16D195786fb2F509f2E2D7F69920262EF114D',
  healthFactorThreshold: ethers.utils.parseUnits('1', 18),
  gasLimit: 500000,
  gasPrice: ethers.utils.parseUnits('50', 'gwei'),
  aaveDataProviderAddress: '0x99e8269dDD5c7Af0F1B3973A591b47E8E001BCac',
  aaveOracleAddress: '0xeCF313dE38aA85EF618D06D1A602bAa917D62525',
};
