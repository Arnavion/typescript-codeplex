var C = (function () {
    function C() {
        this.p1 = 0;
    }
    C.prototype.callback = function (cb) {
        cb();
    };
    C.prototype.doit = function () {
        var _this = this;
        this.callback(function () {
            _this.p1 + 1;
        });
    };
    return C;
})();
