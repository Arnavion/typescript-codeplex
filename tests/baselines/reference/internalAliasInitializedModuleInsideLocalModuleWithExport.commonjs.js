(function (a) {
    (function (b) {
        var c = (function () {
            function c() {
            }
            return c;
        })();
        b.c = c;
    })(a.b || (a.b = {}));
    var b = a.b;
})(exports.a || (exports.a = {}));
var a = exports.a;

(function (c) {
    var b = a.b;
    c.b = b;
    c.x = new b.c();
})(exports.c || (exports.c = {}));
var c = exports.c;


////[internalAliasInitializedModuleInsideLocalModuleWithExport.d.ts]
export declare module a.b {
    class c {
    }
}
export declare module c {
    import b = a.b;
    var x: a.b.c;
}
