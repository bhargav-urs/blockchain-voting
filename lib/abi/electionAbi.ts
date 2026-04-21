export const electionAbi = [
  // State
  "function factory() view returns (address)",
  "function owner() view returns (address)",
  "function title() view returns (string)",
  "function description() view returns (string)",
  "function isActive() view returns (bool)",
  "function startTime() view returns (uint256)",
  "function endTime() view returns (uint256)",
  "function createdAt() view returns (uint256)",
  "function totalVotes() view returns (uint256)",
  "function isRegisteredVoter(address) view returns (bool)",
  "function hasVoted(address) view returns (bool)",
  "function votedAt(address) view returns (uint256)",

  // Admin
  "function registerVoters(address[] voters)",
  "function removeVoter(address voter)",
  "function activate()",
  "function deactivate()",
  "function updateTimeWindow(uint256 newStart, uint256 newEnd)",

  // Voter
  "function vote(uint256 candidateId)",

  // Views
  "function isVotingOpen() view returns (bool)",
  "function candidateCount() view returns (uint256)",
  "function getResults() view returns (string[] names, uint256[] voteCounts)",
  "function getVoterStatus(address voter) view returns (bool registered, bool voted, uint256 timestamp)",
  "function getMyVote() view returns (bool voted, uint256 candidateId, string candidateName, uint256 timestamp)",
  "function getElectionInfo() view returns (string title, string description, bool isActive, bool isVotingOpen, uint256 startTime, uint256 endTime, uint256 createdAt, uint256 totalVotes, uint256 candidateCount)",

  // Events
  "event VoterRegistered(address indexed voter)",
  "event VoterRemoved(address indexed voter)",
  "event ElectionActivated()",
  "event ElectionDeactivated()",
  "event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp)",
] as const;
