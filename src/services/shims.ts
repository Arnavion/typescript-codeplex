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


module Services {

    export interface IScriptSnapshotShim {
        // Get's a portion of the script snapshot specified by [start, end).  
        getText(start: number, end: number): string;

        // Get's the length of this script snapshot.
        getLength(): number;

        // This call returns the JSON encoded array of the type:
        //  number[]
        getLineStartPositions(): string;

        // Returns a JSON encoded value of the type:
        //  { span: { start: number; length: number }; newLength: number }
        //
        // Or null value if there was no change.
        getTextChangeRangeSinceVersion(scriptVersion: number): string;
    }

    //
    // Public interface of the host of a language service shim instance.
    //
    export interface ILanguageServiceShimHost extends TypeScript.ILogger {
        getCompilationSettings(): string;

        // Returns a JSON encoded value of the type:
        // string[]
        getScriptFileNames(): string;
        getScriptVersion(fileName: string): number;
        getScriptSnapshot(fileName: string): IScriptSnapshotShim;
    }

    //
    // Public interface of of a language service instance shim.
    //
    export interface IShimFactory {
        registerShim(shim: IShim): void;
        unregisterShim(shim: IShim): void;
    }

    export interface IShim {
        dispose(dummy: any): void;
    }

    export class ShimBase implements IShim {
        constructor(private factory: IShimFactory) {
            factory.registerShim(this);
        }
        public dispose(dummy: any): void {
            this.factory.unregisterShim(this);
        }
    }

    export interface ILanguageServiceShim extends IShim {
        languageService: Services.IPullLanguageService;

        dispose(dummy: any): void;

        refresh(throwOnError: bool): void;
        
        getSyntacticDiagnostics(fileName: string): string;
        getSemanticDiagnostics(fileName: string): string;

        getCompletionsAtPosition(fileName: string, pos: number, isMemberCompletion: bool);
        getTypeAtPosition(fileName: string, pos: number): string;
        getNameOrDottedNameSpan(fileName: string, startPos: number, endPos: number): string;
        getBreakpointStatementAtPosition(fileName: string, pos: number): string;
        getSignatureAtPosition(fileName: string, pos: number): string;

        // Returns a JSON encoded value of the type:
        // { fileName: string; minChar: number; limChar: number; kind: string; name: string; containerKind: string; containerName: string }
        //
        // Or null value if no definition can be found.
        getDefinitionAtPosition(fileName: string, pos: number): string;

        // Returns a JSON encoded value of the type:
        // { fileName: string; minChar: number; limChar: number; isWriteAccess: bool }[]
        getReferencesAtPosition(fileName: string, pos: number): string;

        // Returns a JSON encoded value of the type:
        // { fileName: string; minChar: number; limChar: number; isWriteAccess: bool }[]
        getOccurrencesAtPosition(fileName: string, pos: number): string;

        // Returns a JSON encoded value of the type:
        // { fileName: string; minChar: number; limChar: number; isWriteAccess: bool }[]
        getImplementorsAtPosition(fileName: string, pos: number): string;

        // Returns a JSON encoded value of the type:
        // { name: string; kind: string; kindModifiers: string; containerName: string; containerKind: string; matchKind: string; fileName: string; minChar: number; limChar: number; } [] = [];
        getNavigateToItems(searchValue: string): string;

        // Returns a JSON encoded value of the type:
        // { name: string; kind: string; kindModifiers: string; containerName: string; containerKind: string; matchKind: string; fileName: string; minChar: number; limChar: number; } [] = [];
        getScriptLexicalStructure(fileName: string): string;

        // Returns a JSON encoded value of the type:
        // { name: string; kind: string; kindModifiers: string; containerName: string; containerKind: string; matchKind: string; fileName: string; minChar: number; limChar: number; } [] = [];
        getOutliningRegions(fileName: string): string;

        getBraceMatchingAtPosition(fileName: string, pos: number): string;
        getSmartIndentAtLineNumber(fileName: string, position: number, options: string/*Services.EditorOptions*/): string;

        getFormattingEditsForRange(fileName: string, minChar: number, limChar: number, options: string/*Services.FormatCodeOptions*/): string;
        getFormattingEditsForDocument(fileName: string, minChar: number, limChar: number, options: string/*Services.FormatCodeOptions*/): string;
        getFormattingEditsOnPaste(fileName: string, minChar: number, limChar: number, options: string/*Services.FormatCodeOptions*/): string;
        getFormattingEditsAfterKeystroke(fileName: string, position: number, key: string, options: string/*Services.FormatCodeOptions*/): string;

        getEmitOutput(fileName: string): string;
    }

