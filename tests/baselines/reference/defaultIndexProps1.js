var Foo = (function () {
    function Foo() {
        this.v = "Yo";
    }
    return Foo;
})();

var f = new Foo();

var q = f["v"];

var o = { v: "Yo2" };

var q2 = o["v"];
