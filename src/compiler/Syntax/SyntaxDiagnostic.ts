///<reference path='Diagnostic.ts' />
///<reference path='..\Core\Errors.ts' />

class SyntaxDiagnostic extends Diagnostic {
    private _start: number;
    private _length: number;

    constructor(start: number, length: number, code: DiagnosticCode, args: any[]) {
        super(code, args);

        if (length < 0) {
            throw Errors.argumentOutOfRange("width");
        }

        this._start = start;
        this._length = length;
    }

    public toJSON(key) {
        var result: any = {};
        result._position = this._start;
        result._width = this._length;
        result._diagnosticCode = (<any>DiagnosticCode)._map[this.diagnosticCode()];

        var arguments = (<any>this)._arguments;
        if (arguments && arguments.length > 0) {
            result._arguments = arguments;
        }

        return result;
    }

    public start(): number {
        return this._start;
    }

    public length(): number {
        return this._length;
    }

    public static equals(diagnostic1: SyntaxDiagnostic, diagnostic2: SyntaxDiagnostic): bool {
        return diagnostic1._start === diagnostic2._start &&
               diagnostic1._length === diagnostic2._length &&
               Diagnostic.equals(diagnostic1, diagnostic2);
    }
}