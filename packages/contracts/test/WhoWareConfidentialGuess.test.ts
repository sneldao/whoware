import { expect } from "chai";
import hre from "hardhat";

/**
 * Tests for WhoWareConfidentialGuess — the Inco Lightning encrypted guessing contract.
 *
 * These tests use Inco's Hardhat cheatcodes (fakePrepareEuint256Ciphertext,
 * processAllOperations, getBoolValue) to simulate the encrypted operations
 * without running a local covalidator.
 *
 * Prerequisites: the @inco/lightning library must be compiled and the
 * Hardhat environment must have the Inco cheatcodes injected.
 *
 * Run with: npx hardhat test test/WhoWareConfidentialGuess.test.ts
 */

describe("WhoWareConfidentialGuess", function () {
  async function deployFixture() {
    const [deployer, curator, player, other] = await hre.viem.getWalletClients();
    const contract = await hre.viem.deployContract("WhoWareConfidentialGuess", []);
    const publicClient = await hre.viem.getPublicClient();
    return { contract, deployer, curator, player, other, publicClient };
  }

  it("should set an encrypted answer", async function () {
    const { contract, curator } = await deployFixture();

    // Simulate an encrypted uint256 ciphertext for the answer (figure ID = 42)
    const ciphertext = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);

    await contract.write.setAnswer([1n, ciphertext], { account: curator.account });

    const isSet = await contract.read.answerSet([1n]);
    expect(isSet).to.equal(true);
  });

  it("should not allow setting the answer twice", async function () {
    const { contract, curator } = await deployFixture();

    const ciphertext = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.setAnswer([1n, ciphertext], { account: curator.account });

    // Second attempt should fail
    const ciphertext2 = await (contract as any).read.fakePrepareEuint256Ciphertext([99n]);
    await expect(
      contract.write.setAnswer([1n, ciphertext2], { account: curator.account })
    ).to.be.rejected;
  });

  it("should accept an encrypted guess and compute equality", async function () {
    const { contract, curator, player, publicClient } = await deployFixture();

    // Set answer to 42
    const answerCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.setAnswer([1n, answerCt], { account: curator.account });

    // Player submits a correct guess (also 42)
    const guessCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.submitGuess([1n, guessCt], { account: player.account });

    // Process pending encrypted operations
    await (publicClient as any).request({ method: "inco_processAllOperations" });

    const hasGuessed = await contract.read.hasGuessed([player.account.address, 1n]);
    expect(hasGuessed).to.equal(true);
  });

  it("should not allow double guessing", async function () {
    const { contract, curator, player } = await deployFixture();

    const answerCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.setAnswer([1n, answerCt], { account: curator.account });

    const guessCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.submitGuess([1n, guessCt], { account: player.account });

    // Second guess should fail
    const guessCt2 = await (contract as any).read.fakePrepareEuint256Ciphertext([99n]);
    await expect(
      contract.write.submitGuess([1n, guessCt2], { account: player.account })
    ).to.be.rejected;
  });

  it("should reject guesses before answer is set", async function () {
    const { contract, player } = await deployFixture();

    const guessCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await expect(
      contract.write.submitGuess([1n, guessCt], { account: player.account })
    ).to.be.rejected;
  });

  it("should track reveal state", async function () {
    const { contract, curator, player, publicClient } = await deployFixture();

    const answerCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.setAnswer([1n, answerCt], { account: curator.account });

    const guessCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.submitGuess([1n, guessCt], { account: player.account });

    // Process operations so the ebool is computed
    await (publicClient as any).request({ method: "inco_processAllOperations" });

    // Before reveal
    const beforeRevealed = await contract.read.isRevealed([player.account.address, 1n]);
    expect(beforeRevealed).to.equal(false);

    // Reveal the result
    await contract.write.revealResult([player.account.address, 1n], { account: player.account });

    const afterRevealed = await contract.read.isRevealed([player.account.address, 1n]);
    expect(afterRevealed).to.equal(true);
  });

  it("should not allow revealing before guessing", async function () {
    const { contract, player } = await deployFixture();

    await expect(
      contract.write.revealResult([player.account.address, 1n], { account: player.account })
    ).to.be.rejected;
  });

  it("should not allow double revealing", async function () {
    const { contract, curator, player, publicClient } = await deployFixture();

    const answerCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.setAnswer([1n, answerCt], { account: curator.account });

    const guessCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    await contract.write.submitGuess([1n, guessCt], { account: player.account });

    await (publicClient as any).request({ method: "inco_processAllOperations" });

    await contract.write.revealResult([player.account.address, 1n], { account: player.account });

    // Second reveal should fail
    await expect(
      contract.write.revealResult([player.account.address, 1n], { account: player.account })
    ).to.be.rejected;
  });

  it("should emit events for setAnswer, submitGuess, and revealResult", async function () {
    const { contract, curator, player, publicClient } = await deployFixture();

    // setAnswer
    const answerCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    const setTx = await contract.write.setAnswer([1n, answerCt], { account: curator.account });
    await publicClient.waitForTransactionReceipt({ hash: setTx });

    const setLogs = await publicClient.getLogs({
      address: contract.address,
      event: {
        type: "event",
        name: "AnswerSet",
        inputs: [{ type: "uint256", name: "episodeDay", indexed: true }],
      } as any,
      fromBlock: 0n,
    });
    expect(setLogs.length).to.be.greaterThan(0);

    // submitGuess
    const guessCt = await (contract as any).read.fakePrepareEuint256Ciphertext([42n]);
    const guessTx = await contract.write.submitGuess([1n, guessCt], { account: player.account });
    await publicClient.waitForTransactionReceipt({ hash: guessTx });

    const guessLogs = await publicClient.getLogs({
      address: contract.address,
      event: {
        type: "event",
        name: "GuessSubmitted",
        inputs: [
          { type: "address", name: "player", indexed: true },
          { type: "uint256", name: "episodeDay", indexed: true },
        ],
      } as any,
      fromBlock: 0n,
    });
    expect(guessLogs.length).to.be.greaterThan(0);

    // revealResult
    await (publicClient as any).request({ method: "inco_processAllOperations" });
    const revealTx = await contract.write.revealResult([player.account.address, 1n], { account: player.account });
    await publicClient.waitForTransactionReceipt({ hash: revealTx });

    const revealLogs = await publicClient.getLogs({
      address: contract.address,
      event: {
        type: "event",
        name: "ResultRevealed",
        inputs: [
          { type: "address", name: "player", indexed: true },
          { type: "uint256", name: "episodeDay", indexed: true },
        ],
      } as any,
      fromBlock: 0n,
    });
    expect(revealLogs.length).to.be.greaterThan(0);
  });
});
