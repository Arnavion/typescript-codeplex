define(["require", "exports", "m4", "glo_m4", "fncOnly_m4", "private_m4", "m5", "m4"], function(require, exports, __m4__, __glo_m4__, __fncOnly_m4__, __private_m4__, __m5__, __multiImport_m4__) {
        var m4 = __m4__;

    exports.x4 = m4.x;
    exports.d4 = m4.d;
    exports.f4 = m4.foo();
    (function (m1) {
        m1.x2 = m4.x;
        m1.d2 = m4.d;
        m1.f2 = m4.foo();
        var x3 = m4.x;
        var d3 = m4.d;
        var f3 = m4.foo();
    })(exports.m1 || (exports.m1 = {}));
    var m1 = exports.m1;
        var glo_m4 = __glo_m4__;

    exports.useGlo_m4_x4 = glo_m4.x;
    exports.useGlo_m4_d4 = glo_m4.d;
    exports.useGlo_m4_f4 = glo_m4.foo();
        var fncOnly_m4 = __fncOnly_m4__;

    exports.useFncOnly_m4_f4 = fncOnly_m4.foo();
        var private_m4 = __private_m4__;

    (function (usePrivate_m4_m1) {
        var x3 = private_m4.x;
        var d3 = private_m4.d;
        var f3 = private_m4.foo();
    })(exports.usePrivate_m4_m1 || (exports.usePrivate_m4_m1 = {}));
    var usePrivate_m4_m1 = exports.usePrivate_m4_m1;
        var m5 = __m5__;

    exports.d = m5.foo2();
    var multiImport_m4 = __multiImport_m4__;

    exports.useMultiImport_m4_x4 = multiImport_m4.x;
    exports.useMultiImport_m4_d4 = multiImport_m4.d;
    exports.useMultiImport_m4_f4 = multiImport_m4.foo();
})
////[0.d.ts]
export module "m4" {
    export class d {
    }
    export var x: d;
    export function foo(): d;
}
import m4 = module ("m4");
export var x4: m4.d;
export var d4: new() => m4.d;
export var f4: m4.d;
export module m1 {
    export var x2: m4.d;
    export var d2: new() => m4.d;
    export var f2: m4.d;
}
export module "glo_m4" {
    export class d {
    }
    export var x: d;
    export function foo(): d;
}
import glo_m4 = module ("glo_m4");
export var useGlo_m4_x4: glo_m4.d;
export var useGlo_m4_d4: new() => glo_m4.d;
export var useGlo_m4_f4: glo_m4.d;
export module "fncOnly_m4" {
    export class d {
    }
    export var x: d;
    export function foo(): d;
}
import fncOnly_m4 = module ("fncOnly_m4");
export var useFncOnly_m4_f4: fncOnly_m4.d;
export module "private_m4" {
    export class d {
    }
    export var x: d;
    export function foo(): d;
}
export module usePrivate_m4_m1 {
}
export module "m5" {
    export function foo2(): m4.d;
}
export var d: m4.d;
export var useMultiImport_m4_x4: m4.d;
export var useMultiImport_m4_d4: new() => m4.d;
export var useMultiImport_m4_f4: m4.d;