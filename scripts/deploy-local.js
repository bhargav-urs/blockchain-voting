// scripts/deploy-local.js
// Run: npx hardhat run scripts/deploy-local.js --network localhost

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const Factory = await hre.ethers.getContractFactory("ElectionFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("\n✅ ElectionFactory deployed to:", factoryAddress);
  console.log("   Admin (owner):", deployer.address);

  // Write to .env.local automatically
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_CHAIN_HEX=0x7A69
NEXT_PUBLIC_CHAIN_NAME=Hardhat Local
NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}
NEXT_PUBLIC_EXPLORER_BASE_URL=
NEXT_PUBLIC_ADMIN_ADDRESS=${deployer.address}
`;
  fs.writeFileSync(envPath, envContent);
  console.log("\n📝 .env.local updated with factory address.");
  console.log("\n🚀 Run 'npm run dev' to start the frontend.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
