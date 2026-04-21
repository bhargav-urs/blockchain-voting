export const appConfig = {
  rpcUrl:      process.env.NEXT_PUBLIC_RPC_URL      || "https://rpc-amoy.polygon.technology/",
  chainId:     parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "80002"),
  chainHex:    process.env.NEXT_PUBLIC_CHAIN_HEX    || "0x13882",
  chainName:   process.env.NEXT_PUBLIC_CHAIN_NAME   || "Polygon Amoy",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || "https://amoy.polygonscan.com",
  factoryAddress: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "",
  adminAddress:   process.env.NEXT_PUBLIC_ADMIN_ADDRESS   || "",
};
