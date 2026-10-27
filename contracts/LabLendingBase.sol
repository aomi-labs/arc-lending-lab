// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Arc Lending Lab shared benchmark logic
/// @notice Educational native-USDC accounting: 1 USDC equals 1e18 native units.
/// @dev Collateral is segregated from lendable supplier liquidity. Concrete hooks
/// determine whether the three benchmark defects are present.
abstract contract LabLendingBase {
    error ZeroAmount();
    error InsufficientSupplyBalance();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error BorrowLimitExceeded();
    error RepayExceedsDebt();
    error NotSupplier();
    error CollateralWouldBeUndercollateralized();
    error TransferFailed();
    error Reentrancy();
    error EmptyTransfer();

    /// @notice Recorded supplier principal, in native units.
    mapping(address => uint256) public supplyBalance;
    /// @notice Segregated collateral per account, in native units.
    mapping(address => uint256) public collateralBalance;
    /// @notice Recorded debt per account, in native units.
    mapping(address => uint256) public debt;
    /// @notice Lendable supplier liquidity only; excludes collateral.
    uint256 public availableLiquidity;
    /// @notice Sum of recorded supplier balances.
    uint256 public totalSupplied;
    /// @notice Sum of recorded collateral balances.
    uint256 public totalCollateral;
    /// @notice Sum of recorded debt balances.
    uint256 public totalDebt;
    /// @notice Maximum loan-to-value in basis points; calculations use collateral / 2.
    uint256 public constant MAX_LTV_BPS = 5000;

    uint256 private _entered;

    event Supplied(address indexed supplier, uint256 amount);
    event SupplyWithdrawn(address indexed supplier, address indexed caller, uint256 amount);
    event CollateralDeposited(address indexed account, uint256 amount);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    /// @notice Supply native USDC as lendable liquidity credited to the caller.
    function supply() external payable nonReentrant {
        uint256 amount = msg.value;
        if (amount == 0) revert ZeroAmount();
        supplyBalance[msg.sender] += amount;
        totalSupplied += amount;
        availableLiquidity += amount;
        emit Supplied(msg.sender, amount);
    }

    /// @notice Withdraw supplier principal to the caller, subject to the authorization hook.
    function withdrawSupply(address supplier, uint256 amount) external nonReentrant {
        _authorizeSupplyWithdrawal(supplier, msg.sender);
        if (amount == 0) revert ZeroAmount();
        if (supplyBalance[supplier] < amount) revert InsufficientSupplyBalance();
        if (availableLiquidity < amount) revert InsufficientLiquidity();
        supplyBalance[supplier] -= amount;
        totalSupplied -= amount;
        availableLiquidity -= amount;
        emit SupplyWithdrawn(supplier, msg.sender, amount);
        _sendNative(msg.sender, amount);
    }

    /// @notice Deposit native USDC collateral; collateral never becomes lendable liquidity.
    function depositCollateral() external payable nonReentrant {
        uint256 amount = msg.value;
        if (amount == 0) revert ZeroAmount();
        collateralBalance[msg.sender] += amount;
        totalCollateral += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Borrow native USDC with debt recorded and a collateral / 2 borrowing cap.
    function borrow(uint256 amount) external nonReentrant {
        _checkBorrow(msg.sender, amount);
        debt[msg.sender] += amount;
        totalDebt += amount;
        availableLiquidity -= amount;
        emit Borrowed(msg.sender, amount);
        _sendNative(msg.sender, amount);
    }

    /// @notice Borrow with identical limits, delegating debt recording to the benchmark hook.
    function borrowUntracked(uint256 amount) external nonReentrant {
        _checkBorrow(msg.sender, amount);
        _recordUntrackedBorrowDebt(msg.sender, amount);
        availableLiquidity -= amount;
        emit Borrowed(msg.sender, amount);
        _sendNative(msg.sender, amount);
    }

    /// @notice Repay the caller's recorded debt without overpayment or refunds.
    function repay() external payable nonReentrant {
        uint256 amount = msg.value;
        if (amount == 0) revert ZeroAmount();
        if (amount > debt[msg.sender]) revert RepayExceedsDebt();
        debt[msg.sender] -= amount;
        totalDebt -= amount;
        availableLiquidity += amount;
        emit Repaid(msg.sender, amount);
    }

    /// @notice Withdraw collateral subject to the remaining-collateral benchmark hook.
    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 balance = collateralBalance[msg.sender];
        if (balance < amount) revert InsufficientCollateral();
        uint256 remainingCollateral = balance - amount;
        _checkCollateralWithdrawal(msg.sender, remainingCollateral);
        collateralBalance[msg.sender] = remainingCollateral;
        totalCollateral -= amount;
        emit CollateralWithdrawn(msg.sender, amount);
        _sendNative(msg.sender, amount);
    }

    /// @notice Return remaining collateral-based borrowing capacity, ignoring liquidity.
    function maxBorrowable(address account) public view returns (uint256) {
        uint256 limit = collateralBalance[account] / 2;
        uint256 recordedDebt = debt[account];
        return limit > recordedDebt ? limit - recordedDebt : 0;
    }

    /// @notice Identify the comparison fixture; this metadata is not a safety guarantee.
    function isPatched() public pure virtual returns (bool);

    /// @notice Reject unnamed native transfers; use a named payable function.
    receive() external payable {
        revert EmptyTransfer();
    }

    /// @notice Reject unknown selectors and accidental native transfers.
    fallback() external payable {
        revert EmptyTransfer();
    }

    function _checkBorrow(address borrower, uint256 amount) internal view {
        if (amount == 0) revert ZeroAmount();
        if (debt[borrower] + amount > collateralBalance[borrower] / 2) {
            revert BorrowLimitExceeded();
        }
        if (availableLiquidity < amount) revert InsufficientLiquidity();
    }

    function _sendNative(address recipient, uint256 amount) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function _authorizeSupplyWithdrawal(address supplier, address caller) internal virtual;
    function _recordUntrackedBorrowDebt(address borrower, uint256 amount) internal virtual;
    function _checkCollateralWithdrawal(address user, uint256 remainingCollateral) internal virtual;
}