    class ScriptSnapshotShimAdapter implements TypeScript.IScriptSnapshot {
        private lineStartPositions: number[] = null;

        constructor(private scriptSnapshotShim: IScriptSnapshotShim) {
        }

        public getText(start: number, end: number): string {
            return this.scriptSnapshotShim.getText(start, end);
        }

        public getLength(): number {
            return this.scriptSnapshotShim.getLength();
        }

        public getLineStartPositions(): number[]{
            if (this.lineStartPositions === null) {
                this.lineStartPositions = JSON.parse(this.scriptSnapshotShim.getLineStartPositions());
            }

            return this.lineStartPositions;
        }

        public getTextChangeRangeSinceVersion(scriptVersion: number): TypeScript.TextChangeRange {
            var encoded = this.scriptSnapshotShim.getTextChangeRangeSinceVersion(scriptVersion);
            if (encoded === null) {
                return null;
            }

            var decoded: { span: { start: number; length: number; }; newLength: number; } = JSON.parse(encoded);
            return new TypeScript.TextChangeRange(
                new TypeScript.TextSpan(decoded.span.start, decoded.span.length), decoded.newLength);
        }
    }

    export class LanguageServiceShimHostAdapter implements Services.ILanguageServiceHost {
        constructor(private shimHost: ILanguageServiceShimHost) {
        }

        public information(): bool {
            return this.shimHost.information();
        }

        public debug(): bool {
            return this.shimHost.debug();
        }

        public warning(): bool {
            return this.shimHost.warning();
        }

        public error(): bool {
            return this.shimHost.error();
        }

        public fatal(): bool {
            return this.shimHost.fatal();
        }

        public log(s: string): void {
            this.shimHost.log(s);
        }

        public getCompilationSettings(): TypeScript.CompilationSettings {
            var settingsJson = this.shimHost.getCompilationSettings();
            if (settingsJson == null || settingsJson == "") {
                return null;
            }
            var settings: TypeScript.CompilationSettings = JSON.parse(<any>settingsJson);
            return settings;
        }

        public getScriptFileNames(): string[] {
            var encoded = this.shimHost.getScriptFileNames();
            return JSON.parse(encoded);
        }

        public getScriptSnapshot(fileName: string): TypeScript.IScriptSnapshot {
            return new ScriptSnapshotShimAdapter(this.shimHost.getScriptSnapshot(fileName));
        }

        public getScriptVersion(fileName: string): number {
            return this.shimHost.getScriptVersion(fileName);
        }
    }

    export function simpleForwardCall(logger: TypeScript.ILogger, actionDescription: string, action: () =>any): any {
        logger.log(actionDescription);
        var start = Date.now();
        var result = action();
        var end = Date.now();
        logger.log(actionDescription + " completed in " + (end - start) + " msec");
        if (typeof (result) === "string") {
            var str = <string>result;
            logger.log("  result.length=" + str.length + ", result=\"" + TypeScript.stringToLiteral(str, 128) + (str.length > 128 ? "..." : "") + "\"");
        }
        return result;
    }

    export function forwardCall(logger: TypeScript.ILogger, actionDescription: string, action: () =>any, throwOnError: bool = false): any {
        try {
            return simpleForwardCall(logger, actionDescription, action);
        }
        catch (err) {
            Services.logInternalError(logger, err);
            if (throwOnError)
                throw err;
            return "##ERROR##" + err.name + "##" + err.message;
        }
    }

    export function forwardJSONCall(logger: TypeScript.ILogger, actionDescription: string, action: () =>any): string {
        try {
            return simpleForwardCall(logger, actionDescription, action);
        }
        catch (err) {
            Services.logInternalError(logger, err);
            //throw err; //TODO: Remove this!
            return _errorToJSON(err);
        }
    }

    function _resultToJSON(result: any): string {
        return JSON.stringify({ result: result });
    }

    function _errorToJSON(err): string {
        return JSON.stringify({ error: err });
    }

    export class LanguageServiceShim extends ShimBase implements ILanguageServiceShim {
        private logger: TypeScript.ILogger;

        constructor(factory: IShimFactory,
                    private host: ILanguageServiceShimHost,
                    public languageService: Services.IPullLanguageService) {
            super(factory);
            this.logger = this.host;
        }

        public forwardCall(actionDescription: string, action: () =>any, throwOnError: bool = false): any {
            return Services.forwardCall(this.logger, actionDescription, action, throwOnError);
        }

        public forwardJSONCall(actionDescription: string, action: () =>any): string {
            return Services.forwardJSONCall(this.logger, actionDescription, action);
        }

