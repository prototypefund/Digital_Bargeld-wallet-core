/*
 This file is part of TALER
 (C) 2017 Inria

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
 * View and edit auditors.
 *
 * @author Florian Dold
 */


import { ExchangeRecord, DenominationRecord } from "src/types";
import { AuditorRecord, CurrencyRecord, ReserveRecord, CoinRecord, PreCoinRecord, Denomination } from "src/types";
import { ImplicitStateComponent, StateHolder } from "src/components";
import {
  getCurrencies,
  updateCurrency,
} from "src/wxApi";
import { prettyAmount } from "src/renderHtml";
import { getTalerStampDate } from "src/helpers";

interface CurrencyListState {
  currencies?: CurrencyRecord[];
}

class CurrencyList extends React.Component<any, CurrencyListState> {
  constructor() {
    super();
    let port = chrome.runtime.connect();
    port.onMessage.addListener((msg: any) => {
      if (msg.notify) {
        console.log("got notified");
        this.update();
      }
    });
    this.update();
    this.state = {} as any;
  }

  async update() {
    let currencies = await getCurrencies();
    console.log("currencies: ", currencies);
    this.setState({ currencies });
  }

  async confirmRemove(c: CurrencyRecord, a: AuditorRecord) {
    if (window.confirm(`Do you really want to remove auditor ${a.baseUrl} for currency ${c.name}?`)) {
      c.auditors = c.auditors.filter((x) => x.auditorPub != a.auditorPub);
      await updateCurrency(c);
    }
  }

  render(): JSX.Element {
    let currencies = this.state.currencies;
    if (!currencies) {
      return <span>...</span>;
    }
    return (
      <div>
      {currencies.map(c => (
        <div>
          <h1>Currency {c.name}</h1>
          <p>Displayed with {c.fractionalDigits} fractional digits.</p>
          <p>Auditors:</p>
          <ul>
          {c.auditors.map(a => (
            <li>{a.baseUrl} (<button className="button-linky" onClick={() => this.confirmRemove(c, a)}>Remove</button>)
              <ul>
                <li>valid until {new Date(a.expirationStamp).toString()}</li>
                <li>public key {a.auditorPub}</li>
              </ul>
            </li>
          ))}
          </ul>
        </div>
      ))}
      </div>
    );
  }
}

export function main() {
  ReactDOM.render(<CurrencyList />, document.getElementById("container")!);
}