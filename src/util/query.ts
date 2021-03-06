/*
 This file is part of TALER
 (C) 2016 GNUnet e.V.

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
 * Database query abstractions.
 * @module Query
 * @author Florian Dold
 */

/**
 * Imports.
 */
import { openPromise } from "./promiseUtils";

/**
 * Exception that should be thrown by client code to abort a transaction.
 */
export const TransactionAbort = Symbol("transaction_abort");

/**
 * Definition of an object store.
 */
export class Store<T> {
  constructor(
    public name: string,
    public storeParams?: IDBObjectStoreParameters,
    public validator?: (v: T) => T,
  ) {}
}

/**
 * Options for an index.
 */
export interface IndexOptions {
  /**
   * If true and the path resolves to an array, create an index entry for
   * each member of the array (instead of one index entry containing the full array).
   *
   * Defaults to false.
   */
  multiEntry?: boolean;
}

function requestToPromise(req: IDBRequest): Promise<any> {
  const stack = Error("Failed request was started here.");
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      console.log("error in DB request", req.error);
      reject(req.error);
      console.log("Request failed:", stack);
    };
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  const stack = Error("Failed transaction was started here.");
  return new Promise((resolve, reject) => {
    tx.onabort = () => {
      reject(TransactionAbort);
    };
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      console.error("Transaction failed:", stack);
      reject(tx.error);
    };
  });
}

function applyMutation<T>(
  req: IDBRequest,
  f: (x: T) => T | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const val = cursor.value;
        const modVal = f(val);
        if (modVal !== undefined && modVal !== null) {
          const req2: IDBRequest = cursor.update(modVal);
          req2.onerror = () => {
            reject(req2.error);
          };
          req2.onsuccess = () => {
            cursor.continue();
          };
        } else {
          cursor.continue();
        }
      } else {
        resolve();
      }
    };
    req.onerror = () => {
      reject(req.error);
    };
  });
}

type CursorResult<T> = CursorEmptyResult<T> | CursorValueResult<T>;

interface CursorEmptyResult<T> {
  hasValue: false;
}

interface CursorValueResult<T> {
  hasValue: true;
  value: T;
}

class ResultStream<T> {
  private currentPromise: Promise<void>;
  private gotCursorEnd = false;
  private awaitingResult = false;

  constructor(private req: IDBRequest) {
    this.awaitingResult = true;
    let p = openPromise<void>();
    this.currentPromise = p.promise;
    req.onsuccess = () => {
      if (!this.awaitingResult) {
        throw Error("BUG: invariant violated");
      }
      const cursor = req.result;
      if (cursor) {
        this.awaitingResult = false;
        p.resolve();
        p = openPromise<void>();
        this.currentPromise = p.promise;
      } else {
        this.gotCursorEnd = true;
        p.resolve();
      }
    };
    req.onerror = () => {
      p.reject(req.error);
    };
  }

  async toArray(): Promise<T[]> {
    const arr: T[] = [];
    while (true) {
      const x = await this.next();
      if (x.hasValue) {
        arr.push(x.value);
      } else {
        break;
      }
    }
    return arr;
  }

  async map<R>(f: (x: T) => R): Promise<R[]> {
    const arr: R[] = [];
    while (true) {
      const x = await this.next();
      if (x.hasValue) {
        arr.push(f(x.value));
      } else {
        break;
      }
    }
    return arr;
  }

  async forEachAsync(f: (x: T) => Promise<void>): Promise<void> {
    while (true) {
      const x = await this.next();
      if (x.hasValue) {
        await f(x.value);
      } else {
        break;
      }
    }
  }

  async forEach(f: (x: T) => void): Promise<void> {
    while (true) {
      const x = await this.next();
      if (x.hasValue) {
        f(x.value);
      } else {
        break;
      }
    }
  }

  async filter(f: (x: T) => boolean): Promise<T[]> {
    const arr: T[] = [];
    while (true) {
      const x = await this.next();
      if (x.hasValue) {
        if (f(x.value)) {
          arr.push(x.value);
        }
      } else {
        break;
      }
    }
    return arr;
  }

  async next(): Promise<CursorResult<T>> {
    if (this.gotCursorEnd) {
      return { hasValue: false };
    }
    if (!this.awaitingResult) {
      const cursor: IDBCursor | undefined = this.req.result;
      if (!cursor) {
        throw Error("assertion failed");
      }
      this.awaitingResult = true;
      cursor.continue();
    }
    await this.currentPromise;
    if (this.gotCursorEnd) {
      return { hasValue: false };
    }
    const cursor = this.req.result;
    if (!cursor) {
      throw Error("assertion failed");
    }
    return { hasValue: true, value: cursor.value };
  }
}

