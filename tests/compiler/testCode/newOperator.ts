﻿interface ifc { }
// BUG 12735: Attempting to 'new' an interface yields poor error
var i = new ifc();

// Parens are optional
var x = new Date;
var y = new Date();

// Target is not a class or var, good error
var t1 = new 53();
var t2 = new ''();
new string;

// Use in LHS of expression?
(new Date()).toString();

// Various spacing
var t3 = new string[]( );
var t4 =
new
string
[
    ]
    (
        );

// Unresolved symbol
var f = new q();

// not legal
var t5 = new new Date;

// Can be an expression
new String;

