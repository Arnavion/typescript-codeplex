var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
}
function f1() {
    var a = {
        x: 1,
        y: 2
    };
    a = {
    };
    a = {
        x: 1
    };
    a = {
        x: 1,
        y: 2,
        z: 3
    };
    a = {
        x: 1,
        z: 3
    };
}
var Animal = (function () {
    function Animal() { }
    return Animal;
})();
var Giraffe = (function (_super) {
    __extends(Giraffe, _super);
    function Giraffe() {
        _super.apply(this, arguments);

    }
    return Giraffe;
})(Animal);
function f2() {
    var a = new Animal();
    var g = new Giraffe();
    var aa = [
        a, 
        a, 
        a
    ];
    var gg = [
        g, 
        g, 
        g
    ];
    aa = gg;
    gg = aa;
    var xa = {
        f1: 5,
        f2: aa
    };
    var xb = {
        f1: 5,
        f2: gg
    };
    xa = xb;
    xb = xa;
}
function f4() {
    var _any = 0;
    var i = 5;
    i = null;
    i = undefined;
    var a = {
        x: 1,
        y: 1
    };
    a = {
        x: 1,
        y: null
    };
    a = {
        x: 1,
        y: undefined
    };
    a = {
        x: 1,
        y: _any
    };
    a = {
        x: 1,
        y: _any,
        z: 1
    };
    a = {
        x: 1
    };
    var mf = function m(n) {
        return false;
    };
    var zf = function z(n) {
        return true;
    };
    mf = zf;
    mf(_any);
    zf(_any);
}