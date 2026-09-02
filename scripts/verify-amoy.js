// scripts/verify-amoy.js
//
// Verifies the ElectionFactory and every Election it has deployed.
//
// The Election contracts are created from inside the factory, so their constructor
// arguments are not in any deployment receipt — they are reconstructed here from the
// factory's own registry plus each election's candidate list.
//
// Requires ETHERSCAN_API_KEY (a single etherscan.io key; it covers Amoy via the V2
// multichain API) and NEXT_PUBLIC_FACTORY_ADDRESS.

const hre = require("hardhat");

const FACTORY_ABI = [
  "function owner() view returns (address)",
  "function getAllElections() view returns (tuple(address electionAddress, string title, string description, uint256 createdAt, uint256 startTime, uint256 endTime)[])",
];
const ELECTION_ABI = ["function getResults() view returns (string[], uint256[])"];

async function verify(label, address, constructorArguments) {
  process.stdout.write(`  ${label.padEnd(28)} `);
  try {
    await hre.run("verify:verify", { address, constructorArguments });
    console.log("verified");
    return "verified";
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/already verified/i.test(msg)) {
      console.log("already verified");
      return "already";
    }
    console.log("FAILED");
    console.log(`    ${msg.split("\n")[0]}`);
    return "failed";
  }
}

async function main() {
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) throw new Error("NEXT_PUBLIC_FACTORY_ADDRESS is not set (check .env.local).");
  if (!process.env.ETHERSCAN_API_KEY) throw new Error("ETHERSCAN_API_KEY is not set (get one at etherscan.io/apis).");

  const factory = new hre.ethers.Contract(factoryAddress, FACTORY_ABI, hre.ethers.provider);
  const admin = await factory.owner();
  const elections = await factory.getAllElections();

  console.log(`Factory  : ${factoryAddress}`);
  console.log(`Admin    : ${admin}`);
  console.log(`Elections: ${elections.length}\n`);

  const results = [];
  results.push(await verify("ElectionFactory", factoryAddress, []));

  for (const e of elections) {
    // The factory passes msg.sender — itself gated by onlyOwner — as the election owner.
    const [candidateNames] = await new hre.ethers.Contract(e.electionAddress, ELECTION_ABI, hre.ethers.provider).getResults();
    results.push(await verify(e.title, e.electionAddress, [
      admin,
      e.title,
      e.description,
      [...candidateNames],
      Number(e.startTime),
      Number(e.endTime),
    ]));
  }

  const count = (k) => results.filter((r) => r === k).length;
  console.log(`\nverified ${count("verified")}, already verified ${count("already")}, failed ${count("failed")}`);
  console.log(`\nBrowse: https://amoy.polygonscan.com/address/${factoryAddress}#code`);
  if (count("failed")) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
