/*
 This file is part of TALER
 (C) 2015 GNUnet e.V.

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, If not, see <http://www.gnu.org/licenses/>
 */

/**
 * High-level wallet operations that should be indepentent from the underlying
 * browser extension interface.
 * @module Wallet
 * @author Florian Dold
 */

import {Amount} from "./emscriptif"
import {CoinWithDenom} from "./types";
import {DepositRequestPS_Args} from "./emscriptif";
import {HashCode} from "./emscriptif";
import {EddsaPublicKey} from "./emscriptif";
import {Coin} from "./types";
import {AbsoluteTimeNbo} from "./emscriptif";
import {UInt64} from "./emscriptif";
import {DepositRequestPS} from "./emscriptif";
import {eddsaSign} from "./emscriptif";
import {EddsaPrivateKey} from "./emscriptif";
import {ConfirmReserveRequest} from "./types";
import {ConfirmReserveResponse} from "./types";
import {RsaPublicKey} from "./emscriptif";
import {Denomination} from "./types";
import {RsaBlindingKey} from "./emscriptif";
import {ByteArray} from "./emscriptif";
import {rsaBlind} from "./emscriptif";
import {WithdrawRequestPS} from "./emscriptif";
import {PreCoin} from "./types";
import {rsaUnblind} from "./emscriptif";
import {RsaSignature} from "./emscriptif";
import {Mint} from "./types";
import {HttpResponse} from "./http";
import {RequestException} from "./http";
import {Query} from "./query";
import {AmountJson} from "./types";

"use strict";



class CoinPaySig {
  coin_sig: string;

  coin_pub: string;

  ub_sig: string;

  denom_pub: string;

  f: AmountJson;
}


interface ConfirmPayRequest {
  offer: Offer;
}

interface MintCoins {
  [mintUrl: string]: CoinWithDenom[];
}


interface MintInfo {
  master_pub: string;
  url: string;
}

interface Offer {
  contract: Contract;
  merchant_sig: string;
  H_contract: string;
}

interface Contract {
  H_wire: string;
  amount: AmountJson;
  auditors: string[];
  expiry: string,
  locations: string[];
  max_fee: AmountJson;
  merchant: any;
  merchant_pub: string;
  mints: MintInfo[];
  products: string[];
  refund_deadline: string;
  timestamp: string;
  transaction_id: number;
  fulfillment_url: string;
}


interface CoinPaySig_interface {
  coin_sig: string;
  coin_pub: string;
  ub_sig: string;
  denom_pub: string;
  f: AmountJson;
}


interface Transaction {
  contractHash: string;
  contract: any;
  payReq: any;
}


interface Reserve {
  mint_base_url: string
  reserve_priv: string;
  reserve_pub: string;
}


interface PaymentResponse {
  payReq: any;
  contract: Contract;
}


export interface Badge {
  setText(s: string): void;
  setColor(c: string): void;
}


type PayCoinInfo = Array<{ updatedCoin: Coin, sig: CoinPaySig_interface }>;


/**
 * See http://api.taler.net/wallet.html#general
 */
function canonicalizeBaseUrl(url) {
  let x = new URI(url);
  if (!x.protocol()) {
    x.protocol("https");
  }
  x.path(x.path() + "/").normalizePath();
  x.fragment();
  x.query();
  return x.href()
}

function parsePrettyAmount(pretty: string): AmountJson {
  const res = /([0-9]+)(.[0-9]+)?\s*(\w+)/.exec(pretty);
  if (!res) {
    return null;
  }
  return {
    value: parseInt(res[1], 10),
    fraction: res[2] ? (parseFloat(`0.${res[2]}`) * 1e-6) : 0,
    currency: res[3]
  }
}


interface HttpRequestLibrary {
  req(method: string,
      url: string|uri.URI,
      options?: any): Promise<HttpResponse>;

  get(url: string|uri.URI): Promise<HttpResponse>;

  postJson(url: string|uri.URI, body): Promise<HttpResponse>;

  postForm(url: string|uri.URI, form): Promise<HttpResponse>;
}


function copy(o) {
  return JSON.parse(JSON.stringify(o));
}


function rankDenom(denom1: any, denom2: any) {
  // Slow ... we should find a better way than to convert it evert time.
  let v1 = new Amount(denom1.value);
  let v2 = new Amount(denom2.value);
  return (-1) * v1.cmp(v2);
}


export class Wallet {
  private db: IDBDatabase;
  private http: HttpRequestLibrary;
  private badge: Badge;

