// Multiple indexers of the same type are an error
// BUG 787692
var C = (function () {
    function C() {
    }
    return C;
})();

var a;

var b = { 1: '', "2": '' };

var C2 = (function () {
    function C2() {
    }
    return C2;
})();
