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
    return ({
    });
};
var c3t5 = function (n) {
    return ({
    });
};
var c3t6 = function (n, s) {
    return ({
    });
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
    ({
    }), 
    ({
    })
];
var c3t11 = [
    function (n, s) {
        return s;
    }];
var c3t12 = {
    foo: ({
    })
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
    return ({
    });
};
var c7t2;
c7t2[0] = ({
    n: 1
});
var objc8 = ({
});
objc8.t1 = (function (s) {
    return s;
});
objc8.t2 = ({
    n: 1
});
objc8.t3 = [];
objc8.t4 = function () {
    return ({
    });
};
objc8.t5 = function (n) {
    return ({
    });
};
objc8.t6 = function (n, s) {
    return ({
    });
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
    ({
    }), 
    ({
    })
];
objc8.t11 = [
    function (n, s) {
        return s;
    }];
objc8.t12 = {
    foo: ({
    })
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
    return ({
    });
});
var c10t5 = function () {
    return function (n) {
        return ({
        });
    };
};
var C11t5 = (function () {
    function C11t5(f) {
    }
    return C11t5;
})();
;
var i = new C11t5(function (n) {
    return ({
    });
});
var c12t1 = (function (s) {
    return s;
});
var c12t2 = ({
    n: 1
});
var c12t3 = [];
var c12t4 = function () {
    return ({
    });
};
var c12t5 = function (n) {
    return ({
    });
};
var c12t6 = function (n, s) {
    return ({
    });
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
    ({
    }), 
    ({
    })
];
var c12t11 = [
    function (n, s) {
        return s;
    }];
var c12t12 = {
    foo: ({
    })
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
var x = {
};
//@ sourceMappingURL=0.js.map
////[0.js.map]
{"version":3,"file":"0.js","sources":["0.ts"],"names":["C1T5","C1T5.constructor","","C2T5","C2T5.foo","c3t1","c3t4","c3t5","c3t6","c3t7","c3t8","","f","C4T5","C4T5.constructor","C4T5.constructor.foo","C5T5","C5T5.foo","","t1","t4","t5","t6","t7","t8","","f","c9t5","","c10t5","","C11t5","C11t5.constructor","","","","","","","","","f","EF1","Point","add","add","onmousedown"],"mappings":"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"}
////[comments_ExternalModules_0.js]
//@ sourceMappingURL=comments_ExternalModules_0.js.map
////[comments_ExternalModules_1.js]
//@ sourceMappingURL=comments_ExternalModules_1.js.map
////[comments_MultiModule_MultiFile_0.js]
//@ sourceMappingURL=comments_MultiModule_MultiFile_0.js.map
////[comments_MultiModule_MultiFile_1.js]
//@ sourceMappingURL=comments_MultiModule_MultiFile_1.js.map