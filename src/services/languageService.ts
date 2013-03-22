﻿//﻿
// Copyright (c) Microsoft Corporation.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='typescriptServices.ts' />
///<reference path='diagnosticServices.ts' />

module Services {

    //
    // Public interface of the host of a language service instance.
    //
    export interface ILanguageServiceHost extends TypeScript.ILogger {
        getCompilationSettings(): TypeScript.CompilationSettings;

        getScriptFileNames(): string[];
        getScriptVersion(fileName: string): number;
        getScriptSnapshot(fileName: string): TypeScript.IScriptSnapshot;
        getDiagnosticsObject(): Services.ILanguageServicesDiagnostics;
    }

    //
    // Public services of a language service instance associated
    // with a language service host instance
    //
    export interface ILanguageService {
        // TODO: This should be removed.  We should not be publicly exposing a way to refresh the 
        // language service.
        refresh(): void;

        getSyntacticDiagnostics(fileName: string): TypeScript.IDiagnostic[];
        getSemanticDiagnostics(fileName: string): TypeScript.IDiagnostic[];

        getCompletionsAtPosition(fileName: string, pos: number, isMemberCompletion: bool): CompletionInfo;
        getTypeAtPosition(fileName: string, pos: number): TypeInfo;
        getNameOrDottedNameSpan(fileName: string, startPos: number, endPos: number): SpanInfo;
        getBreakpointStatementAtPosition(fileName: string, pos: number): SpanInfo;
        getSignatureAtPosition(fileName: string, pos: number): SignatureInfo;
        getDefinitionAtPosition(fileName: string, pos: number): DefinitionInfo;
        getReferencesAtPosition(fileName: string, pos: number): ReferenceEntry[];
        getOccurrencesAtPosition(fileName: string, pos: number): ReferenceEntry[];
        getImplementorsAtPosition(fileName: string, pos: number): ReferenceEntry[];
        getNavigateToItems(searchValue: string): NavigateToItem[];
        getScriptLexicalStructure(fileName: string): NavigateToItem[];
        getOutliningRegions(fileName: string): TypeScript.TextSpan[];
        getBraceMatchingAtPosition(fileName: string, position: number): TypeScript.TextSpan[];
        getSmartIndentAtLineNumber(fileName: string, position: number, options: Services.EditorOptions): number;

        getFormattingEditsForRange(fileName: string, minChar: number, limChar: number, options: FormatCodeOptions): TextEdit[];
        getFormattingEditsForDocument(fileName: string, minChar: number, limChar: number, options: FormatCodeOptions): TextEdit[];
        getFormattingEditsOnPaste(fileName: string, minChar: number, limChar: number, options: FormatCodeOptions): TextEdit[];
        getFormattingEditsAfterKeystroke(fileName: string, position: number, key: string, options: FormatCodeOptions): TextEdit[];

        getAstPathToPosition(script: TypeScript.AST, pos: number, options: TypeScript.GetAstPathOptions /*= Tools.GetAstPathOptions.Default*/): TypeScript.AstPath;
        getIdentifierPathToPosition(script: TypeScript.AST, pos: number): TypeScript.AstPath;

        getSymbolTree(): Services.ISymbolTree;

        getEmitOutput(fileName: string): IOutputFile[];
    }

    export function logInternalError(logger: TypeScript.ILogger, err: Error) {
        logger.log("*INTERNAL ERROR* - Exception in typescript services: " + err.message);
    }

    export class ReferenceEntry {
        constructor(public fileName: string, public ast: TypeScript.AST, public isWriteAccess: bool) {
        }

        public getHashCode(): number {
            return TypeScript.combineHashes(
                    TypeScript.Hash.computeSimple31BitStringHashCode(this.fileName),
                    TypeScript.combineHashes(
                        TypeScript.numberHashFn(this.ast.minChar),
                        TypeScript.numberHashFn(this.ast.limChar)));
        }

        public equals(other: ReferenceEntry): bool {
            if (other === null || other === undefined)
                return false;

            return (this.fileName === other.fileName) &&
                (this.ast.minChar === other.ast.minChar) &&
                (this.ast.limChar === other.ast.limChar);
        }
    }

    export class NavigateToItem {
        public name: string = "";
        public kind: string = "";            // see ScriptElementKind
        public kindModifiers: string = "";   // see ScriptElementKindModifier, comma separated
        public matchKind: string = "";
        public fileName: string = TypeScript.unknownLocationInfo.fileName;
        public minChar: number = -1;
        public limChar: number = -1;
        public containerName: string = "";
        public containerKind: string = "";  // see ScriptElementKind
    }

    export class NavigateToContext {
        public options = new TypeScript.AstWalkOptions();
        public fileName: string = TypeScript.unknownLocationInfo.fileName;
        public containerSymbols: TypeScript.Symbol[] = [];
        public containerKinds: string[] = [];
        public containerASTs: TypeScript.AST[] = [];
        public path: TypeScript.AstPath = new TypeScript.AstPath();
        public result: NavigateToItem[] = [];
    }

    export class TextEdit {
        constructor(public minChar: number, public limChar: number, public text: string) {
        }

        static createInsert(pos: number, text: string): TextEdit {
            return new TextEdit(pos, pos, text);
        }
        static createDelete(minChar: number, limChar: number): TextEdit {
            return new TextEdit(minChar, limChar, "");
        }
        static createReplace(minChar: number, limChar: number, text: string): TextEdit {
            return new TextEdit(minChar, limChar, text);
        }
    }

