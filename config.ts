import { ethers } from 'ethers';

export const config = {
  rpcUrl: 'https://node.ghostnet.etherlink.com',
  privateKey: '',
  aavePoolAddress: '0xB0462c142FE3dEEDA33C6Dad2528C509A009136D',
  healthFactorThreshold: ethers.utils.parseUnits('1', 18),
  gasLimit: 500000,
  gasPrice: ethers.utils.parseUnits('50', 'gwei'),
  aaveDataProviderAddress: '0xb46D15E68Eb5a9b5712828D46293A690b2977464', 
  aaveOracleAddress: '0x1a1aAcEe1a75d3bDAEB9EF27430b05c665d58891', 
};
