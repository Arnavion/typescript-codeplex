// bug 702256: retyper: Full/Pull type checker disagreement on array.concat
/// <reference path="../fourslash.ts" />

//// var a = [];
//// a.concat("hello"/*1*/);
//// 
//// a.concat('Hello');
//// 
//// var b = new Array();
//// b.concat('hello');
//// 

edit.disableFormatting();

goTo.marker(1);

edit.insert(", 'world'");
//diagnostics.validateTypesAtPositions(78);
