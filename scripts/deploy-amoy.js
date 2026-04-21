// scripts/deploy-amoy.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying to Polygon Amoy (testnet)");
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log("Balance:", balanceEth, "MATIC");

  if (parseFloat(balanceEth) < 0.05) {
    console.warn("⚠️  Low balance. Get free test MATIC at https://faucet.polygon.technology");
  }

  console.log("\nDeploying ElectionFactory...");
  const Factory = await hre.ethers.getContractFactory("ElectionFactory");

  // Get current gas price and add 20% buffer — prevents "underpriced" errors
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice * 120n / 100n;
  console.log("Gas price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");

  const factory = await Factory.deploy({ gasPrice });
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const txHash = factory.deploymentTransaction()?.hash;

  console.log("\n✅ ElectionFactory deployed!");
  console.log("   Address:", factoryAddress);
  console.log("   Tx Hash:", txHash);
  console.log("   Explorer: https://amoy.polygonscan.com/address/" + factoryAddress);

  // Update .env.local
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = `NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_CHAIN_HEX=0x13882
NEXT_PUBLIC_CHAIN_NAME=Polygon Amoy
NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}
NEXT_PUBLIC_EXPLORER_BASE_URL=https://amoy.polygonscan.com
NEXT_PUBLIC_ADMIN_ADDRESS=${deployer.address}
`;
  fs.writeFileSync(envPath, envContent);
  console.log("\n📝 .env.local updated.");

  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("\nVerifying on PolygonScan...");
    try {
      await hre.run("verify:verify", { address: factoryAddress, constructorArguments: [] });
      console.log("✅ Verified on PolygonScan");
    } catch (e) {
      console.log("⚠️  Verification failed:", e.message);
    }
  }

  console.log("\n🚀 Next steps:");
  console.log("   1. Run 'npm run dev' and open http://localhost:3000");
  console.log("   2. Connect MetaMask to Polygon Amoy");
  console.log("   3. Go to /admin to create your first election");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
