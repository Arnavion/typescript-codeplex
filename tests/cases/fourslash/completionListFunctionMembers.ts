/// <reference path='fourslash.ts'/>

////function fnc1() {
////    var bar = 1;
////    function foob(){ }
////}
////
////fnc1./**/

goTo.marker();
verify.memberListContains('arguments', 'any');