
function Foo():Foo;
function Foo(s:string):Foo;
class Foo {    
    bar1() { /*WScript.Echo("bar1");*/ }
    constructor(s: string);
    constructor(x: any) {
        // WScript.Echo("Constructor function has executed");
    }
}

var f1 = new Foo("hey");


f1.bar1();
Foo();
Foo("s");
