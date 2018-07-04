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

/**
 * Imports.
 */
import * as i18n from "../../i18n";

import * as React from "react";

import { Modal, ModelAnimationDuration } from "./modal";

import "../style/animation.css";

import * as Amounts from "../../amounts";
import {AmountJson} from "../../amounts";

interface MoneyCardPros {
  key: number;
  amount: AmountJson;
  animationDurationTime: number;
  animationDelayTime: number;
}

/**
 * Generate single money card for payment visualization.
 */
const MoneyCard = (props: MoneyCardPros) => {
  console.log("MoneyCardDelay", props.animationDelayTime);
  return (
    <div style={{
      animationDelay: props.animationDelayTime + "ms",
      animationDuration: props.animationDurationTime + "ms",
      animationName: "fadeInAndOut",
      backgroundColor: "white",
      border: "1px solid black",
      borderRadius: "0.5em",
      left: "10%",
      opacity: 0,
      position: "absolute",
      textAlign: "center",
      top: "40%",
      width: "5.5em",
      zIndex: 200,
    }}>
      <i18n.Translate wrap="p">
        <span>{Amounts.toFloat(props.amount) + " " + props.amount.currency}</span>
      </i18n.Translate>
    </div>
  );
};

interface VisualPaymentProps {
  amount: AmountJson;
  animationFinish: (delayTime: number) => void;
  closeAnimation: (event: React.MouseEvent<HTMLInputElement>) => void;
}

/**
 * According to value and currency that passed in, generate a list of denomination,
 * and use MoneyCard to generate payment visualization.
 */
export const VisualPayment = (props: VisualPaymentProps) => {
  // set denomination and its corresponding delay time
  const denominations: AmountJson[] = [];
  let rawDenominations = [100, 50, 10, 5, 1, 0.5, 0.1, 0.05, 0.01];
  if (props.amount.currency === "KUDOS") {
    rawDenominations = [100, 50, 10, 5, 1, 0.5, 0.1, 0.05, 0.01];
  } else if (props.amount.currency === "USD") {
    rawDenominations = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.01];
  } else if (props.amount.currency === "EUR") {
    rawDenominations = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
  }
  for (const denomination of rawDenominations) {
    denominations.push(Amounts.fromFloat(denomination, props.amount.currency));
  }
  console.log("test denominations", denominations);

  const maxDelayTime = 3000;
  const delayDiff = 200;
  const denominationDelay: number[] = [];
  for (let i = 0; i < denominations.length; i++) {
    denominationDelay[i] = maxDelayTime - delayDiff * i;
  }
  console.log(denominationDelay);

  // get moneyList for displaying animation
  const moneyList: AmountJson[] = [];
  let remainingAmount: AmountJson = props.amount;
  for (const denomination of denominations) {
    while (Amounts.cmp(remainingAmount, denomination) >= 0) {
      moneyList.push(denomination);
      remainingAmount = Amounts.sub(remainingAmount, denomination).amount;
    }
  }
  console.log("test money list", moneyList);

  // get list of html element for animation
  // first set a tiny delay time for animation plus the modelbox animation time
  let totalDelayTime = ModelAnimationDuration + 500;
  // first create html element then add totalDelay time
  const listItems = moneyList.map( (value, index) => {
    const MoneyCardItem = (
      <MoneyCard key={index}
                 amount={value}
                 animationDurationTime={denominationDelay[denominations.indexOf(value)]}
                 animationDelayTime={ totalDelayTime } />
    );
    totalDelayTime += denominationDelay[denominations.indexOf(value)];
    return MoneyCardItem;
  });
  props.animationFinish(totalDelayTime);

  return (
    <Modal>
      <div style={{
        height: "30vh",
        width: "60vw",
      }}>
        <i18n.Translate wrap="h2">
          What you will cost: <span>{Amounts.toFloat(props.amount) + " " + props.amount.currency}</span>
        </i18n.Translate>
        {listItems}
        <button className="pure-button button-destructive"
                style={{
                  position: "absolute" as "absolute",
                  right: "5%",
                  top: "80%",
                }}
                onClick={props.closeAnimation} >
          <i18n.Translate wrap="span">
            Close
          </i18n.Translate>
        </button>
      </div>
    </Modal>
  );
};

interface ToggleAnimationWarningProps {
  enableAnimation: (event: React.MouseEvent<HTMLInputElement>) => void;
  disableAnimation: (event: React.MouseEvent<HTMLInputElement>) => void;
}

export const ToggleAnimationWarning = (props: ToggleAnimationWarningProps) => {
  return (
    <Modal>
      <i18n.Translate wrap="h2">
        You will disable payment visualization
      </i18n.Translate>
      <i18n.Translate wrap="p">
        Most people spend more money when payment is easy. <br />
        You might be an exception, or you might be so rich it makes no difference. <br />
        Are you sure you want to turn this off?
      </i18n.Translate>
      <button className="pure-button button-warning"
              value="disableAnimation"
              onClick={props.disableAnimation}>
        <i18n.Translate wrap="span">
          Accept
        </i18n.Translate>
      </button>
      &nbsp;
      <button className="pure-button button-secondary"
              value="enableAnimation"
              onClick={props.enableAnimation}>
        <i18n.Translate wrap="span">
          Cancel
        </i18n.Translate>
      </button>
    </Modal>
  );
};
