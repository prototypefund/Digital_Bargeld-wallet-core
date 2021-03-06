/*
 Copyright 2017 Jeremy Scheff

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 or implied. See the License for the specific language governing
 permissions and limitations under the License.
 */

import BridgeIDBCursor from "./BridgeIDBCursor";
import {
  CursorRange,
  CursorSource,
  BridgeIDBCursorDirection,
  Value,
} from "./util/types";

class BridgeIDBCursorWithValue extends BridgeIDBCursor {
  get value(): Value {
    return this._value;
  }

  protected get _isValueCursor(): boolean {
    return true;
  }

  constructor(
    source: CursorSource,
    objectStoreName: string,
    indexName: string | undefined,
    range: CursorRange,
    direction: BridgeIDBCursorDirection,
    request?: any,
  ) {
    super(source, objectStoreName, indexName, range, direction, request, false);
  }

  public toString() {
    return "[object IDBCursorWithValue]";
  }
}

export default BridgeIDBCursorWithValue;
