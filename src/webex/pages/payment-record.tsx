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

import * as React from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import "react-tabs/style/react-tabs.css";

import { Modal } from "./modal";

import "../style/animation.css";

import * as Amounts from "../../amounts";
import * as wxApi from "../wxApi";

import {Bar, BarChart, Legend, Tooltip, XAxis, YAxis} from "recharts";

/**
 * User UserConfiguration
 *
 * @author Siyu Lei
 */

interface RenderChartPros {
  curValue: number;
  historyValue: number;
  currency: string;
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
      curFullContent: props.curValue / Amounts.fractionalBase + " " + props.currency,
      historyFullContent: props.historyValue / Amounts.fractionalBase + " " + props.currency,
      name: "Payment Record",
      [period]: props.historyValue / Amounts.fractionalBase,
      ["This time"]: props.curValue / Amounts.fractionalBase,
    },
  ];

  return (
    <BarChart width={500}
              height={200}
              data={data}
              layout="vertical"
              margin={{top: 5, right: 30, left: 20, bottom: 5}}>
      <XAxis type="number" unit={props.currency} />
      <YAxis type="category" dataKey="name"/>
      <Tooltip formatter={value => value + " " + props.currency}/>
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
  value: number;
  currency: string;
  period: string;
}

interface RenderDataState {
  loaded: boolean;
  historyAmount: number;
}

class RenderData extends React.Component<RenderDataPros, RenderDataState> {
  constructor(props: RenderDataPros) {
    super(props);
    this.state = {
      historyAmount: 0,
      loaded: false,
    };
  }

  componentWillMount() {
    this.update();
  }

  async update() {
    const record = await wxApi.getPaymentStatistic(this.props.period);
    let amount = 0;
    for (const p of record.history) {
      if (p.detail.amount !== undefined) {
        const arr = p.detail.amount.split(":");
        amount += arr[1] * Amounts.fractionalBase;
      }
    }
    this.setState({ historyAmount: amount, loaded: true });
  }

  render() {
    if (this.state.loaded) {
      return (
        <div>
          <RenderChart
            curValue={this.props.value}
            historyValue={this.state.historyAmount}
            currency={this.props.currency}
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
  value: number;
  currency: string;
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
        <RenderData value={props.value} currency={props.currency} period="one-day"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one week payment record</h3>
        <RenderData value={props.value} currency={props.currency} period="one-week"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one month payment record</h3>
        <RenderData value={props.value} currency={props.currency} period="one-month"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last half year payment record</h3>
        <RenderData value={props.value} currency={props.currency} period="half-year"/>
      </TabPanel>
      <TabPanel>
        <h3 style={{ textAlign: "center" }}>You last one year payment record</h3>
        <RenderData value={props.value} currency={props.currency} period="one-year"/>
      </TabPanel>
    </Tabs>
  );
};

interface TrackMoneyPros {
  buttonHandler: (event: React.MouseEvent<HTMLInputElement>) => void;
  value: number;
  currency: string;
}

export const TrackMoney = (props: TrackMoneyPros) => {
  return (
    <Modal>
      <div style={{
        textAlign: "left",
      }}>
        <RecordTab value={props.value} currency={props.currency} />
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
