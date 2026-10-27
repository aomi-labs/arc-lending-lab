// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LabLendingBase} from "./LabLendingBase.sol";

/// @title Arc Lending Lab intentionally vulnerable market
/// @notice Intentionally vulnerable educational benchmark. Test funds only;
/// never deploy with real value.
contract LabLendingMarket is LabLendingBase {
    /// @notice Return false to identify the intentionally vulnerable fixture.
    function isPatched() public pure override returns (bool) {
        return false;
    }

    function _authorizeSupplyWithdrawal(address, address) internal override {
        // INTENTIONAL VULNERABILITY #1 (educational benchmark, do not fix): no caller == supplier check; payout goes to the caller.
    }

    function _recordUntrackedBorrowDebt(address, uint256) internal override {
        // INTENTIONAL VULNERABILITY #2 (educational benchmark, do not fix): debt and totalDebt never increase for borrowUntracked.
    }

    function _checkCollateralWithdrawal(address, uint256) internal override {
        // INTENTIONAL VULNERABILITY #3 (educational benchmark, do not fix): no debt versus remaining-collateral check.
    }
}
