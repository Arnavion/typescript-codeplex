var m2;
(function (m2) {
    var a = 10;
    a++;
})(m2 || (m2 = {}));
var m3;
(function (m3) {
    var m4;
    (function (m4) {
        m4.x = 30;
    })(m4 || (m4 = {}));

    function foo() {
        return m4.x;
    }
    m3.foo = foo;
})(m3 || (m3 = {}));
//# sourceMappingURL=sourceMapValidationModule.js.map
