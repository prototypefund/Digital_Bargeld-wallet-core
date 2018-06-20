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
 * Component for modal
 *
 * @author Siyu Lei
 */

/**
 * Imports.
 */
import * as React from "react";
import "../style/animation.css";

export const ModelAnimationDuration = 800;

const backDropStyle = {
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  height: "100vh",
  left: 0,
  padding: "20vh 0",
  position: "fixed" as "fixed",
  textAlign: "center",
  top: 0,
  width: "100vw",
  zIndex: 100,
};

const modelContentStyle = {
  animationDuration: ModelAnimationDuration + "ms",
  animationName: "fadeIn",
  backgroundColor: "white",
  border: "1px solid black",
  borderRadius: "0.5em",
  display: "inline-block",
  margin: "auto",
  padding: "1em",
  position: "relative" as "relative",
};

export class Modal extends React.Component {
  render() {
    return (
      <div style={backDropStyle}>
        <div style={modelContentStyle}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
