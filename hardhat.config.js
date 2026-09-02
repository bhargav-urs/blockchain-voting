require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {
      mining: { auto: true, interval: 1000 },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY]
        : [],
      chainId: 80002,
      gas: 3000000,
      gasPrice: 50000000000, // 50 gwei
    },
  },
  etherscan: {
    // Must be a plain string, not a per-network object. hardhat-verify switches to the
    // Etherscan V2 multichain API only when the key is a string; an object pins it to
    // the old per-explorer V1 endpoints, and api-amoy.polygonscan.com/api now answers
    // every request with "You are using a deprecated V1 endpoint".
    // One etherscan.io key covers Amoy (chainid 80002) and every other supported chain.
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },

  // Sourcify would be attractive here (no API key, and it accepts a partial match when
  // only the metadata hash differs) but hardhat-verify 2.x — the newest line that works
  // with Hardhat 2 — still calls Sourcify's retired v1 endpoints, which now return HTML.
  // Left off so it does not add a spurious failure to every verify run.
  sourcify: {
    enabled: false,
  },
};
