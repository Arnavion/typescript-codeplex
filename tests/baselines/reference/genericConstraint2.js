function compare(x, y) {
    if (x == null)
        return y == null ? 0 : -1;
    if (y == null)
        return 1;
    return x.comparer(y);
}

var ComparableString = (function () {
    function ComparableString(currentValue) {
        this.currentValue = currentValue;
    }
    ComparableString.prototype.localeCompare = function (other) {
        return 0;
    };
    return ComparableString;
})();

var a = new ComparableString("a");
var b = new ComparableString("b");
var c = compare(a, b);
