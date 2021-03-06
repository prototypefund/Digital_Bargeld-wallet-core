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

export interface BankUser {
  username: string;
  password: string;
}

/**
 * Generate a random alphanumeric ID.  Does *not* use cryptographically
 * secure randomness.
 */
function makeId(length: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Helper function to generate the "Authorization" HTTP header.
 */
function makeAuth(username: string, password: string): string {
  const auth = `${username}:${password}`;
  const authEncoded: string = Buffer.from(auth).toString("base64");
  return `Basic ${authEncoded}`;
}

/**
 * Client for the Taler bank access API.
 */
export class Bank {
  constructor(private bankBaseUrl: string) {}

  async generateWithdrawUri(
    bankUser: BankUser,
    amount: string,
  ): Promise<string> {
    const body = {
      amount,
    };

    const reqUrl = new URL("api/withdraw-headless-uri", this.bankBaseUrl).href;

    const resp = await Axios({
      method: "post",
      url: reqUrl,
      data: body,
      responseType: "json",
      headers: {
        Authorization: makeAuth(bankUser.username, bankUser.password),
      },
    });

    if (resp.status != 200) {
      throw Error("failed to create bank reserve");
    }

    const withdrawUri = resp.data["taler_withdraw_uri"];
    if (!withdrawUri) {
      throw Error("Bank's response did not include withdraw URI");
    }
    return withdrawUri;
  }

  async createReserve(
    bankUser: BankUser,
    amount: string,
    reservePub: string,
    exchangePaytoUri: string,
  ): Promise<void> {
    const reqUrl = new URL("testing/withdraw", this.bankBaseUrl).href;

    const body = {
      username: bankUser,
      amount,
      reserve_pub: reservePub,
      exchange_payto_uri: exchangePaytoUri,
    };

    const resp = await Axios({
      method: "post",
      url: reqUrl,
      data: body,
      responseType: "json",
      headers: {
        Authorization: makeAuth(bankUser.username, bankUser.password),
      },
    });

    if (resp.status != 200) {
      throw Error("failed to create bank reserve");
    }
  }

  async registerRandomUser(): Promise<BankUser> {
    const reqUrl = new URL("testing/register", this.bankBaseUrl).href;
    const randId = makeId(8);
    const bankUser: BankUser = {
      username: `testuser-${randId}`,
      password: `testpw-${randId}`,
    };

    const resp = await Axios({
      method: "post",
      url: reqUrl,
      data: bankUser,
      responseType: "json",
    });

    if (resp.status != 200) {
      throw Error("could not register bank user");
    }
    return bankUser;
  }
}
