// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Importing OpenZeppelin Libraries
import "@openzeppelin/contracts/access/Ownable.sol"; // For ownership and access control
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // For reentrancy protection

/**
 * @title VotingContract
 * @dev A decentralized voting system allowing users to create, manage, and participate in voting sessions.
 */
contract VotingContract is Ownable, ReentrancyGuard {
    // Struct to represent a candidate in the voting session
    struct Candidate {
        string name; // Candidate's name
        uint voteCount; // Number of votes received
    }

    // Struct to represent a voting session
    struct VotingSession {
        uint id; // Unique identifier for the session
        string title; // Title of the voting session
        uint startTime; // Start time of the session
        uint endTime; // End time of the session
        Candidate[] candidates; // List of candidates
        mapping(address => bool) hasVoted; // Tracks if an address has voted
        bool isActive; // Session status (active/inactive)
        address creator; // Address of the session creator
    }

    // Public variables
    uint public sessionCount; // Counter for total sessions
    mapping(uint => VotingSession) public votingSessions; // Mapping session IDs to VotingSession

    // Events to track contract actions
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

    // Modifier to ensure a function is called only during the voting period
    modifier onlyDuringVotingPeriod(uint sessionId) {
        require(
            block.timestamp >= votingSessions[sessionId].startTime &&
            block.timestamp <= votingSessions[sessionId].endTime,
            "Voting is not active for this session"
        );
        _;
    }

    // Modifier to ensure a voting session exists
    modifier sessionExists(uint sessionId) {
        require(votingSessions[sessionId].id == sessionId, "Session does not exist");
        _;
    }

    // Modifier to restrict access to the session creator
    modifier onlySessionCreator(uint sessionId) {
        require(
            msg.sender == votingSessions[sessionId].creator,
            "Only the session creator can perform this action"
        );
        _;
    }

    /**
     * @dev Constructor to initialize the contract with the owner address.
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @notice Create a new voting session.
     * @param title The title of the voting session.
     * @param startTime The start time of the voting session (timestamp).
     * @param endTime The end time of the voting session (timestamp).
     */
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

    /**
     * @notice Add a candidate to a voting session.
     * @param sessionId The ID of the voting session.
     * @param name The name of the candidate.
     */
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

    /**
     * @notice Cast a vote for a candidate in a session.
     * @param sessionId The ID of the voting session.
     * @param candidateId The ID of the candidate.
     */
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

    /**
     * @notice Archive a voting session after it has ended.
     * @param sessionId The ID of the voting session.
     */
    function archiveSession(uint sessionId) public sessionExists(sessionId) {
        VotingSession storage session = votingSessions[sessionId];
        require(block.timestamp > session.endTime, "Cannot archive active session");
        session.isActive = false;

        emit SessionArchived(sessionId);
    }

    /**
     * @notice Retrieve all candidates in a session.
     * @param sessionId The ID of the voting session.
     * @return An array of Candidate structs.
     */
    function getCandidates(uint sessionId)
        public
        view
        sessionExists(sessionId)
        returns (Candidate[] memory)
    {
        return votingSessions[sessionId].candidates;
    }

    /**
     * @notice Get the winner of a voting session.
     * @param sessionId The ID of the voting session.
     * @return winnerName The name of the winning candidate.
     * @return isTie A boolean indicating if the session resulted in a tie.
     */
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

    /**
     * @notice Check if a user has voted in a session.
     * @param sessionId The ID of the voting session.
     * @param user The address of the user.
     * @return A boolean indicating if the user has voted.
     */
    function hasUserVoted(uint sessionId, address user)
        public
        view
        sessionExists(sessionId)
        returns (bool)
    {
        return votingSessions[sessionId].hasVoted[user];
    }

    /**
     * @notice Get the creator of a voting session.
     * @param sessionId The ID of the voting session.
     * @return The address of the session creator.
     */
    function getSessionCreator(uint sessionId)
        public
        view
        sessionExists(sessionId)
        returns (address)
    {
        return votingSessions[sessionId].creator;
    }
}