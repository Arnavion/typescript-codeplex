var C = (function () {
    function C() {
        this[1] = '';
        this["2"] = '';
    }
    return C;
})();

var c;
var r1 = c['1'];
var r2 = c['2'];
var r3 = c['3'];
var r4 = c[1];
var r5 = c[2];
var r6 = c[3];

var i;
var r1 = i['1'];
var r2 = i['2'];
var r3 = i['3'];
var r4 = i[1];
var r5 = i[2];
var r6 = i[3];

var a;

var r1 = a['1'];
var r2 = a['2'];
var r3 = a['3'];
var r4 = a[1];
var r5 = a[2];
var r6 = a[3];

var b = { 1: '', "2": '' };

// BUG 824470
var r1 = b['1'];
var r2 = b['2'];
var r3 = b['3'];
var r4 = b[1];
var r5 = b[2];
var r6 = b[3];
