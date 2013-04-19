/// <reference path='fourslash.ts'/>

////interface I {
////    x/*1*/1(a: number, callback: (x: 'hi') => number);
////}

////class C {
////    x/*2*/1(a: number, call/*3*/back: (x: 'hi') => number);
////    x/*4*/1(a: number, call/*5*/back: (x: string) => number) {
////        call/*6*/back('hi');
////        callback('bye');
////        var hm = "hm";
////        callback(hm);
////    }
////}

////var c: C;
////c.x/*7*/1(1, (x/*8*/x: 'hi') => { return 1; } );
////c.x1(1, (x/*9*/x: 'bye') => { return 1; } );
////c.x1(1, (x/*10*/x) => { return 1; } );

goTo.marker('1');
verify.quickInfoIs("(a: number, callback: (x: 'hi') => number): any");
goTo.marker('2');
verify.quickInfoIs("(a: number, callback: (x: 'hi') => number): any (+ 0 overload(s))");
goTo.marker('3');
verify.quickInfoIs("(x: 'hi') => number");
goTo.marker('4');
verify.quickInfoIs("(a: number, callback: (x: 'hi') => number): any (+ 0 overload(s))");
goTo.marker('5');
verify.quickInfoIs('(x: string) => number');
goTo.marker('6');
verify.quickInfoIs('(x: string): number');
goTo.marker('7');
verify.quickInfoIs("(a: number, callback: (x: 'hi') => number): any (+ 0 overload(s))");
goTo.marker('8');
verify.quickInfoIs("'hi'");
goTo.marker('9');
verify.quickInfoIs("'bye'");
goTo.marker('10');
verify.quickInfoIs("'hi'");