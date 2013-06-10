/// <reference path='fourslash.ts' />

////var /*b*/b: boolean;
////var /*b2*/b2: /*1*/bool/*2*/;
////var /*b3*/b3: /*3*/bool/*4*/;

// Only report error once
verify.errorExistsBetweenMarkers('1', '2');
verify.numberOfErrorsInCurrentFile(1);

// Check quick info
goTo.marker('b');
verify.quickInfoIs('boolean');
goTo.marker('b2');
verify.quickInfoIs('boolean');
goTo.marker('b3');
verify.quickInfoIs('boolean');

// Fixing the first error should lead to reporting of the second
goTo.marker('2');
edit.insert('ean');
verify.errorExistsBetweenMarkers('3', '4');
verify.numberOfErrorsInCurrentFile(1);

// Check quick info
goTo.marker('b');
verify.quickInfoIs('boolean');
goTo.marker('b2');
verify.quickInfoIs('boolean');
goTo.marker('b3');
verify.quickInfoIs('boolean');