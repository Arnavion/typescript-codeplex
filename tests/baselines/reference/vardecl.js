//// [vardecl.js]
var simpleVar;

var anotherVar;
var varWithSimpleType;
var varWithArrayType;

var varWithInitialValue = 30;

var withComplicatedValue = { x: 30, y: 70, desc: "position" };

var arrayVar = ['a', 'b'];

var complicatedArrayVar;
complicatedArrayVar.push({ x: 30, y: 'hello world' });

var n1;

var c;

var d;

var d3;

var d2;

var n2;
var n4;

var d4;

var m2;
(function (m2) {
    m2.a, m2.b2 = 10, m2.b;
    var m1;
    var a2, b22 = 10, b222;
    var m3;

    var C = (function () {
        function C(b) {
            this.b = b;
        }
        return C;
    })();

    var C2 = (function () {
        function C2(b) {
            this.b = b;
        }
        return C2;
    })();
    m2.C2 = C2;
    var m;

    var b23;

    m2.mE;

    m2.b2E;
})(m2 || (m2 = {}));

var a22, b22 = 10, c22 = 30;
var nn;

var normalVar;

var xl;
var x;
var z;

function foo(a2) {
    var a = 10;
}

for (var i = 0, j = 0; i < 10; i++) {
    j++;
}

for (var k = 0; k < 30; k++) {
    k++;
}
var b = 10;


////[vardecl.d.ts]
declare var simpleVar: any;
declare var anotherVar: any;
declare var varWithSimpleType: number;
declare var varWithArrayType: number[];
declare var varWithInitialValue: number;
declare var withComplicatedValue: {
    x: number;
    y: number;
    desc: string;
};
declare var arrayVar: string[];
declare var complicatedArrayVar: {
    x: number;
    y: string;
}[];
declare var n1: {
    [s: string]: number;
};
declare var c: {
    new?(): any;
};
declare var d: {
    foo?(): {
        x: number;
    };
};
declare var d3: {
    foo(): {
        x: number;
        y: number;
    };
};
declare var d2: {
    foo(): {
        x: number;
    };
};
declare var n2: () => void;
declare var n4: {
    (): void;
}[];
declare var d4: {
    foo(n: string, x: {
        x: number;
        y: number;
    }): {
        x: number;
        y: number;
    };
};
declare module m2 {
    var a: any, b2: number, b: any;
    class C2 {
        public b: any;
        constructor(b: any);
    }
    var mE: any;
    var d1E: any, d2E: any;
    var b2E: any;
    var v1E: any;
}
declare var a22: any, b22: number, c22: number;
declare var nn: any;
declare var normalVar: any;
declare var xl: any;
declare var x: any;
declare var z: any;
declare function foo(a2: any): void;
declare var b: number;
