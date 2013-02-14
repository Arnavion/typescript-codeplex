module Outer {

    // inner mod 1
    var non_export_var;
    module {
        var non_export_var = 0;
        export var export_var = 1;

        function NonExportFunc() { return 0; }

        export function ExportFunc() { return 0; }
    }
    var export_var;

    export var outer_var_export = 0;
    export function outerFuncExport() { return 0; }

}

Outer.NonExportFunc();