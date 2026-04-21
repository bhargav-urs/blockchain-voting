export const factoryAbi = [
  // State
  "function owner() view returns (address)",

  // Elections
  "function createElection(string title, string description, string[] candidateNames, uint256 startTime, uint256 endTime) returns (address)",
  "function getElectionCount() view returns (uint256)",
  "function getElectionAt(uint256 index) view returns (tuple(address electionAddress, string title, string description, uint256 createdAt, uint256 startTime, uint256 endTime))",
  "function getAllElections() view returns (tuple(address electionAddress, string title, string description, uint256 createdAt, uint256 startTime, uint256 endTime)[])",
  "function isElectionFromFactory(address addr) view returns (bool)",

  // Events
  "event ElectionCreated(address indexed electionAddress, string title, uint256 startTime, uint256 endTime, uint256 createdAt)",
] as const;
