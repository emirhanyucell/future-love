// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEFutureLove
 * @notice A decentralized encrypted registry where each user can store a random 10-number sequence.
 *         All data is stored privately using Fully Homomorphic Encryption (FHE).
 */
contract FHEFutureLove is ZamaEthereumConfig {
    /// @notice Stores each user's encrypted random sequence.
    mapping(address => euint32) private _encryptedSequence;

    /// @notice Tracks whether a user has already registered their sequence.
    mapping(address => bool) private _isRegistered;

    /**
     * @notice Submits the user's encrypted random sequence.
     * @param sequenceEncrypted The encrypted sequence (FHE-encrypted uint32 representing 10 numbers).
     * @param proof Zero-knowledge proof corresponding to the encrypted value.
     * @dev
     * - Each user can register only once.
     * - Grants decryption rights to both the user and the contract.
     */
    function registerSequence(externalEuint32 sequenceEncrypted, bytes calldata proof) external {
        require(!_isRegistered[msg.sender], "FHEFutureLove: already registered");

        euint32 sequenceValue = FHE.fromExternal(sequenceEncrypted, proof);
        _encryptedSequence[msg.sender] = sequenceValue;

        // Allow both the user and this contract to decrypt if needed
        FHE.allow(sequenceValue, msg.sender);
        FHE.allowThis(sequenceValue);

        _isRegistered[msg.sender] = true;
    }

    /**
     * @notice Checks if a user has already registered their sequence.
     * @param user The address to check.
     * @return True if the user has already registered.
     */
    function isRegistered(address user) external view returns (bool) {
        return _isRegistered[user];
    }

    /**
     * @notice Retrieves the encrypted random sequence for a given user.
     * @param user Address of the user whose encrypted sequence is requested.
     * @return The encrypted sequence (`euint32`).
     * @dev Only the user or this contract can decrypt the value.
     */
    function getEncryptedSequence(address user) external view returns (euint32) {
        return _encryptedSequence[user];
    }
}
