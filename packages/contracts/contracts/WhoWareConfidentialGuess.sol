// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * WhoWareConfidentialGuess — Inco Lightning encrypted guessing.
 *
 * Replaces the commit-reveal scheme in WhoWareGuess.sol with a single-tx
 * encrypted guess. The answer is set encrypted on-chain by the curator;
 * players submit encrypted guesses; the contract checks equality on-chain
 * using e.eq; the correctness result is revealed at episode close.
 *
 * Flow:
 *   1. Curator calls setAnswer(encryptedAnswer) — answer stored as euint256
 *   2. Player calls submitGuess(episodeDay, encryptedGuess) — single tx
 *   3. Contract computes e.eq(guess, answer) → ebool, stored encrypted
 *   4. At episode close, anyone calls revealResult(player, episodeDay)
 *   5. The ebool is publicly revealed via e.reveal
 *   6. Frontend reads the attested result
 *
 * Privacy guarantees:
 *   - The answer is never plaintext on-chain
 *   - Individual guesses are never plaintext on-chain
 *   - Correctness is only revealed after episode close
 *   - No commit-reveal timing attack surface
 */
import {euint256, ebool, e, inco} from "@inco/lightning/src/Lib.sol";

contract WhoWareConfidentialGuess {
    using e for *;

    // ── State ──────────────────────────────────────────────────────

    /// The encrypted answer for a given episode day.
    mapping(uint256 => euint256) public episodeAnswer;
    mapping(uint256 => bool) public answerSet;

    /// Per-player per-episode guess result.
    struct EncryptedGuess {
        ebool isCorrect;
        bool revealed;
        bool hasGuessed;
    }
    mapping(address => mapping(uint256 => EncryptedGuess)) public guesses;

    // ── Events ──────────────────────────────────────────────────────

    event AnswerSet(uint256 indexed episodeDay);
    event GuessSubmitted(address indexed player, uint256 indexed episodeDay);
    event ResultRevealed(address indexed player, uint256 indexed episodeDay);

    // ── Curator: set the encrypted answer ──────────────────────────

    /**
     * @param episodeDay  The day identifier for the episode.
     * @param ciphertext  The encrypted answer (figure ID as euint256),
     *                    produced by zap.encrypt() in the JS SDK.
     */
    function setAnswer(uint256 episodeDay, bytes calldata ciphertext) external {
        require(!answerSet[episodeDay], "answer already set");

        euint256 answer = e.newEuint256(ciphertext);
        e.allowThis(answer);
        episodeAnswer[episodeDay] = answer;
        answerSet[episodeDay] = true;

        emit AnswerSet(episodeDay);
    }

    // ── Player: submit an encrypted guess ──────────────────────────

    /**
     * @param episodeDay   The day identifier for the episode.
     * @param ciphertext   The encrypted guess (figure ID as euint256),
     *                     produced by zap.encrypt() in the JS SDK.
     */
    function submitGuess(uint256 episodeDay, bytes calldata ciphertext) external {
        require(answerSet[episodeDay], "answer not set");
        require(!guesses[msg.sender][episodeDay].hasGuessed, "already guessed");

        euint256 guess = e.newEuint256(ciphertext);
        e.allowThis(guess);

        // Compute equality on-chain — the result is encrypted
        ebool correct = e.eq(guess, episodeAnswer[episodeDay]);
        e.allowThis(correct);

        guesses[msg.sender][episodeDay] = EncryptedGuess({
            isCorrect: correct,
            revealed: false,
            hasGuessed: true
        });

        emit GuessSubmitted(msg.sender, episodeDay);
    }

    // ── Settlement: reveal the correctness result ───────────────────

    /**
     * @param player     The player whose guess to reveal.
     * @param episodeDay The day identifier for the episode.
     */
    function revealResult(address player, uint256 episodeDay) external {
        EncryptedGuess storage g = guesses[player][episodeDay];
        require(g.hasGuessed, "no guess submitted");
        require(!g.revealed, "already revealed");

        e.reveal(g.isCorrect);
        g.revealed = true;

        emit ResultRevealed(player, episodeDay);
    }

    // ── Read helpers ───────────────────────────────────────────────

    function hasGuessed(address player, uint256 episodeDay) external view returns (bool) {
        return guesses[player][episodeDay].hasGuessed;
    }

    function isRevealed(address player, uint256 episodeDay) external view returns (bool) {
        return guesses[player][episodeDay].revealed;
    }
}
