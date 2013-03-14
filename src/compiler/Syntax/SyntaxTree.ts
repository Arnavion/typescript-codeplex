///<reference path='SyntaxNodes.generated.ts' />
///<reference path='SyntaxDiagnostic.ts' />
///<reference path='..\Text\LineMap.ts' />

module TypeScript {
    export class SyntaxTree {
        private _sourceUnit: SourceUnitSyntax;
        private _diagnostics: SyntaxDiagnostic[];
        private _lineMap: ILineMap;

        constructor(sourceUnit: SourceUnitSyntax,
            diagnostics: SyntaxDiagnostic[],
            lineMap: ILineMap) {
            this._sourceUnit = sourceUnit;
            this._diagnostics = diagnostics;
            this._lineMap = lineMap;
        }

        public toJSON(key) {
            var result: any = {};

            if (this._diagnostics.length > 0) {
                result._diagnostics = this._diagnostics;
            }

            result._sourceUnit = this._sourceUnit;
            result._lineMap = this._lineMap;

            return result;
        }

        public sourceUnit(): SourceUnitSyntax {
            return this._sourceUnit;
        }

        public diagnostics(): SyntaxDiagnostic[] {
            return this._diagnostics;
        }

        public lineMap(): ILineMap {
            return this._lineMap;
        }

        public structuralEquals(tree: SyntaxTree): bool {
            return ArrayUtilities.sequenceEquals(this.diagnostics(), tree.diagnostics(), SyntaxDiagnostic.equals) &&
                this.sourceUnit().structuralEquals(tree.sourceUnit());
        }
    }
}