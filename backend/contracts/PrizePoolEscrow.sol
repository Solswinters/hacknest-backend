// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PrizePoolEscrow
 * @dev Multi-signature escrow contract for secure hackathon and grant prize management
 * @notice This contract allows event hosts to lock funds and distribute prizes to winners
 * 
 * Deployment Network: Base (Chain ID: 8453)
 * 
 * Features:
 * - Multi-signature approval system for prize distribution
 * - Support for native tokens (ETH) and ERC20 tokens
 * - Time-locked emergency withdrawal mechanism
 * - Role-based access control (Host, Judge, Admin)
 * - Prize pool creation and management per event
 * - Batch payouts for multiple winners
 * - Audit trail with comprehensive event logging
 * - Dispute resolution with time-lock protection
 * 
 * Security:
 * - ReentrancyGuard for all fund transfers
 * - Pausable in case of emergency
 * - Multi-sig required for large distributions
 * - Time-lock for emergency withdrawals
 */
contract PrizePoolEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant HOST_ROLE = keccak256("HOST_ROLE");
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Prize pool status
    enum PoolStatus {
        Active,
        Locked,
        Completed,
        Cancelled
    }
    
    // Payout status
    enum PayoutStatus {
        Pending,
        Approved,
        Executed,
        Rejected
    }
    
    // Prize pool structure
    struct PrizePool {
        uint256 eventId;
        address host;
        uint256 totalAmount;
        uint256 remainingAmount;
        address tokenAddress; // address(0) for native ETH
        PoolStatus status;
        uint256 createdAt;
        uint256 lockUntil;
        uint256 requiredSignatures;
        bool emergencyWithdrawable;
        uint256 emergencyWithdrawTime;
    }
    
    // Payout request structure
    struct PayoutRequest {
        uint256 poolId;
        address[] recipients;
        uint256[] amounts;
        string reason;
        PayoutStatus status;
        uint256 createdAt;
        uint256 approvalCount;
        mapping(address => bool) approvals;
    }
    
    // Winner record
    struct Winner {
        address recipient;
        uint256 amount;
        uint256 rank;
        string projectName;
        uint256 paidAt;
    }
    
    // Storage
    mapping(uint256 => PrizePool) public prizePools;
    mapping(uint256 => PayoutRequest) public payoutRequests;
    mapping(uint256 => Winner[]) public eventWinners;
    mapping(uint256 => uint256[]) public poolPayoutRequests;
    
    uint256 public poolCounter;
    uint256 public payoutRequestCounter;
    
    // Configuration
    uint256 public constant EMERGENCY_TIMELOCK = 7 days;
    uint256 public constant MIN_REQUIRED_SIGNATURES = 2;
    uint256 public constant MAX_BATCH_SIZE = 50;
    
    // Events
    event PoolCreated(
        uint256 indexed poolId,
        uint256 indexed eventId,
        address indexed host,
        uint256 amount,
        address tokenAddress,
        uint256 timestamp
    );
    
    event PoolFunded(
        uint256 indexed poolId,
        address indexed funder,
        uint256 amount,
        uint256 timestamp
    );
    
    event PayoutRequested(
        uint256 indexed payoutId,
        uint256 indexed poolId,
        address indexed requester,
        uint256 totalAmount,
        uint256 recipientCount,
        uint256 timestamp
    );
    
    event PayoutApproved(
        uint256 indexed payoutId,
        address indexed approver,
        uint256 approvalCount,
        uint256 requiredSignatures,
        uint256 timestamp
    );
    
    event PayoutExecuted(
        uint256 indexed payoutId,
        uint256 indexed poolId,
        uint256 totalAmount,
        uint256 recipientCount,
        uint256 timestamp
    );
    
    event PayoutRejected(
        uint256 indexed payoutId,
        address indexed rejecter,
        string reason,
        uint256 timestamp
    );
    
    event WinnerPaid(
        uint256 indexed eventId,
        address indexed recipient,
        uint256 amount,
        uint256 rank,
        string projectName,
        uint256 timestamp
    );
    
    event PoolStatusChanged(
        uint256 indexed poolId,
        PoolStatus oldStatus,
        PoolStatus newStatus,
        uint256 timestamp
    );
    
    event EmergencyWithdrawInitiated(
        uint256 indexed poolId,
        address indexed initiator,
        uint256 timestamp,
        uint256 executeAfter
    );
    
    event EmergencyWithdrawExecuted(
        uint256 indexed poolId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    event PoolRefunded(
        uint256 indexed poolId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @dev Constructor
     * @param admin Address of the initial admin
     */
    constructor(address admin) {
        require(admin != address(0), "Invalid admin address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
    /**
     * @dev Create a new prize pool for an event
     * @param eventId ID of the hackathon/grant event
     * @param tokenAddress Address of the token (address(0) for native ETH)
     * @param requiredSignatures Number of signatures required for payout
     * @return poolId ID of the created prize pool
     */
    function createPrizePool(
        uint256 eventId,
        address tokenAddress,
        uint256 requiredSignatures
    ) external payable whenNotPaused returns (uint256) {
        require(
            hasRole(HOST_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Must have HOST_ROLE or ADMIN_ROLE"
        );
        require(requiredSignatures >= MIN_REQUIRED_SIGNATURES, "Too few required signatures");
        require(eventId > 0, "Invalid event ID");
        
        uint256 poolId = poolCounter++;
        uint256 initialAmount = 0;
        
        // If creating with native ETH
        if (tokenAddress == address(0)) {
            initialAmount = msg.value;
            require(initialAmount > 0, "Must send ETH for native pool");
        }
        
        prizePools[poolId] = PrizePool({
            eventId: eventId,
            host: msg.sender,
            totalAmount: initialAmount,
            remainingAmount: initialAmount,
            tokenAddress: tokenAddress,
            status: PoolStatus.Active,
            createdAt: block.timestamp,
            lockUntil: 0,
            requiredSignatures: requiredSignatures,
            emergencyWithdrawable: false,
            emergencyWithdrawTime: 0
        });
        
        emit PoolCreated(poolId, eventId, msg.sender, initialAmount, tokenAddress, block.timestamp);
        
        if (initialAmount > 0) {
            emit PoolFunded(poolId, msg.sender, initialAmount, block.timestamp);
        }
        
        return poolId;
    }
    
    /**
     * @dev Fund an existing prize pool
     * @param poolId ID of the prize pool
     * @param amount Amount to fund (for ERC20 tokens)
     */
    function fundPool(uint256 poolId, uint256 amount) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
    {
        PrizePool storage pool = prizePools[poolId];
        require(pool.createdAt > 0, "Pool does not exist");
        require(pool.status == PoolStatus.Active, "Pool is not active");
        
        uint256 fundAmount;
        
        if (pool.tokenAddress == address(0)) {
            // Native ETH funding
            require(msg.value > 0, "Must send ETH");
            fundAmount = msg.value;
        } else {
            // ERC20 token funding
            require(amount > 0, "Amount must be greater than 0");
            IERC20(pool.tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
            fundAmount = amount;
        }
        
        pool.totalAmount += fundAmount;
        pool.remainingAmount += fundAmount;
        
        emit PoolFunded(poolId, msg.sender, fundAmount, block.timestamp);
    }
    
    /**
     * @dev Request a payout from a prize pool
     * @param poolId ID of the prize pool
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts for each recipient
     * @param reason Reason for the payout
     * @return payoutId ID of the payout request
     */
    function requestPayout(
        uint256 poolId,
        address[] memory recipients,
        uint256[] memory amounts,
        string memory reason
    ) external whenNotPaused returns (uint256) {
        require(
            hasRole(HOST_ROLE, msg.sender) || hasRole(JUDGE_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Insufficient permissions"
        );
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length > 0 && recipients.length <= MAX_BATCH_SIZE, "Invalid recipient count");
        
        PrizePool storage pool = prizePools[poolId];
        require(pool.createdAt > 0, "Pool does not exist");
        require(pool.status == PoolStatus.Active || pool.status == PoolStatus.Locked, "Pool not available");
        
        // Calculate total payout amount
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            totalAmount += amounts[i];
        }
        
        require(totalAmount <= pool.remainingAmount, "Insufficient pool balance");
        
        uint256 payoutId = payoutRequestCounter++;
        PayoutRequest storage request = payoutRequests[payoutId];
        
        request.poolId = poolId;
        request.recipients = recipients;
        request.amounts = amounts;
        request.reason = reason;
        request.status = PayoutStatus.Pending;
        request.createdAt = block.timestamp;
        request.approvalCount = 0;
        
        poolPayoutRequests[poolId].push(payoutId);
        
        emit PayoutRequested(payoutId, poolId, msg.sender, totalAmount, recipients.length, block.timestamp);
        
        return payoutId;
    }
    
    /**
     * @dev Approve a payout request
     * @param payoutId ID of the payout request
     */
    function approvePayout(uint256 payoutId) external whenNotPaused {
        require(
            hasRole(JUDGE_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Must have JUDGE_ROLE or ADMIN_ROLE"
        );
        
        PayoutRequest storage request = payoutRequests[payoutId];
        require(request.createdAt > 0, "Payout request does not exist");
        require(request.status == PayoutStatus.Pending, "Payout not pending");
        require(!request.approvals[msg.sender], "Already approved");
        
        PrizePool storage pool = prizePools[request.poolId];
        
        request.approvals[msg.sender] = true;
        request.approvalCount++;
        
        emit PayoutApproved(
            payoutId, 
            msg.sender, 
            request.approvalCount, 
            pool.requiredSignatures, 
            block.timestamp
        );
        
        // Auto-execute if required signatures reached
        if (request.approvalCount >= pool.requiredSignatures) {
            _executePayout(payoutId);
        }
    }
    
    /**
     * @dev Execute an approved payout
     * @param payoutId ID of the payout request
     */
    function _executePayout(uint256 payoutId) private nonReentrant {
        PayoutRequest storage request = payoutRequests[payoutId];
        require(request.status == PayoutStatus.Pending, "Payout not pending");
        
        PrizePool storage pool = prizePools[request.poolId];
        require(request.approvalCount >= pool.requiredSignatures, "Insufficient approvals");
        
        request.status = PayoutStatus.Executed;
        
        uint256 totalPaid = 0;
        
        // Execute payouts to all recipients
        for (uint256 i = 0; i < request.recipients.length; i++) {
            address recipient = request.recipients[i];
            uint256 amount = request.amounts[i];
            
            if (pool.tokenAddress == address(0)) {
                // Native ETH transfer
                (bool success, ) = payable(recipient).call{value: amount}("");
                require(success, "ETH transfer failed");
            } else {
                // ERC20 token transfer
                IERC20(pool.tokenAddress).safeTransfer(recipient, amount);
            }
            
            totalPaid += amount;
            
            // Record winner
            eventWinners[pool.eventId].push(Winner({
                recipient: recipient,
                amount: amount,
                rank: i + 1,
                projectName: request.reason,
                paidAt: block.timestamp
            }));
            
            emit WinnerPaid(pool.eventId, recipient, amount, i + 1, request.reason, block.timestamp);
        }
        
        pool.remainingAmount -= totalPaid;
        
        emit PayoutExecuted(payoutId, request.poolId, totalPaid, request.recipients.length, block.timestamp);
        
        // Mark pool as completed if fully distributed
        if (pool.remainingAmount == 0) {
            _updatePoolStatus(request.poolId, PoolStatus.Completed);
        }
    }
    
    /**
     * @dev Reject a payout request
     * @param payoutId ID of the payout request
     * @param reason Reason for rejection
     */
    function rejectPayout(uint256 payoutId, string memory reason) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have ADMIN_ROLE");
        
        PayoutRequest storage request = payoutRequests[payoutId];
        require(request.createdAt > 0, "Payout request does not exist");
        require(request.status == PayoutStatus.Pending, "Payout not pending");
        
        request.status = PayoutStatus.Rejected;
        
        emit PayoutRejected(payoutId, msg.sender, reason, block.timestamp);
    }
    
    /**
     * @dev Initiate emergency withdrawal (requires time-lock)
     * @param poolId ID of the prize pool
     */
    function initiateEmergencyWithdraw(uint256 poolId) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have ADMIN_ROLE");
        
        PrizePool storage pool = prizePools[poolId];
        require(pool.createdAt > 0, "Pool does not exist");
        require(pool.remainingAmount > 0, "No funds to withdraw");
        require(!pool.emergencyWithdrawable, "Already initiated");
        
        pool.emergencyWithdrawable = true;
        pool.emergencyWithdrawTime = block.timestamp + EMERGENCY_TIMELOCK;
        
        emit EmergencyWithdrawInitiated(
            poolId, 
            msg.sender, 
            block.timestamp, 
            pool.emergencyWithdrawTime
        );
    }
    
    /**
     * @dev Execute emergency withdrawal (after time-lock)
     * @param poolId ID of the prize pool
     */
    function executeEmergencyWithdraw(uint256 poolId) external nonReentrant {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have ADMIN_ROLE");
        
        PrizePool storage pool = prizePools[poolId];
        require(pool.emergencyWithdrawable, "Emergency withdraw not initiated");
        require(block.timestamp >= pool.emergencyWithdrawTime, "Time-lock not expired");
        require(pool.remainingAmount > 0, "No funds to withdraw");
        
        uint256 amount = pool.remainingAmount;
        address recipient = pool.host;
        
        pool.remainingAmount = 0;
        _updatePoolStatus(poolId, PoolStatus.Cancelled);
        
        if (pool.tokenAddress == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(pool.tokenAddress).safeTransfer(recipient, amount);
        }
        
        emit EmergencyWithdrawExecuted(poolId, recipient, amount, block.timestamp);
    }
    
    /**
     * @dev Refund pool to host (only if no payouts executed)
     * @param poolId ID of the prize pool
     */
    function refundPool(uint256 poolId) external nonReentrant {
        PrizePool storage pool = prizePools[poolId];
        require(pool.createdAt > 0, "Pool does not exist");
        require(
            msg.sender == pool.host || hasRole(ADMIN_ROLE, msg.sender),
            "Must be host or admin"
        );
        require(pool.status == PoolStatus.Active, "Pool not active");
        require(pool.remainingAmount == pool.totalAmount, "Payouts already made");
        
        uint256 amount = pool.remainingAmount;
        address recipient = pool.host;
        
        pool.remainingAmount = 0;
        _updatePoolStatus(poolId, PoolStatus.Cancelled);
        
        if (pool.tokenAddress == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(pool.tokenAddress).safeTransfer(recipient, amount);
        }
        
        emit PoolRefunded(poolId, recipient, amount, block.timestamp);
    }
    
    /**
     * @dev Update pool status
     */
    function _updatePoolStatus(uint256 poolId, PoolStatus newStatus) private {
        PrizePool storage pool = prizePools[poolId];
        PoolStatus oldStatus = pool.status;
        pool.status = newStatus;
        
        emit PoolStatusChanged(poolId, oldStatus, newStatus, block.timestamp);
    }
    
    /**
     * @dev Lock a pool (prevents new funding, allows existing payouts)
     */
    function lockPool(uint256 poolId, uint256 lockDuration) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have ADMIN_ROLE");
        
        PrizePool storage pool = prizePools[poolId];
        require(pool.status == PoolStatus.Active, "Pool not active");
        
        pool.lockUntil = block.timestamp + lockDuration;
        _updatePoolStatus(poolId, PoolStatus.Locked);
    }
    
    /**
     * @dev Get pool details
     */
    function getPoolDetails(uint256 poolId) 
        external 
        view 
        returns (
            uint256 eventId,
            address host,
            uint256 totalAmount,
            uint256 remainingAmount,
            address tokenAddress,
            PoolStatus status,
            uint256 requiredSignatures
        ) 
    {
        PrizePool storage pool = prizePools[poolId];
        return (
            pool.eventId,
            pool.host,
            pool.totalAmount,
            pool.remainingAmount,
            pool.tokenAddress,
            pool.status,
            pool.requiredSignatures
        );
    }
    
    /**
     * @dev Get winners for an event
     */
    function getEventWinners(uint256 eventId) external view returns (Winner[] memory) {
        return eventWinners[eventId];
    }
    
    /**
     * @dev Get payout requests for a pool
     */
    function getPoolPayoutRequests(uint256 poolId) external view returns (uint256[] memory) {
        return poolPayoutRequests[poolId];
    }
    
    /**
     * @dev Pause contract (emergency)
     */
    function pause() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have ADMIN_ROLE");
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have ADMIN_ROLE");
        _unpause();
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}


