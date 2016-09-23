/*
 This file is part of TALER
 (C) 2016 INRIA

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */
System.register([], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var ChromeBadge;
    /**
     * Polyfill for requestAnimationFrame, which
     * doesn't work from a background page.
     */
    function rAF(cb) {
        window.setTimeout(() => {
            cb(performance.now());
        }, 100);
    }
    return {
        setters:[],
        execute: function() {
            ChromeBadge = class ChromeBadge {
                constructor(window) {
                    /**
                     * True if animation running.  The animation
                     * might still be running even if we're not busy anymore,
                     * just to transition to the "normal" state in a animated way.
                     */
                    this.animationRunning = false;
                    this.isBusy = false;
                    this.rotationAngle = 0;
                    // Allow injecting another window for testing
                    let bg = window || chrome.extension.getBackgroundPage();
                    this.canvas = bg.document.createElement("canvas");
                    this.canvas.width = 32;
                    this.canvas.height = 32;
                    this.ctx = this.canvas.getContext("2d");
                    this.talerLogo = bg.document.getElementById("taler-logo");
                    if (!(this.talerLogo instanceof HTMLImageElement)) {
                        throw Error();
                    }
                    this.draw();
                }
                /**
                 * Draw the badge based on the current state.
                 */
                draw() {
                    // Reset to identity
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
                    this.ctx.rotate(this.rotationAngle / ChromeBadge.rotationAngleMax * Math.PI * 2);
                    this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
                    this.ctx.drawImage(this.talerLogo, 0, 0, this.talerLogo.width, this.talerLogo.height, 0, 0, this.canvas.width, this.canvas.height);
                    // Allow running outside the extension for testing
                    if (chrome && chrome.browserAction) {
                        let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                        chrome.browserAction.setIcon({ imageData });
                    }
                }
                animate() {
                    if (this.animationRunning) {
                        return;
                    }
                    this.animationRunning = true;
                    let start = undefined;
                    let step = (timestamp) => {
                        if (!this.animationRunning) {
                            return;
                        }
                        if (!start) {
                            start = timestamp;
                        }
                        let delta = (timestamp - start);
                        if (!this.isBusy && this.rotationAngle + delta >= ChromeBadge.rotationAngleMax) {
                            // stop if we're close enough to origin
                            this.rotationAngle = 0;
                        }
                        else {
                            this.rotationAngle = (this.rotationAngle + timestamp - start) % ChromeBadge.rotationAngleMax;
                        }
                        if (this.isBusy || this.rotationAngle != 0) {
                            start = timestamp;
                            rAF(step);
                        }
                        else {
                            this.animationRunning = false;
                        }
                        this.draw();
                    };
                    rAF(step);
                }
                setText(s) {
                    chrome.browserAction.setBadgeText({ text: s });
                }
                setColor(c) {
                    chrome.browserAction.setBadgeBackgroundColor({ color: c });
                }
                startBusy() {
                    if (this.isBusy) {
                        return;
                    }
                    this.isBusy = true;
                    this.animate();
                }
                stopBusy() {
                    this.isBusy = false;
                }
            };
            ChromeBadge.rotationAngleMax = 1000;
            exports_1("ChromeBadge", ChromeBadge);
        }
    }
});
//# sourceMappingURL=chromeBadge.js.map