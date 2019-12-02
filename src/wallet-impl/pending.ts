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
  PendingOperationInfo,
  PendingOperationsResponse,
  getTimestampNow,
} from "../walletTypes";
import { runWithReadTransaction } from "../util/query";
import { InternalWalletState } from "./state";
import {
  Stores,
  ExchangeUpdateStatus,
  ReserveRecordStatus,
  CoinStatus,
  ProposalStatus,
} from "../dbTypes";

export async function getPendingOperations(
  ws: InternalWalletState,
): Promise<PendingOperationsResponse> {
  const pendingOperations: PendingOperationInfo[] = [];
  let minRetryDurationMs = 5000;
  await runWithReadTransaction(
    ws.db,
    [
      Stores.exchanges,
      Stores.reserves,
      Stores.refresh,
      Stores.coins,
      Stores.withdrawalSession,
      Stores.proposals,
      Stores.tips,
    ],
    async tx => {
      await tx.iter(Stores.exchanges).forEach(e => {
        switch (e.updateStatus) {
          case ExchangeUpdateStatus.FINISHED:
            if (e.lastError) {
              pendingOperations.push({
                type: "bug",
                message:
                  "Exchange record is in FINISHED state but has lastError set",
                details: {
                  exchangeBaseUrl: e.baseUrl,
                },
              });
            }
            if (!e.details) {
              pendingOperations.push({
                type: "bug",
                message:
                  "Exchange record does not have details, but no update in progress.",
                details: {
                  exchangeBaseUrl: e.baseUrl,
                },
              });
            }
            if (!e.wireInfo) {
              pendingOperations.push({
                type: "bug",
                message:
                  "Exchange record does not have wire info, but no update in progress.",
                details: {
                  exchangeBaseUrl: e.baseUrl,
                },
              });
            }
            break;
          case ExchangeUpdateStatus.FETCH_KEYS:
            pendingOperations.push({
              type: "exchange-update",
              stage: "fetch-keys",
              exchangeBaseUrl: e.baseUrl,
              lastError: e.lastError,
              reason: e.updateReason || "unknown",
            });
            break;
          case ExchangeUpdateStatus.FETCH_WIRE:
            pendingOperations.push({
              type: "exchange-update",
              stage: "fetch-wire",
              exchangeBaseUrl: e.baseUrl,
              lastError: e.lastError,
              reason: e.updateReason || "unknown",
            });
            break;
          default:
            pendingOperations.push({
              type: "bug",
              message: "Unknown exchangeUpdateStatus",
              details: {
                exchangeBaseUrl: e.baseUrl,
                exchangeUpdateStatus: e.updateStatus,
              },
            });
            break;
        }
      });
      await tx.iter(Stores.reserves).forEach(reserve => {
        const reserveType = reserve.bankWithdrawStatusUrl
          ? "taler-bank"
          : "manual";
        const now = getTimestampNow();
        switch (reserve.reserveStatus) {
          case ReserveRecordStatus.DORMANT:
            // nothing to report as pending
            break;
          case ReserveRecordStatus.WITHDRAWING:
          case ReserveRecordStatus.UNCONFIRMED:
          case ReserveRecordStatus.QUERYING_STATUS:
          case ReserveRecordStatus.REGISTERING_BANK:
            pendingOperations.push({
              type: "reserve",
              stage: reserve.reserveStatus,
              timestampCreated: reserve.created,
              reserveType,
              reservePub: reserve.reservePub,
            });
            if (reserve.created.t_ms < now.t_ms - 5000) {
              minRetryDurationMs = 500;
            } else if (reserve.created.t_ms < now.t_ms - 30000) {
              minRetryDurationMs = 2000;
            }
            break;
          case ReserveRecordStatus.WAIT_CONFIRM_BANK:
            pendingOperations.push({
              type: "reserve",
              stage: reserve.reserveStatus,
              timestampCreated: reserve.created,
              reserveType,
              reservePub: reserve.reservePub,
              bankWithdrawConfirmUrl: reserve.bankWithdrawConfirmUrl,
            });
            if (reserve.created.t_ms < now.t_ms - 5000) {
              minRetryDurationMs = 500;
            } else if (reserve.created.t_ms < now.t_ms - 30000) {
              minRetryDurationMs = 2000;
            }
            break;
          default:
            pendingOperations.push({
              type: "bug",
              message: "Unknown reserve record status",
              details: {
                reservePub: reserve.reservePub,
                reserveStatus: reserve.reserveStatus,
              },
            });
            break;
        }
      });

      await tx.iter(Stores.refresh).forEach(r => {
        if (r.finished) {
          return;
        }
        let refreshStatus: string;
        if (r.norevealIndex === undefined) {
          refreshStatus = "melt";
        } else {
          refreshStatus = "reveal";
        }

        pendingOperations.push({
          type: "refresh",
          oldCoinPub: r.meltCoinPub,
          refreshStatus,
          refreshOutputSize: r.newDenoms.length,
          refreshSessionId: r.refreshSessionId,
        });
      });

      await tx.iter(Stores.coins).forEach(coin => {
        if (coin.status == CoinStatus.Dirty) {
          pendingOperations.push({
            type: "dirty-coin",
            coinPub: coin.coinPub,
          });
        }
      });

      await tx.iter(Stores.withdrawalSession).forEach(ws => {
        const numCoinsWithdrawn = ws.withdrawn.reduce(
          (a, x) => a + (x ? 1 : 0),
          0,
        );
        const numCoinsTotal = ws.withdrawn.length;
        if (numCoinsWithdrawn < numCoinsTotal) {
          pendingOperations.push({
            type: "withdraw",
            numCoinsTotal,
            numCoinsWithdrawn,
            source: ws.source,
            withdrawSessionId: ws.withdrawSessionId,
          });
        }
      });

      await tx.iter(Stores.proposals).forEach((proposal) => {
        if (proposal.proposalStatus == ProposalStatus.PROPOSED) {
          pendingOperations.push({
            type: "proposal-choice",
            merchantBaseUrl: proposal.download!!.contractTerms.merchant_base_url,
            proposalId: proposal.proposalId,
            proposalTimestamp: proposal.timestamp,
          });
        } else if (proposal.proposalStatus == ProposalStatus.DOWNLOADING) {
          pendingOperations.push({
            type: "proposal-download",
            merchantBaseUrl: proposal.download!!.contractTerms.merchant_base_url,
            proposalId: proposal.proposalId,
            proposalTimestamp: proposal.timestamp,
          });
        }
      });

      await tx.iter(Stores.tips).forEach((tip) => {
        if (tip.accepted && !tip.pickedUp) {
          pendingOperations.push({
            type: "tip",
            merchantBaseUrl: tip.merchantBaseUrl,
            tipId: tip.tipId,
            merchantTipId: tip.merchantTipId,
          });
        }
      });
    },
  );

  return {
    pendingOperations,
    nextRetryDelay: {
      d_ms: minRetryDurationMs,
    },
  };
}
