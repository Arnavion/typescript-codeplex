var bar = (function () {
    function bar() {
    }
    bar.prototype.f = function () {
        return '';
    };
    bar.prototype.g = function () {
        return { a: null, b: undefined, c: void 4 };
    };
    bar.prototype.h = function (x, y, z) {
        if (typeof x === "undefined") { x = 4; }
        if (typeof y === "undefined") { y = null; }
        if (typeof z === "undefined") { z = ''; }
        x++;
    };
    return bar;
})();