  constructor(db: IDBDatabase, http: HttpRequestLibrary, badge: Badge) {
    this.db = db;
    this.http = http;
    this.badge = badge;
  }

  static signDeposit(offer: Offer,
                     cds: CoinWithDenom[]): PayCoinInfo {
    let ret = [];
    let amountSpent = Amount.getZero(cds[0].coin.currentAmount.currency);
    let amountRemaining = new Amount(offer.contract.amount);
    cds = copy(cds);
    for (let cd of cds) {
      let coinSpend;

      if (amountRemaining.value == 0 && amountRemaining.fraction == 0) {
        break;
      }

      if (amountRemaining.cmp(new Amount(cd.coin.currentAmount)) < 0) {
        coinSpend = new Amount(amountRemaining.toJson());
      } else {
        coinSpend = new Amount(cd.coin.currentAmount);
      }

      amountSpent.add(coinSpend);
      amountRemaining.sub(coinSpend);

      let newAmount = new Amount(cd.coin.currentAmount);
      newAmount.sub(coinSpend);
      cd.coin.currentAmount = newAmount.toJson();

      let args: DepositRequestPS_Args = {
        h_contract: HashCode.fromCrock(offer.H_contract),
        h_wire: HashCode.fromCrock(offer.contract.H_wire),
        amount_with_fee: coinSpend.toNbo(),
        coin_pub: EddsaPublicKey.fromCrock(cd.coin.coinPub),
        deposit_fee: new Amount(cd.denom.fee_deposit).toNbo(),
        merchant: EddsaPublicKey.fromCrock(offer.contract.merchant_pub),
        refund_deadline: AbsoluteTimeNbo.fromTalerString(offer.contract.refund_deadline),
        timestamp: AbsoluteTimeNbo.fromTalerString(offer.contract.timestamp),
        transaction_id: UInt64.fromNumber(offer.contract.transaction_id),
      };

      let d = new DepositRequestPS(args);

      let coinSig = eddsaSign(d.toPurpose(),
                              EddsaPrivateKey.fromCrock(cd.coin.coinPriv))
        .toCrock();

      let s: CoinPaySig_interface = {
        coin_sig: coinSig,
        coin_pub: cd.coin.coinPub,
        ub_sig: cd.coin.denomSig,
        denom_pub: cd.coin.denomPub,
        f: coinSpend.toJson(),
      };
      ret.push({sig: s, updatedCoin: cd.coin});
    }
    return ret;
  }


  /**
   * Get mints and associated coins that are still spendable,
   * but only if the sum the coins' remaining value exceeds the payment amount.
   * @param paymentAmount
   * @param depositFeeLimit
   * @param allowedMints
   */
  getPossibleMintCoins(paymentAmount: AmountJson,
                       depositFeeLimit: AmountJson,
                       allowedMints: MintInfo[]): Promise<MintCoins> {


    let m: MintCoins = {};

    function storeMintCoin(mc) {
      let mint = mc[0];
      let coin = mc[1];
      let cd = {
        coin: coin,
        denom: mint.keys.denoms.find((e) => e.denom_pub === coin.denomPub)
      };
      if (!cd.denom) {
        throw Error("denom not found (database inconsistent)");
      }
      let x = m[mint.baseUrl];
      if (!x) {
        m[mint.baseUrl] = [cd];
      } else {
        x.push(cd);
      }
    }

    let ps = allowedMints.map((info) => {
      return Query(this.db)
        .iter("mints", {indexName: "pubKey", only: info.master_pub})
        .indexJoin("coins", "mintBaseUrl", (mint) => mint.baseUrl)
        .reduce(storeMintCoin);
    });

    return Promise.all(ps).then(() => {
      let ret: MintCoins = {};

      nextMint:
        for (let key in m) {
          let coins = m[key].map((x) => ({
            a: new Amount(x.denom.fee_deposit),
            c: x
          }));
          // Sort by ascending deposit fee
          coins.sort((o1, o2) => o1.a.cmp(o2.a));
          let maxFee = new Amount(depositFeeLimit);
          let minAmount = new Amount(paymentAmount);
          let accFee = new Amount(coins[0].c.denom.fee_deposit);
          let accAmount = Amount.getZero(coins[0].c.coin.currentAmount.currency);
          let usableCoins: CoinWithDenom[] = [];
          nextCoin:
            for (let i = 0; i < coins.length; i++) {
              let coinAmount = new Amount(coins[i].c.coin.currentAmount);
              let coinFee = coins[i].a;
              if (coinAmount.cmp(coinFee) <= 0) {
                continue nextCoin;
              }
              accFee.add(coinFee);
              accAmount.add(coinAmount);
              if (accFee.cmp(maxFee) >= 0) {
                console.log("too much fees");
                continue nextMint;
              }
              usableCoins.push(coins[i].c);
              if (accAmount.cmp(minAmount) >= 0) {
                ret[key] = usableCoins;
                continue nextMint;
              }
            }
        }
      return ret;
    });
  }


