// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LabLendingBase} from "./LabLendingBase.sol";

/// @title Arc Lending Lab patched comparison fixture
/// @notice Only repairs the three known benchmark defects. This is an unaudited
/// comparison fixture, not a claim of safety; use test funds only.
contract FixedLabLendingMarket is LabLendingBase {
    /// @notice Return true to identify the patched comparison, not to guarantee safety.
    function isPatched() public pure override returns (bool) {
        return true;
    }

    function _authorizeSupplyWithdrawal(address supplier, address caller) internal override {
        if (caller != supplier) revert NotSupplier();
    }

    function _recordUntrackedBorrowDebt(address borrower, uint256 amount) internal override {
        debt[borrower] += amount;
        totalDebt += amount;
    }

    function _checkCollateralWithdrawal(address user, uint256 remainingCollateral) internal override {
        if (debt[user] > remainingCollateral / 2) {
            revert CollateralWouldBeUndercollateralized();
        }
    }
}
