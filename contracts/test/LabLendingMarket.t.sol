// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LabLendingBase} from "../LabLendingBase.sol";
import {LabLendingMarket} from "../LabLendingMarket.sol";
import {FixedLabLendingMarket} from "../FixedLabLendingMarket.sol";

// 1 USDC == 1e18 native units.
uint256 constant USDC = 1e18;

/* ------------------------------------------------------------------ */
/*                           Test helpers                              */
/* ------------------------------------------------------------------ */

/// Generic actor contract that forwards arbitrary calls and bubbles reverts.
contract Actor {
    function exec(address t, uint256 v, bytes calldata d) external payable returns (bytes memory) {
        (bool ok, bytes memory r) = t.call{value: v}(d);
        if (!ok) {
            assembly {
                revert(add(r, 32), mload(r))
            }
        }
        return r;
    }
}

/// Recipient that rejects any native payout.
contract Rejecter is Actor {
    receive() external payable {
        revert("no eth");
    }
}

/// Recipient that attempts ONE re-entrant call when it receives a payout.
contract Probe is Actor {
    address public target;
    bytes public payload;
    uint256 public reValue;
    bool public swallow;
    bool public fired;
    bool public reentryOk;
    bytes4 public lastErr;

    function arm(address t, bytes calldata p, uint256 v, bool swallow_) external {
        target = t;
        payload = p;
        reValue = v;
        swallow = swallow_;
    }

    receive() external payable {
        if (target == address(0) || fired) return;
        fired = true;
        (bool ok, bytes memory r) = target.call{value: reValue}(payload);
        reentryOk = ok;
        if (!ok) {
            lastErr = bytes4(r);
            if (!swallow) {
                assembly {
                    revert(add(r, 32), mload(r))
                }
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*                           Shared base                               */
/* ------------------------------------------------------------------ */

abstract contract MarketTestBase is Test {
    uint256 internal constant START = 100 * USDC;

    bytes4 internal immutable E_ZERO = LabLendingBase.ZeroAmount.selector;
    bytes4 internal immutable E_SUPBAL = LabLendingBase.InsufficientSupplyBalance.selector;
    bytes4 internal immutable E_LIQ = LabLendingBase.InsufficientLiquidity.selector;
    bytes4 internal immutable E_COLL = LabLendingBase.InsufficientCollateral.selector;
    bytes4 internal immutable E_LIMIT = LabLendingBase.BorrowLimitExceeded.selector;
    bytes4 internal immutable E_REPAY = LabLendingBase.RepayExceedsDebt.selector;
    bytes4 internal immutable E_NOTSUP = LabLendingBase.NotSupplier.selector;
    bytes4 internal immutable E_UNDER = LabLendingBase.CollateralWouldBeUndercollateralized.selector;
    bytes4 internal immutable E_XFER = LabLendingBase.TransferFailed.selector;
    bytes4 internal immutable E_REENT = LabLendingBase.Reentrancy.selector;
    bytes4 internal immutable E_EMPTY = LabLendingBase.EmptyTransfer.selector;

    LabLendingBase internal market;
    address internal victim = makeAddr("victim");
    address internal lender = makeAddr("lender");
    address internal attacker = makeAddr("attacker");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function _deploy() internal virtual returns (LabLendingBase);

    function setUp() public virtual {
        market = _deploy();
        address[5] memory who = [victim, lender, attacker, alice, bob];
        for (uint256 i; i < who.length; ++i) {
            vm.deal(who[i], START);
        }
    }

    // ---- action helpers (each pranks exactly the one call) ----
    function _supply(address who, uint256 amt) internal {
        vm.prank(who);
        market.supply{value: amt}();
    }

    function _collateral(address who, uint256 amt) internal {
        vm.prank(who);
        market.depositCollateral{value: amt}();
    }

    function _borrow(address who, uint256 amt) internal {
        vm.prank(who);
        market.borrow(amt);
    }

    function _repay(address who, uint256 amt) internal {
        vm.prank(who);
        market.repay{value: amt}();
    }

    function _wColl(address who, uint256 amt) internal {
        vm.prank(who);
        market.withdrawCollateral(amt);
    }

    function _wSupply(address who, address supplier, uint256 amt) internal {
        vm.prank(who);
        market.withdrawSupply(supplier, amt);
    }

    /// Accounting invariant: native balance == lendable liquidity + collateral.
    function _inv() internal view {
        assertEq(
            address(market).balance,
            market.availableLiquidity() + market.totalCollateral(),
            "balance != availableLiquidity + totalCollateral"
        );
    }
}

/* ------------------------------------------------------------------ */
/*        A + B: behaviour that must be IDENTICAL on both markets      */
/* ------------------------------------------------------------------ */

abstract contract HonestTests is MarketTestBase {
    // ---------- fresh state / isolation ----------
    function test_FreshStateAfterSetUp() public view {
        assertEq(address(market).balance, 0);
        assertEq(market.availableLiquidity(), 0);
        assertEq(market.totalSupplied(), 0);
        assertEq(market.totalCollateral(), 0);
        assertEq(market.totalDebt(), 0);
        address[5] memory who = [victim, lender, attacker, alice, bob];
        for (uint256 i; i < who.length; ++i) {
            assertEq(market.supplyBalance(who[i]), 0);
            assertEq(market.collateralBalance(who[i]), 0);
            assertEq(market.debt(who[i]), 0);
            assertEq(who[i].balance, START);
        }
    }

    // Two mirror tests: each mutates state, then asserts totals equal ONLY its own mutation.
    function test_NoLeakA() public {
        assertEq(market.totalSupplied(), 0);
        _supply(lender, 1 * USDC);
        assertEq(market.totalSupplied(), 1 * USDC);
        assertEq(lender.balance, START - USDC);
    }

    function test_NoLeakB() public {
        assertEq(market.totalSupplied(), 0);
        _supply(lender, 1 * USDC);
        assertEq(market.totalSupplied(), 1 * USDC);
        assertEq(lender.balance, START - USDC);
    }

    // ---------- A: honest flows ----------
    function test_SupplyThenWithdrawSupply() public {
        vm.expectEmit(true, false, false, true, address(market));
        emit LabLendingBase.Supplied(lender, 4 * USDC);
        _supply(lender, 4 * USDC);
        assertEq(market.supplyBalance(lender), 4 * USDC);
        assertEq(market.availableLiquidity(), 4 * USDC);
        assertEq(market.totalSupplied(), 4 * USDC);
        assertEq(address(market).balance, 4 * USDC);
        assertEq(lender.balance, START - 4 * USDC);
        _inv();

        vm.expectEmit(true, true, false, true, address(market));
        emit LabLendingBase.SupplyWithdrawn(lender, lender, 1 * USDC);
        _wSupply(lender, lender, 1 * USDC);
        assertEq(market.supplyBalance(lender), 3 * USDC);
        assertEq(market.availableLiquidity(), 3 * USDC);
        assertEq(market.totalSupplied(), 3 * USDC);
        assertEq(address(market).balance, 3 * USDC);
        assertEq(lender.balance, START - 3 * USDC);
        _inv();

        _wSupply(lender, lender, 3 * USDC);
        assertEq(market.supplyBalance(lender), 0);
        assertEq(address(market).balance, 0);
        assertEq(lender.balance, START);
        _inv();
    }

    function test_DepositBorrowRepayWithdrawCollateral() public {
        _supply(lender, 10 * USDC);

        vm.expectEmit(true, false, false, true, address(market));
        emit LabLendingBase.CollateralDeposited(alice, 4 * USDC);
        _collateral(alice, 4 * USDC);
        assertEq(market.collateralBalance(alice), 4 * USDC);
        assertEq(market.totalCollateral(), 4 * USDC);
        assertEq(market.availableLiquidity(), 10 * USDC, "collateral must not be lendable");
        assertEq(market.maxBorrowable(alice), 2 * USDC);
        _inv();

        vm.expectEmit(true, false, false, true, address(market));
        emit LabLendingBase.Borrowed(alice, 2 * USDC);
        _borrow(alice, 2 * USDC); // exactly collateral / 2
        assertEq(market.debt(alice), 2 * USDC);
        assertEq(market.totalDebt(), 2 * USDC);
        assertEq(market.availableLiquidity(), 8 * USDC);
        assertEq(market.maxBorrowable(alice), 0);
        assertEq(alice.balance, START - 4 * USDC + 2 * USDC);
        _inv();

        vm.expectEmit(true, false, false, true, address(market));
        emit LabLendingBase.Repaid(alice, USDC / 2);
        _repay(alice, USDC / 2); // partial
        assertEq(market.debt(alice), 3 * USDC / 2);
        assertEq(market.totalDebt(), 3 * USDC / 2);
        assertEq(market.availableLiquidity(), 8 * USDC + USDC / 2);
        _inv();

        _repay(alice, 3 * USDC / 2); // full
        assertEq(market.debt(alice), 0);
        assertEq(market.totalDebt(), 0);
        assertEq(market.availableLiquidity(), 10 * USDC);
        _inv();

        vm.expectEmit(true, false, false, true, address(market));
        emit LabLendingBase.CollateralWithdrawn(alice, 4 * USDC);
        _wColl(alice, 4 * USDC);
        assertEq(market.collateralBalance(alice), 0);
        assertEq(market.totalCollateral(), 0);
        assertEq(alice.balance, START);
        assertEq(address(market).balance, 10 * USDC);
        _inv();
    }

    function test_CollateralIsNotLendable() public {
        _collateral(alice, 2 * USDC);
        vm.expectRevert(E_LIQ);
        _borrow(alice, 1 * USDC);
        // another user's collateral cannot fund bob's loan either
        _collateral(bob, 2 * USDC);
        vm.expectRevert(E_LIQ);
        _borrow(bob, 1 * USDC);
        assertEq(market.availableLiquidity(), 0);
        _inv();
    }

    function test_BorrowAtExactlyHalfSucceeds() public {
        _supply(lender, 10 * USDC);
        _collateral(alice, 2 * USDC);
        _borrow(alice, 1 * USDC);
        assertEq(market.debt(alice), 1 * USDC);
        _inv();
    }

    function test_BorrowOneWeiOverHalfReverts() public {
        _supply(lender, 10 * USDC);
        _collateral(alice, 2 * USDC);
        vm.expectRevert(E_LIMIT);
        _borrow(alice, 1 * USDC + 1);
        assertEq(market.debt(alice), 0);
        // cumulative: existing debt counts toward the cap
        _borrow(alice, 1 * USDC);
        vm.expectRevert(E_LIMIT);
        _borrow(alice, 1);
        // odd collateral rounds the cap down
        _collateral(bob, 3);
        vm.expectRevert(E_LIMIT);
        _borrow(bob, 2);
        _borrow(bob, 1);
        _inv();
    }

    function test_BorrowWithoutCollateralReverts() public {
        _supply(lender, 10 * USDC);
        vm.expectRevert(E_LIMIT);
        _borrow(alice, 1);
    }

    function test_RepayExceedsDebtReverts() public {
        _supply(lender, 10 * USDC);
        _collateral(alice, 4 * USDC);
        _borrow(alice, 1 * USDC);
        vm.expectRevert(E_REPAY);
        _repay(alice, 1 * USDC + 1);
        vm.expectRevert(E_REPAY);
        _repay(bob, 1); // no debt at all
        assertEq(market.debt(alice), 1 * USDC);
        _inv();
    }

    function test_SupplierCannotWithdrawBorrowedLiquidity() public {
        _supply(lender, 4 * USDC);
        _collateral(alice, 6 * USDC);
        _borrow(alice, 3 * USDC);
        vm.expectRevert(E_LIQ);
        _wSupply(lender, lender, 2 * USDC);
        _wSupply(lender, lender, 1 * USDC);
        _inv();
    }

    // ---------- B: zero amounts ----------
    function test_Zero_Supply() public {
        vm.expectRevert(E_ZERO);
        _supply(lender, 0);
    }

    function test_Zero_DepositCollateral() public {
        vm.expectRevert(E_ZERO);
        _collateral(alice, 0);
    }

    function test_Zero_Repay() public {
        vm.expectRevert(E_ZERO);
        _repay(alice, 0);
    }

    function test_Zero_WithdrawSupply() public {
        _supply(lender, 1 * USDC);
        vm.expectRevert(E_ZERO);
        _wSupply(lender, lender, 0);
    }

    function test_Zero_Borrow() public {
        vm.expectRevert(E_ZERO);
        _borrow(alice, 0);
    }

    function test_Zero_BorrowUntracked() public {
        vm.prank(alice);
        vm.expectRevert(E_ZERO);
        market.borrowUntracked(0);
    }

    function test_Zero_WithdrawCollateral() public {
        _collateral(alice, 1 * USDC);
        vm.expectRevert(E_ZERO);
        _wColl(alice, 0);
    }

    // ---------- B: insufficient ----------
    function test_WithdrawSupplyMoreThanBalanceReverts() public {
        _supply(lender, 1 * USDC);
        _supply(bob, 5 * USDC); // plenty of pool liquidity, still lender's balance is 1
        vm.expectRevert(E_SUPBAL);
        _wSupply(lender, lender, 1 * USDC + 1);
        assertEq(market.supplyBalance(lender), 1 * USDC);
    }

    function test_Borrow_InsufficientLiquidity() public {
        _supply(lender, USDC / 2);
        _collateral(alice, 2 * USDC);
        vm.expectRevert(E_LIQ);
        _borrow(alice, 1 * USDC);
        assertEq(market.debt(alice), 0);
        _inv();
    }

    function test_BorrowUntracked_InsufficientLiquidity() public {
        _supply(lender, USDC / 2);
        _collateral(alice, 2 * USDC);
        vm.prank(alice);
        vm.expectRevert(E_LIQ);
        market.borrowUntracked(1 * USDC);
        assertEq(market.availableLiquidity(), USDC / 2);
    }

    function test_BorrowUntracked_LimitExceeded() public {
        _supply(lender, 10 * USDC);
        _collateral(alice, 2 * USDC);
        vm.prank(alice);
        vm.expectRevert(E_LIMIT);
        market.borrowUntracked(1 * USDC + 1);
    }

    function test_WithdrawCollateralMoreThanBalanceReverts() public {
        _collateral(alice, 2 * USDC);
        vm.expectRevert(E_COLL);
        _wColl(alice, 2 * USDC + 1);
        vm.expectRevert(E_COLL);
        _wColl(bob, 1);
        assertEq(market.collateralBalance(alice), 2 * USDC);
    }

    // ---------- B: empty transfers ----------
    function test_PlainNativeTransferReverts() public {
        vm.prank(alice);
        (bool ok, bytes memory ret) = address(market).call{value: 1}("");
        assertFalse(ok);
        assertEq(bytes4(ret), E_EMPTY);
        assertEq(address(market).balance, 0);
        assertEq(alice.balance, START);
    }

    function test_UnknownSelectorReverts() public {
        vm.startPrank(alice);
        (bool ok, bytes memory ret) = address(market).call(abi.encodeWithSelector(0xdeadbeef));
        assertFalse(ok);
        assertEq(bytes4(ret), E_EMPTY);
        (ok, ret) = address(market).call{value: 1}(abi.encodeWithSelector(0xdeadbeef, uint256(7)));
        assertFalse(ok);
        assertEq(bytes4(ret), E_EMPTY);
        vm.stopPrank();
        assertEq(address(market).balance, 0);
    }

    // ---------- B: recipient rejects native ----------
    function _sel(bytes4 s, uint256 a) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(s, a);
    }

    function test_WithdrawSupply_RecipientRejects_TransferFailed() public {
        Rejecter rej = new Rejecter();
        vm.deal(address(rej), 10 * USDC);
        rej.exec(address(market), 2 * USDC, abi.encodeWithSelector(LabLendingBase.supply.selector));
        vm.expectRevert(E_XFER);
        rej.exec(address(market), 0, abi.encodeWithSelector(LabLendingBase.withdrawSupply.selector, address(rej), 1 * USDC));
        assertEq(market.supplyBalance(address(rej)), 2 * USDC);
        assertEq(address(market).balance, 2 * USDC);
        _inv();
    }

    function test_Borrow_RecipientRejects_TransferFailed() public {
        Rejecter rej = new Rejecter();
        vm.deal(address(rej), 10 * USDC);
        _supply(lender, 4 * USDC);
        rej.exec(address(market), 2 * USDC, abi.encodeWithSelector(LabLendingBase.depositCollateral.selector));
        vm.expectRevert(E_XFER);
        rej.exec(address(market), 0, _sel(LabLendingBase.borrow.selector, 1 * USDC));
        assertEq(market.debt(address(rej)), 0);
        assertEq(market.availableLiquidity(), 4 * USDC);
        _inv();
    }

    function test_WithdrawCollateral_RecipientRejects_TransferFailed() public {
        Rejecter rej = new Rejecter();
        vm.deal(address(rej), 10 * USDC);
        rej.exec(address(market), 2 * USDC, abi.encodeWithSelector(LabLendingBase.depositCollateral.selector));
        vm.expectRevert(E_XFER);
        rej.exec(address(market), 0, _sel(LabLendingBase.withdrawCollateral.selector, 1 * USDC));
        assertEq(market.collateralBalance(address(rej)), 2 * USDC);
        assertEq(market.totalCollateral(), 2 * USDC);
        _inv();
    }

    // ---------- B: reentrancy ----------
    function _probe(uint256 funds) internal returns (Probe p) {
        p = new Probe();
        vm.deal(address(p), funds);
    }

    function test_Reentrancy_WithdrawSupply_BubblesTransferFailed_NoFundsMove() public {
        Probe p = _probe(10 * USDC);
        _supply(victim, 4 * USDC);
        p.exec(address(market), 2 * USDC, abi.encodeWithSelector(LabLendingBase.supply.selector));
        p.arm(address(market), abi.encodeWithSelector(LabLendingBase.withdrawSupply.selector, address(p), 1), 0, false);
        uint256 mBal = address(market).balance;
        uint256 pBal = address(p).balance;
        vm.expectRevert(E_XFER);
        p.exec(address(market), 0, abi.encodeWithSelector(LabLendingBase.withdrawSupply.selector, address(p), 1 * USDC));
        assertEq(address(market).balance, mBal);
        assertEq(address(p).balance, pBal);
        assertEq(market.supplyBalance(address(p)), 2 * USDC);
        assertEq(market.supplyBalance(victim), 4 * USDC);
        _inv();
    }

    function test_Reentrancy_WithdrawSupply_Swallowed_PaysExactlyOnce() public {
        Probe p = _probe(10 * USDC);
        _supply(victim, 4 * USDC);
        p.exec(address(market), 2 * USDC, abi.encodeWithSelector(LabLendingBase.supply.selector));
        p.arm(address(market), abi.encodeWithSelector(LabLendingBase.withdrawSupply.selector, address(p), 1), 0, true);
        uint256 pBal = address(p).balance;
        p.exec(address(market), 0, abi.encodeWithSelector(LabLendingBase.withdrawSupply.selector, address(p), 1 * USDC));
        assertTrue(p.fired());
        assertFalse(p.reentryOk());
        assertEq(p.lastErr(), E_REENT);
        assertEq(address(p).balance, pBal + 1 * USDC, "paid exactly once");
        assertEq(market.supplyBalance(address(p)), 1 * USDC);
        assertEq(market.supplyBalance(victim), 4 * USDC);
        _inv();
    }

    function test_Reentrancy_Borrow_Swallowed_BorrowsExactlyOnce() public {
        Probe p = _probe(10 * USDC);
        _supply(lender, 10 * USDC);
        p.exec(address(market), 4 * USDC, abi.encodeWithSelector(LabLendingBase.depositCollateral.selector));
        p.arm(address(market), _sel(LabLendingBase.borrow.selector, 1), 0, true);
        p.exec(address(market), 0, _sel(LabLendingBase.borrow.selector, 1 * USDC));
        assertEq(p.lastErr(), E_REENT);
        assertEq(market.debt(address(p)), 1 * USDC);
        assertEq(market.availableLiquidity(), 9 * USDC);
        _inv();
    }

    function test_Reentrancy_Borrow_NotSwallowed_Reverts() public {
        Probe p = _probe(10 * USDC);
        _supply(lender, 10 * USDC);
        p.exec(address(market), 4 * USDC, abi.encodeWithSelector(LabLendingBase.depositCollateral.selector));
        p.arm(address(market), _sel(LabLendingBase.borrow.selector, 1), 0, false);
        vm.expectRevert(E_XFER);
        p.exec(address(market), 0, _sel(LabLendingBase.borrow.selector, 1 * USDC));
        assertEq(market.debt(address(p)), 0);
        assertEq(market.availableLiquidity(), 10 * USDC);
        _inv();
    }

    function test_Reentrancy_SupplyDuringCollateralWithdraw_Blocked() public {
        Probe p = _probe(10 * USDC);
        p.exec(address(market), 4 * USDC, abi.encodeWithSelector(LabLendingBase.depositCollateral.selector));
        p.arm(address(market), abi.encodeWithSelector(LabLendingBase.supply.selector), 1, true);
        p.exec(address(market), 0, _sel(LabLendingBase.withdrawCollateral.selector, 1 * USDC));
        assertEq(p.lastErr(), E_REENT);
        assertEq(market.totalSupplied(), 0);
        assertEq(market.collateralBalance(address(p)), 3 * USDC);
        _inv();
    }

    // ---------- bounded fuzz (runs on both markets) ----------
    function testFuzz_SupplyWithdraw(uint256 sup, uint256 wd) public {
        sup = bound(sup, 1, START);
        wd = bound(wd, 1, sup);
        _supply(lender, sup);
        _inv();
        _wSupply(lender, lender, wd);
        assertEq(market.supplyBalance(lender), sup - wd);
        assertEq(market.totalSupplied(), sup - wd);
        assertEq(market.availableLiquidity(), sup - wd);
        assertEq(lender.balance, START - sup + wd);
        _inv();
    }

    function testFuzz_BorrowRepay(uint256 coll, uint256 amt, uint256 rep1) public {
        coll = bound(coll, 2, START);
        amt = bound(amt, 1, coll / 2);
        _supply(lender, START);
        _collateral(alice, coll);
        _inv();
        _borrow(alice, amt);
        assertEq(market.debt(alice), amt);
        assertEq(market.availableLiquidity(), START - amt);
        _inv();
        rep1 = bound(rep1, 1, amt);
        _repay(alice, rep1);
        assertEq(market.debt(alice), amt - rep1);
        assertEq(market.totalDebt(), amt - rep1);
        _inv();
        if (amt > rep1) _repay(alice, amt - rep1);
        assertEq(market.debt(alice), 0);
        assertEq(market.availableLiquidity(), START);
        _wColl(alice, coll);
        assertEq(alice.balance, START);
        _inv();
    }
}

contract VulnerableHonestTest is HonestTests {
    function _deploy() internal override returns (LabLendingBase) {
        return new LabLendingMarket();
    }
}

contract FixedHonestTest is HonestTests {
    function _deploy() internal override returns (LabLendingBase) {
        return new FixedLabLendingMarket();
    }
}

/* ------------------------------------------------------------------ */
/*          C: exploit regressions on the VULNERABLE market            */
/* ------------------------------------------------------------------ */

contract VulnerableExploitTest is MarketTestBase {
    function _deploy() internal override returns (LabLendingBase) {
        return new LabLendingMarket();
    }

    function test_Vuln_IsNotPatched() public view {
        assertFalse(market.isPatched());
    }

    function test_Bug1_AnyoneWithdrawsVictimSupply() public {
        _supply(victim, 4 * USDC);
        uint256 a0 = attacker.balance;
        uint256 v0 = victim.balance;

        vm.expectEmit(true, true, false, true, address(market));
        emit LabLendingBase.SupplyWithdrawn(victim, attacker, 1 * USDC);
        _wSupply(attacker, victim, 1 * USDC);

        assertEq(attacker.balance, a0 + 1 * USDC, "attacker net +1 USDC");
        assertEq(victim.balance, v0, "victim got nothing");
        assertEq(market.supplyBalance(victim), 3 * USDC);
        assertEq(market.availableLiquidity(), 3 * USDC);
        assertEq(market.totalSupplied(), 3 * USDC);
        assertEq(market.supplyBalance(attacker), 0);
        assertEq(address(market).balance, 3 * USDC);
        _inv();
    }

    function test_Bug1_AttackerCanDrainEntireVictimSupply() public {
        _supply(victim, 4 * USDC);
        _wSupply(attacker, victim, 4 * USDC);
        assertEq(attacker.balance, START + 4 * USDC);
        assertEq(market.supplyBalance(victim), 0, "victim ledger wiped but funds gone");
        assertEq(address(market).balance, 0);
    }

    function test_Bug2_BorrowUntrackedRecordsNoDebt_CollateralFullyWithdrawable() public {
        _supply(lender, 4 * USDC);
        uint256 a0 = attacker.balance;
        _collateral(attacker, 2 * USDC);

        vm.expectEmit(true, false, false, true, address(market));
        emit LabLendingBase.Borrowed(attacker, 1 * USDC);
        vm.prank(attacker);
        market.borrowUntracked(1 * USDC);

        assertEq(market.debt(attacker), 0, "bug2: no debt recorded");
        assertEq(market.totalDebt(), 0);
        assertEq(attacker.balance, a0 - 2 * USDC + 1 * USDC, "received 1 USDC");
        assertEq(market.availableLiquidity(), 3 * USDC);

        _wColl(attacker, 2 * USDC);
        assertEq(market.collateralBalance(attacker), 0);
        assertEq(market.debt(attacker), 0);
        assertEq(attacker.balance, a0 + 1 * USDC, "net profit exactly +1 USDC");
        assertEq(market.availableLiquidity(), 3 * USDC, "lender liquidity 3 USDC");
        assertEq(address(market).balance, 3 * USDC);
        _inv();
    }

    function test_Bug2_LeavesLenderInsolvent() public {
        _supply(lender, 4 * USDC);
        _collateral(attacker, 2 * USDC);
        vm.prank(attacker);
        market.borrowUntracked(1 * USDC);
        _wColl(attacker, 2 * USDC);
        // lender ledger says 4, pool has only 3
        assertEq(market.supplyBalance(lender), 4 * USDC);
        vm.expectRevert(E_LIQ);
        _wSupply(lender, lender, 4 * USDC);
        _wSupply(lender, lender, 3 * USDC);
        assertEq(lender.balance, START - 1 * USDC);
    }

    function test_Bug3_WithdrawAllCollateralWhileDebtOutstanding() public {
        _supply(victim, 4 * USDC);
        uint256 a0 = attacker.balance;
        _collateral(attacker, 2 * USDC);
        _borrow(attacker, 1 * USDC);
        assertEq(market.debt(attacker), 1 * USDC, "bug3 differs from bug2: debt IS recorded");
        assertEq(market.totalDebt(), 1 * USDC);

        _wColl(attacker, 2 * USDC);
        assertEq(market.collateralBalance(attacker), 0);
        assertEq(market.totalCollateral(), 0);
        assertEq(market.debt(attacker), 1 * USDC, "uncollateralized debt remains");
        assertEq(market.totalDebt(), 1 * USDC);
        assertEq(market.maxBorrowable(attacker), 0);
        assertEq(attacker.balance, a0 + 1 * USDC, "net profit +1 USDC");
        assertEq(market.availableLiquidity(), 3 * USDC);
        _inv();
    }

}

/* ------------------------------------------------------------------ */
/*            D: the SAME exploit sequences on the FIXED market        */
/* ------------------------------------------------------------------ */

contract FixedExploitTest is MarketTestBase {
    function _deploy() internal override returns (LabLendingBase) {
        return new FixedLabLendingMarket();
    }

    function test_Fixed_IsPatched() public view {
        assertTrue(market.isPatched());
    }

    function test_Bug1_Fixed_RevertsNotSupplier_NoStateChange() public {
        _supply(victim, 4 * USDC);
        uint256 a0 = attacker.balance;
        vm.expectRevert(E_NOTSUP);
        _wSupply(attacker, victim, 1 * USDC);
        assertEq(attacker.balance, a0);
        assertEq(market.supplyBalance(victim), 4 * USDC);
        assertEq(market.availableLiquidity(), 4 * USDC);
        assertEq(market.totalSupplied(), 4 * USDC);
        assertEq(address(market).balance, 4 * USDC);
        // the real supplier can still withdraw
        _wSupply(victim, victim, 1 * USDC);
        assertEq(market.supplyBalance(victim), 3 * USDC);
        _inv();
    }

    function test_Bug2_Fixed_UntrackedBorrowRecordsDebt_CollateralLocked() public {
        _supply(lender, 4 * USDC);
        uint256 a0 = attacker.balance;
        _collateral(attacker, 2 * USDC);
        vm.prank(attacker);
        market.borrowUntracked(1 * USDC);

        assertEq(market.debt(attacker), 1 * USDC, "debt recorded");
        assertEq(market.totalDebt(), 1 * USDC);
        assertEq(attacker.balance, a0 - 2 * USDC + 1 * USDC);
        assertEq(market.availableLiquidity(), 3 * USDC);

        vm.expectRevert(E_UNDER);
        _wColl(attacker, 2 * USDC);
        vm.expectRevert(E_UNDER);
        _wColl(attacker, 1);
        assertEq(market.collateralBalance(attacker), 2 * USDC);
        assertLt(attacker.balance, a0, "attacker net profit is never positive");
        _inv();

        // after full repay attacker only gets back exactly what is theirs
        _repay(attacker, 1 * USDC);
        _wColl(attacker, 2 * USDC);
        assertEq(attacker.balance, a0);
        assertEq(market.availableLiquidity(), 4 * USDC);
        _inv();
    }

    function test_Bug3_Fixed_NormalBorrow_WithdrawBlockedUntilRepaid() public {
        _supply(victim, 4 * USDC);
        uint256 a0 = attacker.balance;
        _collateral(attacker, 2 * USDC);
        _borrow(attacker, 1 * USDC);
        assertEq(market.debt(attacker), 1 * USDC);

        // with collateral 2 and debt 1 the max withdrawable is 0
        vm.expectRevert(E_UNDER);
        _wColl(attacker, 2 * USDC);
        vm.expectRevert(E_UNDER);
        _wColl(attacker, 1 * USDC);
        vm.expectRevert(E_UNDER);
        _wColl(attacker, 1);
        assertEq(market.collateralBalance(attacker), 2 * USDC);
        assertEq(market.totalCollateral(), 2 * USDC);
        assertLt(attacker.balance, a0);

        _repay(attacker, 1 * USDC);
        _wColl(attacker, 2 * USDC);
        assertEq(market.collateralBalance(attacker), 0);
        assertEq(market.debt(attacker), 0);
        assertEq(attacker.balance, a0, "no profit, no loss");
        _inv();
    }

    function test_Bug3_Fixed_PartialRepayUnlocksExactlyTheSafeAmount() public {
        _supply(victim, 4 * USDC);
        _collateral(attacker, 2 * USDC);
        _borrow(attacker, 1 * USDC);
        _repay(attacker, USDC / 2); // debt 0.5 => need remaining collateral >= 1
        vm.expectRevert(E_UNDER);
        _wColl(attacker, 1 * USDC + 1);
        _wColl(attacker, 1 * USDC);
        assertEq(market.collateralBalance(attacker), 1 * USDC);
        assertEq(market.debt(attacker), USDC / 2);
        _inv();
    }
}

/* ------------------------------------------------------------------ */
/*      E: per-bug isolation harnesses (exactly ONE hook repaired)     */
/* ------------------------------------------------------------------ */

contract OnlyBug1Fixed is LabLendingBase {
    function isPatched() public pure override returns (bool) {
        return false;
    }

    function _authorizeSupplyWithdrawal(address supplier, address caller) internal override {
        if (caller != supplier) revert NotSupplier();
    }

    function _recordUntrackedBorrowDebt(address, uint256) internal override {}
    function _checkCollateralWithdrawal(address, uint256) internal override {}
}

contract OnlyBug2Fixed is LabLendingBase {
    function isPatched() public pure override returns (bool) {
        return false;
    }

    function _authorizeSupplyWithdrawal(address, address) internal override {}

    function _recordUntrackedBorrowDebt(address borrower, uint256 amount) internal override {
        debt[borrower] += amount;
        totalDebt += amount;
    }

    function _checkCollateralWithdrawal(address, uint256) internal override {}
}

contract OnlyBug3Fixed is LabLendingBase {
    function isPatched() public pure override returns (bool) {
        return false;
    }

    function _authorizeSupplyWithdrawal(address, address) internal override {}
    function _recordUntrackedBorrowDebt(address, uint256) internal override {}

    function _checkCollateralWithdrawal(address user, uint256 remainingCollateral) internal override {
        if (debt[user] > remainingCollateral / 2) revert CollateralWouldBeUndercollateralized();
    }
}

abstract contract IsolationBase is MarketTestBase {
    struct Result {
        bool ok; // did the final exploit step succeed?
        bytes4 err; // revert selector if not
        uint256 debtAfter;
        int256 profit; // attacker net native change
    }

    function _errOf(bytes memory r) internal pure returns (bytes4 e) {
        if (r.length >= 4) e = bytes4(r);
    }

    function _bug1() internal returns (Result memory res) {
        _supply(victim, 4 * USDC);
        uint256 a0 = attacker.balance;
        vm.prank(attacker);
        try market.withdrawSupply(victim, 1 * USDC) {
            res.ok = true;
        } catch (bytes memory r) {
            res.err = _errOf(r);
        }
        res.debtAfter = market.debt(attacker);
        res.profit = int256(attacker.balance) - int256(a0);
    }

    function _bug2() internal returns (Result memory res) {
        _supply(lender, 4 * USDC);
        uint256 a0 = attacker.balance;
        _collateral(attacker, 2 * USDC);
        vm.prank(attacker);
        market.borrowUntracked(1 * USDC);
        res.debtAfter = market.debt(attacker); // recorded right after borrow
        vm.prank(attacker);
        try market.withdrawCollateral(2 * USDC) {
            res.ok = true;
        } catch (bytes memory r) {
            res.err = _errOf(r);
        }
        res.profit = int256(attacker.balance) - int256(a0);
    }

    function _bug3() internal returns (Result memory res) {
        _supply(victim, 4 * USDC);
        uint256 a0 = attacker.balance;
        _collateral(attacker, 2 * USDC);
        _borrow(attacker, 1 * USDC);
        vm.prank(attacker);
        try market.withdrawCollateral(2 * USDC) {
            res.ok = true;
        } catch (bytes memory r) {
            res.err = _errOf(r);
        }
        res.debtAfter = market.debt(attacker);
        res.profit = int256(attacker.balance) - int256(a0);
    }
}

contract OnlyBug1FixedTest is IsolationBase {
    function _deploy() internal override returns (LabLendingBase) {
        return new OnlyBug1Fixed();
    }

    function test_Bug1RepairBlocksBug1() public {
        Result memory r = _bug1();
        assertFalse(r.ok);
        assertEq(r.err, E_NOTSUP);
        assertEq(r.profit, 0);
        assertEq(market.supplyBalance(victim), 4 * USDC);
    }

    function test_Bug2StillExploitable() public {
        Result memory r = _bug2();
        assertEq(r.debtAfter, 0);
        assertTrue(r.ok);
        assertEq(r.profit, int256(USDC));
    }

    function test_Bug3StillExploitable() public {
        Result memory r = _bug3();
        assertTrue(r.ok);
        assertEq(r.debtAfter, 1 * USDC);
        assertEq(r.profit, int256(USDC));
    }
}

contract OnlyBug2FixedTest is IsolationBase {
    function _deploy() internal override returns (LabLendingBase) {
        return new OnlyBug2Fixed();
    }

    function test_Bug1StillExploitable() public {
        Result memory r = _bug1();
        assertTrue(r.ok);
        assertEq(r.profit, int256(USDC));
        assertEq(market.supplyBalance(victim), 3 * USDC);
    }

    function test_Bug2RepairRecordsDebt() public {
        Result memory r = _bug2();
        assertEq(r.debtAfter, 1 * USDC, "borrowUntracked now records debt");
        assertEq(market.totalDebt(), 1 * USDC);
    }

    function test_Bug2RepairAloneStillDrainableViaBug3() public {
        // debt is recorded, but the unrepaired collateral hook still lets the collateral out
        Result memory r = _bug2();
        assertTrue(r.ok);
        assertEq(r.profit, int256(USDC));
        assertEq(market.debt(attacker), 1 * USDC);
        assertEq(market.collateralBalance(attacker), 0);
    }

    function test_Bug3StillExploitable() public {
        Result memory r = _bug3();
        assertTrue(r.ok);
        assertEq(r.debtAfter, 1 * USDC);
        assertEq(r.profit, int256(USDC));
    }
}

contract OnlyBug3FixedTest is IsolationBase {
    function _deploy() internal override returns (LabLendingBase) {
        return new OnlyBug3Fixed();
    }

    function test_Bug1StillExploitable() public {
        Result memory r = _bug1();
        assertTrue(r.ok);
        assertEq(r.profit, int256(USDC));
    }

    function test_Bug2StillExploitable() public {
        Result memory r = _bug2();
        assertEq(r.debtAfter, 0, "untracked borrow still records no debt");
        assertTrue(r.ok, "so the collateral hook has nothing to block");
        assertEq(r.profit, int256(USDC));
    }

    function test_Bug3RepairBlocksBug3() public {
        Result memory r = _bug3();
        assertFalse(r.ok);
        assertEq(r.err, E_UNDER);
        assertEq(r.debtAfter, 1 * USDC);
        assertLt(r.profit, int256(USDC));
        assertEq(r.profit, -int256(USDC)); // -2 collateral +1 borrowed
        assertEq(market.collateralBalance(attacker), 2 * USDC);
    }
}

/* ------------------------------------------------------------------ */
/*                       F: differential tests                         */
/* ------------------------------------------------------------------ */

contract DifferentialTest is Test {
    LabLendingBase internal v;
    LabLendingBase internal f;
    address internal lender = makeAddr("lender");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        v = new LabLendingMarket();
        f = new FixedLabLendingMarket();
        vm.deal(lender, 100 * USDC);
        vm.deal(alice, 100 * USDC);
        vm.deal(bob, 100 * USDC);
    }

    function _honest(LabLendingBase m) internal {
        vm.prank(lender);
        m.supply{value: 10 * USDC}();
        vm.prank(bob);
        m.supply{value: 3 * USDC}();
        vm.prank(alice);
        m.depositCollateral{value: 6 * USDC}();
        vm.prank(alice);
        m.borrow(2 * USDC);
        vm.prank(alice);
        m.repay{value: 1 * USDC}();
        vm.prank(bob);
        m.withdrawSupply(bob, 1 * USDC);
        vm.prank(alice);
        m.repay{value: 1 * USDC}();
        vm.prank(alice);
        m.withdrawCollateral(6 * USDC);
        vm.prank(lender);
        m.withdrawSupply(lender, 4 * USDC);
    }

    function _observe(LabLendingBase m) internal view returns (bytes32) {
        address[3] memory who = [lender, alice, bob];
        bytes memory acc = abi.encode(
            address(m).balance,
            m.availableLiquidity(),
            m.totalSupplied(),
            m.totalCollateral(),
            m.totalDebt(),
            m.MAX_LTV_BPS()
        );
        for (uint256 i; i < 3; ++i) {
            acc = abi.encodePacked(
                acc,
                abi.encode(
                    who[i].balance,
                    m.supplyBalance(who[i]),
                    m.collateralBalance(who[i]),
                    m.debt(who[i]),
                    m.maxBorrowable(who[i])
                )
            );
        }
        return keccak256(acc);
    }

    function test_HonestScriptProducesIdenticalState() public {
        uint256 snap = vm.snapshotState();
        _honest(v);
        bytes32 hv = _observe(v);
        assertEq(v.availableLiquidity(), 8 * USDC);
        assertEq(address(v).balance, 8 * USDC);
        vm.revertToState(snap);
        _honest(f);
        bytes32 hf = _observe(f);
        assertEq(f.availableLiquidity(), 8 * USDC);
        assertEq(hv, hf, "state diverged on honest flow");
        assertEq(f.totalSupplied(), 8 * USDC);
        assertEq(f.totalCollateral(), 0);
        assertEq(f.totalDebt(), 0);
    }

    function test_IsPatchedMetadata() public view {
        assertFalse(v.isPatched());
        assertTrue(f.isPatched());
    }

    function test_SameSevenSelectors() public {
        assertEq(LabLendingBase.supply.selector, bytes4(keccak256("supply()")));
        assertEq(LabLendingBase.withdrawSupply.selector, bytes4(keccak256("withdrawSupply(address,uint256)")));
        assertEq(LabLendingBase.depositCollateral.selector, bytes4(keccak256("depositCollateral()")));
        assertEq(LabLendingBase.borrow.selector, bytes4(keccak256("borrow(uint256)")));
        assertEq(LabLendingBase.borrowUntracked.selector, bytes4(keccak256("borrowUntracked(uint256)")));
        assertEq(LabLendingBase.repay.selector, bytes4(keccak256("repay()")));
        assertEq(LabLendingBase.withdrawCollateral.selector, bytes4(keccak256("withdrawCollateral(uint256)")));

        // identical calldata -> identical success flag and return data on both
        bytes[7] memory calls = [
            abi.encodeWithSelector(LabLendingBase.supply.selector),
            abi.encodeWithSelector(LabLendingBase.withdrawSupply.selector, alice, uint256(0)),
            abi.encodeWithSelector(LabLendingBase.depositCollateral.selector),
            abi.encodeWithSelector(LabLendingBase.borrow.selector, uint256(0)),
            abi.encodeWithSelector(LabLendingBase.borrowUntracked.selector, uint256(0)),
            abi.encodeWithSelector(LabLendingBase.repay.selector),
            abi.encodeWithSelector(LabLendingBase.withdrawCollateral.selector, uint256(0))
        ];
        for (uint256 i; i < 7; ++i) {
            vm.prank(alice);
            (bool okV, bytes memory rV) = address(v).call(calls[i]);
            vm.prank(alice);
            (bool okF, bytes memory rF) = address(f).call(calls[i]);
            assertEq(okV, okF);
            assertFalse(okV);
            assertEq(rV, rF);
            assertEq(bytes4(rV), LabLendingBase.ZeroAmount.selector);
        }
    }
}
