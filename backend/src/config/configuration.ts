export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/hacknest',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXP || '7d',
  },
  web3: {
    providerUrl: process.env.ETH_PROVIDER_URL || 'https://rpc.base.org',
    chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
    privateKey: process.env.PRIVATE_KEY,
  },
  contracts: {
    eventFactoryAddress: process.env.EVENT_FACTORY_ADDRESS || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

