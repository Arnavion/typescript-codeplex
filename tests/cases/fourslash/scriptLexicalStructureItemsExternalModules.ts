/// <reference path="fourslash.ts"/>

////{| "itemName": "Bar", "kind": "class" |}export class Bar {
////    {| "itemName": "s", "kind": "property", "parentName": "Bar" |}public s: string;
////}

verify.getScriptLexicalStructureListCount(2); // external module node + class + property

test.markers().forEach((marker) => {
    verify.navigationItemsListContains(marker.data.itemName, marker.data.kind, marker.fileName, marker.data.parentName);
});
