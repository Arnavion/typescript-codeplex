var C1T5 = (function () {
    function C1T5() {
        this.foo = function (i) {
            return i;
        };
    }
    return C1T5;
})();
var C2T5;
(function (C2T5) {
    C2T5.foo = function (i) {
        return i;
    };
})(C2T5 || (C2T5 = {}));
var c3t1 = (function (s) {
    return s;
});
var c3t2 = ({
    n: 1
});
var c3t3 = [];
var c3t4 = function () {
    return ({});
};
var c3t5 = function (n) {
    return ({});
};
var c3t6 = function (n, s) {
    return ({});
};
var c3t7 = function (n) {
    return n;
};
var c3t8 = function (n) {
    return n;
};
var c3t9 = [
    [], 
    []
];
var c3t10 = [
    ({}), 
    ({})
];
var c3t11 = [
    function (n, s) {
        return s;
    }];
var c3t12 = {
    foo: ({})
};
var c3t13 = ({
    f: function (i, s) {
        return s;
    }
});
var c3t14 = ({
    a: []
});
var C4T5 = (function () {
    function C4T5() {
        this.foo = function (i, s) {
            return s;
        };
    }
    return C4T5;
})();
var C5T5;
(function (C5T5) {
    C5T5.foo;
    C5T5.foo = function (i, s) {
        return s;
    };
})(C5T5 || (C5T5 = {}));
var c6t5;
c6t5 = function (n) {
    return ({});
};
var c7t2;
c7t2[0] = ({
    n: 1
});
var objc8 = ({});
objc8.t1 = (function (s) {
    return s;
});
objc8.t2 = ({
    n: 1
});
objc8.t3 = [];
objc8.t4 = function () {
    return ({});
};
objc8.t5 = function (n) {
    return ({});
};
objc8.t6 = function (n, s) {
    return ({});
};
objc8.t7 = function (n) {
    return n;
};
objc8.t8 = function (n) {
    return n;
};
objc8.t9 = [
    [], 
    []
];
objc8.t10 = [
    ({}), 
    ({})
];
objc8.t11 = [
    function (n, s) {
        return s;
    }];
objc8.t12 = {
    foo: ({})
};
objc8.t13 = ({
    f: function (i, s) {
        return s;
    }
});
objc8.t14 = ({
    a: []
});
function c9t5(f) {
}
;
c9t5(function (n) {
    return ({});
});
var c10t5 = function () {
    return function (n) {
        return ({});
    };
};
var C11t5 = (function () {
    function C11t5(f) {
    }
    return C11t5;
})();
;
var i = new C11t5(function (n) {
    return ({});
});
var c12t1 = (function (s) {
    return s;
});
var c12t2 = ({
    n: 1
});
var c12t3 = [];
var c12t4 = function () {
    return ({});
};
var c12t5 = function (n) {
    return ({});
};
var c12t6 = function (n, s) {
    return ({});
};
var c12t7 = function (n) {
    return n;
};
var c12t8 = function (n) {
    return n;
};
var c12t9 = [
    [], 
    []
];
var c12t10 = [
    ({}), 
    ({})
];
var c12t11 = [
    function (n, s) {
        return s;
    }];
var c12t12 = {
    foo: ({})
};
var c12t13 = ({
    f: function (i, s) {
        return s;
    }
});
var c12t14 = ({
    a: []
});
function EF1(a, b) {
    return a + b;
}
var efv = EF1(1, 2);

