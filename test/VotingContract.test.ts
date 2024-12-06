import { expect } from "chai";
import { ethers } from "hardhat";

describe("VotingContract", function () {
  async function deployVotingFixture() {
    const [owner, user1, user2] = await ethers.getSigners(); 
    const VotingContract = await ethers.getContractFactory("VotingContract"); 
    const votingContract = await VotingContract.deploy(); 
    return { votingContract, owner, user1, user2 }; 
  }

  // Deployment tests
  describe("Deployment", function () {
    it("Should deploy with an initial session count of 0", async function () {
      const { votingContract } = await deployVotingFixture();
      expect(await votingContract.sessionCount()).to.equal(0);
    });
  });

  // Candidate management tests
  describe("Candidate Management", function () {
    it("Should allow session creator to add a candidate", async function () {
      const { votingContract } = await deployVotingFixture();

      const startTime = Math.floor(Date.now() / 1000) + 3600; 
      const endTime = startTime + 600;
    
      await votingContract.createVotingSession("Test Candidates", startTime, endTime);
      
      await expect(votingContract.addCandidate(0, "Candidate 1"))
        .to.emit(votingContract, "CandidateAdded")
        .withArgs(0, "Candidate 1");
    
      const candidates = await votingContract.getCandidates(0);
      expect(candidates.length).to.equal(1);
      expect(candidates[0].name).to.equal("Candidate 1");
    });    

    it("Should fail if non-creator tries to add a candidate", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Unauthorized Add", startTime, endTime);
      await expect(
        votingContract.connect(user1).addCandidate(0, "Candidate X")
      ).to.be.revertedWith("Only the session creator can perform this action");
    });

    it("Should allow adding multiple candidates", async function () {
      const { votingContract } = await deployVotingFixture();
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 600;
    
      await votingContract.createVotingSession("Multiple Candidates", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");
    
      const candidates = await votingContract.getCandidates(0);
      expect(candidates.length).to.equal(2);
      expect(candidates[1].name).to.equal("Candidate B");
    });    

    it("Should return an empty array if no candidates exist", async function () {
      const { votingContract } = await deployVotingFixture();
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Empty Candidates", startTime, endTime);
      const candidates = await votingContract.getCandidates(0);
      expect(candidates.length).to.equal(0);
    });      
  });

  // Voting functionality tests
  describe("Voting Functionality", function () {
    it("Should fail if user has already voted", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 200;
      const endTime = startTime + 600;
  
      await votingContract.createVotingSession("Duplicate Voting", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");
  
      await votingContract.connect(user1).vote(0, 0);
  
      await expect(votingContract.connect(user1).vote(0, 0))
          .to.be.revertedWith("You have already voted");
    });  

    it("Should allow voting exactly at session start time", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600;
  
      await votingContract.createVotingSession("Boundary Test", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);
      await ethers.provider.send("evm_mine");
  
      await expect(votingContract.connect(user1).vote(0, 0))
          .to.emit(votingContract, "VoteCast")
          .withArgs(user1.address, 0, 0);
    });  

    it("Should allow voting exactly at session end time", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 10;
      const endTime = currentTime + 30;
      
      await votingContract.createVotingSession("Boundary Test", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(votingContract.connect(user1).vote(0, 0))
          .to.emit(votingContract, "VoteCast")
          .withArgs(user1.address, 0, 0);
    });      

    it("Should return false if the user has not voted", async function () {
      const { votingContract, user1 } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Voting Session", startTime, endTime);

      await votingContract.addCandidate(0, "Candidate A");

      const hasVoted = await votingContract.hasUserVoted(0, user1.address);
      expect(hasVoted).to.equal(false);
    });  

    it("Should return true if the user has voted", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
  
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600;
  
      await votingContract.createVotingSession("Voting Session", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");
  
      await votingContract.connect(user1).vote(0, 0);

      const hasVoted = await votingContract.hasUserVoted(0, user1.address);
      expect(hasVoted).to.equal(true);
    });

    it("Should fail to vote for a candidate ID out of range", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600;
  
      await votingContract.createVotingSession("Out of Range Vote", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");
  
      await expect(
          votingContract.connect(user1).vote(0, 999)
      ).to.be.revertedWith("Invalid candidate ID");
    });   
  });
});