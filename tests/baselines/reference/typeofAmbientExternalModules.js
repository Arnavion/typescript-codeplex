//// [typeofAmbientExternalModules_0.js]
//// [typeofAmbientExternalModules_1.js]
///<reference path='typeofAmbientExternalModules_0.ts'/>
var ext = require('external');
var exp = require('exportAssign');

var y1 = ext;
y1 = exp;
var y2 = exp;
y2 = ext;

