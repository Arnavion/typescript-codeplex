/// <reference path="fourslash.ts"/>

////class Foo extends /*1*/Bar/*2*/ { }

verify.errorExistsBetweenMarkers("1", "2");

// currentlly getting duplicate errors
verify.numberOfErrorsInCurrentFile(3);
//verify.numberOfErrorsInCurrentFile(1);
