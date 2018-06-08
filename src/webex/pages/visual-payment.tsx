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
 * Component for payment visualization
 *
 * @author Siyu Lei
 */


import * as React from "react";
import * as Amounts from "../../amounts";

const modelAnimationDuration = 800;

const backDropStyle = {
  position: "fixed" as "fixed",
  width: "100vw",
  height: "100vh",
  padding: "20vh 0",
  left: 0,
  top: 0,
  zIndex: 100,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
}

const modelContentStyle = {
  position: "relative" as "relative",
  backgroundColor: "white",
  margin: "auto",
  padding: 0,
  border: "1px solid black",
  borderRadius: "0.5em",
  textAlign: "center",
  // opacity: 0,
  animationName: "fadeIn",
  animationDuration: modelAnimationDuration + "ms",
}

// const Backdrop = () => {
//   return (
//     <div style={{
//       position: "fixed",
//       width: "100vw",
//       height: "100vh",
//       left: 0,
//       top: 0,
//       zIndex: 100,
//       backgroundColor: "rgba(0, 0, 0, 0.5)",
//     }}></div>
//   );
// }

interface MoneyCardPros {
  key: number;
  value: number;
  currency: string;
  animationDurationTime: number;
  animationDelayTime: number;
}

const MoneyCard = (props: MoneyCardPros) => {
  console.log("MoneyCardDelay", props.animationDelayTime);
  return (
    <div style={{
      border: "1px solid black",
      borderRadius: "0.5em",
      zIndex: 200,
      padding: "1em 0.5em",
      width: "5.5em",
      position: "absolute",
      left: "10%",
      top: "40%",
      opacity: 0,
      backgroundColor: "white",
      textAlign: "center",
      animationName: "fadeInAndOut",
      animationDuration: props.animationDurationTime + "ms",
      animationDelay: props.animationDelayTime + "ms",
    }}>
      {props.value + " " + props.currency}
    </div>
  );
}

interface VisualPaymentProps {
  value: number;
  currency: string;
  animationFinish: (delayTime: number) => void;
  closeAnimation: (event: React.MouseEvent<HTMLInputElement>) => void;
}

export const VisualPayment = (props: VisualPaymentProps) => {
  // set denomination and its corresponding delay time
  const denominations = [100, 50, 10, 5, 1, 0.5, 0.1, 0.05, 0.01];
  const maxDelayTime = 3000;
  const delayDiff = 200;
  const denominationDelay: number[] = [];
  for (let i = 0; i < denominations.length; i++) {
    denominationDelay[i] = maxDelayTime - delayDiff * i;
  }
  console.log(denominationDelay);

  // get moneyList for displaying animation
  const moneyList: number[] = [];
  let remainingAmount: number = props.value;
  for (const denomination of denominations) {
    while (remainingAmount >= denomination * Amounts.fractionalBase) {
      moneyList.push(denomination);
      remainingAmount -= denomination * Amounts.fractionalBase;
    }
  }
  console.log(moneyList);

  // get list of html element for animation
  // first set a tiny delay time for animation plus the modelbox animation time
  let totalDelayTime = modelAnimationDuration + 500;
  // first create html element then add totalDelay time
  const listItems = moneyList.map( (value, index) => {
    const MoneyCardItem = (
      <MoneyCard key={index}
                 value={value}
                 currency={props.currency}
                 animationDurationTime={denominationDelay[denominations.indexOf(value)]}
                 animationDelayTime={ totalDelayTime } />
    );
    totalDelayTime += denominationDelay[denominations.indexOf(value)];
    return MoneyCardItem;
  });
  console.log("totalDelay", totalDelayTime);
  props.animationFinish(totalDelayTime);

  // return (
  //   <div style={{
  //     position: "fixed",
  //     width: "60vw",
  //     top: "35%",
  //     left: "20%",
  //     textAlign: "center",
  //   }}>
  //     <h3>What you will cost</h3>
  //     {listItems}
  //     <Backdrop />
  //   </div>
  // );
  return (
    <div style={backDropStyle}>
      <div style={{
        ...modelContentStyle,
        width: "60%",
        height: "40%",
      }}>
        <h2>What you will cost: {props.value / Amounts.fractionalBase + " " + props.currency}</h2>
        {listItems}
        <button className="pure-button button-destructive"
                style={{
                  position: "absolute" as "absolute",
                  top: "80%",
                  right: "5%",
                }}
                onClick={props.closeAnimation} >Close</button>
      </div>
    </div>
  );
}

interface ToggleAnimationWarningProps {
  enableAnimation: (event: React.MouseEvent<HTMLInputElement>) => void;
  disableAnimation: (event: React.MouseEvent<HTMLInputElement>) => void;
}

export const ToggleAnimationWarning = (props: ToggleAnimationWarningProps) => {
  return (
    <div style={backDropStyle}>
      <div style={{
        ...modelContentStyle,
        width: "50%",
        paddingBottom: "1em",
        paddingLeft: "1em",
        paddingRight: "1em",
      }}>
        <h2>You will disable payment visualization</h2>
        <p>Most people spend more money when payment is easy. You might be an exception,
          or you might be so rich it makes no difference. <br />Are you sure you want to turn this off?</p>
        <button className="pure-button button-warning"
                value="disableAnimation"
                onClick={props.disableAnimation}>Accept</button>
        &nbsp;
        <button className="pure-button button-secondary"
                value="enableAnimation"
                onClick={props.enableAnimation}>Cancel</button>
      </div>
    </div>
  );
}

