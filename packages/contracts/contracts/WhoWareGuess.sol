// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * Commit-reveal guessing scheme for fair competitive play.
 *
 * Flow:
 *   1. Player calls commitGuess(episodeDay, keccak256(abi.encodePacked(guess, salt)))
 *   2. After the episode closes, player calls revealGuess(episodeDay, guess, salt)
 *   3. The hash is verified, and the guess is recorded on-chain.
 *
 * This prevents players from seeing others' guesses and copying correct answers
 * on the leaderboard.
 */
contract WhoWareGuess {
    struct Commitment {
        bytes32 guessHash;
        uint256 committedAt;
        bool revealed;
    }

    struct RevealedGuess {
        address player;
        string guess;
        uint256 revealedAt;
    }

    mapping(address => mapping(uint256 => Commitment)) public commitments;
    mapping(uint256 => RevealedGuess[]) public revealedGuesses;

    event GuessCommitted(address indexed player, uint256 indexed episodeDay, bytes32 guessHash);
    event GuessRevealed(address indexed player, uint256 indexed episodeDay, string guess);

    function commitGuess(uint256 episodeDay, bytes32 guessHash) external {
        require(commitments[msg.sender][episodeDay].guessHash == bytes32(0), "WhoWareGuess: already committed");
        require(guessHash != bytes32(0), "WhoWareGuess: empty hash");

        commitments[msg.sender][episodeDay] = Commitment({
            guessHash: guessHash,
            committedAt: block.timestamp,
            revealed: false
        });

        emit GuessCommitted(msg.sender, episodeDay, guessHash);
    }

    function revealGuess(uint256 episodeDay, string calldata guess, bytes32 salt) external {
        Commitment storage commitment = commitments[msg.sender][episodeDay];
        require(commitment.guessHash != bytes32(0), "WhoWareGuess: no commitment");
        require(!commitment.revealed, "WhoWareGuess: already revealed");

        bytes32 expectedHash = keccak256(abi.encodePacked(guess, salt));
        require(expectedHash == commitment.guessHash, "WhoWareGuess: hash mismatch");

        commitment.revealed = true;
        revealedGuesses[episodeDay].push(RevealedGuess({
            player: msg.sender,
            guess: guess,
            revealedAt: block.timestamp
        }));

        emit GuessRevealed(msg.sender, episodeDay, guess);
    }

    function getRevealedCount(uint256 episodeDay) external view returns (uint256) {
        return revealedGuesses[episodeDay].length;
    }

    function getRevealedGuess(uint256 episodeDay, uint256 index) external view returns (RevealedGuess memory) {
        return revealedGuesses[episodeDay][index];
    }
}
