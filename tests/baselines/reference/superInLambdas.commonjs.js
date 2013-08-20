var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var User = (function () {
    function User() {
        this.name = "Bob";
    }
    User.prototype.sayHello = function () {
        //console.log("Hello, " + this.name);
    };
    return User;
})();

var RegisteredUser = (function (_super) {
    __extends(RegisteredUser, _super);
    function RegisteredUser() {
        var _this = this;
        _super.call(this);
        this.name = "Frank";

        // super call in a constructor
        _super.prototype.sayHello.call(this);

        // super call in a lambda in a constructor
        var x = function () {
            return _super.prototype.sayHello.call(_this);
        };
    }
    RegisteredUser.prototype.sayHello = function () {
        var _this = this;
        // super call in a method
        _super.prototype.sayHello.call(this);

        // super call in a lambda in a method
        var x = function () {
            return _super.prototype.sayHello.call(_this);
        };
    };
    return RegisteredUser;
})(User);
var RegisteredUser2 = (function (_super) {
    __extends(RegisteredUser2, _super);
    function RegisteredUser2() {
        var _this = this;
        _super.call(this);
        this.name = "Joe";

        // super call in a nested lambda in a constructor
        var x = function () {
            return function () {
                return function () {
                    return _super.prototype.sayHello.call(_this);
                };
            };
        };
    }
    RegisteredUser2.prototype.sayHello = function () {
        var _this = this;
        // super call in a nested lambda in a method
        var x = function () {
            return function () {
                return function () {
                    return _super.prototype.sayHello.call(_this);
                };
            };
        };
    };
    return RegisteredUser2;
})(User);

var RegisteredUser3 = (function (_super) {
    __extends(RegisteredUser3, _super);
    function RegisteredUser3() {
        var _this = this;
        _super.call(this);
        this.name = "Sam";

        // super property in a nested lambda in a constructor
        var superName = function () {
            return function () {
                return function () {
                    return _super.prototype.name;
                };
            };
        };
    }
    RegisteredUser3.prototype.sayHello = function () {
        var _this = this;
        // super property in a nested lambda in a method
        var superName = function () {
            return function () {
                return function () {
                    return _super.prototype.name;
                };
            };
        };
    };
    return RegisteredUser3;
})(User);

var RegisteredUser4 = (function (_super) {
    __extends(RegisteredUser4, _super);
    function RegisteredUser4() {
        _super.call(this);
        this.name = "Mark";

        // super in a nested lambda in a constructor
        var x = function () {
            return function () {
                return _super.prototype.;
            };
        };
    }
    RegisteredUser4.prototype.sayHello = function () {
        // super in a nested lambda in a method
        var x = function () {
            return function () {
                return _super.prototype.;
            };
        };
    };
    return RegisteredUser4;
})(User);
