/*
 This file is part of TALER
 (C) 2017 Inria and GNUnet e.V.

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */


import {test} from "ava";

import * as aat from "./aatree";


function shuffleArray(array: any[]): any[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}


function myCmp(a: any, b: any): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}


test("insertion", (t) => {
  let vs = [];
  for (let i = 0; i < 1000; i++) {
    vs.push(Math.floor(Math.random() * 500));
  }
  
  let tree = undefined;
  t.true(aat.checkInvariants(tree));

  for (let i = 0; i < 1000; i++) {
    tree = aat.treeInsert(tree, vs[i], myCmp);
    t.true(aat.checkInvariants(tree));
    t.true(aat.treeFind(tree, vs[i], myCmp));
  }

  vs = Array.from(new Set(vs));

  vs.sort((a, b) => a - b);
  t.deepEqual(aat.treeToArray(tree), vs);
});


test("deletion", (t) => {
  let vs = [];
  let tree = undefined;
  for (let i = 0; i < 1000; i++) {
    vs.push(Math.floor(Math.random() * 500));
    tree = aat.treeInsert(tree, vs[i], myCmp);
    t.true(aat.checkInvariants(tree));
    t.true(aat.treeFind(tree, vs[i], myCmp));
  }

  shuffleArray(vs);

  for (let i = 0; i < 1000; i++) {
    tree = aat.treeDelete(tree, vs[i], myCmp);
    t.true(aat.checkInvariants(tree));
    t.false(aat.treeFind(tree, vs[i], myCmp));
  }
});
