// Module
var Shapes;
(function (Shapes) {
    // Class
    var Point = (function () {
        // Constructor
        function Point(x, y) {
            this.x = x;
            this.y = y;
        }
        Point.prototype.getDist = // Instance member
        function () {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        };
        Point.origin = new Point(0, 0);
        return Point;
    })();
    Shapes.Point = Point;    
    // Variable comment after class
    var a = 10;
    function foo() {
    }
    Shapes.foo = foo;
    /**  comment after function
    * this is another comment
    */
    var b = 10;
})(Shapes || (Shapes = {}));
/** Local Variable */
var p = new Shapes.Point(3, 4);
var dist = p.getDist();
//@ sourceMappingURL=0.js.map
////[0.js.map]
{"version":3,"file":"0.js","sources":["0.ts"],"names":["Shapes","Shapes.Point","Shapes.Point.constructor","Shapes.Point.getDist","Shapes.foo"],"mappings":"AAMA,SAAS;AACT,IAAO,MAAM;AAyBb,CAzBA,UAAO,MAAM;IAETA,QAAQA;IACRA;QAEIC,cADcA;QACdA,SAFSA,KAAKA,CAEFA,CAAgBA,EAAEA,CAAgBA;YAAlCC,MAAQA,GAADA,CAACA;AAAQA,YAAEA,MAAQA,GAADA,CAACA;AAAQA,SACtDD;QAEQA,0BADAA,kBAAkBA;QAClBA;YAAYE,OAAOA,IAAIA,CAACA,IAAIA,CAACA,IAAIA,CAACA,CAACA,GAAGA,IAAIA,CAACA,CAACA,GAAGA,IAAIA,CAACA,CAACA,GAAGA,IAAIA,CAACA,CAACA,CAAAA,CAAGA;SACzEF;QAEQA,eAAgBA,IAAIA,KAAKA,CAACA,CAACA,EAAEA,CAACA,CAAAA;AACtCA;KATID,IAUJA;IAVIA,qBAUJA,IAAAA;IACIA,+BAA+BA;IAC3BA,IAAAA,CAACA,GAAGA,EAAEA,CAAAA;IAEVA,SAAgBA,GAAGA;KAEvBA;IAFIA;AAEJA,IACIA;;MAEEA;IACEA,IAAAA,CAACA,GAAGA,EAAEA,CAAAA;AACdA,CACAA,2BAAA;AACA,qBAAqB;AACjB,IAAA,CAAC,GAAW,IAAI,MAAM,CAAC,KAAK,CAAC,CAAC,EAAE,CAAC,CAAA,CAAC;AAClC,IAAA,IAAI,GAAG,CAAC,CAAC,OAAO,EAAC,CAAC"}
////[comments_ExternalModules_0.js]
//@ sourceMappingURL=comments_ExternalModules_0.js.map
////[comments_ExternalModules_0.js.map]
{"version":3,"file":"comments_ExternalModules_0.js","sources":["comments_ExternalModules_0.ts"],"names":[],"mappings":""}
////[comments_ExternalModules_1.js]
//@ sourceMappingURL=comments_ExternalModules_1.js.map
////[comments_ExternalModules_1.js.map]
{"version":3,"file":"comments_ExternalModules_1.js","sources":["comments_ExternalModules_1.ts"],"names":[],"mappings":""}
////[comments_MultiModule_MultiFile_0.js]
//@ sourceMappingURL=comments_MultiModule_MultiFile_0.js.map
////[comments_MultiModule_MultiFile_0.js.map]
{"version":3,"file":"comments_MultiModule_MultiFile_0.js","sources":["comments_MultiModule_MultiFile_0.ts"],"names":[],"mappings":""}
////[comments_MultiModule_MultiFile_1.js]
//@ sourceMappingURL=comments_MultiModule_MultiFile_1.js.map
////[comments_MultiModule_MultiFile_1.js.map]
{"version":3,"file":"comments_MultiModule_MultiFile_1.js","sources":["comments_MultiModule_MultiFile_1.ts"],"names":[],"mappings":""}
////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js]
//@ sourceMappingURL=duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js.map
////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js.map]
{"version":3,"file":"duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js","sources":["duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.ts"],"names":[],"mappings":""}
////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js]
//@ sourceMappingURL=duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js.map
////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js.map]
{"version":3,"file":"duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js","sources":["duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.ts"],"names":[],"mappings":""}
////[importInsideModule_file1.js]
//@ sourceMappingURL=importInsideModule_file1.js.map
////[importInsideModule_file1.js.map]
{"version":3,"file":"importInsideModule_file1.js","sources":["importInsideModule_file1.ts"],"names":[],"mappings":""}
////[importInsideModule_file2.js]
//@ sourceMappingURL=importInsideModule_file2.js.map
////[importInsideModule_file2.js.map]
{"version":3,"file":"importInsideModule_file2.js","sources":["importInsideModule_file2.ts"],"names":[],"mappings":""}