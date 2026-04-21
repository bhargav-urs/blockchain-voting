// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Election.sol";

/**
 * @title ElectionFactory
 * @notice Deploys and tracks all Election contracts.
 *         The deployer address becomes the permanent admin.
 */
contract ElectionFactory {
    // ─────────────────────────── Structs ───────────────────────────

    struct ElectionRecord {
        address electionAddress;
        string  title;
        string  description;
        uint256 createdAt;
        uint256 startTime;
        uint256 endTime;
    }

    // ─────────────────────────── Storage ───────────────────────────

    address public immutable owner;
    ElectionRecord[] private elections;

    // ─────────────────────────── Events ────────────────────────────

    event ElectionCreated(
        address indexed electionAddress,
        string  title,
        uint256 startTime,
        uint256 endTime,
        uint256 createdAt
    );

    // ─────────────────────────── Errors ────────────────────────────

    error NotOwner();
    error InvalidElection();

    // ─────────────────────────── Modifiers ─────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─────────────────────────── Constructor ───────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────── Functions ─────────────────────────

    /**
     * @notice Create a new Election contract.
     * @param title_            Short name shown on the ballot.
     * @param description_      Longer context shown to voters.
     * @param candidateNames_   At least two candidate names.
     * @param startTime_        Unix timestamp when voting opens.
     * @param endTime_          Unix timestamp when voting closes.
     */
    function createElection(
        string   calldata title_,
        string   calldata description_,
        string[] calldata candidateNames_,
        uint256  startTime_,
        uint256  endTime_
    ) external onlyOwner returns (address) {
        Election election = new Election(
            msg.sender,
            title_,
            description_,
            candidateNames_,
            startTime_,
            endTime_
        );

        address addr = address(election);

        elections.push(ElectionRecord({
            electionAddress: addr,
            title:           title_,
            description:     description_,
            createdAt:       block.timestamp,
            startTime:       startTime_,
            endTime:         endTime_
        }));

        emit ElectionCreated(addr, title_, startTime_, endTime_, block.timestamp);
        return addr;
    }

    // ─────────────────────────── View Functions ────────────────────

    function getElectionCount() external view returns (uint256) {
        return elections.length;
    }

    function getElectionAt(uint256 index)
        external
        view
        returns (ElectionRecord memory)
    {
        return elections[index];
    }

    function getAllElections()
        external
        view
        returns (ElectionRecord[] memory)
    {
        return elections;
    }

    function isElectionFromFactory(address addr) external view returns (bool) {
        for (uint256 i = 0; i < elections.length; i++) {
            if (elections[i].electionAddress == addr) return true;
        }
        return false;
    }
}
