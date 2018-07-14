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
import * as ReactDOM from "react-dom";
import * as wxApi from "../wxApi";
import { ToggleAnimationWarning } from "./visual-payment";

interface UserConfigurationState {
  allowAnimation: boolean;
  renderWarning: boolean;
  loaded: boolean;
}

/**
 * Component for user configuration
 */
class UserConfiguration extends React.Component<any, UserConfigurationState> {
  constructor(props: any) {
    super(props);
    this.state = {
      allowAnimation: true,
      loaded: false,
      renderWarning: false,
    };
  }

  componentWillMount() {
    this.update();
  }

  async update() {
    const config = await wxApi.getUserConfig("toggleAnimation");
    if (config === null || config.toggle) {
      this.setState({ allowAnimation: true });
    } else {
      this.setState({ allowAnimation: false });
    }
    this.setState({ loaded: true});
  }

  toggleAnimation = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ allowAnimation: event.target.checked });
    // update indexedDB for user configuration
    wxApi.updateUserConfig({ operation: "toggleAnimation", toggle: event.target.checked });
    if (!event.target.checked) {
      this.setState({ renderWarning: true });
    }
  }

  toggleAnimationHandler = (event: React.MouseEvent<HTMLInputElement>) => {
    this.setState({ renderWarning: false });
    if (event.currentTarget.value === "enableAnimation") {
      this.setState({allowAnimation: true});
      // update indexedDB for user configuration
      wxApi.updateUserConfig({ operation: "toggleAnimation", toggle: true });
    } else {
      this.setState({allowAnimation: false});
      // update indexedDB for user configuration
      wxApi.updateUserConfig({ operation: "toggleAnimation", toggle: false});
    }
  }

  render() {
    let toggleAnimationWarning = null;
    if (this.state.renderWarning) {
      toggleAnimationWarning = (
        <ToggleAnimationWarning
          enableAnimation={this.toggleAnimationHandler}
          disableAnimation={this.toggleAnimationHandler}/>
      );
    }

    if (this.state.loaded) {
      return (
        <div id="main">
          <h1>User Configuration</h1>
          <p>You can enable/disable payment visualization and show payment record in this page.</p>
          Enable Payment Visualization<input type="checkbox"
                                             onChange={this.toggleAnimation}
                                             checked={this.state.allowAnimation}/>
          <br />
          Enable show payment record <input type="checkbox"/>
          {toggleAnimationWarning}
        </div>
      );
    } else {
      return (
        <p>Fetching data...</p>
      );
    }
  }
}

function main() {
  ReactDOM.render(<UserConfiguration />, document.getElementById("container")!);
}

document.addEventListener("DOMContentLoaded", main);
