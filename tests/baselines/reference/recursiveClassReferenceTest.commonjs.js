var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Sample;
(function (Sample) {
    (function (Actions) {
        (function (Thing) {
            (function (Find) {
                var StartFindAction = (function () {
                    function StartFindAction() { }
                    StartFindAction.prototype.getId = function () {
                        return "yo";
                    };
                    StartFindAction.prototype.run = function (Thing) {
                        return true;
                    };
                    return StartFindAction;
                })();
                Find.StartFindAction = StartFindAction;                
            })(Thing.Find || (Thing.Find = {}));
            var Find = Thing.Find;
        })(Actions.Thing || (Actions.Thing = {}));
        var Thing = Actions.Thing;
    })(Sample.Actions || (Sample.Actions = {}));
    var Actions = Sample.Actions;
})(Sample || (Sample = {}));
var Sample;
(function (Sample) {
    (function (Thing) {
        (function (Widgets) {
            var FindWidget = (function () {
                function FindWidget(codeThing) {
                    this.codeThing = codeThing;
                    this.domNode = null;
                    codeThing.addWidget("addWidget", this);
                }
                FindWidget.prototype.gar = function (runner) {
                    if (true) {
                        return runner(this);
                    }
                };
                FindWidget.prototype.getDomNode = function () {
                    return domNode;
                };
                FindWidget.prototype.destroy = function () {
                };
                return FindWidget;
            })();
            Widgets.FindWidget = FindWidget;            
        })(Thing.Widgets || (Thing.Widgets = {}));
        var Widgets = Thing.Widgets;
    })(Sample.Thing || (Sample.Thing = {}));
    var Thing = Sample.Thing;
})(Sample || (Sample = {}));
var AbstractMode = (function () {
    function AbstractMode() { }
    AbstractMode.prototype.getInitialState = function () {
        return null;
    };
    return AbstractMode;
})();
var Sample;
(function (Sample) {
    (function (Thing) {
        (function (Languages) {
            (function (PlainText) {
                var State = (function () {
                    function State(mode) {
                        this.mode = mode;
                    }
                    State.prototype.clone = function () {
                        return this;
                    };
                    State.prototype.equals = function (other) {
                        return this === other;
                    };
                    State.prototype.getMode = function () {
                        return mode;
                    };
                    return State;
                })();
                PlainText.State = State;                
                var Mode = (function (_super) {
                    __extends(Mode, _super);
                    function Mode() {
                        _super.apply(this, arguments);

                    }
                    Mode.prototype.getInitialState = function () {
                        return new State(self);
                    };
                    return Mode;
                })(AbstractMode);
                PlainText.Mode = Mode;                
            })(Languages.PlainText || (Languages.PlainText = {}));
            var PlainText = Languages.PlainText;
        })(Thing.Languages || (Thing.Languages = {}));
        var Languages = Thing.Languages;
    })(Sample.Thing || (Sample.Thing = {}));
    var Thing = Sample.Thing;
})(Sample || (Sample = {}));
//@ sourceMappingURL=0.js.map
////[0.js.map]
{"version":3,"file":"0.js","sources":["0.ts"],"names":["Sample","Sample.Actions","Sample.Actions.Thing","Sample.Actions.Thing.Find","Sample.Actions.Thing.Find.StartFindAction","Sample.Actions.Thing.Find.StartFindAction.constructor","Sample.Actions.Thing.Find.StartFindAction.getId","Sample.Actions.Thing.Find.StartFindAction.run","Sample","Sample.Thing","Sample.Thing.Widgets","Sample.Thing.Widgets.FindWidget","Sample.Thing.Widgets.FindWidget.constructor","Sample.Thing.Widgets.FindWidget.gar","Sample.Thing.Widgets.FindWidget.getDomNode","Sample.Thing.Widgets.FindWidget.destroy","AbstractMode","AbstractMode.constructor","AbstractMode.getInitialState","Sample","Sample.Thing","Sample.Thing.Languages","Sample.Thing.Languages.PlainText","Sample.Thing.Languages.PlainText.State","Sample.Thing.Languages.PlainText.State.constructor","Sample.Thing.Languages.PlainText.State.clone","Sample.Thing.Languages.PlainText.State.equals","Sample.Thing.Languages.PlainText.State.getMode","Sample.Thing.Languages.PlainText.Mode","Sample.Thing.Languages.PlainText.Mode.constructor","Sample.Thing.Languages.PlainText.Mode.getInitialState"],"mappings":";;;;;AA+BA,IAAO,MAAM;AAUZ,CAVD,UAAO,MAAM;KAAbA,UAAcA,OAAOA;SAArBC,UAAsBA,KAAKA;aAA3BC,UAA4BA,IAAIA;gBAC/BC;oBAAAC;AAQCA,oBANAA,kCAAAA;wBAAiBE,OAAOA,IAAIA,CAACA;oBAACA,CAACA;oBAE/BF,gCAAAA,UAAWA,KAA6BA;wBAEvCG,OAAOA,IAAIA,CAACA;oBACbA,CAACA;oBACFH;AAACA,gBAADA,CAACA,IAAAD;gBARDA,uCAQCA,gBAAAA;YACFA,CAACA,mCAAAD;YAVDA;AAUCA,QAADA,CAACA,yCAAAD;QAVDA;AAUCA,IAADA,CAACA,2CAAAD;IAVDA;AAUCA,CAAAA,2BAAA;AAED,IAAO,MAAM;AAoBZ,CApBD,UAAO,MAAM;KAAbQ,UAAcA,KAAKA;SAAnBC,UAAoBA,OAAOA;YAC1BC;gBAKCC,SALYA,UAAUA,CAKVA,SAA0CA;oBAA1CC,cAAiBA,GAATA,SAASA;AAAyBA,oBADtDA,KAAQA,OAAOA,GAAOA,IAAIA,CAACA;oBAGvBA,SAASA,CAACA,SAASA,CAACA,WAAWA,EAAEA,IAAIA,CAAAA;AAAEA,gBAC3CA,CAACA;gBANDD,2BAAAA,UAAWA,MAAyCA;oBAAIE,IAAIA,IAAIA,CAAEA;wBAACA,OAAOA,MAAMA,CAACA,IAAIA,CAAAA,CAAEA;qBAACA;gBAAAA,CAACA;gBAQzFF,kCAAAA;oBACCG,OAAOA,OAAOA,CAACA;gBAChBA,CAACA;gBAEDH,+BAAAA;gBAEAI,CAACA;gBAEFJ;AAACA,YAADA,CAACA,IAAAD;YAlBDA,gCAkBCA,YAAAA;QACFA,CAACA,yCAAAD;QApBDA;AAoBCA,IAADA,CAACA,uCAAAD;IApBDA;AAoBCA,CAAAA,2BAAA;AAGD;IAAAQ;AAAwFA,IAAlDA,yCAAAA;QAAmCE,OAAOA,IAAIA,CAACA;IAAAA,CAACA;IAACF;AAACA,CAAAA,IAAA;AAKxF,IAAO,MAAM;AAwBZ,CAxBD,UAAO,MAAM;KAAbG,UAAcA,KAAKA;SAAnBC,UAAoBA,SAASA;aAA7BC,UAA8BA,SAASA;gBAEtCC;oBACOC,SADMA,KAAKA,CACCA,IAAmBA;wBAAnBC,SAAYA,GAAJA,IAAIA;AAAOA,oBAAIA,CAACA;oBAC1CD,wBAAAA;wBACCE,OAAOA,IAAIA,CAACA;oBACbA,CAACA;oBAEDF,yBAAAA,UAAcA,KAAYA;wBACzBG,OAAOA,IAAIA,KAAKA,KAAKA,CAACA;oBACvBA,CAACA;oBAEDH,0BAAAA;wBAA0BI,OAAOA,IAAIA,CAACA;oBAACA,CAACA;oBACzCJ;AAACA,gBAADA,CAACA,IAAAD;gBAXDA,wBAWCA,gBAAAA;gBAEDA;;oBAAAM;;;;AAQCA,oBALAA,iCAAAA;wBACCE,OAAOA,IAAIA,KAAKA,CAACA,IAAIA,CAAAA,CAAEA;oBACxBA,CAACA;oBAGFF;AAACA,gBAADA,CAACA,EARyBN,YAAYA,EAQrCA;gBARDA,sBAQCA,gBAAAA;YACFA,CAACA,qDAAAD;YAxBDA;AAwBCA,QAADA,CAACA,6CAAAD;QAxBDA;AAwBCA,IAADA,CAACA,uCAAAD;IAxBDA;AAwBCA,CAAAA,2BAAA"}
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