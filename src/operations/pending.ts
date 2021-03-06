/*
 This file is part of GNU Taler
 (C) 2019 GNUnet e.V.

 GNU Taler is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 GNU Taler is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 GNU Taler; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */

/**
 * Imports.
 */
import {
  ExchangeUpdateStatus,
  ProposalStatus,
  ReserveRecordStatus,
  Stores,
} from "../types/dbTypes";
import {
  PendingOperationsResponse,
  PendingOperationType,
  ExchangeUpdateOperationStage,
} from "../types/pending";
import {
  Duration,
  getTimestampNow,
  Timestamp,
  getDurationRemaining,
  durationMin,
} from "../util/time";
import { TransactionHandle } from "../util/query";
import { InternalWalletState } from "./state";
import { getBalancesInsideTransaction } from "./balance";
import { ReserveType } from "../types/history";

function updateRetryDelay(
  oldDelay: Duration,
  now: Timestamp,
  retryTimestamp: Timestamp,
): Duration {
  const remaining = getDurationRemaining(retryTimestamp, now);
  const nextDelay = durationMin(oldDelay, remaining);
  return nextDelay;
}

async function gatherExchangePending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  if (onlyDue) {
    // FIXME: exchanges should also be updated regularly
    return;
  }
  await tx.iter(Stores.exchanges).forEach((e) => {
    switch (e.updateStatus) {
      case ExchangeUpdateStatus.Finished:
        if (e.lastError) {
          resp.pendingOperations.push({
            type: PendingOperationType.Bug,
            givesLifeness: false,
            message:
              "Exchange record is in FINISHED state but has lastError set",
            details: {
              exchangeBaseUrl: e.baseUrl,
            },
          });
        }
        if (!e.details) {
          resp.pendingOperations.push({
            type: PendingOperationType.Bug,
            givesLifeness: false,
            message:
              "Exchange record does not have details, but no update in progress.",
            details: {
              exchangeBaseUrl: e.baseUrl,
            },
          });
        }
        if (!e.wireInfo) {
          resp.pendingOperations.push({
            type: PendingOperationType.Bug,
            givesLifeness: false,
            message:
              "Exchange record does not have wire info, but no update in progress.",
            details: {
              exchangeBaseUrl: e.baseUrl,
            },
          });
        }
        break;
      case ExchangeUpdateStatus.FetchKeys:
        resp.pendingOperations.push({
          type: PendingOperationType.ExchangeUpdate,
          givesLifeness: false,
          stage: ExchangeUpdateOperationStage.FetchKeys,
          exchangeBaseUrl: e.baseUrl,
          lastError: e.lastError,
          reason: e.updateReason || "unknown",
        });
        break;
      case ExchangeUpdateStatus.FetchWire:
        resp.pendingOperations.push({
          type: PendingOperationType.ExchangeUpdate,
          givesLifeness: false,
          stage: ExchangeUpdateOperationStage.FetchWire,
          exchangeBaseUrl: e.baseUrl,
          lastError: e.lastError,
          reason: e.updateReason || "unknown",
        });
        break;
      case ExchangeUpdateStatus.FinalizeUpdate:
        resp.pendingOperations.push({
          type: PendingOperationType.ExchangeUpdate,
          givesLifeness: false,
          stage: ExchangeUpdateOperationStage.FinalizeUpdate,
          exchangeBaseUrl: e.baseUrl,
          lastError: e.lastError,
          reason: e.updateReason || "unknown",
        });
        break;
      default:
        resp.pendingOperations.push({
          type: PendingOperationType.Bug,
          givesLifeness: false,
          message: "Unknown exchangeUpdateStatus",
          details: {
            exchangeBaseUrl: e.baseUrl,
            exchangeUpdateStatus: e.updateStatus,
          },
        });
        break;
    }
  });
}

