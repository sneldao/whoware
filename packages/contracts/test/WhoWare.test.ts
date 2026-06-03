import { expect } from "chai";
import hre from "hardhat";
import { encodePacked, keccak256 } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const ORACLE_KEY = generatePrivateKey();
const oracleAccount = privateKeyToAccount(ORACLE_KEY);

describe("WhoWareScore", function () {
  async function deployScoreFixture() {
    const [deployer, player] = await hre.viem.getWalletClients();
    const score = await hre.viem.deployContract("WhoWareScore", [oracleAccount.address]);
    return { score, deployer, player };
  }

  it("should mint a score NFT with valid oracle signature", async function () {
    const { score, player } = await deployScoreFixture();
    const publicClient = await hre.viem.getPublicClient();

    const playerAddress = player.account.address;
    const chainId = BigInt(hre.network.config.chainId ?? 31337);

    const domain = {
      name: "WhoWareScore",
      version: "1",
      chainId,
      verifyingContract: score.address,
    };

    const types = {
      MintScore: [
        { name: "player", type: "address" },
        { name: "episodeDay", type: "uint256" },
        { name: "score", type: "uint256" },
        { name: "memoriesViewed", type: "uint8" },
        { name: "cluesOpened", type: "uint8" },
        { name: "guessesUsed", type: "uint8" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const message = {
      player: playerAddress,
      episodeDay: 1n,
      score: 8500n,
      memoriesViewed: 2,
      cluesOpened: 3,
      guessesUsed: 1,
      nonce: 0n,
    };

    const signature = await oracleAccount.signTypedData({
      domain,
      types,
      primaryType: "MintScore",
      message,
    });

    const hash = await score.write.mintScore([
      playerAddress,
      1n,
      8500n,
      2,
      3,
      1,
      signature,
    ]);
    await publicClient.waitForTransactionReceipt({ hash });

    const record = await score.read.getRecord([0n]);
    expect(record.player.toLowerCase()).to.equal(playerAddress.toLowerCase());
    expect(Number(record.score)).to.equal(8500);
    expect(Number(record.episodeDay)).to.equal(1);
  });

  it("should reject minting with invalid signature", async function () {
    const { score, player } = await deployScoreFixture();
    const badKey = generatePrivateKey();
    const badAccount = privateKeyToAccount(badKey);

    const chainId = BigInt(hre.network.config.chainId ?? 31337);

    const domain = {
      name: "WhoWareScore",
      version: "1",
      chainId,
      verifyingContract: score.address,
    };

    const types = {
      MintScore: [
        { name: "player", type: "address" },
        { name: "episodeDay", type: "uint256" },
        { name: "score", type: "uint256" },
        { name: "memoriesViewed", type: "uint8" },
        { name: "cluesOpened", type: "uint8" },
        { name: "guessesUsed", type: "uint8" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const message = {
      player: player.account.address,
      episodeDay: 1n,
      score: 9999n,
      memoriesViewed: 1,
      cluesOpened: 0,
      guessesUsed: 1,
      nonce: 0n,
    };

    const badSignature = await badAccount.signTypedData({
      domain,
      types,
      primaryType: "MintScore",
      message,
    });

    await expect(
      score.write.mintScore([player.account.address, 1n, 9999n, 1, 0, 1, badSignature])
    ).to.be.rejected;
  });

  it("should prevent transfers (soul-bound)", async function () {
    const { score, player } = await deployScoreFixture();
    const [,, other] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const chainId = BigInt(hre.network.config.chainId ?? 31337);

    const domain = {
      name: "WhoWareScore",
      version: "1",
      chainId,
      verifyingContract: score.address,
    };

    const types = {
      MintScore: [
        { name: "player", type: "address" },
        { name: "episodeDay", type: "uint256" },
        { name: "score", type: "uint256" },
        { name: "memoriesViewed", type: "uint8" },
        { name: "cluesOpened", type: "uint8" },
        { name: "guessesUsed", type: "uint8" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const message = {
      player: player.account.address,
      episodeDay: 1n,
      score: 8000n,
      memoriesViewed: 2,
      cluesOpened: 1,
      guessesUsed: 1,
      nonce: 0n,
    };

    const signature = await oracleAccount.signTypedData({
      domain,
      types,
      primaryType: "MintScore",
      message,
    });

    const hash = await score.write.mintScore([player.account.address, 1n, 8000n, 2, 1, 1, signature]);
    await publicClient.waitForTransactionReceipt({ hash });

    await expect(
      score.write.transferFrom([player.account.address, other.account.address, 0n])
    ).to.be.rejected;
  });
});

describe("WhoWareGuess", function () {
  it("should commit and reveal a guess correctly", async function () {
    const guess = await hre.viem.deployContract("WhoWareGuess", []);
    const publicClient = await hre.viem.getPublicClient();

    const guessText = "Winston Churchill";
    const salt = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
    const guessHash = keccak256(encodePacked(["string", "bytes32"], [guessText, salt]));

    const commitHash = await guess.write.commitGuess([1n, guessHash]);
    await publicClient.waitForTransactionReceipt({ hash: commitHash });

    const revealHash = await guess.write.revealGuess([1n, guessText, salt]);
    await publicClient.waitForTransactionReceipt({ hash: revealHash });

    const count = await guess.read.getRevealedCount([1n]);
    expect(Number(count)).to.equal(1);

    const revealed = await guess.read.getRevealedGuess([1n, 0n]);
    expect(revealed.guess).to.equal(guessText);
  });

  it("should reject double commit", async function () {
    const guess = await hre.viem.deployContract("WhoWareGuess", []);
    const publicClient = await hre.viem.getPublicClient();

    const hash1 = keccak256(encodePacked(["string", "bytes32"], ["test", "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`]));
    const hash2 = keccak256(encodePacked(["string", "bytes32"], ["test2", "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`]));

    const txHash = await guess.write.commitGuess([1n, hash1]);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    await expect(guess.write.commitGuess([1n, hash2])).to.be.rejected;
  });

  it("should reject reveal with wrong salt", async function () {
    const guess = await hre.viem.deployContract("WhoWareGuess", []);
    const publicClient = await hre.viem.getPublicClient();

    const salt = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
    const wrongSalt = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`;
    const guessText = "Winston Churchill";
    const guessHash = keccak256(encodePacked(["string", "bytes32"], [guessText, salt]));

    const txHash = await guess.write.commitGuess([1n, guessHash]);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    await expect(guess.write.revealGuess([1n, guessText, wrongSalt])).to.be.rejected;
  });
});

describe("WhoWareStreak", function () {
  it("should mint and update streak with valid signature", async function () {
    const [player] = await hre.viem.getWalletClients();
    const streak = await hre.viem.deployContract("WhoWareStreak", [oracleAccount.address]);
    const publicClient = await hre.viem.getPublicClient();
    const chainId = BigInt(hre.network.config.chainId ?? 31337);

    const domain = {
      name: "WhoWareStreak",
      version: "1",
      chainId,
      verifyingContract: streak.address,
    };

    const types = {
      UpdateStreak: [
        { name: "player", type: "address" },
        { name: "currentStreak", type: "uint256" },
        { name: "bestStreak", type: "uint256" },
        { name: "lastSolvedDay", type: "uint256" },
        { name: "totalSolved", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const message = {
      player: player.account.address,
      currentStreak: 3n,
      bestStreak: 3n,
      lastSolvedDay: 100n,
      totalSolved: 3n,
      nonce: 0n,
    };

    const signature = await oracleAccount.signTypedData({
      domain,
      types,
      primaryType: "UpdateStreak",
      message,
    });

    const hash = await streak.write.updateStreak([player.account.address, 3n, 3n, 100n, 3n, signature]);
    await publicClient.waitForTransactionReceipt({ hash });

    const data = await streak.read.getStreak([player.account.address]);
    expect(Number(data.current)).to.equal(3);
    expect(Number(data.best)).to.equal(3);
  });

  it("should return correct tier names", async function () {
    const streak = await hre.viem.deployContract("WhoWareStreak", [oracleAccount.address]);

    expect(await streak.read.getTier([0n])).to.equal("none");
    expect(await streak.read.getTier([1n])).to.equal("spark");
    expect(await streak.read.getTier([7n])).to.equal("flame");
    expect(await streak.read.getTier([30n])).to.equal("inferno");
    expect(await streak.read.getTier([100n])).to.equal("eternal");
  });
});
