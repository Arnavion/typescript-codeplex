/// <reference path='FourSlash.ts' />

////// Completion after invalid character
////module testModule {
////    export var foo = 1;
////}
////@ 
////testModule./**/

goTo.marker();
verify.memberListContains("foo");
