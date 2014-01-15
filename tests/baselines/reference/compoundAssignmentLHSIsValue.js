var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
// expected error for all the LHS of compound assignments (arithmetic and addition)
var value;

// this
var C = (function () {
    function C() {
        this *= value;
        this += value;
    }
    C.prototype.foo = function () {
        this *= value;
        this += value;
    };
    C.sfoo = function () {
        this *= value;
        this += value;
    };
    return C;
})();

function foo() {
    this *= value;
    this += value;
}

this *= value;
this += value;

// identifiers: module, class, enum, function
var M;
(function (M) {
    M.a;
})(M || (M = {}));
M *= value;
M += value;

C *= value;
C += value;

var E;
(function (E) {
})(E || (E = {}));
E *= value;
E += value;

foo *= value;
foo += value;

// literals
null *= value;
null += value;
true *= value;
true += value;
false *= value;
false += value;
0 *= value;
0 += value;
'' *= value;
'' += value;
/d+/ *= value;
/d+/ += value;

 {
    a:
    0;
}
value;
 {
    a:
    0;
}
value;

// array literals
['', ''] *= value;
['', ''] += value;

// super
var Derived = (function (_super) {
    __extends(Derived, _super);
    function Derived() {
        _super.call(this);
        _super.prototype. *= value;
        _super.prototype. += value;
    }
    Derived.prototype.foo = function () {
        _super.prototype. *= value;
        _super.prototype. += value;
    };

    Derived.sfoo = function () {
        _super.prototype. *= value;
        _super.prototype. += value;
    };
    return Derived;
})(C);

// function expression
function bar1() {
}
value;
function bar2() {
}
value;
(function () {
});
value;
(function () {
});
value;

// function calls
foo() *= value;
foo() += value;

// parentheses, the containted expression is value
(this) *= value;
(this) += value;
(M) *= value;
(M) += value;
(C) *= value;
(C) += value;
(E) *= value;
(E) += value;
(foo) *= value;
(foo) += value;
(null) *= value;
(null) += value;
(true) *= value;
(true) += value;
(0) *= value;
(0) += value;
('') *= value;
('') += value;
(/d+/) *= value;
(/d+/) += value;
({}) *= value;
({}) += value;
([]) *= value;
([]) += value;
(function baz1() {
}) *= value;
(function baz2() {
}) += value;
(foo()) *= value;
(foo()) += value;
