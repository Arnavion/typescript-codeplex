function simpleFunc(): string;
var simpleFuncVar: () => string;
function anotherFuncNoReturn(): void;
var anotherFuncNoReturnVar: () => void;
function withReturn(): string;
var withReturnVar: () => string;
function withParams(a: string): string;
var withparamsVar: (a: string) => string;
function withMultiParams(a: number, b, c: Object): number;
var withMultiParamsVar: (a: number, b: any, c: Object) => number;
function withOptionalParams(a?: string): void;
var withOptionalParamsVar: (a?: string) => void;
function withInitializedParams(a: string, b0, b?: number, c?: string): void;
var withInitializedParamsVar: (a: string, b0: any, b: number, c: string) => void;
function withOptionalInitializedParams(a: string, c?: string): void;
var withOptionalInitializedParamsVar: (a: string, c?: string) => void;
function withRestParams(a: string, ...myRestParameter: number[]): number[];
var withRestParamsVar: (a: string, ...myRestParameter: number[]) => number[];
function overload1(n: number): string;
function overload1(s: string): string;
var withOverloadSignature: {
    (n: number): string;
    (s: string): string;
};
function f(n: () => void): void;
module m2 {
    function foo(n: () => void): void;
}
var f2: () => string;