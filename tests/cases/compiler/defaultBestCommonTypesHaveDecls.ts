
var obj1: {};

obj1.length;
 
 

var obj2: Object;

obj2.length;
 
 

function concat<T>(x: T, y: T): T { return null; }

var result = concat(1, "");

var elementCount = result.length; // would like to get an error by now
