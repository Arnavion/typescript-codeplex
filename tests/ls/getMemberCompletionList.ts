﻿///<reference path='..\..\src\compiler\typescript.ts' />
///<reference path='..\..\src\harness\harness.ts' />

describe('getMemberCompletionList', function () {
    var code: string = Harness.CollateralReader.read('ls/testCode/memberlist.ts');
    var script: TypeScript.Script = null;
    var ls: TypeScript.TypeScriptCompiler = null;

    function initCompiler(code: string) {
        if (!script) {
            Harness.Compiler.recreate();
            Harness.Compiler.compileString(code, "test.ts", function (result) {
                script = result.scripts[0];
            }, true);

            ls = Harness.Compiler.compiler;
        }
    }

    function namesAndTypesAtPos(code: string, line: number, col: number) {
        initCompiler(code);

        var lineMap = script.locationInfo.lineMap;
        var offset = lineMap[line] + col;
        var text = new TypeScript.StringSourceText(code);
        var pos = offset;
        var isMemberCompletion = false;
        var logger = new TypeScript.NullLogger();
        var enclosingScopeContext = TypeScript.findEnclosingScopeAt(logger, script, text, pos, isMemberCompletion);
        return new TypeScript.ScopeTraversal(ls).getScopeEntries(enclosingScopeContext);
    }

    function memberCompletionAtPos(code: string, line: number, col: number) {
        initCompiler(code);

        var lineMap = script.locationInfo.lineMap;
        var offset = lineMap[line] + col;

        var text = new TypeScript.StringSourceText(code);
        var pos = offset;
        var isMemberCompletion = true;
        var logger = new TypeScript.NullLogger();
        var enclosingScopeContext = TypeScript.findEnclosingScopeAt(logger, script, text, pos, isMemberCompletion);
        return new TypeScript.ScopeTraversal(ls).getScopeEntries(enclosingScopeContext);
    }

    function verifyNumberOfMembers(namesAndTypes: TypeScript.ScopeEntry[], count: number) {
        var names = namesAndTypes;

        if (names.length !== count) {
            throw new Error("Expected " + count + " items, got " + names.length + " instead.");
        }
    }

    function verifyNamesAndTypes(namesAndTypes: TypeScript.ScopeEntry[], spec: any) {
        var found: bool;
        var names = namesAndTypes;

        for (name in spec) {
            found = false;

            for (var i = 0; i < names.length; i++) {
                if (names[i].name === name) {
                    found = true;

                    if (names[i].type !== spec[name]) {
                        throw new Error("Expected " + name + " to be of type " + spec[name] + ", is of type " + names[i].type);
                    }

                    break;
                }
            }

            if (!found)
                throw new Error("Expected to find name '" + name + "'");
        }
    }

    describe('member completion', function () {
        it("get members of classes", function () {
            var namesAndTypes = memberCompletionAtPos(code, 9, 5);

            verifyNumberOfMembers(namesAndTypes, 3);
            verifyNamesAndTypes(namesAndTypes, {
                'csVar': 'number',
                'csFunc': '() => void',
                'prototype': 'cls1'
            });
        });

        it("get members of functions", function () {
            var namesAndTypes = memberCompletionAtPos(code, 18, 5);

            verifyNumberOfMembers(namesAndTypes, 3);
            verifyNamesAndTypes(namesAndTypes, {
                'arguments': 'IArguments',
                'foovar': 'any',
                'foosfunc': '() => void'
            });
        });

        it("get members of module", function () {
            var namesAndTypes = memberCompletionAtPos(code, 33, 5);

            verifyNumberOfMembers(namesAndTypes, 5);
            verifyNamesAndTypes(namesAndTypes, {
                'meX': 'number',
                'meFunc': '() => void',
                'meClass': 'new() => mod1.meClass',
                'meMod': 'mod1.meMod',
                'meInt': 'mod1.meInt'
            });
        });

        it("get members of objects", function () {
            var namesAndTypes = memberCompletionAtPos(code, 51, 5);

            verifyNumberOfMembers(namesAndTypes, 2);
            verifyNamesAndTypes(namesAndTypes, {
                'bar': 'any',
                'foob': '(bar: any) => any'
            });
        });

        it("get members of class instances", function () {
            var namesAndTypes = memberCompletionAtPos(code, 54, 5);

            verifyNumberOfMembers(namesAndTypes, 2);
            verifyNamesAndTypes(namesAndTypes, {
                'ceFunc': '() => void',
                'ceVar': 'number'
            });
        });

        it("get members of the super", function () {
            var namesAndTypes = memberCompletionAtPos(code, 58, 14);

            verifyNumberOfMembers(namesAndTypes, 2);
            verifyNamesAndTypes(namesAndTypes, {
                'ceFunc': '() => void',
                'ceVar': 'number'
            });
        });


        it("get members of nested module", function () {
            var namesAndTypes = memberCompletionAtPos(code, 85, 31);

            verifyNumberOfMembers(namesAndTypes, 5);
            verifyNamesAndTypes(namesAndTypes, {
                'meX': 'number',
                'meFunc': '() => void',
                'meClass': 'new() => mod1.meClass',
                'meMod': 'mod1.meMod',
                'meInt': 'mod1.meInt'
            });
        });

        it("get members of from module variable", function () {
            var namesAndTypes = memberCompletionAtPos(code, 86, 9);

            verifyNumberOfMembers(namesAndTypes, 5);
            verifyNamesAndTypes(namesAndTypes, {
                'meX': 'number',
                'meFunc': '() => void',
                'meClass': 'new() => mod1.meClass',
                'meMod': 'mod1.meMod',
                'meInt': 'mod1.meInt'
            });
        });

        it("get members of nested from module variable", function () {
            var namesAndTypes = memberCompletionAtPos(code, 87, 10);

            verifyNumberOfMembers(namesAndTypes, 1);
            verifyNamesAndTypes(namesAndTypes, {
                'iMex': 'number',
            });
        });
    });
});
