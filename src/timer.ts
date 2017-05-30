/*
 This file is part of TALER
 (C) 2017 GNUnet e.V.

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
 * Cross-platform timers.
 *
 * NodeJS and the browser use slightly different timer API,
 * this abstracts over these differences.
 */

/**
 * Cancelable timer.
 */
export interface TimerHandle {
  clear(): void;
}

class IntervalHandle {
  constructor(public h: any) {
  }

  clear() {
    clearTimeout(this.h);
  }
}

class TimeoutHandle {
  constructor(public h: any) {
  }

  clear() {
    clearTimeout(this.h);
  }
}

/**
 * Get a performance counter in milliseconds.
 */
export let performanceNow = (() => {
  if (typeof process !== "undefined" && process.hrtime) {
    return () => {
      const t = process.hrtime();
      return t[0] * 1e9 + t[1];
    };
  } else if (typeof "performance" !== "undefined") {
    return () => performance.now();
  } else {
    return () => 0;
  }
})();

/**
 * Call a function every time the delay given in milliseconds passes.
 */
export function every(delayMs: number, callback: () => void): TimerHandle {
  return new IntervalHandle(setInterval(callback, delayMs));
}

/**
 * Call a function after the delay given in milliseconds passes.
 */
export function after(delayMs: number, callback: () => void): TimerHandle {
  return new TimeoutHandle(setInterval(callback, delayMs));
}