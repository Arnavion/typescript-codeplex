var Foo;
(function (Foo) {
    (function (Bar) {
        "use strict";
        var Greeter = (function () {
            function Greeter(greeting) {
                this.greeting = greeting;
            }
            Greeter.prototype.greet = function () {
                return "<h1>" + this.greeting + "</h1>";
            };
            return Greeter;
        })();        
        function foo(greeting) {
            return new Greeter(greeting);
        }
        var greeter = new Greeter("Hello, world!");
        var str = greeter.greet();
        function foo2(greeting) {
            var restGreetings = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                restGreetings[_i] = arguments[_i + 1];
            }
            var greeters = [];
            greeters[0] = new Greeter(greeting);
            for (var i = 0; i < restGreetings.length; i++) {
                greeters.push(new Greeter(restGreetings[i]));
            }
            return greeters;
        }
        var b = foo2("Hello", "World", "!");
        for (var j = 0; j < b.length; j++) {
            b[j].greet();
        }
    })(Foo.Bar || (Foo.Bar = {}));
    var Bar = Foo.Bar;

})(Foo || (Foo = {}));
//@ sourceMappingURL=0.js.map
////[0.js.map]
{"version":3,"file":"0.js","sources":["0.ts"],"names":["Foo","Foo.Bar","Foo.Bar.Greeter","Foo.Bar.Greeter.constructor","Foo.Bar.Greeter.greet","Foo.Bar.foo","Foo.Bar.foo2"],"mappings":"AAAA,IAAO,GAAG;AAkCT,CAlCD,UAAO,GAAG;KAAVA,UAAWA,GAAGA;QACVC,YAAYA,CAACA;QAEbA;YACIC,SADEA,OAAOA,CACGA,QAAuBA;gBAAvBC,aAAeA,GAARA,QAAQA;AAAQA,YACnCA,CAACA;YAEDD,0BAAAA;gBACIE,OAAOA,MAAMA,GAAGA,IAAIA,CAACA,QAAQA,GAAGA,OAAOA,CAACA;YAC5CA,CAACA;YACLF;AAACA,QAADA,CAACA,IAAAD,QAAAA;QAGDA,SAASA,GAAGA,CAACA,QAAgBA;YACzBI,OAAOA,IAAIA,OAAOA,CAACA,QAAQA,CAAAA,CAAEA;QACjCA,CAACA;QAEDJ,IAAIA,OAAOA,GAAGA,IAAIA,OAAOA,CAACA,eAAeA,CAAAA,CAAEA;QAC3CA,IAAIA,GAAGA,GAAGA,OAAOA,CAACA,KAAKA,EAACA,CAAEA;QAE1BA,SAASA,IAAIA,CAACA,QAAgBA;YAAEK,IAAGA,aAAaA;AAAUA,iBAA1BA,WAA0BA,CAA1BA,2BAA0BA,EAA1BA,IAA0BA;gBAA1BA,sCAA0BA;;YACtDA,IAAIA,QAAQA,GAAcA,EAAEA,CAACA;YAC7BA,QAAQA,CAACA,CAACA,CAACA,GAAGA,IAAIA,OAAOA,CAACA,QAAQA,CAAAA,CAAEA;YACpCA,KAAKA,IAAIA,CAACA,GAAGA,CAACA,EAAEA,CAACA,GAAGA,aAAaA,CAACA,MAAMA,EAAEA,CAACA,EAAEA,CAAEA;gBAC3CA,QAAQA,CAACA,IAAIA,CAACA,IAAIA,OAAOA,CAACA,aAAaA,CAACA,CAACA,CAACA,CAAAA,CAACA,CAAEA;aAChDA;YAEDA,OAAOA,QAAQA,CAACA;QACpBA,CAACA;QAEDL,IAAIA,CAACA,GAAGA,IAAIA,CAACA,OAAOA,EAAEA,OAAOA,EAAEA,GAAGA,CAAAA,CAAEA;QACpCA,KAAKA,IAAIA,CAACA,GAAGA,CAACA,EAAEA,CAACA,GAAGA,CAACA,CAACA,MAAMA,EAAEA,CAACA,EAAEA,CAAEA;YAC/BA,CAACA,CAACA,CAACA,CAACA,CAACA,KAAKA,EAACA,CAAEA;SAChBA;IACLA,CAACA,6BAAAD;IAlCDA;AAkCCA;AAADA,CAACA,qBAAA"}
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
////[deprecatedBool_0.js]
//@ sourceMappingURL=deprecatedBool_0.js.map
////[deprecatedBool_0.js.map]
{"version":3,"file":"deprecatedBool_0.js","sources":["deprecatedBool_0.ts"],"names":[],"mappings":""}
////[deprecatedBool_1.js]
//@ sourceMappingURL=deprecatedBool_1.js.map
////[deprecatedBool_1.js.map]
{"version":3,"file":"deprecatedBool_1.js","sources":["deprecatedBool_1.ts"],"names":[],"mappings":""}
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