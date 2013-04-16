/// <reference path='FourSlash.ts' />

//// module M {
////     export class A {
////		 constructor(a: string) {}
////         public m(n: number) {
////             return 0;
////         }
////         public n() {
////             return this.m(0);
////         }
////     }
////     export class B extends A { 
////     	constructor(a: string) {
////			super(a);
////		}
////		/*1*/ 
////	 }
////	 var a = new A("s");
////	 var b = new B("s");
//// }

verify.numberOfErrorsInCurrentFile(0);
goTo.marker('1');
edit.insert("public m(n: number) { return 0; }");
verify.numberOfErrorsInCurrentFile(0);