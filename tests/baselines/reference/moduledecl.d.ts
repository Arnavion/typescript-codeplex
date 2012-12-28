module a {
}
module b.a {
}
module c.a.b {
}
module mImport {
}
module m0 {
}
module m1 {
    function f1(): void;
    function f2(s: string);
    class c1 {
        public n;
        public n2: number;
        private n3;
        private n4;
        public a: () => string;
        private b;
        static s1;
        static s2;
        public d(): string;
        public e: {
            x: number;
            y: string;
        };
        constructor (n, n2: number, n3, n4: string);
        public f: c.a.b;
    }
    interface i1 {
        (): Object;
        [n: number]: c1;
    }
}
module m {
    module m2 {
        var b: number;
    }
    module m3 {
        var c: number;
    }
}
module m.m25.m5 {
    var c: number;
}
module m13.m4 {
    module m2.m3 {
        var c: number;
    }
    function f(): number;
}
module m4 {
    var b;
}
module m5 {
    var c;
}
module m43 {
    var b;
}
module m55 {
    var c;
}
module "m3" {
    var b: number;
}
module exportTests {
    class C1_public {
        private f2();
        public f3(): string;
    }
    class C3_public {
        private getC2_private();
        private setC2_private(arg);
        private c2;
        public getC1_public(): C1_public;
        public setC1_public(arg: C1_public): void;
        public c1 : C1_public;
    }
}
module mAmbient {
    class C {
        public myProp: number;
    }
    function foo(): C;
    var aVar: C;
    interface B {
        x: number;
        y: C;
    }
    enum e {
        x,
        y,
        z,
    }
    module m3 {
        class C {
            public myProp: number;
        }
        function foo(): C;
        var aVar: C;
        interface B {
            x: number;
            y: C;
        }
        enum e {
            x,
            y,
            z,
        }
    }
}
function foo(): mAmbient.C;
var cVar: mAmbient.C;
var aVar: mAmbient.C;
var bB: mAmbient.B;
var eVar: mAmbient.e;
function m3foo(): mAmbient.m3.C;
var m3cVar: mAmbient.m3.C;
var m3aVar: mAmbient.m3.C;
var m3bB: mAmbient.m3.B;
var m3eVar: mAmbient.m3.e;