  executePay(offer: Offer,
             payCoinInfo: PayCoinInfo,
             chosenMint: string): Promise<any> {
    let payReq = {};
    payReq["amount"] = offer.contract.amount;
    payReq["coins"] = payCoinInfo.map((x) => x.sig);
    payReq["H_contract"] = offer.H_contract;
    payReq["max_fee"] = offer.contract.max_fee;
    payReq["merchant_sig"] = offer.merchant_sig;
    payReq["mint"] = URI(chosenMint).href();
    payReq["refund_deadline"] = offer.contract.refund_deadline;
    payReq["timestamp"] = offer.contract.timestamp;
    payReq["transaction_id"] = offer.contract.transaction_id;
    let t: Transaction = {
      contractHash: offer.H_contract,
      contract: offer.contract,
      payReq: payReq,
    };

    let historyEntry = {
      type: "pay",
      timestamp: (new Date).getTime(),
      detail: {
        merchantName: offer.contract.merchant.name,
        amount: offer.contract.amount,
        contractHash: offer.H_contract,
        fulfillmentUrl: offer.contract.fulfillment_url
      }
    };

    return Query(this.db)
      .put("transactions", t)
      .put("history", historyEntry)
      .putAll("coins", payCoinInfo.map((pci) => pci.updatedCoin))
      .finish()
      .then(() => {
        return {
          success: true
        };
      });
  }

  confirmPay(offer: Offer): Promise<any> {
    return Promise.resolve().then(() => {
      return this.getPossibleMintCoins(offer.contract.amount,
                                       offer.contract.max_fee,
                                       offer.contract.mints)
    }).then((mcs) => {
      if (Object.keys(mcs).length == 0) {
        return {
          success: false,
          message: "Not enough coins",
        };
      }
      let mintUrl = Object.keys(mcs)[0];
      let ds = Wallet.signDeposit(offer, mcs[mintUrl]);
      return this
        .executePay(offer, ds, mintUrl);
    });
  }

  doPayment(H_contract): Promise<any> {
    return Promise.resolve().then(() => {
      return Query(this.db)
        .get("transactions", H_contract)
        .then((t) => {
          if (!t) {
            return {
              success: false,
              contractFound: false,
            }
          }
          let resp = {
            success: true,
            payReq: t.payReq,
            contract: t.contract,
          };
          return resp;
        });
    });
  }

  initReserve(reserveRecord) {
    this.updateMintFromUrl(reserveRecord.mint_base_url)
        .then((mint) =>
                this.updateReserve(reserveRecord.reserve_pub, mint)
                    .then((reserve) => this.depleteReserve(reserve,
                                                           mint)))
        .then(() => {
          let depleted = {
            type: "depleted-reserve",
            timestamp: (new Date).getTime(),
            detail: {
              reservePub: reserveRecord.reserve_pub,
            }
          };
          return Query(this.db).put("history", depleted).finish();
        })
        .catch((e) => {
          console.error("Failed to deplete reserve", e.stack);
        });
  }


  confirmReserve(req: ConfirmReserveRequest): Promise<ConfirmReserveResponse> {
    let reservePriv = EddsaPrivateKey.create();
    let reservePub = reservePriv.getPublicKey();
    let form = new FormData();
    let now: number = (new Date).getTime();
    form.append(req.field_amount, req.amount_str);
    form.append(req.field_reserve_pub, reservePub.toCrock());
    form.append(req.field_mint, req.mint);
    // TODO: set bank-specified fields.
    let mintBaseUrl = canonicalizeBaseUrl(req.mint);
    let requestedAmount = parsePrettyAmount(req.amount_str);

    if (!requestedAmount) {
      throw Error(`unrecognized amount ${req.amount_str}.`);
    }

    return this.http.postForm(req.post_url, form)
               .then((hresp) => {
                 // TODO: look at response status code and handle errors appropriately
                 let json = JSON.parse(hresp.responseText);
                 if (!json) {
                   return {
                     success: false
                   };
                 }
                 let resp: ConfirmReserveResponse = {
                   success: undefined,
                   backlink: json.redirect_url,
                 };
                 let reserveRecord = {
                   reserve_pub: reservePub.toCrock(),
                   reserve_priv: reservePriv.toCrock(),
                   mint_base_url: mintBaseUrl,
                   created: now,
                   last_query: null,
                   current_amount: null,
                   // XXX: set to actual amount
                   requested_amount: null
                 };

                 if (hresp.status != 200) {
                   resp.success = false;
                   return resp;
                 }

                 let historyEntry = {
                   type: "create-reserve",
                   timestamp: now,
                   detail: {
                     requestedAmount,
                     reservePub: reserveRecord.reserve_pub,
                   }
                 };

                 resp.success = true;

                 return Query(this.db)
                   .put("reserves", reserveRecord)
                   .put("history", historyEntry)
                   .finish()
                   .then(() => {
                     // Do this in the background
                     this.initReserve(reserveRecord);
                     return resp;
                   });
               });
  }


