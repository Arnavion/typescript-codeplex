/// <reference path='fourslash.ts' />

// @Filename: Definition.ts
////var /*remoteVariableDefinition*/remoteVariable;
/////*remoteFunctionDefinition*/function remoteFunction() { }
/////*remoteClassDefinition*/class remoteClass { }
/////*remoteInterfaceDefinition*/interface remoteInterface{ }
/////*remoteModuleDefinition*/module remoteModule{ export var foo = 1;}

// @Filename: Consumption.ts
/////*remoteVariableReference*/remoteVariable = 1;
/////*remoteFunctionReference*/remoteFunction();
////var foo = new /*remoteClassReference*/remoteClass();
////class fooCls implements /*remoteInterfaceReference*/remoteInterface { }
////var fooVar = /*remoteModuleReference*/remoteModule.foo;

var markerList = [
    "remoteVariable",
    "remoteFunction",
    "remoteClass",
    "remoteInterface",
    "remoteModule",
];

markerList.forEach((marker) => {
    goTo.marker(marker + 'Reference');
    goTo.definition();
    verify.caretAtMarker(marker + 'Definition');
});
