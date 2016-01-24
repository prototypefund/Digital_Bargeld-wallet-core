/*
 This file is part of TALER
 (C) 2016 GNUnet e.V.

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, If not, see <http://www.gnu.org/licenses/>
 */


import {ConfirmReserveRequest} from "./types";
import {Wallet} from "./wallet";
import {exportDb} from "./db";
import {deleteDb} from "./db";
import {openTalerDb} from "./db";
import {BrowserHttpLib} from "./http";
import {Badge} from "./wallet";

/**
 * Messaging for the WebExtensions wallet.  Should contain
 * parts that are specific for WebExtensions, but as little business
 * logic as possible.
 * @module Messaging
 * @author Florian Dold
 */

"use strict";

function makeHandlers(wallet) {
  return {
    ["balances"]: function(db, detail, sendResponse) {
      wallet.getBalances()
            .then(sendResponse)
            .catch((e) => {
              console.log("exception during 'balances'");
              console.error(e.stack);
            });
      return true;
    },
    ["dump-db"]: function(db, detail, sendResponse) {
      exportDb(db).then(sendResponse);
      return true;
    },
    ["reset"]: function(db, detail, sendResponse) {
      let tx = db.transaction(db.objectStoreNames, 'readwrite');
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        tx.objectStore(db.objectStoreNames[i]).clear();
      }
      deleteDb();

      chrome.browserAction.setBadgeText({text: ""});
      console.log("reset done");
      // Response is synchronous
      return false;
    },
    ["confirm-reserve"]: function(db, detail, sendResponse) {
      // TODO: make it a checkable
      let req: ConfirmReserveRequest = {
        field_amount: detail.field_amount,
        field_mint: detail.field_mint,
        field_reserve_pub: detail.field_reserve_pub,
        post_url: detail.post_url,
        mint: detail.mint,
        amount_str: detail.amount_str
      };
      wallet.confirmReserve(req)
            .then((resp) => {
              sendResponse(resp);
            })
            .catch((e) => {
              sendResponse({success: false});
              console.error("exception during 'confirm-reserve'");
              console.error(e.stack);
            });
      return true;
    },
    ["confirm-pay"]: function(db, detail, sendResponse) {
      wallet.confirmPay(detail.offer, detail.merchantPageUrl)
            .then(() => {
              sendResponse({success: true})
            })
            .catch((e) => {
              console.error("exception during 'confirm-pay'");
              console.error(e.stack);
              sendResponse({error: e.message});
            });
      return true;
    },
    ["execute-payment"]: function(db, detail, sendResponse) {
      wallet.doPayment(detail.H_contract)
            .then((r) => {
              sendResponse({
                             success: true,
                             payUrl: r.payUrl,
                             payReq: r.payReq
                           });
            })
            .catch((e) => {
              console.error("exception during 'execute-payment'");
              console.error(e.stack);
              sendResponse({success: false, error: e.message});
            });
      // async sendResponse
      return true;
    },
    ["get-history"]: function(db, detail, sendResponse) {
      // TODO: limit history length
      wallet.getHistory()
        .then((h) => {
          sendResponse(h);
        })
        .catch((e) => {
          console.error("exception during 'get-history'");
          console.error(e.stack);
        });
      return true;
    }
  };
}

class ChromeBadge implements Badge {
  setText(s: string) {
    chrome.browserAction.setBadgeText({text: s});
  }

  setColor(c: string) {
    chrome.browserAction.setBadgeBackgroundColor({color: c});
  }
}


export function wxMain() {
  chrome.browserAction.setBadgeText({text: ""});

  openTalerDb()
    .then((db) => {
      let http = new BrowserHttpLib();
      let badge = new ChromeBadge();
      let wallet = new Wallet(db, http, badge);
      let handlers = makeHandlers(wallet);
      wallet.updateBadge();
      chrome.runtime.onMessage.addListener(
        function(req, sender, onresponse) {
          if (req.type in handlers) {
            return handlers[req.type](db, req.detail, onresponse);
          }
          console.error(`Request type ${JSON.stringify(req)} unknown, req ${req.type}`);
          return false;
        });
    })
    .catch((e) => {
      console.error("could not open database:");
      console.error(e.stack);
    });
}