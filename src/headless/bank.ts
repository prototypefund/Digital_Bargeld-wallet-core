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
 * Helper functions to deal with the GNU Taler demo bank.
 *
 * Mostly useful for automated tests.
 */

/**
 * Imports.
 */
import Axios from "axios";
import querystring = require("querystring");
import URI = require("urijs");

export interface BankUser {
  username: string;
  password: string;
}

function makeId(length: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export class Bank {
  constructor(private bankBaseUrl: string) {}

  async createReserve(
    bankUser: BankUser,
    amount: string,
    reservePub: string,
    exchangePaytoUri: string,
  ) {
    const reqUrl = new URI("taler/withdraw")
      .absoluteTo(this.bankBaseUrl)
      .href();

    const body = {
      auth: { type: "basic" },
      username: bankUser,
      amount,
      reserve_pub: reservePub,
      exchange_wire_detail: exchangePaytoUri,
    };

    const resp = await Axios({
      method: "post",
      url: reqUrl,
      data: body,
      responseType: "json",
      headers: {
        "X-Taler-Bank-Username": bankUser.username,
        "X-Taler-Bank-Password": bankUser.password,
      },
    });

    if (resp.status != 200) {
      throw Error("failed to create bank reserve");
    }
  }

  async registerRandomUser(): Promise<BankUser> {
    const reqUrl = new URI("register").absoluteTo(this.bankBaseUrl).href();
    const randId = makeId(8);
    const bankUser: BankUser = {
      username: `testuser-${randId}`,
      password: `testpw-${randId}`,
    };

    const resp = await Axios({
      method: "post",
      url: reqUrl,
      data: querystring.stringify(bankUser),
      responseType: "json",
    });

    if (resp.status != 200) {
      throw Error("could not register bank user");
    }
    return bankUser;
  }
}