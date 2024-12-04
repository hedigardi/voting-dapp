// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol"; 
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract VotingContract is Ownable, ReentrancyGuard {
    struct Candidate {
        string name; 
        uint voteCount; 
    }

    struct VotingSession {
        uint id; 
        string title; 
        uint startTime; 
        uint endTime; 
        Candidate[] candidates;
        mapping(address => bool) hasVoted;
        bool isActive;
        address creator;
    }

    uint public sessionCount;
    mapping(uint => VotingSession) public votingSessions;

    event VotingSessionCreated(
        address indexed creator,
        uint sessionId,
        string title,
        uint startTime,
        uint endTime
    );
    event CandidateAdded(uint indexed sessionId, string candidateName);
    event VoteCast(address indexed voter, uint indexed sessionId, uint candidateId);
    event SessionArchived(uint indexed sessionId);

    modifier onlyDuringVotingPeriod(uint sessionId) {
        require(
            block.timestamp >= votingSessions[sessionId].startTime &&
            block.timestamp <= votingSessions[sessionId].endTime,
            "Voting is not active for this session"
        );
        _;
    }

    modifier sessionExists(uint sessionId) {
        require(votingSessions[sessionId].id == sessionId, "Session does not exist");
        _;
    }

    modifier onlySessionCreator(uint sessionId) {
        require(
            msg.sender == votingSessions[sessionId].creator,
            "Only the session creator can perform this action"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    function createVotingSession(
        string memory title,
        uint startTime,
        uint endTime
    ) public onlyOwner {
        require(endTime > startTime, "End time must be after start time");

        VotingSession storage session = votingSessions[sessionCount];
        session.id = sessionCount;
        session.title = title;
        session.startTime = startTime;
        session.endTime = endTime;
        session.isActive = true;
        session.creator = msg.sender;

        emit VotingSessionCreated(msg.sender, sessionCount, title, startTime, endTime);
        sessionCount++;
    }

    function addCandidate(uint sessionId, string memory name)
        public
        sessionExists(sessionId)
        onlySessionCreator(sessionId)
    {
        VotingSession storage session = votingSessions[sessionId];

        require(session.isActive, "You cannot add a candidate to a voting session that has already ended.");
        require(block.timestamp < session.startTime, "Candidates cannot be added during the voting period.");

        session.candidates.push(Candidate(name, 0));

        emit CandidateAdded(sessionId, name);
    }

    function vote(uint sessionId, uint candidateId)
        public
        nonReentrant
        onlyDuringVotingPeriod(sessionId)
        sessionExists(sessionId)
    {
        VotingSession storage session = votingSessions[sessionId];
        require(!session.hasVoted[msg.sender], "You have already voted");
        require(candidateId < session.candidates.length, "Invalid candidate ID");

        session.hasVoted[msg.sender] = true;
        session.candidates[candidateId].voteCount++;

        emit VoteCast(msg.sender, sessionId, candidateId);
    }

    function archiveSession(uint sessionId) public sessionExists(sessionId) {
        VotingSession storage session = votingSessions[sessionId];
        require(block.timestamp > session.endTime, "Cannot archive active session");
        session.isActive = false;

        emit SessionArchived(sessionId);
    }

    function getCandidates(uint sessionId)
        public
        view
        sessionExists(sessionId)
        returns (Candidate[] memory)
    {
        return votingSessions[sessionId].candidates;
    }

    function getWinner(uint sessionId)
        public
        view
        sessionExists(sessionId)
        returns (string memory winnerName, bool isTie)
    {
        VotingSession storage session = votingSessions[sessionId];
        require(session.candidates.length > 0, "No candidates in the session");

        uint maxVotes = 0;
        uint tieCount = 0;

        for (uint i = 0; i < session.candidates.length; i++) {
            if (session.candidates[i].voteCount > maxVotes) {
                maxVotes = session.candidates[i].voteCount;
                winnerName = session.candidates[i].name;
                tieCount = 1;
            } else if (session.candidates[i].voteCount == maxVotes) {
                tieCount++;
            }
        }

        if (tieCount > 1) {
            return ("", true);
        }

        return (winnerName, false);
    }

    function hasUserVoted(uint sessionId, address user)
        public
        view
        sessionExists(sessionId)
        returns (bool)
    {
        return votingSessions[sessionId].hasVoted[user];
    }

    function getSessionCreator(uint sessionId)
        public
        view
        sessionExists(sessionId)
        returns (address)
    {
        return votingSessions[sessionId].creator;
    }
}