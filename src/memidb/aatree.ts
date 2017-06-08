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


/**
 * Implementation of AA trees (Arne Andersson, 1993) as a persistent data
 * structure (Prabhakar Ragde, 2014).
 *
 * AA trees were chosen since they balance efficiency and a simple
 * implementation.
 */


/**
 * An AA tree, either a node or 'undefined' as sentinel element.
 */
export type AATree = AATreeNode | undefined;


interface AATreeNode {
  left: AATree;
  right: AATree;
  level: number;
  key: any;
}


/**
 * Check AA tree invariants.  Useful for testing.
 */
export function checkInvariants(t: AATree): boolean {
  // No invariants for the sentinel.
  if (!t) {
    return true;
  }

  // AA1: The left child of a node x has level one less than x.
  if (level(t.left) != level(t) - 1) {
    console.log("violated AA1");

    console.log(JSON.stringify(t, undefined, 2));
    return false;
  }

  // AA2: The right child of x has the same level (x is a "double" node) or one less (x is a "single" node).
  if (!(level(t.right) === level(t) || level(t.right) === level(t) - 1)) {
    console.log("violated AA2");
    console.log("level(t.right)", level(t.right));
    console.log("level(t)", level(t));
    return false;
  }

  // AA3: The right child of the right child of x has level less than x.
  if (t.right && t.right.right) {
    if (level(t.right.right) >= level(t)) {
      console.log("violated AA3");
      console.log(JSON.stringify(t, undefined, 2));
      return false;
    }
  }

  // AA4: All internal nodes have two children.
  // This invariant follows from how we defined "level"
  return true;
}


/**
 * Fix a violation of invariant AA1 by reversing a link.
 *
 * ```
 *    y <--- t    =>     y ---> t
 *   / \      \   =>    /      / \
 *  a   b      c  =>   a      b   c
 * ```
 */
function skew(t: AATreeNode) {
  if (t.left && t.left.level === t.level) {
    return { ...t.left, right: { ...t, left: t.left.right } };
  }
  return t;
}


/**
 * Fix a violation of invariant AA3 by pulling up the middle node.
 *
 * ```
 *                    =>      y
 *                    =>     / \
 *    t --> y --> z   =>    t   z
 *   /     /          =>   / \
 *  a     b           =>  a   b
 * ```
 */
function split(t: AATreeNode) {
  if (t.right && t.right.right && 
      t.level === t.right.level &&
      t.right.level === t.right.right.level) {
    return {
      level: t.level + 1,
      key: t.right.key,
      left: { ...t, right: t.right.left },
      right: t.right.right,
    }
  }
  return t;
}


/**
 * Non-destructively insert a new key into an AA tree.
 */
export function treeInsert(t: AATree, k: any, cmpFn: (k1: any, k2: any) => number): AATreeNode {
  if (!t) {
    return {
      level: 1,
      key: k,
      left: undefined,
      right: undefined,
    }
  }
  const cmp = cmpFn(k, t.key);
  if (cmp === 0) {
    return t;
  } else if (cmp < 0) {
    return split(skew({ ...t, left: treeInsert(t.left, k, cmpFn)}));
  } else {
    return split(skew({ ...t, right: treeInsert(t.right, k, cmpFn)}));
  }
}


/**
 * Level of an AA tree node, or zero if it's a sentinel.
 */
function level(t: AATree) {
  if (!t) {
    return 0;
  }
  return t.level;
}


/**
 * Check if a node is single, i.e. doens't have a right child
 * on the same level.
 */
function isSingle(t: AATree) {
  if (t && t.right && t.right.level === t.level) {
    return false;
  }
  return true;
}


/**
 * Restore invariants that were broken by deleting a node.
 *
 * Assumes that invariants for t.left and t.right are already adjusted.
 */
