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
 * User UserConfiguration
 *
 * @author Siyu Lei
 */

import * as React from "react";

import { Modal } from "./modal";

import "../style/animation.css";

import * as Amounts from "../../amounts";
import * as wxApi from "../wxApi";

import {Bar, BarChart, Legend, Tooltip, XAxis, YAxis} from "recharts";
import {AmountJson} from "../../amounts";
import {HistoryRecord} from "../../walletTypes";

interface RenderHistoryPros {
  curAmount: AmountJson;
  historyAmount: AmountJson;
  period: string;
}

const RenderHistoryRecord = (props: RenderHistoryPros) => {
  let period = "Last one day";
  switch (props.period) {
    case "one day": {
      period = "Last one day";
      break;
    }
    case "one week": {
      period = "Last one week";
      break;
    }
    case "one month": {
      period = "Last one month";
      break;
    }
    case "half year": {
      period = "Last half year";
      break;
    }
    case "one year": {
      period = "Last one year";
      break;
    }
  }

  const data = [
    {
      // curFullContent: Amounts.toFloat(props.curAmount) + " " + props.curAmount.currency,
      // historyFullContent: Amounts.toFloat(props.historyAmount) + " " + props.historyAmount.currency,
      name: "Payment Record",
      [period]: Amounts.toFloat(props.historyAmount),
      ["This time"]: Amounts.toFloat(props.curAmount),
    },
  ];

  return (
    <BarChart width={500}
              height={200}
              data={data}
              layout="vertical"
              margin={{top: 20, right: 30, left: 20, bottom: 5}}>
      <XAxis type="number" unit={props.curAmount.currency} />
      <YAxis type="category" dataKey="name"/>
      <Tooltip formatter={value => value + " " + props.curAmount.currency}/>
      <Legend />
      <Bar dataKey={period} stackId="a" fill="#8884d8" />
      <Bar dataKey="This time" stackId="a" fill="#82ca9d" />
      {/*<Bar dataKey={period} stackId="a" fill="#8884d8">*/}
        {/*<LabelList dataKey="historyFullContent" />*/}
      {/*</Bar>*/}
      {/*<Bar dataKey="This time" stackId="a" fill="#82ca9d">*/}
        {/*<LabelList dataKey="curFullContent" />*/}
      {/*</Bar>*/}
    </BarChart>
  );
};

interface TrackMoneyPros {
  amount: AmountJson;
  buttonHandler: (event: React.MouseEvent<HTMLInputElement>) => void;
}

interface TrackMoneyState {
  displayMode: string;
  displayPeriod: string;
  loaded: boolean;
  periodRecords: HistoryRecord[][];
}

export class TrackMoney extends React.Component<TrackMoneyPros, TrackMoneyState> {
  periods: string[];
  modes: string[];

  constructor(props: TrackMoneyPros) {
    super(props);
    this.periods = ["one day", "one week", "one month", "half year", "one year"];
    this.modes = ["history record", "category", "budget"];
    this.state = {
      // Need to fix
      displayMode: this.modes[0],
      displayPeriod: this.periods[0],
      loaded: false,
      periodRecords: [],
    };
  }

  componentWillMount() {
    this.update();
  }

  async update() {
    const tempPeriodRecords = [];
    for (const period of this.periods) {
      const record = await wxApi.getPaymentStatistic(period.replace(" ", "-"));
      tempPeriodRecords.push(record.history);
    }
    this.setState({ periodRecords: tempPeriodRecords, loaded: true });
  }

  periodsHandler = (event: React.FormEvent<HTMLSelectElement>) => {
    this.setState({ displayPeriod: event.currentTarget.value });
  }

  modesHandler = (event: React.FormEvent<HTMLSelectElement>) => {
    this.setState({ displayMode: event.currentTarget.value });
  }

  render() {
    const headerOptions = (
      <div style={{
        fontSize: "large",
      }}>
        <strong>Your </strong><RenderSelection options={this.modes} selectHandler={this.modesHandler}/>
        <strong> of last </strong>
        <RenderSelection options={this.periods} selectHandler={this.periodsHandler}/>
      </div>
    );

    let displayContent = null;
    if (this.state.loaded) {
      const displayData = this.state.periodRecords[this.periods.indexOf(this.state.displayPeriod)];
      if (this.state.displayMode === "category") {
        console.log("test ===", "ccc");
      } else if (this.state.displayMode === "budget") {
        console.log("test ===", "bbb");
      } else {
        let historyAmount = Amounts.getZero(this.props.amount.currency);
        for (const p of displayData) {
          if (p.type === "pay") {
            if (p.detail.totalCost !== undefined) {
              if (this.props.amount.currency === Amounts.parseOrThrow(p.detail.totalCost).currency) {
                historyAmount = Amounts.add(historyAmount, Amounts.parseOrThrow(p.detail.totalCost)).amount;
              }
            } else {
              if (this.props.amount.currency === Amounts.parseOrThrow(p.detail.amount).currency) {
                historyAmount = Amounts.add(historyAmount, Amounts.parseOrThrow(p.detail.amount)).amount;
              }
            }
          }
          if (p.type === "refund") {
            if (this.props.amount.currency === p.detail.refundAmount.currency) {
              historyAmount = Amounts.sub(historyAmount, p.detail.refundAmount).amount;
            }
          }
        }
        displayContent = (
          <RenderHistoryRecord
            curAmount={this.props.amount}
            historyAmount={historyAmount}
            period={this.state.displayPeriod}/>
        );
      }
    }
    if (this.state.loaded) {
      return (
        <Modal>
          {headerOptions}
          {displayContent}
          <div style={{
            marginTop: "1em",
            textAlign: "center",
          }}>
            <button className="pure-button button-success"
                    value="pay"
                    onClick={this.props.buttonHandler}>
              Pay</button>
            &nbsp;
            <button className="pure-button button-secondary"
                    value="cancel"
                    onClick={this.props.buttonHandler}>
              Cancel</button>
          </div>
        </Modal>
      );
    } else {
      return (
        <p>Fetching data...</p>
      );
    }
  }
}

interface RenderCategoryProps {
  selectHandler: (event: React.FormEvent<HTMLSelectElement>) => void;
}

export const RenderCategory = (props: RenderCategoryProps) => {
  return (
    <div>
      <p style={{display: "inline-block"}}>Choose a category:</p>
      &nbsp;
      <select onChange={props.selectHandler}>
        <option value="Uncategorized">Uncategorized</option>
        <option value="Education">Education</option>
        <option value="Shopping">Shopping</option>
        <option value="Entertainment">Entertainment</option>
        <option value="Restaurant">Restaurant</option>
        <option value="Groceries">Groceries</option>
      </select>
    </div>
  );
};

interface RenderSelectionPros {
  selectHandler: (event: React.FormEvent<HTMLSelectElement>) => void;
  options: string[];
}

export const RenderSelection = (props: RenderSelectionPros) => {
  const optionLists = props.options.map( (value, index) => (
    <option key={index} value={value}>{value}</option>
  ));

  return (
    <select onChange={props.selectHandler}>
      {optionLists}
    </select>
  );
};
