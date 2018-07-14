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
import { CategoryBudget } from "../../dbTypes";
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

/**
 * Component for budget setting
 */
const RenderBudgetChar = (props: RenderBudgetChartPros) => {
  // For each time period in given list, render budget
  const listItems = props.amountsArray.map( (value, index) => {
    const totalAmount = Amounts.add(value.historyAmount, value.curAmount).amount;
    const budget = props.budgetArray[index];
    let percentage = 100;
    let color = "#2c99f4";
    let diff: number = -1;
    // avoid overflow
    if (budget !== -1 && budget !== 0) {
      percentage = (parseFloat(Amounts.toString(totalAmount).split(":")[1]) / budget) * 100;
      if (percentage > 100) {
        percentage = 100;
        color = "#ef3139";
      }
    }

    if (budget !== -1) {
      const minus = parseFloat(Amounts.toString(Amounts.sub(totalAmount,
        Amounts.fromFloat(budget, totalAmount.currency)).amount).split(":")[1]);
      if (minus > 0) {
        diff = minus;
        color = "#ef3139";
      }
    }

    // budget has been set
    const normalDisplay = () => (
      <div>
        <p>
          {totalAmount.currency}: {parseFloat(Amounts.toString(totalAmount).split(":")[1])} of {budget}
          {diff !== -1 ? <span> Over {diff}</span> : null }</p>
        <Line percent={percentage} strokeWidth="4" strokeColor={color} trailWidth="4"/>
        <a href="" id={index.toString()} onClick={props.showSettingHandler}>Edit Budget</a>
      </div>
    );

    // budget has not been set
    const noBudgetDisplay = () => (
      <div>
        <p>{totalAmount.currency}: {parseFloat(Amounts.toString(totalAmount).split(":")[1])}</p>
        <a href="" id={index.toString()} onClick={props.showSettingHandler}>Set Budget</a>
      </div>
    );

    // reset the budget
    const changeBudgetDisplay = () => (
      <div>
        <p>{totalAmount.currency}: {parseFloat(Amounts.toString(totalAmount).split(":")[1])}</p>
        <form onSubmit={props.setBudgetHandler} id={index.toString()}>
          <input type="text" name="budget" size={8} pattern="\\d+(\\.\\d{0,2})?" />
          <input type="submit" value="Set" />
        </form>
      </div>
    );

    // decide the display mode for (1)budget has been set, (2)no budget set, (3)reset budget
    const renderContent = () => {
      if (budget !== -1) {
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

/**
 * Component for spending visualization
 */
const RenderHistoryRecordChart = (props: RenderHistoryChartPros) => {
  const data = [];
  for (const TotalAmount of props.amountsArray) {
    const dataItem: {name: string; History: number; Current: number } = {
      Current: parseFloat(Amounts.toString(TotalAmount.curAmount).split(":")[1]),
      History: parseFloat(Amounts.toString(TotalAmount.historyAmount).split(":")[1]),
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
  categoryBudget: CategoryBudget[];
}

/**
 * Main component for spending visualization and budget planning
 */
export class TrackMoney extends React.Component<TrackMoneyPros, TrackMoneyState> {
  periods: string[];
  modes: string[];
  categories: string[];
  budgetMode: string[];

  constructor(props: TrackMoneyPros) {
    super(props);
    this.periods = ["one day", "one week", "one month", "half year", "one year"];
    this.modes = ["history record", "budget & spending"];
    this.budgetMode = ["display", "setting"];
    // set first element to be all category
    this.categories = ["All Categories", ...PaymentCategory];
    this.state = {
      budgetMode: [this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0], this.budgetMode[0]],
      categoryBudget: [],
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
    this.setState({ periodRecords: tempPeriodRecords });

    const tempCategoryBudgets = [];
    for (const curCategory of this.categories) {
      let categoryBudget = await wxApi.getCategoryBudget(curCategory);
      if (categoryBudget === null) {
        const tempCategoryBudget: CategoryBudget = {category: curCategory, budget: []};
        let i = 0;
        while (i < this.periods.length) {
          tempCategoryBudget.budget.push(-1);
          i++;
        }
        categoryBudget = tempCategoryBudget;
        wxApi.updateCategoryBudget(categoryBudget);
      }
      tempCategoryBudgets.push(categoryBudget);
    }
    console.log("test db", tempCategoryBudgets);
    this.setState({ categoryBudget: tempCategoryBudgets });
    this.setState({ loaded: true });
  }

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
    const index = this.categories.indexOf(this.state.displayCategory);
    const tempCategoryBudgetArr = this.state.categoryBudget;
    const tempCategoryBudget = tempCategoryBudgetArr[index];
    const tempBudgetArr = tempCategoryBudget.budget;
    tempBudgetArr[parseInt(event.currentTarget.id, 10)] = parseFloat(event.currentTarget[0].value);
    tempCategoryBudget.budget = tempBudgetArr;
    wxApi.updateCategoryBudget(tempCategoryBudget);
    tempCategoryBudgetArr[index] = tempCategoryBudget;
    console.log("test setting", tempCategoryBudgetArr);
    this.setState({ categoryBudget: tempCategoryBudgetArr});
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
        // plus payment record
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
        // minus refund
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
            budgetArray={this.state.categoryBudget[this.categories.indexOf(this.state.displayCategory)].budget}
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


/**
 * Render select(dropdown list by given list)
 */
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
