/// <reference path="fourslash.ts" />

////class Foo { static fun() { }; }

////Foo./**/;
/////*1*/var bar;

goTo.marker();
verify.memberListContains("fun");
verify.errorDoesNotExistBeyondMarker("1");