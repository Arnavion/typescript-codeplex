(function (a) {
    (function (weekend) {
        weekend[weekend["Friday"] = 0] = "Friday";
        weekend[weekend["Saturday"] = 1] = "Saturday";
        weekend[weekend["Sunday"] = 2] = "Sunday";
    })(a.weekend || (a.weekend = {}));
    var weekend = a.weekend;
})(exports.a || (exports.a = {}));
var a = exports.a;

var b = a.weekend;
exports.b = b;
exports.bVal = exports.b.Sunday;


////[0.d.ts]
export declare module a {
    enum weekend {
        Friday,
        Saturday,
        Sunday,
    }
}
export import b = a.weekend;
export declare var bVal: a.weekend;
