declare export module "m4" {
    export class d {
    };
    var x : d;
    export function foo(): d;
}

export import m4 = module("m4");
export var x4 = m4.x;
export var d4 = m4.d;
export var f4 = m4.foo();

export module m1 {
    declare export module "m2" {
        export class d {
        };
        var x: d;
        export function foo(): d;
    }
    export import m2 = module("m2");
    export import m3 = module("m4");

    export var x2 = m2.x;
    export var d2 = m2.d;
    export var f2 = m2.foo();

    export var x3 = m3.x;
    export var d3 = m3.d;
    export var f3 = m3.foo();
}

export var x2 = m1.m2.x;
export var d2 = m1.m2.d;
export var f2 = m1.m2.foo();

export var x3 = m1.m3.x;
export var d3 = m1.m3.d;
export var f3 = m1.m3.foo();

export module m5 {
    export var x2 = m1.m2.x;
    export var d2 = m1.m2.d;
    export var f2 = m1.m2.foo();

    export var x3 = m1.m3.x;
    export var d3 = m1.m3.d;
    export var f3 = m1.m3.foo();
}