  withdrawPrepare(denom: Denomination,
                  reserve: Reserve): Promise<PreCoin> {
    let reservePriv = new EddsaPrivateKey();
    reservePriv.loadCrock(reserve.reserve_priv);
    let reservePub = new EddsaPublicKey();
    reservePub.loadCrock(reserve.reserve_pub);
    let denomPub = RsaPublicKey.fromCrock(denom.denom_pub);
    let coinPriv = EddsaPrivateKey.create();
    let coinPub = coinPriv.getPublicKey();
    let blindingFactor = RsaBlindingKey.create(1024);
    let pubHash: HashCode = coinPub.hash();
    let ev: ByteArray = rsaBlind(pubHash, blindingFactor, denomPub);

    if (!denom.fee_withdraw) {
      throw Error("Field fee_withdraw missing");
    }

    let amountWithFee = new Amount(denom.value);
    amountWithFee.add(new Amount(denom.fee_withdraw));
    let withdrawFee = new Amount(denom.fee_withdraw);

    // Signature
    let withdrawRequest = new WithdrawRequestPS({
      reserve_pub: reservePub,
      amount_with_fee: amountWithFee.toNbo(),
      withdraw_fee: withdrawFee.toNbo(),
      h_denomination_pub: denomPub.encode().hash(),
      h_coin_envelope: ev.hash()
    });

    var sig = eddsaSign(withdrawRequest.toPurpose(), reservePriv);

    let preCoin: PreCoin = {
      reservePub: reservePub.toCrock(),
      blindingKey: blindingFactor.toCrock(),
      coinPub: coinPub.toCrock(),
      coinPriv: coinPriv.toCrock(),
      denomPub: denomPub.encode().toCrock(),
      mintBaseUrl: reserve.mint_base_url,
      withdrawSig: sig.toCrock(),
      coinEv: ev.toCrock(),
      coinValue: denom.value
    };

    return Query(this.db).put("precoins", preCoin).finish().then(() => preCoin);
  }


  withdrawExecute(pc: PreCoin): Promise<Coin> {
    return Query(this.db)
      .get("reserves", pc.reservePub)
      .then((r) => {
        let wd: any = {};
        wd.denom_pub = pc.denomPub;
        wd.reserve_pub = pc.reservePub;
        wd.reserve_sig = pc.withdrawSig;
        wd.coin_ev = pc.coinEv;
        let reqUrl = URI("reserve/withdraw").absoluteTo(r.mint_base_url);
        return this.http.postJson(reqUrl, wd);
      })
      .then(resp => {
        if (resp.status != 200) {
          throw new RequestException({
            hint: "Withdrawal failed",
            status: resp.status
          });
        }
        let r = JSON.parse(resp.responseText);
        let denomSig = rsaUnblind(RsaSignature.fromCrock(r.ev_sig),
                                  RsaBlindingKey.fromCrock(pc.blindingKey),
                                  RsaPublicKey.fromCrock(pc.denomPub));
        let coin: Coin = {
          coinPub: pc.coinPub,
          coinPriv: pc.coinPriv,
          denomPub: pc.denomPub,
          denomSig: denomSig.encode().toCrock(),
          currentAmount: pc.coinValue,
          mintBaseUrl: pc.mintBaseUrl,
        };
        return coin;
      });
  }


  updateBadge() {
    function countNonEmpty(c, n) {
      if (c.currentAmount.fraction != 0 || c.currentAmount.value != 0) {
        return n + 1;
      }
      return n;
    }

    function doBadge(n) {
      this.badge.setText(n.toString());
      this.badge.setColor("#0F0");
    }

    Query(this.db)
      .iter("coins")
      .reduce(countNonEmpty, 0)
      .then(doBadge.bind(this));
  }