    export class EditorOptions {
        public IndentSize: number = 4;
        public TabSize: number = 4;
        public NewLineCharacter: string = "\r\n";
        public ConvertTabsToSpaces: bool = true;
    }

    export class FormatCodeOptions extends EditorOptions {
        public InsertSpaceAfterCommaDelimiter: bool = true;
        public InsertSpaceAfterSemicolonInForStatements: bool = true;
        public InsertSpaceBeforeAndAfterBinaryOperators: bool = true;
        public InsertSpaceAfterKeywordsInControlFlowStatements: bool = true;
        public InsertSpaceAfterFunctionKeywordForAnonymousFunctions: bool = false;
        public InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: bool = false;
        public PlaceOpenBraceOnNewLineForFunctions: bool = false;
        public PlaceOpenBraceOnNewLineForControlBlocks: bool = false;
    }

    export class DefinitionInfo {
        constructor(
            public fileName: string,
            public minChar: number,
            public limChar: number,
            public kind: string,
            public name: string,
            public containerKind: string,
            public containerName: string,
            public overloads: DefinitionInfo[]) {
        }
    }

    export class TypeInfo {
        constructor(
            public memberName: TypeScript.MemberName,
            public docComment: string,
            public fullSymbolName: string,
            public kind: string,
            public minChar: number,
            public limChar: number) {
        }
    }

    export class SpanInfo {
        constructor(public minChar: number, public limChar: number, public text: string = null) {
        }
    }

    export class SignatureInfo {
        public actual: ActualSignatureInfo;
        public formal: FormalSignatureInfo;
        public activeFormal: number; // Index of the "best match" formal signature
    }

    export class FormalSignatureInfo {
        public name: string;
        public isNew: bool;
        public openParen: string;
        public closeParen: string;
        public docComment: string;
        public signatureGroup: FormalSignatureItemInfo[] = [];
    }

    export class FormalSignatureItemInfo {
        public parameters: FormalParameterInfo[] = [];   // Array of parameters
        public returnType: string;                          // String representation of parameter type
        public docComment: string; // Help for the signature
    }

    export class FormalParameterInfo {
        public name: string;        // Parameter name
        public type: string;        // String representation of parameter type
        public isOptional: bool;    // true if parameter is optional
        public isVariable: bool;    // true if parameter is var args
        public docComment: string; // Comments that contain help for the parameter
    }

    export class ActualSignatureInfo {
        public openParenMinChar: number;
        public closeParenLimChar: number;
        public currentParameter: number; // Index of active parameter in "parameters" array
        public parameters: ActualParameterInfo[] = [];
    }

    export class ActualParameterInfo {
        public minChar: number;
        public limChar: number;
    }

    export class CompletionInfo {
        public maybeInaccurate = false;
        public isMemberCompletion = false;
        public entries: CompletionEntry[] = [];
    }

    export class CompletionEntry {
        public name = "";
        public type = "";
        public kind = "";            // see ScriptElementKind
        public kindModifiers = "";   // see ScriptElementKindModifier, comma separated
        public fullSymbolName = "";
        public docComment = "";
    }

    export class ScriptElementKind {
        static unknown = "";

        // predefined type (void) or keyword (class)
        static keyword = "keyword";

        // top level script node
        static scriptElement = "script";

        // module foo {}
        static moduleElement = "module";

        // class X {}
        static classElement = "class";

        // interface Y {}
        static interfaceElement = "interface";

        // enum E
        static enumElement = "enum";

        // Inside module and script only
        // var v = ..
        static variableElement = "var";

        // Inside function
        static localVariableElement = "local var";

        // Inside module and script only
        // function f() { }
        static functionElement = "function";

        // Inside function
        static localFunctionElement = "local function";

        // class X { [public|private]* foo() {} }
        static memberFunctionElement = "method";

        // class X { [public|private]* [get|set] foo:number; }
        static memberGetAccessorElement = "getter";
        static memberSetAccessorElement = "setter";

        // class X { [public|private]* foo:number; }
        // interface Y { foo:number; }
        static memberVariableElement = "property";

        // class X { constructor() { } }
        static constructorImplementationElement = "constructor";

        // interface Y { ():number; }
        static callSignatureElement = "call";

        // interface Y { []:number; }
        static indexSignatureElement = "index";

        // interface Y { new():Y; }
        static constructSignatureElement = "construct";

        // function foo(*Y*: string)
        static parameterElement = "parameter";
    }

    export class ScriptElementKindModifier {
        static none = "";
        static publicMemberModifier = "public";
        static privateMemberModifier = "private";
        static exportedModifier = "export";
        static ambientModifier = "declare";
        static staticModifier = "static";
    }

    export class MatchKind {
        static none: string = null;
        static exact = "exact";
        static subString = "substring";
        static prefix = "prefix";
    }

    export class ScriptSyntaxASTState {
        public version: number;
        public syntaxTree: TypeScript.SyntaxTree;
        public fileName: string;

        constructor() {
            this.version = -1;
            this.fileName = null;
        }
    }

    export interface IOutputFile {
        name: string;
        useUTF8encoding: bool;
        text: string;
    }
}
