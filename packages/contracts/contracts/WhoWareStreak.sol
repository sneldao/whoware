// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * Soul-bound streak token. One token per player, updated in-place as the
 * streak grows. Visual tier thresholds unlock at milestones.
 *
 * Tier badges:
 *   0   — No streak
 *   1–6 — Spark (🔥)
 *   7–29 — Flame (🔥🔥)
 *   30–99 — Inferno (🔥🔥🔥)
 *   100+  — Eternal (💎)
 */
contract WhoWareStreak is ERC721, Ownable, EIP712 {
    using ECDSA for bytes32;

    address public oracle;

    uint256 private _nextTokenId = 1;

    struct StreakData {
        uint256 current;
        uint256 best;
        uint256 lastSolvedDay;
        uint256 totalSolved;
        uint256 updatedAt;
    }

    mapping(address => uint256) public playerTokenId;
    mapping(uint256 => StreakData) public streaks;

    bytes32 private constant UPDATE_TYPEHASH =
        keccak256("UpdateStreak(address player,uint256 currentStreak,uint256 bestStreak,uint256 lastSolvedDay,uint256 totalSolved,uint256 nonce)");

    mapping(address => uint256) public nonces;

    event StreakUpdated(
        address indexed player,
        uint256 current,
        uint256 best,
        uint256 lastSolvedDay,
        string tier
    );

    constructor(address _oracle)
        ERC721("WhoWare Streak", "WHOWSTK")
        Ownable(msg.sender)
        EIP712("WhoWareStreak", "1")
    {
        oracle = _oracle;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function updateStreak(
        address player,
        uint256 currentStreak,
        uint256 bestStreak,
        uint256 lastSolvedDay,
        uint256 totalSolved,
        bytes calldata signature
    ) external {
        uint256 nonce = nonces[player]++;

        bytes32 structHash = keccak256(
            abi.encode(UPDATE_TYPEHASH, player, currentStreak, bestStreak, lastSolvedDay, totalSolved, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == oracle, "WhoWareStreak: invalid oracle signature");

        uint256 tokenId = playerTokenId[player];
        if (tokenId == 0) {
            tokenId = _nextTokenId++;
            _safeMint(player, tokenId);
            playerTokenId[player] = tokenId;
        }

        streaks[tokenId] = StreakData({
            current: currentStreak,
            best: bestStreak,
            lastSolvedDay: lastSolvedDay,
            totalSolved: totalSolved,
            updatedAt: block.timestamp
        });

        emit StreakUpdated(player, currentStreak, bestStreak, lastSolvedDay, getTier(currentStreak));
    }

    function getTier(uint256 streak) public pure returns (string memory) {
        if (streak >= 100) return "eternal";
        if (streak >= 30) return "inferno";
        if (streak >= 7) return "flame";
        if (streak >= 1) return "spark";
        return "none";
    }

    function getStreak(address player) external view returns (StreakData memory) {
        uint256 tokenId = playerTokenId[player];
        if (tokenId == 0) {
            return StreakData(0, 0, 0, 0, 0);
        }
        return streaks[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("WhoWareStreak: soul-bound, cannot transfer");
        }
        return super._update(to, tokenId, auth);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