async function gatherReservePending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  // FIXME: this should be optimized by using an index for "onlyDue==true".
  await tx.iter(Stores.reserves).forEach((reserve) => {
    const reserveType = reserve.bankWithdrawStatusUrl
      ? ReserveType.TalerBankWithdraw
      : ReserveType.Manual;
    if (!reserve.retryInfo.active) {
      return;
    }
    switch (reserve.reserveStatus) {
      case ReserveRecordStatus.DORMANT:
        // nothing to report as pending
        break;
      case ReserveRecordStatus.UNCONFIRMED:
        if (onlyDue) {
          break;
        }
        resp.pendingOperations.push({
          type: PendingOperationType.Reserve,
          givesLifeness: false,
          stage: reserve.reserveStatus,
          timestampCreated: reserve.timestampCreated,
          reserveType,
          reservePub: reserve.reservePub,
          retryInfo: reserve.retryInfo,
        });
        break;
      case ReserveRecordStatus.WAIT_CONFIRM_BANK:
      case ReserveRecordStatus.WITHDRAWING:
      case ReserveRecordStatus.QUERYING_STATUS:
      case ReserveRecordStatus.REGISTERING_BANK:
        resp.nextRetryDelay = updateRetryDelay(
          resp.nextRetryDelay,
          now,
          reserve.retryInfo.nextRetry,
        );
        if (onlyDue && reserve.retryInfo.nextRetry.t_ms > now.t_ms) {
          return;
        }
        resp.pendingOperations.push({
          type: PendingOperationType.Reserve,
          givesLifeness: true,
          stage: reserve.reserveStatus,
          timestampCreated: reserve.timestampCreated,
          reserveType,
          reservePub: reserve.reservePub,
          retryInfo: reserve.retryInfo,
        });
        break;
      default:
        resp.pendingOperations.push({
          type: PendingOperationType.Bug,
          givesLifeness: false,
          message: "Unknown reserve record status",
          details: {
            reservePub: reserve.reservePub,
            reserveStatus: reserve.reserveStatus,
          },
        });
        break;
    }
  });
}

async function gatherRefreshPending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  await tx.iter(Stores.refreshGroups).forEach((r) => {
    if (r.timestampFinished) {
      return;
    }
    resp.nextRetryDelay = updateRetryDelay(
      resp.nextRetryDelay,
      now,
      r.retryInfo.nextRetry,
    );
    if (onlyDue && r.retryInfo.nextRetry.t_ms > now.t_ms) {
      return;
    }

    resp.pendingOperations.push({
      type: PendingOperationType.Refresh,
      givesLifeness: true,
      refreshGroupId: r.refreshGroupId,
      finishedPerCoin: r.finishedPerCoin,
      retryInfo: r.retryInfo,
    });
  });
}

async function gatherWithdrawalPending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  await tx.iter(Stores.withdrawalGroups).forEach((wsr) => {
    if (wsr.timestampFinish) {
      return;
    }
    resp.nextRetryDelay = updateRetryDelay(
      resp.nextRetryDelay,
      now,
      wsr.retryInfo.nextRetry,
    );
    if (onlyDue && wsr.retryInfo.nextRetry.t_ms > now.t_ms) {
      return;
    }
    const numCoinsWithdrawn = wsr.withdrawn.reduce(
      (a, x) => a + (x ? 1 : 0),
      0,
    );
    const numCoinsTotal = wsr.withdrawn.length;
    resp.pendingOperations.push({
      type: PendingOperationType.Withdraw,
      givesLifeness: true,
      numCoinsTotal,
      numCoinsWithdrawn,
      source: wsr.source,
      withdrawalGroupId: wsr.withdrawalGroupId,
      lastError: wsr.lastError,
    });
  });
}

async function gatherProposalPending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  await tx.iter(Stores.proposals).forEach((proposal) => {
    if (proposal.proposalStatus == ProposalStatus.PROPOSED) {
      if (onlyDue) {
        return;
      }
      const dl = proposal.download;
      if (!dl) {
        resp.pendingOperations.push({
          type: PendingOperationType.Bug,
          message: "proposal is in invalid state",
          details: {},
          givesLifeness: false,
        });
      } else {
        resp.pendingOperations.push({
          type: PendingOperationType.ProposalChoice,
          givesLifeness: false,
          merchantBaseUrl: dl.contractData.merchantBaseUrl,
          proposalId: proposal.proposalId,
          proposalTimestamp: proposal.timestamp,
        });
      }
    } else if (proposal.proposalStatus == ProposalStatus.DOWNLOADING) {
      resp.nextRetryDelay = updateRetryDelay(
        resp.nextRetryDelay,
        now,
        proposal.retryInfo.nextRetry,
      );
      if (onlyDue && proposal.retryInfo.nextRetry.t_ms > now.t_ms) {
        return;
      }
      resp.pendingOperations.push({
        type: PendingOperationType.ProposalDownload,
        givesLifeness: true,
        merchantBaseUrl: proposal.merchantBaseUrl,
        orderId: proposal.orderId,
        proposalId: proposal.proposalId,
        proposalTimestamp: proposal.timestamp,
        lastError: proposal.lastError,
        retryInfo: proposal.retryInfo,
      });
    }
  });
}

