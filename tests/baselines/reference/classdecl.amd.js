var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var a = (function () {
    function a(ns) {
    }
    a.prototype.pgF = function () {
    };
    Object.defineProperty(a.prototype, "d", {
        get: function () {
            return 30;
        },
        set: function () {
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(a, "p2", {
        get: function () {
            return {
                x: 30,
                y: 40
            };
        },
        enumerable: true,
        configurable: true
    });
    a.d2 = function d2() {
    };
    Object.defineProperty(a, "p3", {
        get: function () {
            return "string";
        },
        enumerable: true,
        configurable: true
    });
    a.prototype.foo = function (ns) {
        return ns.toString();
    };
    return a;
})();
var b = (function (_super) {
    __extends(b, _super);
    function b() {
        _super.apply(this, arguments);

    }
    return b;
})(a);
var m1;
(function (m1) {
    var b = (function () {
        function b() { }
        return b;
    })();
    m1.b = b;    
    var d = (function () {
        function d() { }
        return d;
    })();    
})(m1 || (m1 = {}));
var m2;
(function (m2) {
    (function (m3) {
        var c = (function (_super) {
            __extends(c, _super);
            function c() {
                _super.apply(this, arguments);

            }
            return c;
        })(b);
        m3.c = c;        
        var ib2 = (function () {
            function ib2() { }
            return ib2;
        })();
        m3.ib2 = ib2;        
    })(m2.m3 || (m2.m3 = {}));
    var m3 = m2.m3;
})(m2 || (m2 = {}));
var c = (function (_super) {
    __extends(c, _super);
    function c() {
        _super.apply(this, arguments);

    }
    return c;
})(m1.b);
var ib2 = (function () {
    function ib2() { }
    return ib2;
})();

var d = (function () {
    function d() { }
    d.prototype.foo = function (ns) {
        return ns.toString();
    };
    return d;
})();
var e = (function () {
    function e() { }
    e.prototype.foo = function (ns) {
        return ns.toString();
    };
    return e;
})();
////[0.d.ts]
class a {
    constructor(n: number);
    constructor(s: string);
    public pgF(): void;
    public pv;
    public d : number;
    static p2 : {
        x: number;
        y: number;
    };
    static d2();
    static p3;
    private pv3;
    private foo(n);
}
class b extends a {
}
module m1 {
    export class b {
    }
    export interface ib {
    }
}
module m2.m3 {
    export class c extends b {
    }
    export class ib2 implements m1.ib {
    }
}
class c extends m1.b {
}
class ib2 implements m1.ib {
}
class aAmbient {
    constructor(n: number);
    constructor(s: string);
    public pgF(): void;
    public pv;
    public d: number;
    static p2: {
        x: number;
        y: number;
    };
    static d2();
    static p3;
    private pv3;
    private foo(s);
}
class d {
    private foo(n);
}
class e {
    private foo(s);
}