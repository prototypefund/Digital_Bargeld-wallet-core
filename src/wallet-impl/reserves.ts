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

import {
  CreateReserveRequest,
  CreateReserveResponse,
  getTimestampNow,
  ConfirmReserveRequest,
  OperationError,
} from "../walletTypes";
import { canonicalizeBaseUrl } from "../util/helpers";
import { InternalWalletState } from "./state";
import {
  ReserveRecordStatus,
  ReserveRecord,
  CurrencyRecord,
  Stores,
  WithdrawalSessionRecord,
} from "../dbTypes";
import {
  oneShotMutate,
  oneShotPut,
  oneShotGet,
  runWithWriteTransaction,
  TransactionAbort,
} from "../util/query";
import { Logger } from "../util/logging";
import * as Amounts from "../util/amounts";
import { updateExchangeFromUrl, getExchangeTrust } from "./exchanges";
import { WithdrawOperationStatusResponse, ReserveStatus } from "../talerTypes";
import { assertUnreachable } from "../util/assertUnreachable";
import { OperationFailedAndReportedError } from "../wallet";
import { encodeCrock } from "../crypto/talerCrypto";
import { randomBytes } from "../crypto/primitives/nacl-fast";
import {
  getVerifiedWithdrawDenomList,
  processWithdrawSession,
} from "./withdraw";

const logger = new Logger("reserves.ts");

/**
 * Create a reserve, but do not flag it as confirmed yet.
 *
 * Adds the corresponding exchange as a trusted exchange if it is neither
 * audited nor trusted already.
 */
export async function createReserve(
  ws: InternalWalletState,
  req: CreateReserveRequest,
): Promise<CreateReserveResponse> {
  const keypair = await ws.cryptoApi.createEddsaKeypair();
  const now = getTimestampNow();
  const canonExchange = canonicalizeBaseUrl(req.exchange);

  let reserveStatus;
  if (req.bankWithdrawStatusUrl) {
    reserveStatus = ReserveRecordStatus.REGISTERING_BANK;
  } else {
    reserveStatus = ReserveRecordStatus.UNCONFIRMED;
  }

  const currency = req.amount.currency;

  const reserveRecord: ReserveRecord = {
    created: now,
    withdrawAllocatedAmount: Amounts.getZero(currency),
    withdrawCompletedAmount: Amounts.getZero(currency),
    withdrawRemainingAmount: Amounts.getZero(currency),
    exchangeBaseUrl: canonExchange,
    hasPayback: false,
    initiallyRequestedAmount: req.amount,
    reservePriv: keypair.priv,
    reservePub: keypair.pub,
    senderWire: req.senderWire,
    timestampConfirmed: undefined,
    timestampReserveInfoPosted: undefined,
    bankWithdrawStatusUrl: req.bankWithdrawStatusUrl,
    exchangeWire: req.exchangeWire,
    reserveStatus,
    lastStatusQuery: undefined,
  };

  const senderWire = req.senderWire;
  if (senderWire) {
    const rec = {
      paytoUri: senderWire,
    };
    await oneShotPut(ws.db, Stores.senderWires, rec);
  }

  const exchangeInfo = await updateExchangeFromUrl(ws, req.exchange);
  const exchangeDetails = exchangeInfo.details;
  if (!exchangeDetails) {
    console.log(exchangeDetails);
    throw Error("exchange not updated");
  }
  const { isAudited, isTrusted } = await getExchangeTrust(ws, exchangeInfo);
  let currencyRecord = await oneShotGet(
    ws.db,
    Stores.currencies,
    exchangeDetails.currency,
  );
  if (!currencyRecord) {
    currencyRecord = {
      auditors: [],
      exchanges: [],
      fractionalDigits: 2,
      name: exchangeDetails.currency,
    };
  }

  if (!isAudited && !isTrusted) {
    currencyRecord.exchanges.push({
      baseUrl: req.exchange,
      exchangePub: exchangeDetails.masterPublicKey,
    });
  }

  const cr: CurrencyRecord = currencyRecord;

  const resp = await runWithWriteTransaction(
    ws.db,
    [Stores.currencies, Stores.reserves, Stores.bankWithdrawUris],
    async tx => {
      // Check if we have already created a reserve for that bankWithdrawStatusUrl
      if (reserveRecord.bankWithdrawStatusUrl) {
        const bwi = await tx.get(
          Stores.bankWithdrawUris,
          reserveRecord.bankWithdrawStatusUrl,
        );
        if (bwi) {
          const otherReserve = await tx.get(Stores.reserves, bwi.reservePub);
          if (otherReserve) {
            logger.trace(
              "returning existing reserve for bankWithdrawStatusUri",
            );
            return {
              exchange: otherReserve.exchangeBaseUrl,
              reservePub: otherReserve.reservePub,
            };
          }
        }
        await tx.put(Stores.bankWithdrawUris, {
          reservePub: reserveRecord.reservePub,
          talerWithdrawUri: reserveRecord.bankWithdrawStatusUrl,
        });
      }
      await tx.put(Stores.currencies, cr);
      await tx.put(Stores.reserves, reserveRecord);
      const r: CreateReserveResponse = {
        exchange: canonExchange,
        reservePub: keypair.pub,
      };
      return r;
    },
  );

  // Asynchronously process the reserve, but return
  // to the caller already.
  processReserve(ws, resp.reservePub).catch(e => {
    console.error("Processing reserve failed:", e);
  });

  return resp;
}