export class TransactionHandle {
  constructor(private tx: IDBTransaction) {}

  put<T>(store: Store<T>, value: T, key?: any): Promise<any> {
    const req = this.tx.objectStore(store.name).put(value, key);
    return requestToPromise(req);
  }

  add<T>(store: Store<T>, value: T, key?: any): Promise<any> {
    const req = this.tx.objectStore(store.name).add(value, key);
    return requestToPromise(req);
  }

  get<T>(store: Store<T>, key: any): Promise<T | undefined> {
    const req = this.tx.objectStore(store.name).get(key);
    return requestToPromise(req);
  }

  getIndexed<S extends IDBValidKey, T>(
    index: Index<S, T>,
    key: any,
  ): Promise<T | undefined> {
    const req = this.tx
      .objectStore(index.storeName)
      .index(index.indexName)
      .get(key);
    return requestToPromise(req);
  }

  iter<T>(store: Store<T>, key?: any): ResultStream<T> {
    const req = this.tx.objectStore(store.name).openCursor(key);
    return new ResultStream<T>(req);
  }

  iterIndexed<S extends IDBValidKey, T>(
    index: Index<S, T>,
    key?: any,
  ): ResultStream<T> {
    const req = this.tx
      .objectStore(index.storeName)
      .index(index.indexName)
      .openCursor(key);
    return new ResultStream<T>(req);
  }

  delete<T>(store: Store<T>, key: any): Promise<void> {
    const req = this.tx.objectStore(store.name).delete(key);
    return requestToPromise(req);
  }

  mutate<T>(
    store: Store<T>,
    key: any,
    f: (x: T) => T | undefined,
  ): Promise<void> {
    const req = this.tx.objectStore(store.name).openCursor(key);
    return applyMutation(req, f);
  }
}

function runWithTransaction<T>(
  db: IDBDatabase,
  stores: Store<any>[],
  f: (t: TransactionHandle) => Promise<T>,
  mode: "readonly" | "readwrite",
): Promise<T> {
  const stack = Error("Failed transaction was started here.");
  return new Promise((resolve, reject) => {
    const storeName = stores.map((x) => x.name);
    const tx = db.transaction(storeName, mode);
    let funResult: any = undefined;
    let gotFunResult = false;
    tx.oncomplete = () => {
      // This is a fatal error: The transaction completed *before*
      // the transaction function returned.  Likely, the transaction
      // function waited on a promise that is *not* resolved in the
      // microtask queue, thus triggering the auto-commit behavior.
      // Unfortunately, the auto-commit behavior of IDB can't be switched
      // of.  There are some proposals to add this functionality in the future.
      if (!gotFunResult) {
        const msg =
          "BUG: transaction closed before transaction function returned";
        console.error(msg);
        reject(Error(msg));
      }
      resolve(funResult);
    };
    tx.onerror = () => {
      console.error("error in transaction");
      console.error(stack);
    };
    tx.onabort = () => {
      if (tx.error) {
        console.error("Transaction aborted with error:", tx.error);
      } else {
        console.log("Trasaction aborted (no error)");
      }
      reject(TransactionAbort);
    };
    const th = new TransactionHandle(tx);
    const resP = Promise.resolve().then(() => f(th));
    resP
      .then((result) => {
        gotFunResult = true;
        funResult = result;
      })
      .catch((e) => {
        if (e == TransactionAbort) {
          console.info("aborting transaction");
        } else {
          console.error("Transaction failed:", e);
          console.error(stack);
          tx.abort();
        }
      })
      .catch((e) => {
        console.error("fatal: aborting transaction failed", e);
      });
  });
}

/**
 * Definition of an index.
 */
export class Index<S extends IDBValidKey, T> {
  /**
   * Name of the store that this index is associated with.
   */
  storeName: string;

  /**
   * Options to use for the index.
   */
  options: IndexOptions;

  constructor(
    s: Store<T>,
    public indexName: string,
    public keyPath: string | string[],
    options?: IndexOptions,
  ) {
    const defaultOptions = {
      multiEntry: false,
    };
    this.options = { ...defaultOptions, ...(options || {}) };
    this.storeName = s.name;
  }

  /**
   * We want to have the key type parameter in use somewhere,
   * because otherwise the compiler complains.  In iterIndex the
   * key type is pretty useful.
   */
  protected _dummyKey: S | undefined;
}

/**
 * Return a promise that resolves
 * to the taler wallet db.
 */
