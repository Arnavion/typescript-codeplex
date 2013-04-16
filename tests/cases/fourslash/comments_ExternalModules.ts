/// <reference path='FourSlash.ts' />

// @Filename: file_0.ts
/////** Module comment*/
////export module m/*1*/1 {
////    /** b's comment*/
////    export var b: number;
////    /** foo's comment*/
////    function foo() {
////        return /*2*/b;
////    }
////    /** m2 comments*/
////    export module m2 {
////        /** class comment;*/
////        export class c {
////        };
////        /** i*/
////        export var i = new c();
////    }
////    /** exported function*/
////    export function fooExport() {
////        return f/*3q*/oo(/*3*/);
////    }
////}
/////*4*/m1./*5*/fooEx/*6q*/port(/*6*/);
////var my/*7*/var = new m1.m2./*8*/c();

// @Filename: file_1.ts
/////**This is on import declaration*/
////import ex/*9*/tMod = module("file_0");
/////*10*/extMod./*11*/m1./*12*/fooExp/*13q*/ort(/*13*/);
////var new/*14*/Var = new extMod.m1.m2./*15*/c();

goTo.file("file_0.ts");
goTo.marker('1');
verify.quickInfoIs("m1", "Module comment", "m1", "module");

goTo.marker('2');
verify.completionListContains("b", "number", "b's comment", "m1.b", "var");
verify.completionListContains("foo", "(): number", "foo's comment", "m1.foo", "function");

goTo.marker('3');
verify.currentSignatureHelpDocCommentIs("foo's comment");
goTo.marker('3q');
verify.quickInfoIs("(): number", "foo's comment", "m1.foo", "function");

goTo.marker('4');
verify.completionListContains("m1", "m1", "Module comment", "m1", "module");

goTo.marker('5');
verify.memberListContains("b", "number", "b's comment", "m1.b", "var");
verify.memberListContains("fooExport", "(): number", "exported function", "m1.fooExport", "function");
verify.memberListContains("m2", "m1.m2", "m2 comments", "m1.m2", "module");

goTo.marker('6');
verify.currentSignatureHelpDocCommentIs("exported function");
goTo.marker('6q');
verify.quickInfoIs("(): number", "exported function", "m1.fooExport", "function");

goTo.marker('7');
verify.quickInfoIs("m1.m2.c", "", "myvar", "var");

goTo.marker('8');
verify.memberListContains("c", undefined, "class comment;", "m1.m2.c", "class");
verify.memberListContains("i", "m1.m2.c", "i", "m1.m2.i", "var");

goTo.file("file_1.ts");
goTo.marker('9');
verify.quickInfoIs(undefined, "This is on import declaration", "extMod", "module");

goTo.marker('10');
verify.completionListContains("extMod", "extMod", "This is on import declaration", "extMod", "module");

goTo.marker('11');
verify.memberListContains("m1", "extMod.m1", "Module comment", "extMod.m1", "module");

goTo.marker('12');
verify.memberListContains("b", "number", "b's comment", "extMod.m1.b", "var");
verify.memberListContains("fooExport", "(): number", "exported function", "extMod.m1.fooExport", "function");
verify.memberListContains("m2", "extMod.m1.m2", "m2 comments", "extMod.m1.m2", "module");

goTo.marker('13');
verify.currentSignatureHelpDocCommentIs("exported function");
goTo.marker('13q');
verify.quickInfoIs("(): number", "exported function", "extMod.m1.fooExport", "function");

goTo.marker('14');
verify.quickInfoIs("extMod.m1.m2.c", "", "newVar", "var");

goTo.marker('15');
verify.memberListContains("c", undefined, "class comment;", "extMod.m1.m2.c", "class");
verify.memberListContains("i", "extMod.m1.m2.c", "i", "extMod.m1.m2.i", "var");
