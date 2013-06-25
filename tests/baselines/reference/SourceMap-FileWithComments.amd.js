////[0.js.map]
{"version":3,"file":"0.js","sourceRoot":"","sources":["file:///0.ts"],"names":["Shapes","Shapes.Point","Shapes.Point.constructor","Shapes.Point.getDist","Shapes.foo"],"mappings":"AAMA,SAAS;AACT,IAAO,MAAM;AAwBZ,CAxBD,UAAO,MAAM;IAETA,QAAQA;IACRA;QAEIC,cADcA;QACdA,eAAYA,CAAgBA,EAAEA,CAAgBA;YAAlCC,MAAQA,GAADA,CAACA;AAAQA,YAAEA,MAAQA,GAADA,CAACA;AAAQA,QAAIA,CAACA;QAGnDD,kBADkBA;kCAClBA;YAAYE,OAAOA,IAAIA,CAACA,IAAIA,CAACA,IAAIA,CAACA,CAACA,GAAGA,IAAIA,CAACA,CAACA,GAAGA,IAAIA,CAACA,CAACA,GAAGA,IAAIA,CAACA,CAACA,CAACA,CAACA;QAACA,CAACA;;QAGlEF,eAAgBA,IAAIA,KAAKA,CAACA,CAACA,EAAEA,CAACA,CAACA;AAACA,QACpCA;AAACA,IAADA,CAACA,IAAAD;IATDA,qBASCA;;IAGDA,+BAD+BA;IAC3BA,IAAAA,CAACA,GAAGA,EAAEA,CAACA;;IAEXA,SAAgBA,GAAGA;IACnBI,CAACA;IADDJ,iBACCA;;IAKDA;;MADEA;IACEA,IAAAA,CAACA,GAAGA,EAAEA,CAACA;AACfA,CAACA,2BAAA;;AAGD,qBADqB;AACjB,IAAA,CAAC,GAAW,IAAI,MAAM,CAAC,KAAK,CAAC,CAAC,EAAE,CAAC,CAAC,CAAC;AACvC,IAAI,IAAI,GAAG,CAAC,CAAC,OAAO,CAAC,CAAC,CAAC"}
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
        // Instance member
        Point.prototype.getDist = function () {
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
//# sourceMappingURL=0.js.map

////[comments_ExternalModules_0.js.map]
{"version":3,"file":"comments_ExternalModules_0.js","sourceRoot":"","sources":["file:///comments_ExternalModules_0.ts"],"names":[],"mappings":""}
////[comments_ExternalModules_0.js]
//# sourceMappingURL=comments_ExternalModules_0.js.map

////[comments_ExternalModules_1.js.map]
{"version":3,"file":"comments_ExternalModules_1.js","sourceRoot":"","sources":["file:///comments_ExternalModules_1.ts"],"names":[],"mappings":""}
////[comments_ExternalModules_1.js]
//# sourceMappingURL=comments_ExternalModules_1.js.map

////[comments_MultiModule_MultiFile_0.js.map]
{"version":3,"file":"comments_MultiModule_MultiFile_0.js","sourceRoot":"","sources":["file:///comments_MultiModule_MultiFile_0.ts"],"names":[],"mappings":""}
////[comments_MultiModule_MultiFile_0.js]
//# sourceMappingURL=comments_MultiModule_MultiFile_0.js.map

////[comments_MultiModule_MultiFile_1.js.map]
{"version":3,"file":"comments_MultiModule_MultiFile_1.js","sourceRoot":"","sources":["file:///comments_MultiModule_MultiFile_1.ts"],"names":[],"mappings":""}
////[comments_MultiModule_MultiFile_1.js]
//# sourceMappingURL=comments_MultiModule_MultiFile_1.js.map

////[declFileImportModuleWithExportAssignment_0.js.map]
{"version":3,"file":"declFileImportModuleWithExportAssignment_0.js","sourceRoot":"","sources":["file:///declFileImportModuleWithExportAssignment_0.ts"],"names":[],"mappings":""}
////[declFileImportModuleWithExportAssignment_0.js]
//# sourceMappingURL=declFileImportModuleWithExportAssignment_0.js.map

////[declFileImportModuleWithExportAssignment_1.js.map]
{"version":3,"file":"declFileImportModuleWithExportAssignment_1.js","sourceRoot":"","sources":["file:///declFileImportModuleWithExportAssignment_1.ts"],"names":[],"mappings":""}
////[declFileImportModuleWithExportAssignment_1.js]
//# sourceMappingURL=declFileImportModuleWithExportAssignment_1.js.map

////[deprecatedBool_0.js.map]
{"version":3,"file":"deprecatedBool_0.js","sourceRoot":"","sources":["file:///deprecatedBool_0.ts"],"names":[],"mappings":""}
////[deprecatedBool_0.js]
//# sourceMappingURL=deprecatedBool_0.js.map

////[deprecatedBool_1.js.map]
{"version":3,"file":"deprecatedBool_1.js","sourceRoot":"","sources":["file:///deprecatedBool_1.ts"],"names":[],"mappings":""}
////[deprecatedBool_1.js]
//# sourceMappingURL=deprecatedBool_1.js.map

////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js.map]
{"version":3,"file":"duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js","sourceRoot":"","sources":["file:///duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.ts"],"names":[],"mappings":""}
////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js]
//# sourceMappingURL=duplicateIdentifierShouldNotShorCircuitBaseTypeBindingA.js.map

////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js.map]
{"version":3,"file":"duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js","sourceRoot":"","sources":["file:///duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.ts"],"names":[],"mappings":""}
////[duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js]
//# sourceMappingURL=duplicateIdentifierShouldNotShorCircuitBaseTypeBindingB.js.map

////[errorsOnImportedSymbol_0.js.map]
{"version":3,"file":"errorsOnImportedSymbol_0.js","sourceRoot":"","sources":["file:///errorsOnImportedSymbol_0.ts"],"names":[],"mappings":""}
////[errorsOnImportedSymbol_0.js]
//# sourceMappingURL=errorsOnImportedSymbol_0.js.map

////[errorsOnImportedSymbol_1.js.map]
{"version":3,"file":"errorsOnImportedSymbol_1.js","sourceRoot":"","sources":["file:///errorsOnImportedSymbol_1.ts"],"names":[],"mappings":""}
////[errorsOnImportedSymbol_1.js]
//# sourceMappingURL=errorsOnImportedSymbol_1.js.map

////[exportEqualsClass_A.js.map]
{"version":3,"file":"exportEqualsClass_A.js","sourceRoot":"","sources":["file:///exportEqualsClass_A.ts"],"names":[],"mappings":""}
////[exportEqualsClass_A.js]
//# sourceMappingURL=exportEqualsClass_A.js.map

////[exportEqualsClass_B.js.map]
{"version":3,"file":"exportEqualsClass_B.js","sourceRoot":"","sources":["file:///exportEqualsClass_B.ts"],"names":[],"mappings":""}
////[exportEqualsClass_B.js]
//# sourceMappingURL=exportEqualsClass_B.js.map

////[exportEqualsEnum_A.js.map]
{"version":3,"file":"exportEqualsEnum_A.js","sourceRoot":"","sources":["file:///exportEqualsEnum_A.ts"],"names":[],"mappings":""}
////[exportEqualsEnum_A.js]
//# sourceMappingURL=exportEqualsEnum_A.js.map

////[exportEqualsEnum_B.js.map]
{"version":3,"file":"exportEqualsEnum_B.js","sourceRoot":"","sources":["file:///exportEqualsEnum_B.ts"],"names":[],"mappings":""}
////[exportEqualsEnum_B.js]
//# sourceMappingURL=exportEqualsEnum_B.js.map

////[exportEqualsFunction_A.js.map]
{"version":3,"file":"exportEqualsFunction_A.js","sourceRoot":"","sources":["file:///exportEqualsFunction_A.ts"],"names":[],"mappings":""}
////[exportEqualsFunction_A.js]
//# sourceMappingURL=exportEqualsFunction_A.js.map

////[exportEqualsFunction_B.js.map]
{"version":3,"file":"exportEqualsFunction_B.js","sourceRoot":"","sources":["file:///exportEqualsFunction_B.ts"],"names":[],"mappings":""}
////[exportEqualsFunction_B.js]
//# sourceMappingURL=exportEqualsFunction_B.js.map

////[exportEqualsInterface_A.js.map]
{"version":3,"file":"exportEqualsInterface_A.js","sourceRoot":"","sources":["file:///exportEqualsInterface_A.ts"],"names":[],"mappings":""}
////[exportEqualsInterface_A.js]
//# sourceMappingURL=exportEqualsInterface_A.js.map

////[exportEqualsInterface_B.js.map]
{"version":3,"file":"exportEqualsInterface_B.js","sourceRoot":"","sources":["file:///exportEqualsInterface_B.ts"],"names":[],"mappings":""}
////[exportEqualsInterface_B.js]
//# sourceMappingURL=exportEqualsInterface_B.js.map

////[exportEqualsModule_A.js.map]
{"version":3,"file":"exportEqualsModule_A.js","sourceRoot":"","sources":["file:///exportEqualsModule_A.ts"],"names":[],"mappings":""}
////[exportEqualsModule_A.js]
//# sourceMappingURL=exportEqualsModule_A.js.map

////[exportEqualsModule_B.js.map]
{"version":3,"file":"exportEqualsModule_B.js","sourceRoot":"","sources":["file:///exportEqualsModule_B.ts"],"names":[],"mappings":""}
////[exportEqualsModule_B.js]
//# sourceMappingURL=exportEqualsModule_B.js.map

////[exportEqualsVar_A.js.map]
{"version":3,"file":"exportEqualsVar_A.js","sourceRoot":"","sources":["file:///exportEqualsVar_A.ts"],"names":[],"mappings":""}
////[exportEqualsVar_A.js]
//# sourceMappingURL=exportEqualsVar_A.js.map

////[exportEqualsVar_B.js.map]
{"version":3,"file":"exportEqualsVar_B.js","sourceRoot":"","sources":["file:///exportEqualsVar_B.ts"],"names":[],"mappings":""}
////[exportEqualsVar_B.js]
//# sourceMappingURL=exportEqualsVar_B.js.map

////[importInsideModule_file1.js.map]
{"version":3,"file":"importInsideModule_file1.js","sourceRoot":"","sources":["file:///importInsideModule_file1.ts"],"names":[],"mappings":""}
////[importInsideModule_file1.js]
//# sourceMappingURL=importInsideModule_file1.js.map

////[importInsideModule_file2.js.map]
{"version":3,"file":"importInsideModule_file2.js","sourceRoot":"","sources":["file:///importInsideModule_file2.ts"],"names":[],"mappings":""}
////[importInsideModule_file2.js]
//# sourceMappingURL=importInsideModule_file2.js.map

////[modulesImportedForTypeArgumentPosition_0.js.map]
{"version":3,"file":"modulesImportedForTypeArgumentPosition_0.js","sourceRoot":"","sources":["file:///modulesImportedForTypeArgumentPosition_0.ts"],"names":[],"mappings":""}
////[modulesImportedForTypeArgumentPosition_0.js]
//# sourceMappingURL=modulesImportedForTypeArgumentPosition_0.js.map

////[modulesImportedForTypeArgumentPosition_1.js.map]
{"version":3,"file":"modulesImportedForTypeArgumentPosition_1.js","sourceRoot":"","sources":["file:///modulesImportedForTypeArgumentPosition_1.ts"],"names":[],"mappings":""}
////[modulesImportedForTypeArgumentPosition_1.js]
//# sourceMappingURL=modulesImportedForTypeArgumentPosition_1.js.map