export function openDatabase(
  idbFactory: IDBFactory,
  databaseName: string,
  databaseVersion: number,
  onVersionChange: () => void,
  onUpgradeNeeded: (
    db: IDBDatabase,
    oldVersion: number,
    newVersion: number,
  ) => void,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = idbFactory.open(databaseName, databaseVersion);
    req.onerror = (e) => {
      console.log("taler database error", e);
      reject(new Error("database error"));
    };
    req.onsuccess = (e) => {
      req.result.onversionchange = (evt: IDBVersionChangeEvent) => {
        console.log(
          `handling live db version change from ${evt.oldVersion} to ${evt.newVersion}`,
        );
        req.result.close();
        onVersionChange();
      };
      resolve(req.result);
    };
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const newVersion = e.newVersion;
      if (!newVersion) {
        throw Error("upgrade needed, but new version unknown");
      }
      onUpgradeNeeded(db, e.oldVersion, newVersion);
      console.log(
        `DB: upgrade needed: oldVersion=${e.oldVersion}, newVersion=${e.newVersion}`,
      );
    };
  });
}

export class Database {
  constructor(private db: IDBDatabase) {}

  static deleteDatabase(idbFactory: IDBFactory, dbName: string): void {
    idbFactory.deleteDatabase(dbName);
  }

  async exportDatabase(): Promise<any> {
    const db = this.db;
    const dump = {
      name: db.name,
      stores: {} as { [s: string]: any },
      version: db.version,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(Array.from(db.objectStoreNames));
      tx.addEventListener("complete", () => {
        resolve(dump);
      });
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        const name = db.objectStoreNames[i];
        const storeDump = {} as { [s: string]: any };
        dump.stores[name] = storeDump;
        tx.objectStore(name)
          .openCursor()
          .addEventListener("success", (e: Event) => {
            const cursor = (e.target as any).result;
            if (cursor) {
              storeDump[cursor.key] = cursor.value;
              cursor.continue();
            }
          });
      }
    });
  }

  importDatabase(dump: any): Promise<void> {
    const db = this.db;
    console.log("importing db", dump);
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(Array.from(db.objectStoreNames), "readwrite");
      if (dump.stores) {
        for (const storeName in dump.stores) {
          const objects = [];
          const dumpStore = dump.stores[storeName];
          for (const key in dumpStore) {
            objects.push(dumpStore[key]);
          }
          console.log(`importing ${objects.length} records into ${storeName}`);
          const store = tx.objectStore(storeName);
          for (const obj of objects) {
            store.put(obj);
          }
        }
      }
      tx.addEventListener("complete", () => {
        resolve();
      });
    });
  }

  async get<T>(store: Store<T>, key: any): Promise<T | undefined> {
    const tx = this.db.transaction([store.name], "readonly");
    const req = tx.objectStore(store.name).get(key);
    const v = await requestToPromise(req);
    await transactionToPromise(tx);
    return v;
  }

  async getIndexed<S extends IDBValidKey, T>(
    index: Index<S, T>,
    key: any,
  ): Promise<T | undefined> {
    const tx = this.db.transaction([index.storeName], "readonly");
    const req = tx.objectStore(index.storeName).index(index.indexName).get(key);
    const v = await requestToPromise(req);
    await transactionToPromise(tx);
    return v;
  }

  async put<T>(store: Store<T>, value: T, key?: any): Promise<any> {
    const tx = this.db.transaction([store.name], "readwrite");
    const req = tx.objectStore(store.name).put(value, key);
    const v = await requestToPromise(req);
    await transactionToPromise(tx);
    return v;
  }

  async mutate<T>(
    store: Store<T>,
    key: any,
    f: (x: T) => T | undefined,
  ): Promise<void> {
    const tx = this.db.transaction([store.name], "readwrite");
    const req = tx.objectStore(store.name).openCursor(key);
    await applyMutation(req, f);
    await transactionToPromise(tx);
  }

  iter<T>(store: Store<T>): ResultStream<T> {
    const tx = this.db.transaction([store.name], "readonly");
    const req = tx.objectStore(store.name).openCursor();
    return new ResultStream<T>(req);
  }

  iterIndex<S extends IDBValidKey, T>(
    index: Index<S, T>,
    query?: any,
  ): ResultStream<T> {
    const tx = this.db.transaction([index.storeName], "readonly");
    const req = tx
      .objectStore(index.storeName)
      .index(index.indexName)
      .openCursor(query);
    return new ResultStream<T>(req);
  }

  async runWithReadTransaction<T>(
    stores: Store<any>[],
    f: (t: TransactionHandle) => Promise<T>,
  ): Promise<T> {
    return runWithTransaction<T>(this.db, stores, f, "readonly");
  }

  async runWithWriteTransaction<T>(
    stores: Store<any>[],
    f: (t: TransactionHandle) => Promise<T>,
  ): Promise<T> {
    return runWithTransaction<T>(this.db, stores, f, "readwrite");
  }
}
