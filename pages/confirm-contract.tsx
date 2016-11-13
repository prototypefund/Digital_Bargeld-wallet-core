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
 TALER; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */

/**
 * Page shown to the user to confirm entering
 * a contract.
 *
 * @author Florian Dold
 */


import {substituteFulfillmentUrl} from "../lib/wallet/helpers";
import {Contract, AmountJson, IExchangeInfo} from "../lib/wallet/types";
import {renderContract, prettyAmount} from "../lib/wallet/renderHtml";
"use strict";
import {getExchanges} from "../lib/wallet/wxApi";


interface DetailState {
  collapsed: boolean;
  exchanges: null|IExchangeInfo[];
}

interface DetailProps {
  contract: Contract
  collapsed: boolean
}


class Details extends React.Component<DetailProps, DetailState> {
  constructor(props: DetailProps) {
    super(props);
    this.setState({
      collapsed: props.collapsed,
      exchanges: null
    });

    console.log("initial state:", this.state);

    this.update();
  }

  componentWillReceiveProps(props: DetailProps) {
    this.setState({collapsed: props.collapsed} as any);
  }

  async update() {
    let exchanges = await getExchanges();
    this.setState({exchanges} as any);
  }

  render() {
    console.log("details collapsed (state)", this.state.collapsed);
    console.log("details collapsed (prop)", this.props.collapsed);
    if (this.state.collapsed) {
      return (
        <div>
          <button className="linky"
                  onClick={() => { this.setState({collapsed: false} as any)}}>
            show more details
          </button>
        </div>
      );
    } else {
      return (
        <div>
          <button className="linky"
                  onClick={() => this.setState({collapsed: true} as any)}>
            show less details
          </button>
          <div>
            Accepted exchanges:
            <ul>
              {this.props.contract.exchanges.map(
                e => <li>{`${e.url}: ${e.master_pub}`}</li>)}
            </ul>
            Exchanges in the wallet:
            <ul>
              {(this.state.exchanges || []).map(
                (e: IExchangeInfo) =>
                  <li>{`${e.baseUrl}: ${e.masterPublicKey}`}</li>)}
            </ul>
          </div>
        </div>);
    }
  }
}

interface ContractPromptProps {
  offer: any;
}

interface ContractPromptState {
  error: string|null;
  payDisabled: boolean;
}

class ContractPrompt extends React.Component<ContractPromptProps, ContractPromptState> {
  constructor() {
    super();
    this.state = {
      error: null,
      payDisabled: true,
    }
  }

  componentWillMount() {
    this.checkPayment();
  }

  componentWillUnmount() {
    // FIXME: abort running ops
  }

  checkPayment() {
    let msg = {
      type: 'check-pay',
      detail: {
        offer: this.props.offer
      }
    };
    chrome.runtime.sendMessage(msg, (resp) => {
      if (resp.error) {
        console.log("check-pay error", JSON.stringify(resp));
        switch (resp.error) {
          case "coins-insufficient":
            this.state.error = i18n`You have insufficient funds of the requested currency in your wallet.`;
            break;
          default:
            this.state.error = `Error: ${resp.error}`;
            break;
        }
        this.state.payDisabled = true;
      } else {
        this.state.payDisabled = false;
        this.state.error = null;
      }
      this.setState({} as any);
      window.setTimeout(() => this.checkPayment(), 300);
    });
  }

  doPayment() {
    let d = {offer: this.props.offer};
    chrome.runtime.sendMessage({type: 'confirm-pay', detail: d}, (resp) => {
      if (resp.error) {
        console.log("confirm-pay error", JSON.stringify(resp));
        switch (resp.error) {
          case "coins-insufficient":
            this.state.error = "You do not have enough coins of the" +
              " requested currency.";
            break;
          default:
            this.state.error = `Error: ${resp.error}`;
            break;
        }
        this.setState({} as any);
        return;
      }
      let c = d.offer.contract;
      console.log("contract", c);
      document.location.href = substituteFulfillmentUrl(c.fulfillment_url,
                                                        this.props.offer);
    });
  }


  render() {
    let c = this.props.offer.contract;
    return (
      <div>
        {renderContract(c)}
        <button onClick={() => this.doPayment()}
                disabled={this.state.payDisabled}
                className="accept">
          Confirm payment
        </button>
        {(this.state.error ? <p className="errorbox">{this.state.error}</p> : <p />)}
        <Details contract={c} collapsed={!this.state.error}/>
      </div>
    );
  }
}


export function main() {
  let url = URI(document.location.href);
  let query: any = URI.parseQuery(url.query());
  let offer = JSON.parse(query.offer);
  console.dir(offer);
  let contract = offer.contract;

  ReactDOM.render(<ContractPrompt offer={offer}/>, document.getElementById(
    "contract")!);
}
