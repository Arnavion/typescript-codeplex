﻿//﻿
// Copyright (c) Microsoft Corporation.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='typescriptServices.ts' />

module Services {
    export interface ISymbolTree {
        isField(sym: TypeScript.Symbol): boolean;
    }

    export interface ISymbolTreeHost {
        getScripts(): TypeScript.Script[];
    }

    export class SymbolTree implements ISymbolTree {
        private _allTypes: TypeScript.Symbol[];

        constructor (public host: ISymbolTreeHost) {
            this._allTypes = null;
        }

        public getAllTypes(): TypeScript.Symbol[] {
            if (this._allTypes === null) {
                var result = new SymbolSet();
                this._allTypes = result.getAll();
            }
            return this._allTypes;
        }

        public isField(sym: TypeScript.Symbol): boolean {
            return sym != null &&
                sym.kind() === TypeScript.SymbolKind.Field;
        }

        public isStatic(sym: TypeScript.Symbol): boolean {
            return sym != null && sym.isStatic();
        }
    }
}
