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

import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { AmountJson } from "../../amounts";
import { HistoryRecord } from "../../walletTypes";

import { Line } from "rc-progress";

import "./payment-record.css";

interface TotalAmountRecord {
  curAmount: AmountJson;
  historyAmount: AmountJson;
  period: string;
}

interface RenderBudgetChartPros {
  amountsArray: TotalAmountRecord[];
  budgetArray: number[];
  displayMode: string[];
  setBudgetHandler: (event: React.FormEvent<HTMLFormElement>) => void;
  showSettingHandler: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const RenderBudgetChar = (props: RenderBudgetChartPros) => {
  const listItems = props.amountsArray.map( (value, index) => {
    const totalAmount = Amounts.add(value.historyAmount, value.curAmount).amount;
    const budget = props.budgetArray[index];
    let percentage = 100;
    let color = "#2c99f4";
    let diff: number = -1;
    if (budget !== undefined && budget !== 0) {
      percentage = (Amounts.toFloat(totalAmount) / budget) * 100;
      if (percentage > 100) {
        diff = Amounts.toFloat(Amounts.sub(totalAmount, Amounts.fromFloat(budget, totalAmount.currency)).amount);
        percentage = 100;
        color = "#ef3139";
      }
    }

    const normalDisplay = () => (
      <div>
        <p>
          {totalAmount.currency}: {Amounts.toFloat(totalAmount)} of {budget}
          {diff !== -1 ? <span> Over {diff}</span> : null }</p>
        <Line percent={percentage} strokeWidth="4" strokeColor={color} trailWidth="4"/>
        <a href="" id={index.toString()} onClick={props.showSettingHandler}>Edit Budget</a>
      </div>
    );

    const noBudgetDisplay = () => (
      <div>
        <p>{totalAmount.currency}: {Amounts.toFloat(totalAmount)}</p>
        <a href="" id={index.toString()} onClick={props.showSettingHandler}>Set Budget</a>
      </div>
    );

    const changeBudgetDisplay = () => (
      <div>
        <p>{totalAmount.currency}: {Amounts.toFloat(totalAmount)}</p>
        <form onSubmit={props.setBudgetHandler} id={index.toString()}>
          <input type="text" name="budget" size={3} />
          <input type="submit" value="Set" />
        </form>
      </div>
    );

    const renderContent = () => {
      if (budget !== undefined) {
        if (props.displayMode[index] === "display") {
          return (
            <div>
              {normalDisplay()}
            </div>
          );
        } else {
          return (
            <div>
              {changeBudgetDisplay()}
            </div>
          );
        }
      } else {
        if (props.displayMode[index] === "display") {
          return (
            <div>
              {noBudgetDisplay()}
            </div>
          );
        } else {
          return (
            <div>
              {changeBudgetDisplay()}
            </div>
          );
        }
      }
    };

    const item = (
      <div className="budget-card" key={index}>
        <p>{value.period}</p>
        <div className="budget-card-right-part">
          {renderContent()}
        </div>
      </div>
    );
    return item;
  });

  return (
    <div style={{
      marginTop: 20,
    }}>
      {listItems}
    </div>
  );
};

interface RenderHistoryChartPros {
  amountsArray: TotalAmountRecord[];
}

const RenderHistoryRecordChart = (props: RenderHistoryChartPros) => {
  const data = [];
  for (const TotalAmount of props.amountsArray) {
    const dataItem: {name: string; History: number; Current: number } = {
      Current: Amounts.toFloat(TotalAmount.curAmount),
      History: Amounts.toFloat(TotalAmount.historyAmount),
      name: TotalAmount.period,
    };
    data.push(dataItem);
  }
  const currency = props.amountsArray[0].curAmount.currency;

  return (
    <BarChart width={500}
              height={350}
              data={data}
              layout="vertical"
              margin={{top: 20, right: 30, left: 20, bottom: 5}}>
      <XAxis type="number" unit={currency} />
      <YAxis type="category" dataKey="name"/>
      <Tooltip formatter={value => value + " " + currency}/>
      <Legend />
      <Bar dataKey="History" stackId="a" fill="#8884d8" />
      <Bar dataKey="Current" stackId="a" fill="#82ca9d" />
    </BarChart>
  );
};

interface TrackMoneyPros {
  amount: AmountJson;
  buttonHandler: (event: React.MouseEvent<HTMLInputElement>) => void;
  category: string;
}

interface TrackMoneyState {
  budgetMode: string[];
  displayCategory: string;
  displayMode: string;
  // displayPeriod: string;
  loaded: boolean;
  periodRecords: HistoryRecord[][];
}

export class TrackMoney extends React.Component<TrackMoneyPros, TrackMoneyState> {
  periods: string[];
  modes: string[];
  categories: string[];
  budgetMode: string[];