function adjust(t: AATreeNode): AATreeNode {
  // First check if left or right subtree are at the right level.  Note that
  // they can't be both at the wrong level, since only one node is deleted
  // before calling adjust.
  const leftOkay = level(t.left) === level(t) - 1;
  const rightOkay = (level(t.right) === level(t) || level(t.right) === level(t) - 1);
  if (leftOkay && rightOkay) {
    return t;
  }
  if (!rightOkay) {
    if (isSingle(t.left)) {
      return skew({ ...t, level: t.level - 1 });
    }
    /*
     *      ( t )       =>      ( b )
     *     /     \      =>     /     \
     *    x -> b  \     =>    x       t
     *   /    / \  \    =>   / \     / \
     *  a    d   e  c   =>  a   d   e   c
     */
    const b = t.left!.right!;
    return {
      level: b.level + 1,
      key: b.key,
      left: { ...t.left, right: b.left },
      right: { ...t, level: t.level - 1, left: b.right },
    };
  }
  if (!leftOkay) {
    if (isSingle(t)) {
      return split({ ...t, level: t.level - 1 });
    }
    /*
     *      t -> ( r )    =>       ( a ) -> r   
     *     /    /     \   =>      /        / \  
     *    /    a -> d  b  =>     t        d   b 
     *   /    /           =>    / \            
     *  x    c            =>   l   c           
     *
     *      t -> r    =>       ( a )
     *     /    / \   =>      /     \
     *    /    a   b  =>     t       r -> b
     *   /    / \     =>    / \     /    
     *  x    c   d    =>   l   c   d
     *
     *  Only Level of r differs, depending on whether a is single or double.
     *  Node 'r' must be split, as node 'b' might be double.
     */
    const a = t.right!.left!;
    const n = isSingle(a) ? a.level : a.level + 1;
    return {
      key: a.key,
      left: { ...t, level: a.level, right: a.left },
      level: a.level + 1,
      right: split({
        level: n,
        left: a.right,
        right: t.right!.right,
        key: t.right!.key,
      }),
    };
  }
  throw Error("not reached");
}


function treeDeleteLargest(t: AATreeNode): { key: any, tree: AATree } {
  if (!t.right) {
    return { key: t.key, tree: t.left };
  }
  const d = treeDeleteLargest(t.right);
  return {
    key: d.key,
    tree: adjust({ ...t, right: d.tree}),
  };
}


/**
 * Count the number of elements stored in the tree.
 */
export function treeSize(t: AATree): number {
  if (!t) {
    return 0;
  }
  return treeSize(t.left) + treeSize(t.right) + 1;
}


/**
 * Get an array of (sorted) keys from an AA tree.
 */
export function treeToArray(t: AATree, accum: any[] = []) {
  if (!t) {
    return accum;
  }
  treeToArray(t.left, accum);
  accum.push(t.key);
  treeToArray(t.right, accum);
  return accum;
}


/**
 * Check if a key can be found in a tree.
 */
export function treeFind(t: AATree, k: any, cmpFn: (k1: any, k2: any) => number): boolean {
  if (!t) {
    return false;
  }
  const cmp = cmpFn(k, t.key);
  if (cmp < 0) {
    return treeFind(t.left, k, cmpFn);
  }
  if (cmp > 0) {
    return treeFind(t.right, k, cmpFn);
  }
  return true;
}


/**
 * Get the largest key in the tree.
 */
export function treeBiggest(t: AATree): any {
  if (!t) {
    return undefined;
  }
  if (!t.right) {
    return t.key;
  }
  return treeBiggest(t);
}


/**
 * Get the smallest key in the tree.
 */
export function treeSmallest(t: AATree): any {
  if (!t) {
    return undefined;
  }
  if (!t.left) {
    return t.key;
  }
  return treeSmallest(t);
}


/**
 * Get the smallest key from the tree that is larger than the given key.
 * Returns 'undefined' if the given key is the largest key.
 */
export function treeNextKey(t: AATree, k: any, cmpFn: (k1: any, k2: any) => number): any {
  if (!t) {
    return undefined;
  }
  const cmp = cmpFn(k, t.key);
  if (cmp === 0) {
    return treeSmallest(t.right);
  }
  if (cmp < 0) {
    const r = treeNextKey(t.left, k, cmpFn);
    if (r) {
      return r;
    }
    return t.key;
  }
  if (cmp < 0) {
    return treeNextKey(t.right, k, cmpFn);
  }
}


/**
 * Get the largest tree from the tree that is smaller than the given key.
 * Returns 'undefined' if the given key is the smallest key.
 */
export function treePreviousKey(t: AATree, k: any, cmpFn: (k1: any, k2: any) => number): any {
  return treeNextKey(t, k, (k1, k2) => -cmpFn(k1, k2));
}


/**
 * Returns a new tree without the given key.
 */
export function treeDelete(t: AATree, k: any, cmpFn: (k1: any, k2: any) => number): AATree {
  if (!t) {
    return t;
  }
  const cmp = cmpFn(k, t.key);
  if (cmp === 0) {
    if (!t.left) {
      return t.right;
    }
    if (!t.right) {
      return t.left;
    }
    const d = treeDeleteLargest(t.left);
    return adjust({
      key: d.key,
      left: d.tree,
      right: t.right,
      level: t.level,
    });
  }
  if (cmp < 0) {
    return adjust({ ...t, left: treeDelete(t.left, k, cmpFn) });
  }
  if (cmp > 0) {
    return adjust({ ...t, right: treeDelete(t.right, k, cmpFn) });
  }
  throw Error("not reached");
}
