<<<<<<< HEAD
/// <reference path="fourslash.ts" />

//// /*1*/function parseInt(s/*2*/:string):number;

goTo.marker('2');
edit.deleteAtCaret(':string'.length);
goTo.marker('1');
edit.insert('declare ');
=======
/// <reference path="fourslash.ts" />
//// /*1*/function parseInt(s/*2*/:string):number;
// Bug 713956
//goTo.marker('2');
//edit.deleteAtCaret(':string'.length);
//goTo.marker('1');
//edit.insert('declare ');
 
>>>>>>> release-0.9.0
