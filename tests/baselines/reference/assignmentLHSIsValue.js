var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
// expected error for all the LHS of assignments
var value;

// this
var C = (function () {
    function C() {
        this = value;
    }
    C.prototype.foo = function () {
        this = value;
    };
    C.sfoo = function () {
        this = value;
    };
    return C;
})();

function foo() {
    this = value;
}

this = value;

// identifiers: module, class, enum, function
var M;
(function (M) {
    M.a;
})(M || (M = {}));
M = value;

C = value;

var E;
(function (E) {
})(E || (E = {}));
E = value;

foo = value;

// literals
null = value;
true = value;
false = value;
0 = value;
'' = value;
/d+/ = value;

 {
    a:
    0;
}
value;

// array literals
['', ''] = value;

// super
var Derived = (function (_super) {
    __extends(Derived, _super);
    function Derived() {
        _super.call(this);
        _super.prototype. = value;
    }
    Derived.prototype.foo = function () {
        _super.prototype. = value;
    };

    Derived.sfoo = function () {
        _super.prototype. = value;
    };
    return Derived;
})(C);

// function expression
function bar() {
}
value;
(function () {
});
value;

// function calls
foo() = value;

// parentheses, the containted expression is value
(this) = value;
(M) = value;
(C) = value;
(E) = value;
(foo) = value;
(null) = value;
(true) = value;
(0) = value;
('') = value;
(/d+/) = value;
({}) = value;
([]) = value;
(function baz() {
}) = value;
(foo()) = value;
