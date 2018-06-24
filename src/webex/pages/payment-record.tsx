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
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import "react-tabs/style/react-tabs.css";

import { Modal } from "./modal";

import "../style/animation.css";

import * as Amounts from "../../amounts";
import * as wxApi from "../wxApi";

import {Bar, BarChart, Legend, Tooltip, XAxis, YAxis} from "recharts";
import {AmountJson} from "../../amounts";

interface RenderChartPros {
  curAmount: AmountJson;
  historyAmount: AmountJson;
  period: string;
}

const RenderChart = (props: RenderChartPros) => {
  let period = "Last one day";
  switch (props.period) {
    case "one-day": {
      period = "Last one day";
      break;
    }
    case "one-week": {
      period = "Last one week";
      break;
    }
    case "one-month": {
      period = "Last one month";
      break;
    }
    case "half-year": {
      period = "Last half year";
      break;
    }
    case "one-year": {
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
              margin={{top: 5, right: 30, left: 20, bottom: 5}}>
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

interface RenderDataPros {
  amount: AmountJson;
  period: string;
}

interface RenderDataState {
  loaded: boolean;
  historyAmount: AmountJson;
}

class RenderData extends React.Component<RenderDataPros, RenderDataState> {
  constructor(props: RenderDataPros) {
    super(props);
    this.state = {
      historyAmount: {value: 0, fraction: 0, currency: props.amount.currency},
      loaded: false,
    };
  }

  componentWillMount() {
    this.update();
  }

  async update() {
    const record = await wxApi.getPaymentStatistic(this.props.period);
    let amount = {value: 0, fraction: 0, currency: this.props.amount.currency};
    for (const p of record.history) {
      if (p.detail.totalCost !== undefined &&
        Amounts.parseOrThrow(p.detail.totalCost).currency === this.props.amount.currency) {
        amount = Amounts.add(amount, Amounts.parseOrThrow(p.detail.totalCost)).amount;
      }
    }
    this.setState({ historyAmount: amount, loaded: true });
  }

  render() {
    if (this.state.loaded) {
      return (
        <div>
          <RenderChart
            curAmount={this.props.amount}
            historyAmount={this.state.historyAmount}
            period={this.props.period}/>
        </div>
      );
    } else {
      return (
        <p>Fetching data...</p>
      );
    }
  }
}


interface RecordTabProps {
  amount: AmountJson;
}

const RecordTab = (props: RecordTabProps) => {
  return (
    <Tabs>
      <TabList>
        <Tab>
          One day
        </Tab>
        <Tab>
          One week
        </Tab>
        <Tab>
          One month
        </Tab>
        <Tab>
          Half year
        </Tab>
        <Tab>
          One year
        </Tab>
      </TabList>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one day payment record</h3>
        <RenderData amount={props.amount} period="one-day"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one week payment record</h3>
        <RenderData amount={props.amount} period="one-week"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one month payment record</h3>
        <RenderData amount={props.amount} period="one-month"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last half year payment record</h3>
        <RenderData amount={props.amount} period="half-year"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one year payment record</h3>
        <RenderData amount={props.amount} period="one-year"/>
      </TabPanel>
    </Tabs>
  );
};

interface TrackMoneyPros {
  buttonHandler: (event: React.MouseEvent<HTMLInputElement>) => void;
  amount: AmountJson;
}

export const TrackMoney = (props: TrackMoneyPros) => {
  return (
    <Modal>
      <div style={{
        textAlign: "left",
      }}>
        <RecordTab amount={props.amount} />
      </div>
      <div style={{
        marginTop: "1em",
        textAlign: "center",
      }}>
        <button className="pure-button button-success"
                value="pay"
                onClick={props.buttonHandler}>
          Pay</button>
        &nbsp;
        <button className="pure-button button-secondary"
                value="cancel"
                onClick={props.buttonHandler}>
          Cancel</button>
      </div>
    </Modal>
  );
};