        // DISPOSE
        // Ensure (almost) determinstic release of internal Javascript resources when 
        // some external native objects holds onto us (e.g. Com/Interop).
        public dispose(dummy: any): void {
            this.logger.log("dispose()")
            this.languageService = null;
            this.logger = null;

            super.dispose(dummy);
        }

        // REFRESH
        // Update the list of scripts known to the compiler
        public refresh(throwOnError: bool): void {
            this.forwardCall(
                "refresh(" + throwOnError + ")",
                () => {
                    this.languageService.refresh();
                    return null;
                },
                throwOnError);
        }

        /// SQUIGGLES
        ///

        private static realizeDiagnostic(diagnostic: TypeScript.IDiagnostic): { message: string; start: number; length: number; } {
            return { message: diagnostic.message(), start: diagnostic.start(), length: diagnostic.length() };
        }

        public getSyntacticDiagnostics(fileName: string): string {
            return this.forwardJSONCall(
                "getSyntacticDiagnostics(\"" + fileName + "\")",
                () => {
                    var errors = this.languageService.getSyntacticDiagnostics(fileName);
                    return _resultToJSON(errors.map(LanguageServiceShim.realizeDiagnostic));
                });
        }

        public getSemanticDiagnostics(fileName: string): string {
            return this.forwardJSONCall(
                "getSemanticDiagnostics(\"" + fileName + "\")",
                () => {
                    var errors = this.languageService.getSemanticDiagnostics(fileName);
                    return _resultToJSON(errors.map(LanguageServiceShim.realizeDiagnostic));
                });
        }

        /// QUICKINFO
        /// Computes a string representation of the type at the requested position
        /// in the active file.
        public getTypeAtPosition(fileName: string, pos: number): string {
            return this.forwardJSONCall(
                "getTypeAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var typeInfo = this.languageService.getTypeAtPosition(fileName, pos);
                    return _resultToJSON(typeInfo);
                });
        }

        /// NAMEORDOTTEDNAMESPAN
        /// Computes span information of the name or dotted name at the requested position
        // in the active file.
        public getNameOrDottedNameSpan(fileName: string, startPos: number, endPos: number): string {
            return this.forwardJSONCall(
                "getNameOrDottedNameSpan(\"" + fileName + "\", " + startPos + ", "  + endPos + ")",
                () => {
                    var spanInfo = this.languageService.getNameOrDottedNameSpan(fileName, startPos, endPos);
                    return _resultToJSON(spanInfo);
                });
        }