/**
 * First fetch information requred to withdraw from the reserve,
 * then deplete the reserve, withdrawing coins until it is empty.
 *
 * The returned promise resolves once the reserve is set to the
 * state DORMANT.
 */
export async function processReserve(
  ws: InternalWalletState,
  reservePub: string,
): Promise<void> {
  const p = ws.memoProcessReserve.find(reservePub);
  if (p) {
    return p;
  } else {
    return ws.memoProcessReserve.put(
      reservePub,
      processReserveImpl(ws, reservePub),
    );
  }
}

async function registerReserveWithBank(
  ws: InternalWalletState,
  reservePub: string,
): Promise<void> {
  let reserve = await oneShotGet(ws.db, Stores.reserves, reservePub);
  switch (reserve?.reserveStatus) {
    case ReserveRecordStatus.WAIT_CONFIRM_BANK:
    case ReserveRecordStatus.REGISTERING_BANK:
      break;
    default:
      return;
  }
  const bankStatusUrl = reserve.bankWithdrawStatusUrl;
  if (!bankStatusUrl) {
    return;
  }
  console.log("making selection");
  if (reserve.timestampReserveInfoPosted) {
    throw Error("bank claims that reserve info selection is not done");
  }
  const bankResp = await ws.http.postJson(bankStatusUrl, {
    reserve_pub: reservePub,
    selected_exchange: reserve.exchangeWire,
  });
  console.log("got response", bankResp);
  await oneShotMutate(ws.db, Stores.reserves, reservePub, r => {
    switch (r.reserveStatus) {
      case ReserveRecordStatus.REGISTERING_BANK:
      case ReserveRecordStatus.WAIT_CONFIRM_BANK:
        break;
      default:
        return;
    }
    r.timestampReserveInfoPosted = getTimestampNow();
    r.reserveStatus = ReserveRecordStatus.WAIT_CONFIRM_BANK;
    return r;
  });
  return processReserveBankStatus(ws, reservePub);
}

export async function processReserveBankStatus(
  ws: InternalWalletState,
  reservePub: string,
): Promise<void> {
  let reserve = await oneShotGet(ws.db, Stores.reserves, reservePub);
  switch (reserve?.reserveStatus) {
    case ReserveRecordStatus.WAIT_CONFIRM_BANK:
    case ReserveRecordStatus.REGISTERING_BANK:
      break;
    default:
      return;
  }
  const bankStatusUrl = reserve.bankWithdrawStatusUrl;
  if (!bankStatusUrl) {
    return;
  }

  let status: WithdrawOperationStatusResponse;
  try {
    const statusResp = await ws.http.get(bankStatusUrl);
    status = WithdrawOperationStatusResponse.checked(statusResp.responseJson);
  } catch (e) {
    throw e;
  }

  if (status.selection_done) {
    if (reserve.reserveStatus === ReserveRecordStatus.REGISTERING_BANK) {
      await registerReserveWithBank(ws, reservePub);
      return await processReserveBankStatus(ws, reservePub);
    }
  } else {
    await registerReserveWithBank(ws, reservePub);
    return await processReserveBankStatus(ws, reservePub);
  }

  if (status.transfer_done) {
    await oneShotMutate(ws.db, Stores.reserves, reservePub, r => {
      switch (r.reserveStatus) {
        case ReserveRecordStatus.REGISTERING_BANK:
        case ReserveRecordStatus.WAIT_CONFIRM_BANK:
          break;
        default:
          return;
      }
      const now = getTimestampNow();
      r.timestampConfirmed = now;
      r.reserveStatus = ReserveRecordStatus.QUERYING_STATUS;
      return r;
    });
    await processReserveImpl(ws, reservePub);
  } else {
    await oneShotMutate(ws.db, Stores.reserves, reservePub, r => {
      switch (r.reserveStatus) {
        case ReserveRecordStatus.WAIT_CONFIRM_BANK:
          break;
        default:
          return;
      }
      r.bankWithdrawConfirmUrl = status.confirm_transfer_url;
      return r;
    });
  }
}

