// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Election
 * @notice A single, immutable election instance deployed by ElectionFactory.
 *         Votes are permanently recorded on-chain; no one can alter them.
 * @dev    Timestamps are Unix seconds. isActive is an admin-controlled gate.
 *         Voting succeeds only when isActive AND block.timestamp is within [startTime, endTime].
 */
contract Election {
    // ─────────────────────────── Structs ───────────────────────────

    struct Candidate {
        string name;
        uint256 voteCount;
    }

    // ─────────────────────────── Storage ───────────────────────────

    address public immutable factory;
    address public immutable owner;

    string  public title;
    string  public description;
    bool    public isActive;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public createdAt;
    uint256 public totalVotes;

    Candidate[] private candidates;

    mapping(address => bool)    public isRegisteredVoter;
    mapping(address => bool)    public hasVoted;
    mapping(address => uint256) private voterChoice;      // kept private: public stats ≠ individual disclosure
    mapping(address => uint256) public  votedAt;

    // ─────────────────────────── Events ────────────────────────────

    event VoterRegistered(address indexed voter);
    event VoterRemoved(address indexed voter);
    event ElectionActivated();
    event ElectionDeactivated();
    event VoteCast(
        address indexed voter,
        uint256 indexed candidateId,
        uint256 timestamp
    );

    // ─────────────────────────── Errors ────────────────────────────

    error NotOwner();
    error VotingNotOpen();
    error AlreadyVoted();
    error NotRegistered();
    error InvalidCandidate();
    error EmptyTitle();
    error NeedAtLeastTwoCandidates();
    error InvalidTimeWindow();
    error ZeroAddress();
    error ElectionAlreadyHasVotes();

    // ─────────────────────────── Modifiers ─────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─────────────────────────── Constructor ───────────────────────

    constructor(
        address owner_,
        string memory title_,
        string memory description_,
        string[] memory candidateNames_,
        uint256 startTime_,
        uint256 endTime_
    ) {
        if (bytes(title_).length == 0)       revert EmptyTitle();
        if (candidateNames_.length < 2)      revert NeedAtLeastTwoCandidates();
        if (startTime_ >= endTime_)          revert InvalidTimeWindow();

        factory     = msg.sender;
        owner       = owner_;
        title       = title_;
        description = description_;
        startTime   = startTime_;
        endTime     = endTime_;
        createdAt   = block.timestamp;
        isActive    = false;

        for (uint256 i = 0; i < candidateNames_.length; i++) {
            require(bytes(candidateNames_[i]).length > 0, "Candidate name empty");
            candidates.push(Candidate({ name: candidateNames_[i], voteCount: 0 }));
        }
    }

    // ─────────────────────────── Admin Functions ───────────────────

    /**
     * @notice Register one or more eligible voters by wallet address.
     */
    function registerVoters(address[] calldata voters) external onlyOwner {
        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            if (voter == address(0)) revert ZeroAddress();
            if (!isRegisteredVoter[voter]) {
                isRegisteredVoter[voter] = true;
                emit VoterRegistered(voter);
            }
        }
    }

    /**
     * @notice Remove a voter from the whitelist (only before they have voted).
     */
    function removeVoter(address voter) external onlyOwner {
        require(isRegisteredVoter[voter], "Not registered");
        require(!hasVoted[voter], "Voter already cast ballot");
        isRegisteredVoter[voter] = false;
        emit VoterRemoved(voter);
    }

    /**
     * @notice Activate the election (admin gate). Time window must also be valid.
     */
    function activate() external onlyOwner {
        isActive = true;
        emit ElectionActivated();
    }

    /**
     * @notice Deactivate the election regardless of time window.
     */
    function deactivate() external onlyOwner {
        isActive = false;
        emit ElectionDeactivated();
    }

    /**
     * @notice Update the time window before any votes are cast.
     */
    function updateTimeWindow(uint256 newStart, uint256 newEnd) external onlyOwner {
        if (totalVotes > 0) revert ElectionAlreadyHasVotes();
        if (newStart >= newEnd) revert InvalidTimeWindow();
        startTime = newStart;
        endTime   = newEnd;
    }

    // ─────────────────────────── Voter Function ────────────────────

    /**
     * @notice Cast a single, permanent, immutable vote.
     * @dev    Emits only candidateId, NOT candidateName – prevents name-based correlation.
     */
    function vote(uint256 candidateId) external {
        if (!isVotingOpen())                    revert VotingNotOpen();
        if (!isRegisteredVoter[msg.sender])     revert NotRegistered();
        if (hasVoted[msg.sender])               revert AlreadyVoted();
        if (candidateId >= candidates.length)   revert InvalidCandidate();

        hasVoted[msg.sender]      = true;
        voterChoice[msg.sender]   = candidateId;
        votedAt[msg.sender]       = block.timestamp;

        candidates[candidateId].voteCount += 1;
        totalVotes += 1;

        // Note: voter identity NOT emitted – only candidateId and timestamp
        emit VoteCast(msg.sender, candidateId, block.timestamp);
    }

    // ─────────────────────────── View Functions ────────────────────

    /**
     * @notice True when election is admin-active AND within the time window.
     */
    function isVotingOpen() public view returns (bool) {
        return isActive
            && block.timestamp >= startTime
            && block.timestamp <= endTime;
    }

    function candidateCount() external view returns (uint256) {
        return candidates.length;
    }

    /**
     * @notice Return aggregate results (names + vote counts). Privacy-safe.
     */
    function getResults()
        external
        view
        returns (string[] memory names, uint256[] memory voteCounts)
    {
        uint256 len = candidates.length;
        names       = new string[](len);
        voteCounts  = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            names[i]      = candidates[i].name;
            voteCounts[i] = candidates[i].voteCount;
        }
    }

    /**
     * @notice Returns whether a given voter has voted (but NOT for whom).
     *         The voterChoice mapping is private; this function only confirms participation.
     */
    function getVoterStatus(address voter)
        external
        view
        returns (bool registered, bool voted, uint256 timestamp)
    {
        registered = isRegisteredVoter[voter];
        voted      = hasVoted[voter];
        timestamp  = votedAt[voter];
    }

    /**
     * @notice A voter can view their OWN choice. Others cannot query this via the contract.
     */
    function getMyVote()
        external
        view
        returns (bool voted, uint256 candidateId, string memory candidateName, uint256 timestamp)
    {
        voted = hasVoted[msg.sender];
        if (!voted) return (false, 0, "", 0);
        candidateId   = voterChoice[msg.sender];
        candidateName = candidates[candidateId].name;
        timestamp     = votedAt[msg.sender];
    }

    /**
     * @notice Full election metadata for the frontend.
     */
    function getElectionInfo()
        external
        view
        returns (
            string memory title_,
            string memory description_,
            bool   isActive_,
            bool   isVotingOpen_,
            uint256 startTime_,
            uint256 endTime_,
            uint256 createdAt_,
            uint256 totalVotes_,
            uint256 candidateCount_
        )
    {
        return (
            title,
            description,
            isActive,
            isVotingOpen(),
            startTime,
            endTime,
            createdAt,
            totalVotes,
            candidates.length
        );
    }
}
