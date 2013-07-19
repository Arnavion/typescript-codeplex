/// <reference path='fourslash.ts'/>


////module TypeModule1 {
////    export class C1 { }
////    export class C2 { }
////}
////var x: TypeModule1./*namedType*/
////module TypeModule2 {
////    export class Test3 {}
////}
////
////TypeModule1./*dotedExpression*/
////module TypeModule3 {
////    export class Test3 {}
////}


// Verify the memberlist of module when the following line has a keyword
goTo.marker('namedType');
verify.completionListContains('C1', 'TypeModule1.C1');
verify.completionListContains('C2', 'TypeModule1.C2');

goTo.marker('dotedExpression');
// bug 665591: Fourslash test doesn't get the completion list as we get manually
//verify.completionListContains('C1', 'TypeModule1.C1');
//verify.completionListContains('C2', 'TypeModule1.C2');