async function setReserveError(
  ws: InternalWalletState,
  reservePub: string,
  err: OperationError,
): Promise<void> {
  const mut = (reserve: ReserveRecord) => {
    reserve.lastError = err;
    return reserve;
  };
  await oneShotMutate(ws.db, Stores.reserves, reservePub, mut);
}

/**
 * Update the information about a reserve that is stored in the wallet
 * by quering the reserve's exchange.
 */
async function updateReserve(
  ws: InternalWalletState,
  reservePub: string,
): Promise<void> {
  const reserve = await oneShotGet(ws.db, Stores.reserves, reservePub);
  if (!reserve) {
    throw Error("reserve not in db");
  }

  if (reserve.timestampConfirmed === undefined) {
    throw Error("reserve not confirmed yet");
  }

  if (reserve.reserveStatus !== ReserveRecordStatus.QUERYING_STATUS) {
    return;
  }

  const reqUrl = new URL("reserve/status", reserve.exchangeBaseUrl);
  reqUrl.searchParams.set("reserve_pub", reservePub);
  let resp;
  try {
    resp = await ws.http.get(reqUrl.href);
  } catch (e) {
    if (e.response?.status === 404) {
      const m = "The exchange does not know about this reserve (yet).";
      await setReserveError(ws, reservePub, {
        type: "waiting",
        details: {},
        message: "The exchange does not know about this reserve (yet).",
      });
      throw new OperationFailedAndReportedError(m);
    } else {
      const m = e.message;
      await setReserveError(ws, reservePub, {
        type: "network",
        details: {},
        message: m,
      });
      throw new OperationFailedAndReportedError(m);
    }
  }
  const reserveInfo = ReserveStatus.checked(resp.responseJson);
  const balance = Amounts.parseOrThrow(reserveInfo.balance);
  await oneShotMutate(ws.db, Stores.reserves, reserve.reservePub, r => {
    if (r.reserveStatus !== ReserveRecordStatus.QUERYING_STATUS) {
      return;
    }

    // FIXME: check / compare history!
    if (!r.lastStatusQuery) {
      // FIXME: check if this matches initial expectations
      r.withdrawRemainingAmount = balance;
    } else {
      const expectedBalance = Amounts.sub(
        r.withdrawAllocatedAmount,
        r.withdrawCompletedAmount,
      );
      const cmp = Amounts.cmp(balance, expectedBalance.amount);
      if (cmp == 0) {
        // Nothing changed.
        return;
      }
      if (cmp > 0) {
        const extra = Amounts.sub(balance, expectedBalance.amount).amount;
        r.withdrawRemainingAmount = Amounts.add(
          r.withdrawRemainingAmount,
          extra,
        ).amount;
      } else {
        // We're missing some money.
      }
    }
    r.lastStatusQuery = getTimestampNow();
    r.reserveStatus = ReserveRecordStatus.WITHDRAWING;
    return r;
  });
  ws.notifier.notify();
}

async function processReserveImpl(
  ws: InternalWalletState,
  reservePub: string,
): Promise<void> {
  const reserve = await oneShotGet(ws.db, Stores.reserves, reservePub);
  if (!reserve) {
    console.log("not processing reserve: reserve does not exist");
    return;
  }
  logger.trace(
    `Processing reserve ${reservePub} with status ${reserve.reserveStatus}`,
  );
  switch (reserve.reserveStatus) {
    case ReserveRecordStatus.UNCONFIRMED:
      // nothing to do
      break;
    case ReserveRecordStatus.REGISTERING_BANK:
      await processReserveBankStatus(ws, reservePub);
      return processReserveImpl(ws, reservePub);
    case ReserveRecordStatus.QUERYING_STATUS:
      await updateReserve(ws, reservePub);
      return processReserveImpl(ws, reservePub);
    case ReserveRecordStatus.WITHDRAWING:
      await depleteReserve(ws, reservePub);
      break;
    case ReserveRecordStatus.DORMANT:
      // nothing to do
      break;
    case ReserveRecordStatus.WAIT_CONFIRM_BANK:
      await processReserveBankStatus(ws, reservePub);
      break;
    default:
      console.warn("unknown reserve record status:", reserve.reserveStatus);
      assertUnreachable(reserve.reserveStatus);
      break;
  }
}

