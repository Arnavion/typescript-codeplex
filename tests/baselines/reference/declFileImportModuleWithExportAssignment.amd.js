////[declFileImportModuleWithExportAssignment_0.js]
define(["require", "exports"], function(require, exports) {
    var m2;
    
    return m2;
});

////[declFileImportModuleWithExportAssignment_1.js]
define(["require", "exports", "declFileImportModuleWithExportAssignment_0"], function(require, exports, __a1__) {
    /**This is on import declaration*/
    var a1 = __a1__;
    exports.a1 = a1;
    exports.a = exports.a1;
    exports.a.test1(null, null, null);
});

////[declFileImportModuleWithExportAssignment_1.d.ts]
/**This is on import declaration*/
export import a1 = require("declFileImportModuleWithExportAssignment_0");
export declare var a: {
    test1: a1.connectModule;
    test2(): a1.connectModule;
    (): a1.connectExport;
};
