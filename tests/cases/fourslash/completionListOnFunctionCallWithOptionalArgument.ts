/// <reference path='FourSlash.ts' />

//// declare function Foo(arg1?: Function): { q: number };
//// Foo(function () { } )./**/;

goTo.marker();
verify.memberListContains('q');
