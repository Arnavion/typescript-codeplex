/// <reference path='fourslash.ts' />

// @BaselineFile: bpSpan_classes.baseline
// @Filename: bpSpan_classes.ts
////module Foo.Bar {
////    "use strict";
////
////    class Greeter {
////        constructor(public greeting: string) {
////        }
////
////        greet() {
////            return "<h1>" + this.greeting + "</h1>";
////        }
////    }
////
////
////    function foo(greeting: string): Foo.Bar.Greeter {
////        return new Greeter(greeting);
////    }
////
////    var greeter = new Greeter("Hello, world!");
////    var str = greeter.greet();
////
////    function foo2(greeting: string, ...restGreetings /* more greeting */: string[]) {
////        var greeters = new Greeter[]; /* inline block comment */
////        greeters[0] = new Greeter(greeting);
////        for (var i = 0; i < restGreetings.length; i++) {
////            greeters.push(new Greeter(restGreetings[i]));
////        }
////
////        return greeters;
////    }
////
////    var b = foo2("Hello", "World", "!");
////    // This is simple signle line comment
////    for (var j = 0; j < b.length; j++) {
////        b[j].greet();
////    }
////}


verify.baselineCurrentFileBreakpointLocations();