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
 TALER; see the file COPYING.  If not, If not, see <http://www.gnu.org/licenses/>
 */

/**
 * Common types that are used by Taler.
 *
 * Note most types are defined in wallet.ts, types that
 * are defined in types.ts are intended to be used by components
 * that do not depend on the whole wallet implementation (which depends on
 * emscripten).
 */

import {Checkable} from "./checkable";

@Checkable.Class
export class AmountJson {
  @Checkable.Number
  value: number;

  @Checkable.Number
  fraction: number;

  @Checkable.String
  currency: string;

  static checked: (obj: any) => AmountJson;
}


@Checkable.Class
export class CreateReserveResponse {
  /**
   * Mint URL where the bank should create the reserve.
   * The URL is canonicalized in the response.
   */
  @Checkable.String
  mint: string;

  @Checkable.String
  reservePub: string;

  static checked: (obj: any) => CreateReserveResponse;
}