        /// STATEMENTSPAN
        /// Computes span information of statement at the requested position in the active file.
        public getBreakpointStatementAtPosition(fileName: string, pos: number): string {
            return this.forwardJSONCall(
                "getBreakpointStatementAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var spanInfo = this.languageService.getBreakpointStatementAtPosition(fileName, pos);
                    return _resultToJSON(spanInfo);
                });
        }

        /// SIGNATUREHELP
        /// Computes a string representation of the signatures at the requested position
        /// in the active file.
        public getSignatureAtPosition(fileName: string, pos: number): string {
            return this.forwardJSONCall(
                "getSignatureAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var signatureInfo = this.languageService.getSignatureAtPosition(fileName, pos);
                    return _resultToJSON(signatureInfo);
                });
        }

        /// GOTO DEFINITION
        /// Computes the definition location and file for the symbol
        /// at the requested position. 
        public getDefinitionAtPosition(fileName: string, pos: number): string {
            return this.forwardCall(
                "getDefinitionAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var definition = this.languageService.getDefinitionAtPosition(fileName, pos);
                    if (definition === null) {
                        return null;
                    }

                    return JSON.stringify({
                        fileName: definition.fileName,
                        minChar: definition.minChar,
                        limChar: definition.limChar,
                        kind: definition.kind,
                        name: definition.name,
                        containerKind: definition.containerKind,
                        containerName: definition.containerName });
                });
        }

        /// GET BRACE MATCHING
        public getBraceMatchingAtPosition(fileName: string, pos: number): string {
            return this.forwardJSONCall(
                "getBraceMatchingAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var textRanges = this.languageService.getBraceMatchingAtPosition(fileName, pos);
                    return _resultToJSON(textRanges);
                });
        }

        /// GET SMART INDENT
        public getSmartIndentAtLineNumber(fileName: string, position: number, options: string /*Services.EditorOptions*/): string {
            return this.forwardJSONCall(
                "getSmartIndentAtLineNumber(\"" + fileName + "\", " + position + ")",
                () => {
                    var localOptions: Services.EditorOptions = JSON.parse(options);
                    var columnOffset = this.languageService.getSmartIndentAtLineNumber(fileName, position, localOptions);
                    return _resultToJSON({ value: columnOffset });
                });
        }

        /// GET REFERENCES
        ///  Return references to a symbol at the requested position.
        ///  References are separated by "\n".
        ///  Each reference is a "fileindex min lim" sub-string.
        public getReferencesAtPosition(fileName: string, pos: number): string {
            return this.forwardJSONCall(
                "getReferencesAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var entries = this.languageService.getReferencesAtPosition(fileName, pos);
                    return this._referencesToResult(entries);
                });
        }

        public getOccurrencesAtPosition(fileName: string, pos: number): string {
            return this.forwardCall(
                "getOccurrencesAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var entries = this.languageService.getOccurrencesAtPosition(fileName, pos);
                    return this._referencesToResult(entries);
                });
        }

        /// GET IMPLEMENTORS
        public getImplementorsAtPosition(fileName: string, pos: number): string {
            return this.forwardJSONCall(
                "getImplementorsAtPosition(\"" + fileName + "\", " + pos + ")",
                () => {
                    var entries = this.languageService.getImplementorsAtPosition(fileName, pos);
                    return this._referencesToResult(entries);
                });
        }

        private _referencesToResult(entries: Services.ReferenceEntry[]): string {
            var result: { fileName: string; minChar: number; limChar: number; isWriteAccess: bool; }[] = [];
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                result.push({ fileName: entry.fileName, minChar: entry.ast.minChar, limChar: entry.ast.limChar, isWriteAccess: entry.isWriteAccess });
            }

            return JSON.stringify(result);
        }

        /// COMPLETION LISTS
        /// Get a string based representation of the completions 
        /// to provide at the given source position and providing a member completion 
        /// list if requested.
        public getCompletionsAtPosition(fileName: string, pos: number, isMemberCompletion: bool) {
            return this.forwardJSONCall(
                "getCompletionsAtPosition(\"" + fileName + "\", " + pos + ", " + isMemberCompletion + ")",
                () => {
                    var completion = this.languageService.getCompletionsAtPosition(fileName, pos, isMemberCompletion);
                    var result = _resultToJSON(completion);
                    return result;
                });
        }

        /// FORMAT SELECTION
        public getFormattingEditsForRange(fileName: string, minChar: number, limChar: number, options: string/*Services.FormatCodeOptions*/): string {
            return this.forwardJSONCall(
                "getFormattingEditsForRange(\"" + fileName + "\", " + minChar + ", " + limChar + ")",
                () => {
                    var localOptions: Services.FormatCodeOptions = JSON.parse(options);
                    var edits = this.languageService.getFormattingEditsForRange(fileName, minChar, limChar, localOptions);
                    var result = _resultToJSON(edits);
                    return result;
                });
        }

        /// FORMAT DOCUMENT
        public getFormattingEditsForDocument(fileName: string, minChar: number, limChar: number, options: string/*Services.FormatCodeOptions*/): string {
            return this.forwardJSONCall(
                "getFormattingEditsForDocument(\"" + fileName + "\", " + minChar + ", " + limChar + ")",
                () => {
                    var localOptions: Services.FormatCodeOptions = JSON.parse(options);
                    var edits = this.languageService.getFormattingEditsForDocument(fileName, minChar, limChar, localOptions);
                    var result = _resultToJSON(edits);
                    return result;
                });
        }

        /// FORMAT ON PASTE
        public getFormattingEditsOnPaste(fileName: string, minChar: number, limChar: number, options: string/*Services.FormatCodeOptions*/): string {
            return this.forwardJSONCall(
                "getFormattingEditsOnPaste(\"" + fileName + "\", " + minChar + ", " + limChar + ")",
                () => {
                    var localOptions: Services.FormatCodeOptions = JSON.parse(options);
                    var edits = this.languageService.getFormattingEditsOnPaste(fileName, minChar, limChar, localOptions);
                    var result = _resultToJSON(edits);
                    return result;
                });
        }

        /// FORMAT
        public getFormattingEditsAfterKeystroke(fileName: string, position: number, key: string, options: string/*Services.FormatCodeOptions*/): string {
            return this.forwardJSONCall(
                "getFormattingEditsAfterKeystroke(\"" + fileName + "\", " + position + ", \"" + key + "\")",
                () => {
                    var localOptions: Services.FormatCodeOptions = JSON.parse(options);
                    var edits = this.languageService.getFormattingEditsAfterKeystroke(fileName, position, key, localOptions);
                    var result = _resultToJSON(edits);
                    return result;
                });
        }

        /// NAVIGATE TO
        ///  Return a list of symbols that are interesting to navigate to
        public getNavigateToItems(searchValue: string): string {
            return this.forwardCall(
                "getNavigateToItems(\"" + searchValue + "\")",
                () => {
                    var items = this.languageService.getNavigateToItems(searchValue);
                    var result = this._navigateToItemsToString(items);
                    return result;
                });
        }

        // GET SCRIPT LEXICAL STRUCTURE
        //
        public getScriptLexicalStructure(fileName: string): string {
            return this.forwardCall(
                "getScriptLexicalStructure(\"" + fileName + "\")",
                () => {
                    var items = this.languageService.getScriptLexicalStructure(fileName);
                    var result = this._navigateToItemsToString(items);
                    return result;
                });
        }

        // GET OUTLINING REGIONS
        //
        public getOutliningRegions(fileName: string): string {
            return this.forwardCall(
                "getOutliningRegions(\"" + fileName + "\")",
                () => {
                    var items = this.languageService.getOutliningRegions(fileName);
                    return _resultToJSON(items);
                });
        }

        /// Emit
        public getEmitOutput(fileName: string): string {
            return this.forwardJSONCall(
                "getEmitOutput(\"" + fileName + "\")",
                () => {
                    var output = this.languageService.getEmitOutput(fileName);
                    var result = _resultToJSON(output);
                    return result;
                });
        }

        private _navigateToItemsToString(items: Services.NavigateToItem[]): string {
            var result: {
                name: string;
                kind: string;
                kindModifiers: string;
                containerName: string;
                containerKind: string;
                matchKind: string;
                fileName: string;
                minChar: number;
                limChar: number;
            }[] = [];

            for (var i = 0; i < items.length; i++) {
                var item = items[i];

                result.push({
                    name: item.name,
                    kind: item.kind,
                    kindModifiers: item.kindModifiers,
                    containerName: item.containerName,
                    containerKind: item.containerKind,
                    matchKind: item.matchKind,
                    fileName: item.fileName,
                    minChar: item.minChar,
                    limChar: item.limChar
                });
            }

            return JSON.stringify(result);
        }
    }

    export class ClassifierShim extends ShimBase {
        public classifier: Services.Classifier;

        constructor(factory: IShimFactory, public host: Services.IClassifierHost) {
            super(factory);
            this.classifier = new Services.Classifier(this.host);
        }

        /// COLORIZATION
        public getClassificationsForLine(text: string, lexState: TypeScript.LexState): string {
            var classification = this.classifier.getClassificationsForLine(text, lexState);
            var items = classification.entries;
            var result = "";
            for (var i = 0; i < items.length; i++) {
                result += items[i].length + "\n";
                result += items[i].classification + "\n";
            }
            result += classification.finalLexState;
            return result;
        }
    }

    export class CoreServicesShim extends ShimBase {
        public logger: TypeScript.ILogger;
        public services: Services.CoreServices;

        constructor(factory: IShimFactory, public host: Services.ICoreServicesHost) {
            super(factory);
            this.logger = this.host.logger;
            this.services = new Services.CoreServices(this.host);
        }

        private forwardCall(actionDescription: string, action: () =>any, throwOnError: bool = false): any {
            return Services.forwardCall(this.logger, actionDescription, action, throwOnError);
        }

        private forwardJSONCall(actionDescription: string, action: () =>any): any {
            return Services.forwardJSONCall(this.logger, actionDescription, action);
        }

        ///
        /// getPreProcessedFileInfo
        ///
        public getPreProcessedFileInfo(fileName: string, sourceText: TypeScript.IScriptSnapshot): string {
            return this.forwardJSONCall(
                "getPreProcessedFileInfo(\"" + fileName + "\")",
                () => {
                    var result = this.services.getPreProcessedFileInfo(fileName, sourceText);
                    return _resultToJSON(result);
                });
        }

        ///
        /// getDefaultCompilationSettings
        ///
        public getDefaultCompilationSettings(): string {
            return this.forwardJSONCall(
                "getDefaultCompilationSettings()",
                () => {
                    var result = this.services.getDefaultCompilationSettings();
                    return _resultToJSON(result);
                });
        }

        ///
        /// dumpMemory
        ///
        public dumpMemory(dummy: any): string {
            return this.forwardCall(
                "dumpMemory()",
                () => {
                    return this.services.dumpMemory();
                });
        }

        ///
        /// getMemoryInfo
        ///
        public getMemoryInfo(dummy: any): string {
            return this.forwardJSONCall(
                "getMemoryInfo()",
                () => {
                    var result = this.services.getMemoryInfo();
                    return _resultToJSON(result);
                });
        }
    }
}
