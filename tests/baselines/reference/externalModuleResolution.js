//// [foo.js]
var M2;
(function (M2) {
    M2.Y = 1;
})(M2 || (M2 = {}));
module.exports = M2;
//// [consumer.js]
var x = require('./foo');
x.Y;