  storeCoin(coin: Coin): Promise<void> {
    let historyEntry = {
      type: "withdraw",
      timestamp: (new Date).getTime(),
      detail: {
        coinPub: coin.coinPub,
      }
    };
    return Query(this.db)
      .delete("precoins", coin.coinPub)
      .add("coins", coin)
      .add("history", historyEntry)
      .finish()
      .then(() => {
        this.updateBadge();
      });
  }


  withdraw(denom, reserve): Promise<void> {
    return this.withdrawPrepare(denom, reserve)
               .then((pc) => this.withdrawExecute(pc))
               .then((c) => this.storeCoin(c));
  }


  /**
   * Withdraw coins from a reserve until it is empty.
   */
  depleteReserve(reserve, mint): Promise<void> {
    let denoms = copy(mint.keys.denoms);
    let remaining = new Amount(reserve.current_amount);
    denoms.sort(rankDenom);
    let workList = [];
    for (let i = 0; i < 1000; i++) {
      let found = false;
      for (let d of denoms) {
        let cost = new Amount(d.value);
        cost.add(new Amount(d.fee_withdraw));
        if (remaining.cmp(cost) < 0) {
          continue;
        }
        found = true;
        remaining.sub(cost);
        workList.push(d);
      }
      if (!found) {
        console.log("did not find coins for remaining ", remaining.toJson());
        break;
      }
    }

    return new Promise<void>((resolve, reject) => {
      // Do the request one by one.
      let next = () => {
        if (workList.length == 0) {
          resolve();
          return;
        }
        let d = workList.pop();
        console.log("withdrawing", JSON.stringify(d));
        this.withdraw(d, reserve)
            .then(() => next())
            .catch((e) => {
              console.log("Failed to withdraw coin", e.stack);
              reject();
            });
      };

      // Asynchronous recursion
      next();
    });
  }


  updateReserve(reservePub: string,
                mint): Promise<Reserve> {
    return Query(this.db)
      .get("reserves", reservePub)
      .then((reserve) => {
        let reqUrl = URI("reserve/status").absoluteTo(mint.baseUrl);
        reqUrl.query({'reserve_pub': reservePub});
        return this.http.get(reqUrl).then(resp => {
          if (resp.status != 200) {
            throw Error();
          }
          let reserveInfo = JSON.parse(resp.responseText);
          if (!reserveInfo) {
            throw Error();
          }
          let oldAmount = reserve.current_amount;
          let newAmount = reserveInfo.balance;
          reserve.current_amount = reserveInfo.balance;
          let historyEntry = {
            type: "reserve-update",
            timestamp: (new Date).getTime(),
            detail: {
              reservePub,
              oldAmount,
              newAmount
            }
          };
          return Query(this.db)
            .put("reserves", reserve)
            .finish()
            .then(() => reserve);
        });
      });
  }


  /**
   * Update or add mint DB entry by fetching the /keys information.
   * Optionally link the reserve entry to the new or existing
   * mint entry in then DB.
   */
  updateMintFromUrl(baseUrl) {
    let reqUrl = URI("keys").absoluteTo(baseUrl);
    return this.http.get(reqUrl).then((resp) => {
      if (resp.status != 200) {
        throw Error("/keys request failed");
      }
      let mintKeysJson = JSON.parse(resp.responseText);
      if (!mintKeysJson) {
        throw new RequestException({url: reqUrl, hint: "keys invalid"});
      }
      let mint: Mint = {
        baseUrl: baseUrl,
        keys: mintKeysJson
      };
      return Query(this.db).put("mints", mint).finish().then(() => mint);
    });
  }


  getBalances(): Promise<any> {
    function collectBalances(c: Coin, byCurrency) {
      let acc: AmountJson = byCurrency[c.currentAmount.currency];
      if (!acc) {
        acc = Amount.getZero(c.currentAmount.currency).toJson();
      }
      let am = new Amount(c.currentAmount);
      am.add(new Amount(acc));
      byCurrency[c.currentAmount.currency] = am.toJson();
      return byCurrency;
    }

    return Query(this.db)
      .iter("coins")
      .reduce(collectBalances, {});
  }


  getHistory() {
    function collect(x, acc) {
      acc.push(x);
      return acc;
    }

    return Query(this.db)
      .iter("history", {indexName: "timestamp"})
      .reduce(collect, [])
  }
}