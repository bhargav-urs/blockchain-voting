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
  console.log("Balance:", balanceEth, "POL");

  if (parseFloat(balanceEth) < 0.05) {
    console.warn("⚠️  Low balance. Get free test POL at https://faucet.polygon.technology");
  }

  console.log("\nDeploying ElectionFactory...");
  const Factory = await hre.ethers.getContractFactory("ElectionFactory");

  // Use a fixed reasonable gas price (50 gwei) instead of network's spiked price
  // Amoy's reported gas price can spike to absurd levels but actual cost is much lower
  const gasPrice = hre.ethers.parseUnits("50", "gwei");
  console.log("Gas price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");

  const factory = await Factory.deploy({ gasPrice });
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const txHash = factory.deploymentTransaction()?.hash;

  console.log("\n✅ ElectionFactory deployed!");
  console.log("   Address:", factoryAddress);
  console.log("   Tx Hash:", txHash);
  console.log("   Explorer: https://amoy.polygonscan.com/address/" + factoryAddress);

  const envPath = path.join(__dirname, "../.env.local");
  const envContent = `NEXT_PUBLIC_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_CHAIN_HEX=0x13882
NEXT_PUBLIC_CHAIN_NAME=Polygon Amoy
NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}
NEXT_PUBLIC_EXPLORER_BASE_URL=https://amoy.polygonscan.com
NEXT_PUBLIC_ADMIN_ADDRESS=${deployer.address}
`;
  fs.writeFileSync(envPath, envContent);
  console.log("\n📝 .env.local updated.");

  // Verifying straight after deployment is the only moment the source is guaranteed to
  // match the deployed bytecode exactly — any later edit, even to a comment, changes the
  // metadata hash and breaks Etherscan's match.
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\n🔎 Waiting for the explorer to index the deployment…");
    await new Promise((r) => setTimeout(r, 30_000));
    try {
      await hre.run("verify:verify", { address: factoryAddress, constructorArguments: [] });
      console.log("✅ ElectionFactory verified on PolygonScan.");
    } catch (err) {
      const msg = String(err?.message ?? err);
      console.warn(/already verified/i.test(msg)
        ? "ℹ️  Already verified."
        : `⚠️  Verification failed: ${msg.split("\n")[0]}\n   Retry later with: npm run verify:amoy`);
    }
  } else {
    console.log("\nℹ️  ETHERSCAN_API_KEY not set — skipping verification.");
    console.log("   Set it and run: npm run verify:amoy");
  }

  console.log("\n🚀 Next steps:");
  console.log("   1. Copy NEXT_PUBLIC_FACTORY_ADDRESS to Vercel env vars");
  console.log("   2. Redeploy with: npx vercel --prod");
  console.log("   3. Verify any elections you create: npm run verify:amoy");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
