var class1 = (function () {
    function class1() {
    }
    Object.defineProperty(class1.prototype, "a", {
        get: function () {
            var x2 = {
                doStuff: function (callback) {
                    return function () {
                        var _this = 2;
                        return callback(_this);
                    };
                }
            };

            return 10;
        },
        set: function (val) {
            var x2 = {
                doStuff: function (callback) {
                    return function () {
                        var _this = 2;
                        return callback(_this);
                    };
                }
            };
        },
        enumerable: true,
        configurable: true
    });
    return class1;
})();

var class2 = (function () {
    function class2() {
    }
    Object.defineProperty(class2.prototype, "a", {
        get: function () {
            var _this = 2;
            var x2 = {
                doStuff: function (callback) {
                    return function () {
                        return callback(_this);
                    };
                }
            };

            return 10;
        },
        set: function (val) {
            var _this = 2;
            var x2 = {
                doStuff: function (callback) {
                    return function () {
                        return callback(_this);
                    };
                }
            };
        },
        enumerable: true,
        configurable: true
    });
    return class2;
})();