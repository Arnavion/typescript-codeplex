/// <reference path='FourSlash.ts' />

////module m { export class c { } };
////function x(arg: m.c) { return arg; }
////x(/**/

goTo.marker();
verify.currentSignatureHelpReturnTypeIs('m.c');