async function gatherTipPending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  await tx.iter(Stores.tips).forEach((tip) => {
    if (tip.pickedUp) {
      return;
    }
    resp.nextRetryDelay = updateRetryDelay(
      resp.nextRetryDelay,
      now,
      tip.retryInfo.nextRetry,
    );
    if (onlyDue && tip.retryInfo.nextRetry.t_ms > now.t_ms) {
      return;
    }
    if (tip.acceptedTimestamp) {
      resp.pendingOperations.push({
        type: PendingOperationType.TipPickup,
        givesLifeness: true,
        merchantBaseUrl: tip.merchantBaseUrl,
        tipId: tip.tipId,
        merchantTipId: tip.merchantTipId,
      });
    }
  });
}

async function gatherPurchasePending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  await tx.iter(Stores.purchases).forEach((pr) => {
    if (pr.paymentSubmitPending) {
      resp.nextRetryDelay = updateRetryDelay(
        resp.nextRetryDelay,
        now,
        pr.payRetryInfo.nextRetry,
      );
      if (!onlyDue || pr.payRetryInfo.nextRetry.t_ms <= now.t_ms) {
        resp.pendingOperations.push({
          type: PendingOperationType.Pay,
          givesLifeness: true,
          isReplay: false,
          proposalId: pr.proposalId,
          retryInfo: pr.payRetryInfo,
          lastError: pr.lastPayError,
        });
      }
    }
    if (pr.refundStatusRequested) {
      resp.nextRetryDelay = updateRetryDelay(
        resp.nextRetryDelay,
        now,
        pr.refundStatusRetryInfo.nextRetry,
      );
      if (!onlyDue || pr.refundStatusRetryInfo.nextRetry.t_ms <= now.t_ms) {
        resp.pendingOperations.push({
          type: PendingOperationType.RefundQuery,
          givesLifeness: true,
          proposalId: pr.proposalId,
          retryInfo: pr.refundStatusRetryInfo,
          lastError: pr.lastRefundStatusError,
        });
      }
    }
  });
}

async function gatherRecoupPending(
  tx: TransactionHandle,
  now: Timestamp,
  resp: PendingOperationsResponse,
  onlyDue = false,
): Promise<void> {
  await tx.iter(Stores.recoupGroups).forEach((rg) => {
    if (rg.timestampFinished) {
      return;
    }
    resp.nextRetryDelay = updateRetryDelay(
      resp.nextRetryDelay,
      now,
      rg.retryInfo.nextRetry,
    );
    if (onlyDue && rg.retryInfo.nextRetry.t_ms > now.t_ms) {
      return;
    }
    resp.pendingOperations.push({
      type: PendingOperationType.Recoup,
      givesLifeness: true,
      recoupGroupId: rg.recoupGroupId,
      retryInfo: rg.retryInfo,
      lastError: rg.lastError,
    });
  });
}

export async function getPendingOperations(
  ws: InternalWalletState,
  { onlyDue = false } = {},
): Promise<PendingOperationsResponse> {
  const now = getTimestampNow();
  return await ws.db.runWithReadTransaction(
    [
      Stores.exchanges,
      Stores.reserves,
      Stores.refreshGroups,
      Stores.coins,
      Stores.withdrawalGroups,
      Stores.proposals,
      Stores.tips,
      Stores.purchases,
      Stores.recoupGroups,
    ],
    async (tx) => {
      const walletBalance = await getBalancesInsideTransaction(ws, tx);
      const resp: PendingOperationsResponse = {
        nextRetryDelay: { d_ms: Number.MAX_SAFE_INTEGER },
        onlyDue: onlyDue,
        walletBalance,
        pendingOperations: [],
      };
      await gatherExchangePending(tx, now, resp, onlyDue);
      await gatherReservePending(tx, now, resp, onlyDue);
      await gatherRefreshPending(tx, now, resp, onlyDue);
      await gatherWithdrawalPending(tx, now, resp, onlyDue);
      await gatherProposalPending(tx, now, resp, onlyDue);
      await gatherTipPending(tx, now, resp, onlyDue);
      await gatherPurchasePending(tx, now, resp, onlyDue);
      await gatherRecoupPending(tx, now, resp, onlyDue);
      return resp;
    },
  );
}
