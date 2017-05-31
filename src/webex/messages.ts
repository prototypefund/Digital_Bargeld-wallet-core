/*
 This file is part of TALER
 (C) 2017 Inria and GNUnet e.V.

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */

/**
 * Type definitions for messages between content scripts/pages and backend.
 */

// Messages are already documented in wxApi.
/* tslint:disable:completed-docs */

import * as types from "../types";

/**
 * Message type information.
 */
export interface MessageMap {
  "balances": {
    request: { };
    response: types.WalletBalance;
  };
  "dump-db": {
    request: { };
    response: any;
  };
  "import-db": {
    request: {
      dump: object;
    };
    response: void;
  };
  "get-tab-cookie": {
    request: { }
    response: any;
  };
  "ping": {
    request: { };
    response: void;
  };
  "reset": {
    request: { };
    response: void;
  };
  "create-reserve": {
    request: {
      amount: types.AmountJson;
      exchange: string 
    };
    response: void;
  }; 
  "confirm-reserve": {
    request: { reservePub: string };
    response: void;
  }
  "generate-nonce": {
    request: { }
    response: string;
  };
  "confirm-pay": {
    request: { offer: types.OfferRecord; };
    response: types.ConfirmPayResult;
  };
  "check-pay": {
    request: { offer: types.OfferRecord; };
    response: types.CheckPayResult;
  };
  "query-payment": {
    request: { };
    response: void;
  };
  "exchange-info": {
    request: { baseUrl: string };
    response: types.ExchangeRecord;
  };
  "currency-info": {
    request: { name: string };
    response: types.CurrencyRecord;
  };
  "hash-contract": {
    request: { contract: object };
    response: string;
  };
  "put-history-entry": {
    request: { historyEntry: types.HistoryRecord };
    response: void;
  };
  "safe-offer": {
    request: { offer: types.OfferRecord };
    response: void;
  };
  "reserve-creation-info": {
    request: { baseUrl: string };
    response: types.ReserveCreationInfo;
  }
  "get-history": {
    request: { };
    response: types.HistoryRecord[];
  };
  "get-offer": {
    request: { offerId: number };
    response: types.OfferRecord | undefined;
  };
  "get-currencies": {
    request: { };
    response: types.CurrencyRecord[];
  };
  "update-currency": {
    request: { currencyRecord: types.CurrencyRecord };
    response: void;
  };
  "get-reserves": {
    request: { exchangeBaseUrl: string };
    response: types.ReserveRecord[];
  };
  "get-payback-reserves": {
    request: { };
    response: types.ReserveRecord[];
  };
  "withdraw-payback-reserve": {
    request: { reservePub: string };
    response: void;
  }
  "get-precoins": {
    request: { exchangeBaseUrl: string };
    response: types.PreCoinRecord[];
  };
  "get-denoms": {
    request: { exchangeBaseUrl: string };
    response: types.DenominationRecord[];
  };
  "payback-coin": {
    request: { coinPub: string };
    response: void;
  };
  "payment-failed": {
    request: { contractTermsHash: string };
    response: void;
  };
  "payment-succeeded": {
    request: { contractTermsHash: string; merchantSig: string };
    response: void;
  };
}

/**
 * String literal types for messages.
 */
export type MessageType = keyof MessageMap;

/**
 * Make a request whose details match the request type.
 */
export function makeRequest<T extends MessageType>(type: T, details: MessageMap[T]["request"]) {
  return { type, details };
}

/**
 * Make a response that matches the request type.
 */
export function makeResponse<T extends MessageType>(type: T, response: MessageMap[T]["response"]) {
  return response;
}
