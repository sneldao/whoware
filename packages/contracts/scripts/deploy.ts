import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.viem.getWalletClients();

  console.log(`Deploying contracts with account: ${deployer.account.address}`);

  // Deploy WhoWareScore — oracle is the deployer for now (replace with Convex action signer)
  const score = await hre.viem.deployContract("WhoWareScore", [deployer.account.address]);
  console.log(`WhoWareScore deployed to: ${score.address}`);

  // Deploy WhoWareStreak
  const streak = await hre.viem.deployContract("WhoWareStreak", [deployer.account.address]);
  console.log(`WhoWareStreak deployed to: ${streak.address}`);

  // Deploy WhoWareGuess (no oracle needed — players commit directly)
  const guess = await hre.viem.deployContract("WhoWareGuess", []);
  console.log(`WhoWareGuess deployed to: ${guess.address}`);

  console.log("\n--- Deployment Summary ---");
  console.log(`WhoWareScore: ${score.address}`);
  console.log(`WhoWareStreak: ${streak.address}`);
  console.log(`WhoWareGuess: ${guess.address}`);
  console.log(`Oracle (deployer): ${deployer.account.address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Chain ID: ${hre.network.config.chainId ?? "unknown"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
