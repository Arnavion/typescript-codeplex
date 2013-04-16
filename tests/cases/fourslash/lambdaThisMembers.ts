/// <reference path='FourSlash.ts' />

//// class Foo {
////     a: number;
////     b() {
////         var x = () => {
////             this./**/;
////         }
////     }
//// }

goTo.marker();
verify.completionListContains("a");
verify.completionListContains("b");
verify.memberListCount(2);

