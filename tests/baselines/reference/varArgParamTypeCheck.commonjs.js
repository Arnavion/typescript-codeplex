function sequence() {
    var sequences = [];
    for (var _i = 0; _i < (arguments.length - 0); _i++) {
        sequences[_i] = arguments[_i + 0];
    }
}
function callback(clb) {
}
sequence(function bar() {
}, function foo() {
    var _this = this;
    callback(function () {
        _this();
    });
}, function baz() {
    var _this = this;
    callback(function () {
        _this();
    });
});