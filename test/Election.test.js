const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ElectionFactory + Election", function () {
  let factory, owner, voter1, voter2, voter3, nonVoter;

  const TITLE = "Student Council 2025";
  const DESC = "Vote for your student council president.";
  const CANDIDATES = ["Alice", "Bob", "Charlie"];

  async function deployFactory() {
    [owner, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ElectionFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
    return factory;
  }

  async function createElection(startOffset = 0, endOffset = 3600) {
    const now = await time.latest();
    const start = now + startOffset;
    const end = now + endOffset;
    const tx = await factory.createElection(TITLE, DESC, CANDIDATES, start, end);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (l) => l.fragment && l.fragment.name === "ElectionCreated"
    );
    const electionAddress = event.args[0];
    const Election = await ethers.getContractFactory("Election");
    return Election.attach(electionAddress);
  }

  // ─────────────────────────── Factory Tests ───────────────────────────

  describe("ElectionFactory", function () {
    beforeEach(async () => { await deployFactory(); });

    it("Sets deployer as owner", async () => {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Non-owner cannot create election", async () => {
      const now = await time.latest();
      await expect(
        factory.connect(voter1).createElection(TITLE, DESC, CANDIDATES, now + 10, now + 3600)
      ).to.be.revertedWithCustomError(factory, "NotOwner");
    });

    it("Creates election and records it", async () => {
      const election = await createElection();
      expect(await factory.getElectionCount()).to.equal(1);
      const record = await factory.getElectionAt(0);
      expect(record.electionAddress).to.equal(await election.getAddress());
      expect(record.title).to.equal(TITLE);
    });

    it("isElectionFromFactory returns true for valid address", async () => {
      const election = await createElection();
      expect(await factory.isElectionFromFactory(await election.getAddress())).to.be.true;
      expect(await factory.isElectionFromFactory(voter1.address)).to.be.false;
    });

    it("Can create multiple elections", async () => {
      await createElection();
      await createElection(5, 7200);
      expect(await factory.getElectionCount()).to.equal(2);
    });
  });

  // ─────────────────────────── Election Tests ──────────────────────────

  describe("Election", function () {
    let election;

    beforeEach(async () => {
      await deployFactory();
      election = await createElection(0, 3600); // starts now, ends in 1h
    });

    describe("Deployment", () => {
      it("Has correct title and description", async () => {
        expect(await election.title()).to.equal(TITLE);
        expect(await election.description()).to.equal(DESC);
      });

      it("Starts inactive", async () => {
        expect(await election.isActive()).to.be.false;
        expect(await election.isVotingOpen()).to.be.false;
      });

      it("Has correct candidate count", async () => {
        expect(await election.candidateCount()).to.equal(3);
      });

      it("Requires at least 2 candidates", async () => {
        const now = await time.latest();
        await expect(
          factory.createElection("T", "D", ["Alice"], now + 10, now + 3600)
        ).to.be.revertedWithCustomError(election, "NeedAtLeastTwoCandidates");
      });

      it("Requires valid time window", async () => {
        const now = await time.latest();
        await expect(
          factory.createElection("T", "D", CANDIDATES, now + 100, now + 50)
        ).to.be.revertedWithCustomError(election, "InvalidTimeWindow");
      });
    });

    describe("Voter Registration", () => {
      it("Owner can register voters", async () => {
        await election.registerVoters([voter1.address, voter2.address]);
        expect(await election.isRegisteredVoter(voter1.address)).to.be.true;
        expect(await election.isRegisteredVoter(voter2.address)).to.be.true;
      });

      it("Non-owner cannot register voters", async () => {
        await expect(
          election.connect(voter1).registerVoters([voter2.address])
        ).to.be.revertedWithCustomError(election, "NotOwner");
      });

      it("Owner can remove voter before they vote", async () => {
        await election.registerVoters([voter1.address]);
        await election.removeVoter(voter1.address);
        expect(await election.isRegisteredVoter(voter1.address)).to.be.false;
      });

      it("Cannot remove voter after they vote", async () => {
        await election.registerVoters([voter1.address]);
        await election.activate();
        await election.connect(voter1).vote(0);
        await expect(election.removeVoter(voter1.address)).to.be.revertedWith(
          "Voter already cast ballot"
        );
      });
    });

    describe("Activation", () => {
      it("Owner can activate", async () => {
        await election.activate();
        expect(await election.isActive()).to.be.true;
        expect(await election.isVotingOpen()).to.be.true;
      });

      it("Owner can deactivate", async () => {
        await election.activate();
        await election.deactivate();
        expect(await election.isActive()).to.be.false;
      });

      it("Voting closed when inactive even within time window", async () => {
        await election.registerVoters([voter1.address]);
        // isActive is false
        await expect(election.connect(voter1).vote(0))
          .to.be.revertedWithCustomError(election, "VotingNotOpen");
      });

      it("Voting closed after endTime even if active", async () => {
        await election.registerVoters([voter1.address]);
        await election.activate();
        await time.increase(3700); // past endTime
        await expect(election.connect(voter1).vote(0))
          .to.be.revertedWithCustomError(election, "VotingNotOpen");
      });
    });

    describe("Voting", () => {
      beforeEach(async () => {
        await election.registerVoters([voter1.address, voter2.address]);
        await election.activate();
      });

      it("Registered voter can vote once", async () => {
        await expect(election.connect(voter1).vote(0))
          .to.emit(election, "VoteCast")
          .withArgs(voter1.address, 0, await time.latest() + 1);

        expect(await election.hasVoted(voter1.address)).to.be.true;
        expect(await election.totalVotes()).to.equal(1);
      });

      it("Cannot vote twice", async () => {
        await election.connect(voter1).vote(0);
        await expect(election.connect(voter1).vote(1))
          .to.be.revertedWithCustomError(election, "AlreadyVoted");
      });

      it("Unregistered voter cannot vote", async () => {
        await expect(election.connect(nonVoter).vote(0))
          .to.be.revertedWithCustomError(election, "NotRegistered");
      });

      it("Invalid candidate ID rejected", async () => {
        await expect(election.connect(voter1).vote(99))
          .to.be.revertedWithCustomError(election, "InvalidCandidate");
      });

      it("Results tally correctly", async () => {
        await election.connect(voter1).vote(0); // Alice
        await election.connect(voter2).vote(0); // Alice

        const [names, counts] = await election.getResults();
        expect(names[0]).to.equal("Alice");
        expect(counts[0]).to.equal(2);
        expect(counts[1]).to.equal(0);
      });

      it("getVoterStatus hides candidate choice", async () => {
        await election.connect(voter1).vote(1);
        const [registered, voted] = await election.getVoterStatus(voter1.address);
        expect(registered).to.be.true;
        expect(voted).to.be.true;
        // candidateId is NOT returned from getVoterStatus - privacy preserved
      });

      it("getMyVote returns correct choice for the caller", async () => {
        await election.connect(voter1).vote(2);
        const [voted, candidateId, candidateName] = await election.connect(voter1).getMyVote();
        expect(voted).to.be.true;
        expect(candidateId).to.equal(2);
        expect(candidateName).to.equal("Charlie");
      });

      it("Multiple voters, correct totals", async () => {
        await election.registerVoters([voter3.address]);
        await election.connect(voter1).vote(0);
        await election.connect(voter2).vote(1);
        await election.connect(voter3).vote(0);

        expect(await election.totalVotes()).to.equal(3);
        const [, counts] = await election.getResults();
        expect(counts[0]).to.equal(2); // Alice
        expect(counts[1]).to.equal(1); // Bob
        expect(counts[2]).to.equal(0); // Charlie
      });
    });

    describe("Privacy", () => {
      it("VoteCast event does NOT emit candidate name", async () => {
        await election.registerVoters([voter1.address]);
        await election.activate();
        const tx = await election.connect(voter1).vote(0);
        const receipt = await tx.wait();
        const log = receipt.logs[0];
        // event is VoteCast(address voter, uint256 candidateId, uint256 timestamp)
        // candidateName is intentionally NOT in the event
        expect(log.fragment.inputs.length).to.equal(3);
        expect(log.fragment.inputs.map((i) => i.name)).to.deep.equal([
          "voter",
          "candidateId",
          "timestamp",
        ]);
      });
    });
  });
});
