// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * Soul-bound score NFT. Each token represents a verified game solve on a
 * specific episode day. Non-transferable — the score is bound to the player.
 *
 * Only the backend oracle (trusted signer) can authorize mints, preventing
 * score manipulation.
 */
contract WhoWareScore is ERC721, Ownable, EIP712 {
    using ECDSA for bytes32;

    address public oracle;

    uint256 private _nextTokenId;

    struct ScoreRecord {
        address player;
        uint256 episodeDay;
        uint256 score;
        uint8 memoriesViewed;
        uint8 cluesOpened;
        uint8 guessesUsed;
        uint256 mintedAt;
    }

    mapping(uint256 => ScoreRecord) public records;
    mapping(address => mapping(uint256 => uint256)) public playerBestScore;
    mapping(address => uint256) public totalSolves;

    bytes32 private constant MINT_TYPEHASH =
        keccak256("MintScore(address player,uint256 episodeDay,uint256 score,uint8 memoriesViewed,uint8 cluesOpened,uint8 guessesUsed,uint256 nonce)");

    mapping(address => uint256) public nonces;

    event ScoreMinted(
        address indexed player,
        uint256 indexed episodeDay,
        uint256 tokenId,
        uint256 score,
        uint8 memoriesViewed,
        uint8 cluesOpened,
        uint8 guessesUsed
    );

    constructor(address _oracle)
        ERC721("WhoWare Score", "WHOWARE")
        Ownable(msg.sender)
        EIP712("WhoWareScore", "1")
    {
        oracle = _oracle;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function mintScore(
        address player,
        uint256 episodeDay,
        uint256 score,
        uint8 memoriesViewed,
        uint8 cluesOpened,
        uint8 guessesUsed,
        bytes calldata signature
    ) external returns (uint256) {
        uint256 nonce = nonces[player]++;

        bytes32 structHash = keccak256(
            abi.encode(MINT_TYPEHASH, player, episodeDay, score, memoriesViewed, cluesOpened, guessesUsed, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == oracle, "WhoWareScore: invalid oracle signature");

        uint256 tokenId = _nextTokenId++;
        _safeMint(player, tokenId);

        records[tokenId] = ScoreRecord({
            player: player,
            episodeDay: episodeDay,
            score: score,
            memoriesViewed: memoriesViewed,
            cluesOpened: cluesOpened,
            guessesUsed: guessesUsed,
            mintedAt: block.timestamp
        });

        if (score > playerBestScore[player][episodeDay]) {
            playerBestScore[player][episodeDay] = score;
        }
        totalSolves[player]++;

        emit ScoreMinted(player, episodeDay, tokenId, score, memoriesViewed, cluesOpened, guessesUsed);
        return tokenId;
    }

    /**
     * Soul-bound: transfers are disabled except for the initial mint.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("WhoWareScore: soul-bound, cannot transfer");
        }
        return super._update(to, tokenId, auth);
    }

    function getRecord(uint256 tokenId) external view returns (ScoreRecord memory) {
        return records[tokenId];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