export async function confirmReserve(
  ws: InternalWalletState,
  req: ConfirmReserveRequest,
): Promise<void> {
  const now = getTimestampNow();
  await oneShotMutate(ws.db, Stores.reserves, req.reservePub, reserve => {
    if (reserve.reserveStatus !== ReserveRecordStatus.UNCONFIRMED) {
      return;
    }
    reserve.timestampConfirmed = now;
    reserve.reserveStatus = ReserveRecordStatus.QUERYING_STATUS;
    return reserve;
  });

  ws.notifier.notify();

  processReserve(ws, req.reservePub).catch(e => {
    console.log("processing reserve failed:", e);
  });
}

/**
 * Withdraw coins from a reserve until it is empty.
 *
 * When finished, marks the reserve as depleted by setting
 * the depleted timestamp.
 */
async function depleteReserve(
  ws: InternalWalletState,
  reservePub: string,
): Promise<void> {
  const reserve = await oneShotGet(ws.db, Stores.reserves, reservePub);
  if (!reserve) {
    return;
  }
  if (reserve.reserveStatus !== ReserveRecordStatus.WITHDRAWING) {
    return;
  }
  logger.trace(`depleting reserve ${reservePub}`);

  const withdrawAmount = reserve.withdrawRemainingAmount;

  logger.trace(`getting denom list`);

  const denomsForWithdraw = await getVerifiedWithdrawDenomList(
    ws,
    reserve.exchangeBaseUrl,
    withdrawAmount,
  );
  logger.trace(`got denom list`);
  if (denomsForWithdraw.length === 0) {
    const m = `Unable to withdraw from reserve, no denominations are available to withdraw.`;
    await setReserveError(ws, reserve.reservePub, {
      type: "internal",
      message: m,
      details: {},
    });
    console.log(m);
    throw new OperationFailedAndReportedError(m);
  }

  logger.trace("selected denominations");

  const withdrawalSessionId = encodeCrock(randomBytes(32));

  const totalCoinValue = Amounts.sum(denomsForWithdraw.map(x => x.value)).amount;

  const withdrawalRecord: WithdrawalSessionRecord = {
    withdrawSessionId: withdrawalSessionId,
    exchangeBaseUrl: reserve.exchangeBaseUrl,
    source: {
      type: "reserve",
      reservePub: reserve.reservePub,
    },
    rawWithdrawalAmount: withdrawAmount,
    startTimestamp: getTimestampNow(),
    denoms: denomsForWithdraw.map(x => x.denomPub),
    withdrawn: denomsForWithdraw.map(x => false),
    planchets: denomsForWithdraw.map(x => undefined),
    totalCoinValue,
  };

  const totalCoinWithdrawFee = Amounts.sum(
    denomsForWithdraw.map(x => x.feeWithdraw),
  ).amount;
  const totalWithdrawAmount = Amounts.add(totalCoinValue, totalCoinWithdrawFee)
    .amount;

  function mutateReserve(r: ReserveRecord): ReserveRecord {
    const remaining = Amounts.sub(
      r.withdrawRemainingAmount,
      totalWithdrawAmount,
    );
    if (remaining.saturated) {
      console.error("can't create planchets, saturated");
      throw TransactionAbort;
    }
    const allocated = Amounts.add(
      r.withdrawAllocatedAmount,
      totalWithdrawAmount,
    );
    if (allocated.saturated) {
      console.error("can't create planchets, saturated");
      throw TransactionAbort;
    }
    r.withdrawRemainingAmount = remaining.amount;
    r.withdrawAllocatedAmount = allocated.amount;
    r.reserveStatus = ReserveRecordStatus.DORMANT;

    return r;
  }

  const success = await runWithWriteTransaction(
    ws.db,
    [Stores.withdrawalSession, Stores.reserves],
    async tx => {
      const myReserve = await tx.get(Stores.reserves, reservePub);
      if (!myReserve) {
        return false;
      }
      if (myReserve.reserveStatus !== ReserveRecordStatus.WITHDRAWING) {
        return false;
      }
      await tx.mutate(Stores.reserves, reserve.reservePub, mutateReserve);
      await tx.put(Stores.withdrawalSession, withdrawalRecord);
      return true;
    },
  );

  if (success) {
    console.log("processing new withdraw session");
    await processWithdrawSession(ws, withdrawalSessionId);
  } else {
    console.trace("withdraw session already existed");
  }
}