function Point(x, y) {
    this.x = x;
    this.y = y;
    return this;
}
Point.origin = new Point(0, 0);
Point.prototype.add = function (dx, dy) {
    return new Point(this.x + dx, this.y + dy);
};
Point.prototype = {
    x: 0,
    y: 0,
    add: function (dx, dy) {
        return new Point(this.x + dx, this.y + dy);
    }
};
window.onmousedown = function (ev) {
    ev.bubbles;
};
var x = {};
//@ sourceMappingURL=0.js.map
////[0.js.map]
{"version":3,"file":"0.js","sources":["0.ts"],"names":["C1T5","C1T5.constructor","","C2T5","C2T5.foo","","c3t4","c3t5","c3t6","c3t7","c3t8","","f","C4T5","C4T5.constructor","C4T5.constructor.foo","C5T5","C5T5.foo","","","t4","t5","t6","t7","t8","","f","c9t5","","c10t5","","C11t5","C11t5.constructor","","","","","","","","","f","EF1","Point","add","add","onmousedown"],"mappings":"AAaA;IAAAA;QACIC,KAAAA,GAAGA,GAAqCA,UAASA,CAACA;YAC9CC,OAAOA,CAACA,CAACA;QACbA,CAACA,CAAAD;;AACJD,IAADA;AAACA,CAAAA,IAAA;AAGD,IAAO,IAAI;AAIV,CAJD,UAAO,IAAI;AACPG,IAAWA,KAAAA,GAAGA,GAAqCA,UAASA,CAACA;QACzDC,OAAOA,CAACA,CAACA;IACbA,CAACA;AAAAD,CACJA,uBAAA;AAGD,IAAI,IAAI,IAA0B,UAAU,CAAC;IAAIE,OAAOA,CAACA,CAAAA;AAACA,CAACA,CAAC;AAAC,IACzD,IAAI,GAAG,CAAM;IACb,CAAC,EAAE,CAAC;CACP,CAAC;AAAA,IACE,IAAI,GAAa,EAAE;AAAC,IACpB,IAAI,GAAe;IAAaC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IACpD,IAAI,GAAwB,UAAS,CAAC;IAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IAC9D,IAAI,GAAmC,UAAS,CAAC,EAAE,CAAC;IAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IAC5E,IAAI,GAGJ,UAAS,CAAC;IAAIC,OAAOA,CAACA,CAACA;AAACA,CAACA;AAAC,IAE1B,IAAI,GAAqC,UAAS,CAAC;IAAIC,OAAOA,CAACA,CAACA;AAACA,CAACA;AAAC,IACnE,IAAI,GAAe;IAAC,EAAE;IAAC,EAAE;CAAC;AAAC,IAC3B,KAAK,GAAW;IAAC,CAAM,EAAG,CAAC;IAAC,CAAM,EAAG,CAAC;CAAC;AAAC,IACxC,KAAK,GAAwC;IAAC,UAAS,CAAC,EAAE,CAAC;QAAIC,OAAOA,CAACA,CAACA;IAACA,CAACA,CAAC;AAAC,IAC5E,KAAK,GAAS;IACd,GAAG,EAAE,CAAM,EAAG,CAAC;CAClB;AAAA,IACG,KAAK,GAAG,CAAM;IACd,CAAC,EAAE,UAAS,CAAC,EAAE,CAAC;QAAIC,OAAOA,CAACA,CAACA;IAACA,CAACA;CAClC,CAAC;AAAA,IACE,KAAK,GAAG,CAAM;IACd,CAAC,EAAE,EAAE;CACR,CAAC;AAAA;IAKEC,SAFEA,IAAIA;QAGFC,IAAIA,CAACA,GAAGA,GAAGA,UAASA,CAACA,EAAEA,CAACA;YACpBC,OAAOA,CAACA,CAACA;QACbA,CAACA;AAAAD,IACLA,CAACA;IACLD;AAACA,CAAAA,IAAA;AAGD,IAAO,IAAI;AAKV,CALD,UAAO,IAAI;AACPG,IAAWA,KAAAA,GAAGA;AAAmCA,IACjDA,QAAGA,GAAGA,UAASA,CAACA,EAAEA,CAACA;QACfC,OAAOA,CAACA,CAACA;IACbA,CAACA;AAAAD,CACJA,uBAAA;AAGD,IAAI,IAAI;AAAsB,IAC1B,GAAG,UAA8B,CAAC;IAAIE,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IAG1D,IAAI;AAAS,IACb,CAAC,CAAC,CAAC,GAAG,CAAM;IAAE,CAAC,EAAE,CAAC;CAAC,CAAC;AAAC,IAuBrB,KAAK,GAkBL,CAAc,EAAG,CAAC;AAAC,KAElB,CAAC,EAAE,IAAG,UAAU,CAAC;IAAIC,OAAOA,CAACA,CAAAA;AAACA,CAACA,CAAC;AAAC,KACjC,CAAC,EAAE,GAAG,CAAM;IACb,CAAC,EAAE,CAAC;CACP,CAAC;AAAC,KACE,CAAC,EAAE,GAAG,EAAE;AAAC,KACT,CAAC,EAAE,GAAG;IAAaC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,KACvC,CAAC,EAAE,GAAG,UAAS,CAAC;IAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,KACxC,CAAC,EAAE,GAAG,UAAS,CAAC,EAAE,CAAC;IAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,KAC3C,CAAC,EAAE,GAAG,UAAS,CAAS;IAAIC,OAAOA,CAACA,CAAAA;AAACA,CAACA;AAAC,KAEvC,CAAC,EAAE,GAAG,UAAS,CAAC;IAAIC,OAAOA,CAACA,CAACA;AAACA,CAACA;AAAC,KAChC,CAAC,EAAE,GAAG;IAAC,EAAE;IAAC,EAAE;CAAC;AAAC,KACd,CAAC,GAAG,GAAG;IAAC,CAAM,EAAG,CAAC;IAAC,CAAM,EAAG,CAAC;CAAC;AAAC,KAC/B,CAAC,GAAG,GAAG;IAAC,UAAS,CAAC,EAAE,CAAC;QAAIC,OAAOA,CAACA,CAACA;IAACA,CAACA,CAAC;AAAC,KACtC,CAAC,GAAG,GAAG;IACR,GAAG,EAAE,CAAM,EAAG,CAAC;CAClB;AAAA,KACI,CAAC,GAAG,GAAG,CAAM;IACd,CAAC,EAAE,UAAS,CAAC,EAAE,CAAC;QAAIC,OAAOA,CAACA,CAACA;IAACA,CAACA;CAClC,CAAC;AAAA,KACG,CAAC,GAAG,GAAG,CAAM;IACd,CAAC,EAAE,EAAE;CACR,CAAC;AAAA,SAEO,IAAI,CAAC,CAAsB;AAAGC,CAACA;AAAA,CAAC;AACzC,IAAI,CAAC,UAAS,CAAC;IACXC,OAAOA,CAAMA,EAAGA,CAACA,CAACA;AACtBA,CAACA,CAAA;AAAE,IAGC,KAAK,GAA8B;IAAaC,OAAOA,UAASA,CAACA;QAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;IAACA,CAACA,CAAAD;AAACA,CAACA;AAAC;IAGjFE,SAARA,KAAKA,CAAeA,CAAsBA;IAAIC,CAACA;IAACD;AAACA,CAAAA,IAAA;AAAA,CAAC;AACxD,IAAI,CAAC,GAAG,IAAI,KAAK,CAAC,UAAS,CAAC;IAAIE,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA,CAAA;AAAE,IAGjD,KAAK,GAAG,CAAwB,UAAU,CAAC;IAAIC,OAAOA,CAACA,CAAAA;AAACA,CAACA,CAAC;AAAC,IAC3D,KAAK,GAAG,CAAO;IACf,CAAC,EAAE,CAAC;CACP,CAAC;AAAC,IACC,KAAK,GAAG,EAAa;AAAC,IACtB,KAAK,GAAG;IAA0BC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IACtD,KAAK,GAAG,UAA+B,CAAC;IAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IAChE,KAAK,GAAG,UAA0C,CAAC,EAAE,CAAC;IAAIC,OAAOA,CAAMA,EAAGA,CAACA,CAAAA;AAACA,CAACA;AAAC,IAC9E,KAAK,GAAG,UAGA,CAAQ;IAAIC,OAAOA,CAACA,CAAAA;AAACA,CAACA;AAAC,IAE/B,KAAK,GAAG,UAA4C,CAAC;IAAIC,OAAOA,CAACA,CAACA;AAACA,CAACA;AAAC,IACrE,KAAK,GAAG;IAAc,EAAE;IAAC,EAAE;CAAC;AAAC,IAC7B,MAAM,GAAG;IAAU,CAAM,EAAG,CAAC;IAAC,CAAM,EAAG,CAAC;CAAC;AAAC,IAC1C,MAAM,GAAG;IAAuC,UAAS,CAAC,EAAE,CAAC;QAAIC,OAAOA,CAACA,CAACA;IAACA,CAACA,CAAC;AAAC,IAC9E,MAAM,GAAG;IACT,GAAG,EAAE,CAAM,EAAG,CAAC;CAClB;AAAA,IACG,MAAM,GAAG,CAAO;IAChB,CAAC,EAAE,UAAS,CAAC,EAAE,CAAC;QAAIC,OAAOA,CAACA,CAACA;IAACA,CAACA;CAClC,CAAC;AAAA,IACE,MAAM,GAAG,CAAO;IAChB,CAAC,EAAE,EAAE;CACR,CAAC;AAAA,SAOO,GAAG,CAAC,CAAC,EAAC,CAAC;IAAIC,OAAOA,CAACA,GAACA,CAACA,CAACA;AAACA,CAACA;AAEjC,IAAI,GAAG,GAAG,GAAG,CAAC,CAAC,EAAC,CAAC,CAAA;AAAE;AAcnB,SAAS,KAAK,CAAC,CAAC,EAAE,CAAC;IACfC,IAAIA,CAACA,CAACA,GAAGA,CAACA;AAACA,IACXA,IAAIA,CAACA,CAACA,GAAGA,CAACA;AAACA,IAEXA,OAAOA,IAAIA,CAACA;AAChBA,CAACA;AAED,KAAK,CAAC,MAAM,GAAG,IAAI,KAAK,CAAC,CAAC,EAAE,CAAC,CAAA;AAAE,KAE1B,CAAC,SAAS,CAAC,GAAG,GAAG,UAAS,EAAE,EAAE,EAAE;IACjCC,OAAOA,IAAIA,KAAKA,CAACA,IAAIA,CAACA,CAACA,GAAGA,EAAEA,EAAEA,IAAIA,CAACA,CAACA,GAAGA,EAAEA,CAAAA,CAAEA;AAC/CA,CAACA;AAAC,KAEG,CAAC,SAAS,GAAG;IACd,CAAC,EAAE,CAAC;IACJ,CAAC,EAAE,CAAC;IACJ,GAAG,EAAE,UAAS,EAAE,EAAE,EAAE;QAChBC,OAAOA,IAAIA,KAAKA,CAACA,IAAIA,CAACA,CAACA,GAAGA,EAAEA,EAAEA,IAAIA,CAACA,CAACA,GAAGA,EAAEA,CAAAA,CAAEA;IAC/CA,CAACA;CACJ;AAAC,MAGI,CAAC,WAAW,GAAG,UAAS,EAAE;IAC5BC,EAAEA,CAACA,OAAOA;AAACA,CACdA;AAAA,IAIG,CAAC,GAAM,EAAG;AAAC"}
////[comments_ExternalModules_0.js]
//@ sourceMappingURL=comments_ExternalModules_0.js.map
////[comments_ExternalModules_0.js.map]
{"version":3,"file":"comments_ExternalModules_0.js","sources":["comments_ExternalModules_0.ts"],"names":[],"mappings":""}
////[comments_ExternalModules_1.js]
//@ sourceMappingURL=comments_ExternalModules_1.js.map
////[comments_ExternalModules_1.js.map]
{"version":3,"file":"comments_ExternalModules_1.js","sources":["comments_ExternalModules_1.ts"],"names":[],"mappings":""}
////[comments_MultiModule_MultiFile_0.js]
//@ sourceMappingURL=comments_MultiModule_MultiFile_0.js.map
////[comments_MultiModule_MultiFile_0.js.map]
{"version":3,"file":"comments_MultiModule_MultiFile_0.js","sources":["comments_MultiModule_MultiFile_0.ts"],"names":[],"mappings":""}
////[comments_MultiModule_MultiFile_1.js]
//@ sourceMappingURL=comments_MultiModule_MultiFile_1.js.map
////[comments_MultiModule_MultiFile_1.js.map]
{"version":3,"file":"comments_MultiModule_MultiFile_1.js","sources":["comments_MultiModule_MultiFile_1.ts"],"names":[],"mappings":""}