  constructor(props: TrackMoneyPros) {
    super(props);
    this.periods = ["one day", "one week", "one month", "half year", "one year"];
    this.modes = ["history record", "budget"];
    this.budgetMode = ["display", "setting"];
    // set first element to be all category
    this.categories = ["All Categories", ...PaymentCategory];
    this.state = {
      budgetMode: [this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0]],
      displayCategory: this.categories[0],
      displayMode: this.modes[0],
      // displayPeriod: this.periods[0],
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
    console.log("test category", tempPeriodRecords);
    this.setState({ periodRecords: tempPeriodRecords, loaded: true });
  }

  // periodsHandler = (event: React.FormEvent<HTMLSelectElement>) => {
  //   this.setState({ displayPeriod: event.currentTarget.value });
  // }
  categoryHandler = (event: React.FormEvent<HTMLSelectElement>) => {
    this.setState({ displayCategory: event.currentTarget.value});
    this.setState({
      budgetMode: [this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0]],
    });
  }

  modesHandler = (event: React.FormEvent<HTMLSelectElement>) => {
    this.setState({ displayMode: event.currentTarget.value });
    this.setState({
      budgetMode: [this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0]],
    });
  }

  showSettingHandler = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const tempArr = this.state.budgetMode;
    tempArr[parseInt(event.currentTarget.id, 10)] = this.budgetMode[1];
    console.log("test", event.currentTarget.id);
    this.setState({ budgetMode: tempArr });
  }

  setBudgetHandler = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tempArr = this.state.budgetMode;
    tempArr[parseInt(event.currentTarget.id, 10)] = this.budgetMode[0];
    this.setState({ budgetMode: tempArr });
    console.log("test", event.currentTarget[0].value);
  }

  render() {
    const headerOptions = (
      <div style={{
        fontSize: "large",
      }}>
        <strong>Your </strong><RenderSelection options={this.modes} selectHandler={this.modesHandler}/>
        <strong> in </strong>
        <RenderSelection options={this.categories} selectHandler={this.categoryHandler}/>
      </div>
    );

    const getAmountSum = (periodRecord: HistoryRecord[]) => {
      let historyAmount = Amounts.getZero(this.props.amount.currency);
      for (const p of periodRecord) {
        if (!p.detail.category) {
          p.detail.category = "Uncategorized";
        }
        // set first element in categories to be all category.
        if (this.state.displayCategory !== this.categories[0]) {
          if (p.detail.category !== this.state.displayCategory) {
            continue;
          }
        }
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
      return historyAmount;
    };

    const getCurrentAmount = () => {
      if (this.state.displayCategory !== this.categories[0]) {
        if (this.props.category !== this.state.displayCategory) {
          return Amounts.getZero(this.props.amount.currency);
        }
      }
      return this.props.amount;
    };

    const getPeriod = (period: string) => {
      switch (period) {
        case "one day": {
          return "One Day";
        }
        case "one week": {
          return "One Week";
        }
        case "one month": {
          return "One Month";
        }
        case "half year": {
          return "Half Year";
        }
        case "one year": {
          return "One Year";
        }
        default: {
          return "One Day";
        }
      }
    };

    let displayContent = null;
    if (this.state.loaded) {
      const amountArray: TotalAmountRecord[] = [];
      this.state.periodRecords.forEach(
        (item, index) => {
          const history = getAmountSum(item);
          const current = getCurrentAmount();
          amountArray.push({
            curAmount: current,
            historyAmount: history,
            period: getPeriod(this.periods[index]),
          });
        });

      if (this.state.displayMode === this.modes[0]) {
        displayContent = (
          <RenderHistoryRecordChart
            amountsArray={amountArray}/>
        );
      } else {
        displayContent = (
          <RenderBudgetChar
            amountsArray={amountArray}
            budgetArray={[5, 6, 7, 2]}
            displayMode={this.state.budgetMode}
            setBudgetHandler={this.setBudgetHandler}
            showSettingHandler={this.showSettingHandler}/>
        );
      }
    }

    const renderButton = () => (
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
    );
    if (this.state.loaded) {
      return (
        <Modal>
          <div style={{
            width: 500,
          }}>
            {headerOptions}
            {displayContent}
            {renderButton()}
          </div>
        </Modal>
      );
    } else {
      return (
        <Modal>
          <p style={{
            width: 500,
          }}>Fetching data...</p>
        </Modal>
      );
    }
  }
}

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

export const PaymentCategory = ["Uncategorized", "Education", "Shopping", "Entertainment", "Restaurant", "Groceries"];
