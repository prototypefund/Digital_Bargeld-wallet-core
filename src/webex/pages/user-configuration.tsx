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

class UserConfiguration extends React.Component {
  render(): JSX.Element {
    return (
      <div>
        ok
      </div>
    );
  }
}

function main() {
  ReactDOM.render(<UserConfiguration />, document.getElementById("container")!);
}

document.addEventListener("DOMContentLoaded", main);
