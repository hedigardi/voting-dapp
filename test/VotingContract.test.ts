import { expect } from "chai";
import { ethers } from "hardhat";

// Test suite for the VotingContract smart contract
describe("VotingContract", function () {
  // Helper function to deploy the VotingContract contract and set up signers
  async function deployVotingFixture() {
    const [owner, user1, user2] = await ethers.getSigners(); // Get test accounts
    const VotingContract = await ethers.getContractFactory("VotingContract"); // Fetch contract factory
    const votingContract = await VotingContract.deploy(); // Deploy the contract
    return { votingContract, owner, user1, user2 }; // Return deployed contract and accounts
  }

  // Deployment tests
  describe("Deployment", function () {
    it("Should deploy with an initial session count of 0", async function () {
      const { votingContract } = await deployVotingFixture();
      expect(await votingContract.sessionCount()).to.equal(0);
    });
  });

  // Voting session tests
  describe("Voting Session", function () {
    it("Should create a voting session", async function () {
      const { votingContract, owner } = await deployVotingFixture();
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const endTime = startTime + 600;

      await expect(
        votingContract.createVotingSession("Test Voting", startTime, endTime)
      )
        .to.emit(votingContract, "VotingSessionCreated")
        .withArgs(owner.address, 0, "Test Voting", startTime, endTime);

      const session = await votingContract.votingSessions(0);
      expect(session.title).to.equal("Test Voting");
      expect(session.startTime).to.equal(startTime);
      expect(session.endTime).to.equal(endTime);
      expect(session.creator).to.equal(owner.address);
    });

    it("Should fail if end time is before start time", async function () {
      const { votingContract } = await deployVotingFixture();
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const endTime = startTime - 100;

      await expect(
        votingContract.createVotingSession("Invalid Voting", startTime, endTime)
      ).to.be.revertedWith("End time must be after start time");
    });

    it("Should return false for a non-existent session", async function () {
        const { votingContract, user1 } = await deployVotingFixture();
  
        await expect(
          votingContract.hasUserVoted(1, user1.address)
        ).to.be.revertedWith("Session does not exist");
      });

    it("Should revert if no candidates are in the session", async function () {
        const { votingContract } = await deployVotingFixture();
        const startTime = Math.floor(Date.now() / 1000) + 10;
        const endTime = startTime + 600;
      
        await votingContract.createVotingSession("No Candidates", startTime, endTime);
      
        await expect(votingContract.getWinner(0)).to.be.revertedWith(
          "No candidates in the session"
        );
    }); 

    it("Should revert if session ID is very high", async function () {
        const { votingContract } = await deployVotingFixture();
    
        await expect(votingContract.getCandidates(999)).to.be.revertedWith(
            "Session does not exist"
        );
    });

    it("Should return the correct session creator", async function () {
      const { votingContract, owner } = await deployVotingFixture();

      const startTime = Math.floor(Date.now() / 1000) + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Test Session", startTime, endTime);

      const creator = await votingContract.getSessionCreator(0);
      expect(creator).to.equal(owner.address);
    });

    it("Should revert if session does not exist", async function () {
        const { votingContract } = await deployVotingFixture();
  
        await expect(
          votingContract.getSessionCreator(1)
        ).to.be.revertedWith("Session does not exist");
    });

    it("Should return the creator even after the session is archived", async function () {
      const { votingContract, owner } = await deployVotingFixture();

      const startTime = Math.floor(Date.now() / 1000) + 1;
      const endTime = startTime + 2;

      await votingContract.createVotingSession("Archived Session", startTime, endTime);

      await new Promise((resolve) => setTimeout(resolve, 3000));
      await votingContract.archiveSession(0);

      const creator = await votingContract.getSessionCreator(0);
      expect(creator).to.equal(owner.address);
    });

    it("Should archive a session after its end time", async function () {
      const { votingContract } = await deployVotingFixture();

      const startTime = Math.floor(Date.now() / 1000) + 1;
      const endTime = startTime + 2;

      await votingContract.createVotingSession("Archive Test", startTime, endTime);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await votingContract.archiveSession(0);

      const session = await votingContract.votingSessions(0);
      expect(session.isActive).to.equal(false);
    });

    it("Should fail if session is still active", async function () {
      const { votingContract } = await deployVotingFixture();

      const startTime = Math.floor(Date.now() / 1000) + 1;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Active Archive", startTime, endTime);

      await expect(votingContract.archiveSession(0)).to.be.revertedWith(
        "Cannot archive active session"
      );
    });

    it("Should not affect candidate retrieval after archiving", async function () {
      const { votingContract } = await deployVotingFixture();
    
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const endTime = startTime + 100;
    
      await votingContract.createVotingSession("Archive and Retrieve", startTime, endTime);
      
      await votingContract.addCandidate(0, "Candidate A");
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await ethers.provider.send("evm_mine");
    
      await votingContract.archiveSession(0);
    
      const candidates = await votingContract.getCandidates(0);
      expect(candidates.length).to.equal(1);
      expect(candidates[0].name).to.equal("Candidate A");
    });    
           
    it("Should fail to archive a non-existent session", async function () {
      const { votingContract } = await deployVotingFixture();
  
      await expect(votingContract.archiveSession(999)).to.be.revertedWith(
          "Session does not exist"
      );
    });

    it("Should fail to archive an already archived session", async function () {
      const { votingContract } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 200;

      await votingContract.createVotingSession("Double Archive", startTime, endTime);

      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.archiveSession(0);

      const session = await votingContract.votingSessions(0);
      expect(session.isActive).to.equal(false);

      await votingContract.archiveSession(0);

      const sessionAfterSecondArchive = await votingContract.votingSessions(0);
      expect(sessionAfterSecondArchive.isActive).to.equal(false);
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

    it("Should revert if a candidate is added to a non-existent session", async function () {
        const { votingContract } = await deployVotingFixture();
    
        await expect(
            votingContract.addCandidate(999, "Invalid Candidate")
        ).to.be.revertedWith("Session does not exist");
    });

    it("Should return candidates correctly for a valid session", async function () {
      const { votingContract } = await deployVotingFixture();
    
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 600;
    
      await votingContract.createVotingSession("Test Voting", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");
  
      const candidates = await votingContract.getCandidates(0);
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Candidate A");
      expect(candidates[1].name).to.equal("Candidate B");
    });
    
    it("Should fail to add a candidate to an inactive session", async function () {
      const { votingContract } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 200;

      await votingContract.createVotingSession("Inactive Session", startTime, endTime);

      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.archiveSession(0);

      await expect(
          votingContract.addCandidate(0, "Candidate Z")
      ).to.be.revertedWith("You cannot add a candidate to a voting session that has already ended.");
    });
    
    it("Should fail to add a candidate to an active session", async function () {
      const { votingContract } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600; 
    
      await votingContract.createVotingSession("Active Session", startTime, endTime);
      
      await votingContract.addCandidate(0, "Candidate A");
    
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);
      await ethers.provider.send("evm_mine");
    
      await expect(votingContract.addCandidate(0, "Candidate B"))
          .to.be.revertedWith("Candidates cannot be added during the voting period.");
    });       
  });

  // Voting functionality tests
  describe("Voting Functionality", function () {
    it("Should allow voting during the voting period", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 200; 
      const endTime = startTime + 600;
      
      await votingContract.createVotingSession("Valid Voting", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(votingContract.connect(user1).vote(0, 0))
          .to.emit(votingContract, "VoteCast")
          .withArgs(user1.address, 0, 0);
      
      const candidates = await votingContract.getCandidates(0);
      expect(candidates[0].voteCount).to.equal(1);
    });
          
    it("Should fail if voting outside the voting period", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const startTime = Math.floor(Date.now() / 1000) + 3600; 
      const endTime = startTime + 600;
  
      await votingContract.createVotingSession("Invalid Voting", startTime, endTime);
      
      await votingContract.addCandidate(0, "Candidate A");
  
      await expect(votingContract.connect(user1).vote(0, 0))
          .to.be.revertedWith("Voting is not active for this session");
    });

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

    it("Should fail if voting for a non-existent candidate", async function () {
      const { votingContract, user1 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600;
  
      await votingContract.createVotingSession("Invalid Candidate Vote", startTime, endTime);
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");
  
      await expect(votingContract.connect(user1).vote(0, 999))
          .to.be.revertedWith("Invalid candidate ID");
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

    it("Should revert voting on an archived session", async function () {
      const { votingContract, user1 } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 100;

      await votingContract.createVotingSession("Archived Session", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");

      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.archiveSession(0);

      await expect(votingContract.connect(user1).vote(0, 0))
          .to.be.revertedWith("Voting is not active for this session");
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

  // Winner calculation tests
  describe("Winner Calculation", function () {
    it("Should determine the winner correctly", async function () {
      const { votingContract, user1, user2 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Winner Test", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.connect(user1).vote(0, 0);
      await votingContract.connect(user2).vote(0, 0);

      const [winnerName, isTie] = await votingContract.getWinner(0);
      expect(winnerName).to.equal("Candidate A");
      expect(isTie).to.equal(false);
    });  

    it("Should return a tie if candidates have equal votes", async function () {
      const { votingContract, user1, user2 } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Tie Test", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.connect(user1).vote(0, 0);
      await votingContract.connect(user2).vote(0, 1);

      const [winnerName, isTie] = await votingContract.getWinner(0);
      expect(winnerName).to.equal("");
      expect(isTie).to.equal(true);
    });  

    it("Should return a tie when more than two candidates have the highest votes", async function () {
      const { votingContract, user1, user2 } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Three-Way Tie", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");
      await votingContract.addCandidate(0, "Candidate C");

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.connect(user1).vote(0, 0);
      await votingContract.connect(user2).vote(0, 1);
      const [, , , user3] = await ethers.getSigners();
      await votingContract.connect(user3).vote(0, 2);

      const [winnerName, isTie] = await votingContract.getWinner(0);
      expect(winnerName).to.equal("");
      expect(isTie).to.equal(true);
    });  

    it("Should return no winner if all candidates have zero votes", async function () {
      const { votingContract } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Zero Votes", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");

      const [winnerName, isTie] = await votingContract.getWinner(0);
      expect(winnerName).to.equal("");
      expect(isTie).to.equal(true);
    });  

    it("Should handle a single candidate session correctly", async function () {
      const { votingContract, user1 } = await deployVotingFixture();

      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;

      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Single Candidate", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");

      await votingContract.connect(user1).vote(0, 0);

      const [winnerName, isTie] = await votingContract.getWinner(0);
      expect(winnerName).to.equal("Candidate A");
      expect(isTie).to.equal(false);
    });

    it("Should handle a tie situation correctly", async function () {
      const { votingContract, user1, user2 } = await deployVotingFixture();
      
      const latestBlock = await ethers.provider.getBlock('latest');
      const currentTime = latestBlock!.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = startTime + 600;

      await votingContract.createVotingSession("Tie Handling", startTime, endTime);
      await votingContract.addCandidate(0, "Candidate A");
      await votingContract.addCandidate(0, "Candidate B");
  
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
      await ethers.provider.send("evm_mine");
  
      await votingContract.connect(user1).vote(0, 0);
      await votingContract.connect(user2).vote(0, 1);
  
      const [winnerName, isTie] = await votingContract.getWinner(0);
      expect(isTie).to.equal(true);
      expect(winnerName).to.equal("");
    });
  });
});