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
    //
    // Cache known state of scripts information from host across language service calls.
    // Used to help with incremental behavior of language service.
    //
    export class ScriptMap {
        private map: TypeScript.StringHashTable;

        constructor() {
            // script id => ScriptMapEntry
            this.map = new TypeScript.StringHashTable();
        }

        public setEntry(id: string, version: number) {
            var entry: ScriptMapEntry = this.map.lookup(id);
            if (entry == null) {
                entry = new ScriptMapEntry(version);
                this.map.add(id, entry);
            }
            else {
                entry.version = version;
            }
        }

        public getEntry(id: string): ScriptMapEntry {
            return this.map.lookup(id);
        }
    }

    export class ScriptMapEntry {
        constructor(public version: number) {
        }
    }

    //
    // An cache entry in HostCache 
    //
    export class HostCacheEntry {
        private _sourceText: TypeScript.IScriptSnapshot;

        constructor(
            private fileName: string,
            private host: ILanguageServiceHost,
            public version: number) {
            this._sourceText = null;
        }
        
        public getScriptSnapshot(): TypeScript.IScriptSnapshot {
            if (this._sourceText === null) {
                this._sourceText = this.host.getScriptSnapshot(this.fileName);
            }

            return this._sourceText;
        }
    }

    //
    // Cache host information about scripts. Should be refreshed 
    // at each language service public entry point, since we don't know when 
    // set of scripts handled by the host changes.
    //
    export class HostCache {
        private map: TypeScript.StringHashTable;

        constructor(public host: ILanguageServiceHost) {
            // script id => script index
            this.map = new TypeScript.StringHashTable();

            var fileNames = this.host.getScriptFileNames();
            for (var i = 0, n = fileNames.length; i < n; i++) {
                var fileName = fileNames[i];
                this.map.add(fileName, new HostCacheEntry(
                    fileName, this.host, this.host.getScriptVersion(fileName)));
            }
        }

        public contains(fileName: string): bool {
            return this.map.lookup(fileName) !== null;
        }

        public getFileNames(): string[]{
            return this.map.getAllKeys();
        }

        public getVersion(fileName: string): number {
            return this.map.lookup(fileName).version;
        }

        public getScriptSnapshot(fileName: string): TypeScript.IScriptSnapshot {
            return this.map.lookup(fileName).getScriptSnapshot();
        }
    }

    export class UnitErrors {
        public parseErrors: TypeScript.ErrorEntry[];
        public typeCheckErrors: TypeScript.ErrorEntry[];

        constructor() {
            this.parseErrors = [];
            this.typeCheckErrors = [];
        }
    }

    export class CompilerErrorCollector {
        private parseMode = false;
        public fileNameToUnitErrors = new TypeScript.StringHashTable();
        
        constructor(public logger: TypeScript.ILogger) {
        }

        private getOrCreateUnitErrors(fileName: string): UnitErrors {
            var unitErrors: UnitErrors = this.fileNameToUnitErrors.lookup(fileName);
            if (unitErrors === null) {
                unitErrors = new UnitErrors();
                this.fileNameToUnitErrors.add(fileName, unitErrors);
            }

            return unitErrors;
        }

        public startParsing(fileName: string) {
            //logger.log("Start parsing unit " + unitIndex);
            this.parseMode = true;
            var unitErrors = this.getOrCreateUnitErrors(fileName);
            unitErrors.parseErrors.length = 0;
        }

        public startTypeChecking() {
            //logger.log("Start type checking");

            this.parseMode = false;
            var fileNames = this.fileNameToUnitErrors.getAllKeys();
            for (var i = 0; i < fileNames.length; i++) {
                var errors = this.getOrCreateUnitErrors(fileNames[i]);
                errors.typeCheckErrors.length = 0;
            }
        }

        public reportError(pos: number, len: number, message: string, fileName: string) {
            //logger.log("Compiler reported error in unit index " + unitIndex + " at span(" + pos + ", " + (pos + len) + "): " + message + " (parseMode=" + parseMode + ")");

            var entry = new TypeScript.ErrorEntry(fileName, pos, pos + len, message);
            var unitErrors = this.getOrCreateUnitErrors(fileName);

            if (this.parseMode) {
                unitErrors.parseErrors.push(entry);
            }
            else {
                unitErrors.typeCheckErrors.push(entry);
            }
        }
    }

    class TextWriter implements ITextWriter {
        public text: string;
        constructor(public name: string, public useUTF8encoding: bool) {
            this.text = "";
        }

        public Write(s) {
            this.text += s;
        }

        public WriteLine(s) {
            this.text += s + '\n';
        }

        public Close() {
        }
    }

    export class CompilerState {
        public logger: TypeScript.ILogger;
        //
        // State related to compiler instance
        //
        private compiler: TypeScript.TypeScriptCompiler;
        private errorCollector: CompilerErrorCollector;
        private scriptMap: ScriptMap;
        private hostCache: HostCache;
        private symbolTree: SymbolTree;
        private compilationSettings: TypeScript.CompilationSettings;

        constructor(public host: ILanguageServiceHost) {
            this.logger = this.host;
            //
            // State related to compiler instance
            //
            this.compiler = null;
            this.errorCollector = null;
            this.scriptMap = null; // Map from fileName to FileMapEntry

            //
            // State recomputed at every "refresh" call (performance)
            //
            this.hostCache = null;
            this.symbolTree = null;
            this.compilationSettings = null;
        }

        public getCompilationSettings() {
            return this.compilationSettings;
        }

        private setUnitMapping(fileName: string) {
            this.scriptMap.setEntry(fileName, this.hostCache.getVersion(fileName));
        }

        private onTypeCheckStarting(): void {
            this.errorCollector.startTypeChecking();
            this.symbolTree = new SymbolTree(this);
        }

        public getSymbolTree(): ISymbolTree {
            return this.symbolTree;
        }

        public anyType() {
            return this.compiler.typeFlow.anyType;
        }

        public getFileNames(): string[]{
            return this.compiler.fileNameToScript.getAllKeys();
        }

        public getScript(fileName: string): TypeScript.Script {
            return this.compiler.fileNameToScript.lookup(fileName)
        }

        public getScripts(): TypeScript.Script[]{
            return this.compiler.getScripts();
        }

        public getScriptVersion(fileName: string) {
            return this.hostCache.getVersion(fileName);
        }

        private addCompilerUnit(compiler: TypeScript.TypeScriptCompiler, fileName: string) {
            this.errorCollector.startParsing(fileName);

            //Note: We need to call "_setUnitMapping" _before_ calling into the compiler,
            //      in case the compiler fails (i.e. throws an exception). This is due to the way
            //      we recover from those failure (we still report errors to the host, 
            //      and we need unit mapping info to do that correctly.
            this.setUnitMapping(fileName);

            var newScript = compiler.addSourceUnit(
                this.hostCache.getScriptSnapshot(fileName), fileName);
        }

        private updateCompilerUnit(compiler: TypeScript.TypeScriptCompiler,
                                   fileName: string): TypeScript.UpdateUnitResult {
            var previousEntry = this.scriptMap.getEntry(fileName);

            //
            // If file version is the same, assume no update
            //
            var version = this.hostCache.getVersion(fileName);
            if (previousEntry.version === version) {
                //logger.log("Assumed unchanged unit: " + unitIndex + "-"+ fileName);
                return TypeScript.UpdateUnitResult.noEdits(fileName); // not updated
            }

            if (this.compilationSettings.usePull) {
                this.updateSyntaxTree(fileName);
            }

            //
            // Otherwise, we need to re-parse/retypecheck the file (maybe incrementally)
            //
            var result = this.attemptIncrementalUpdateUnit(fileName);
            if (result != null) {
                return result;
            }

            var sourceText = this.hostCache.getScriptSnapshot(fileName);
            this.setUnitMapping(fileName);
            return compiler.partialUpdateUnit(sourceText, fileName, true/*setRecovery*/);
        }

        private updateSyntaxTree(fileName: string): void {
            var previousScript = this.getScriptAST(fileName);
            var editRange = this.getScriptTextChangeRange(previousScript);
            if (editRange !== null) {
                var newSourceText = this.getScriptSnapshot(previousScript);
                var newText = new TypeScript.SegmentedScriptSnapshot(newSourceText);

                var previousSyntaxTree = this.getSyntaxTree(fileName);
                var nextSyntaxTree = TypeScript.Parser1.incrementalParse(
                    previousSyntaxTree.sourceUnit(), [editRange], newText);

                this.setSyntaxTree(fileName, nextSyntaxTree);
            }
        }

        private attemptIncrementalUpdateUnit(fileName: string): TypeScript.UpdateUnitResult {
            var previousScript = this.getScriptAST(fileName);
            
            var newSourceText = this.getScriptSnapshot(previousScript);
            var editRange = this.getScriptTextChangeRange(previousScript);

            var result = new TypeScript.IncrementalParser(this.logger).attemptIncrementalUpdateUnit(previousScript, fileName, newSourceText, editRange);
            if (result == null)
                return null;

            if (result.kind === TypeScript.UpdateUnitKind.EditsInsideSingleScope) {
                if (result.scope1.nodeType != TypeScript.NodeType.FuncDecl) {
                    this.logger.log("  Bailing out because containing scope is not a function");
                    return null;
                }
            }

            //TODO: We don't enable incremental right now, as it would break IDE error reporting
            if (true) {
                this.logger.log("  Bailing out because incremental typecheck is not implemented yet");
                return null;
            }
            else {
                return result;
            }
        }

        private getHostCompilationSettings() {
            var settings = this.host.getCompilationSettings();
            if (settings !== null) {
                return settings;
            }

            // Set "ES5" target by default for language service
            settings = new TypeScript.CompilationSettings();
            settings.codeGenTarget = TypeScript.CodeGenTarget.ES5;
            return settings;
        }

        private createCompiler() {
            var outerr = { Write: (s) => { }, WriteLine: (s) => { }, Close: () => { } };

            // Create and initialize compiler
            this.logger.log("Initializing compiler");

            this.compilationSettings = new TypeScript.CompilationSettings();
            
            Services.copyDataObject(this.compilationSettings, this.getHostCompilationSettings());
            this.compiler = new TypeScript.TypeScriptCompiler(outerr, this.logger, this.compilationSettings);
            this.scriptMap = new ScriptMap();
            this.errorCollector = new CompilerErrorCollector(this.logger);

            //TODO: "bind" doesn't work here in the context of running unit tests
            //compiler.setErrorCallback(errorCollector.reportError.bind(errorCollector));
            this.compiler.setErrorCallback((a, b, c, d) => { this.errorCollector.reportError(a, b, c, d); });
            this.compiler.parser.errorRecovery = true;

            // Add unit for all source files
            var fileNames = this.host.getScriptFileNames();
            for (var i = 0, n = fileNames.length; i < n; i++) {
                this.addCompilerUnit(this.compiler, fileNames[i]);
            }

            // Initial typecheck
            this.onTypeCheckStarting();
            this.compiler.typeCheck()
        }

        public minimalRefresh(): void {
            if (this.compiler === null) {
                this.refresh();
                return;
            }

            // Reset the cache at start of every refresh
            this.hostCache = new HostCache(this.host);
        }

        public refresh(throwOnError: bool = true): void {
            // Reset the cache at start of every refresh
            this.hostCache = new HostCache(this.host);

            // If full refresh not needed, attempt partial refresh
            if (!this.fullRefresh()) {
                this.partialRefresh();
            }

            // Debugging: log version and unit index mapping data
            if (this.logger.information()) {
                var fileNames = this.compiler.fileNameToLocationInfo.getAllKeys();
                for (var i = 0; i < fileNames.length; i++) {
                    this.logger.log("compiler unit[" + i + "].fileName='" + fileNames[i] + "'");
                }

                var fileNames = this.hostCache.getFileNames();
                for (var i = 0; i < fileNames.length; i++) {
                    var fileName = fileNames[i];
                    this.logger.log("host script[" + i + "].fileName='" + fileName + "', version=" + this.hostCache.getVersion(fileName));
                }
            }
        }

        //
        // Re-create a fresh compiler instance if needed. 
        // Return "true" if a fresh compiler instance was created. 
        //
        private fullRefresh(): bool {
            // Initial state: no compiler yet
            if (this.compiler == null) {
                this.logger.log("Creating new compiler instance because there is no currently active instance");
                this.createCompiler();
                return true;
            }

            // If any compilation settings changes, a new compiler instance is needed
            if (!Services.compareDataObjects(this.compilationSettings, this.getHostCompilationSettings())) {
                this.logger.log("Creating new compiler instance because compilation settings have changed.");
                this.createCompiler();
                return true;
            }

            /// If any file was deleted, we need to create a new compiler, because we are not
            /// even close to supporting removing symbols (unitindex will be all over the place
            /// if we remove scripts from the list).
            var fileNames = this.compiler.fileNameToLocationInfo.getAllKeys();
            for (var unitIndex = 0, len = fileNames.length; unitIndex < len; unitIndex++) {
                var fileName = fileNames[unitIndex];

                if (!this.hostCache.contains(fileName)) {
                    this.logger.log("Creating new compiler instance because of unit is not part of program anymore: " + unitIndex + "-" + fileName);
                    this.createCompiler();
                    return true;
                }
            }

            // We can attempt a partial refresh
            return false;
        }

        // Attempt an incremental refresh of the compiler state.
        private partialRefresh(): void {
            this.logger.log("Updating files...");

            var updateResults: TypeScript.UpdateUnitResult[] = [];
            function getSingleFunctionEdit(updateResults: TypeScript.UpdateUnitResult[]) {
                var result: TypeScript.UpdateUnitResult = null;
                for (var i = 0, len = updateResults.length; i < len; i++) {
                    var entry = updateResults[i];
                    if (entry.kind == TypeScript.UpdateUnitKind.EditsInsideSingleScope) {
                        if (result === null)
                            result = entry;
                        else {
                            result = null;
                            break;
                        }
                    } else if (entry.kind == TypeScript.UpdateUnitKind.Unknown) {
                        result = null;
                        break;
                    }
                }
                return result;
            }
            var fileAdded: bool = false;

            // foreach file in the list of new files
            //   if there was a file with the same name before
            //      update it if content has changed
            //   else
            //      add it
            var fileNames = this.host.getScriptFileNames();
            for (var i = 0, n = fileNames.length; i < n; i++) {
                var fileName = fileNames[i];

                if (this.compiler.fileNameToLocationInfo.lookup(fileName)) {
                    var updateResult = this.updateCompilerUnit(this.compiler, fileName);
                    updateResults.push(updateResult);
                }
                else {
                    this.addCompilerUnit(this.compiler, fileName);
                    fileAdded = true;
                }
            }

            // Are we in an incremental update situation?
            var incrementalTypeCheckSuccessful = false;
            var singleEdit = getSingleFunctionEdit(updateResults);
            if (fileAdded === false && singleEdit !== null) {
                this.logger.log("Attempting incremental type check because there was a single edit to the function \"" + (<TypeScript.FuncDecl>singleEdit.scope1).name.actualText + "\"");
                incrementalTypeCheckSuccessful = this.attemptIncrementalTypeCheck(singleEdit);
            }

            // Incremental was not applicable, fall back to full typecheck
            if (!incrementalTypeCheckSuccessful) {
                // Apply changes to units
                var anythingUpdated = false;
                var i = 0;

                for (i = 0, n = updateResults.length; i < n; i++) {
                    var entry = updateResults[i];
                    if (this.applyUpdateResult(entry))
                        anythingUpdated = true;
                }

                if (anythingUpdated) {
                    this.logger.log("Incremental type check not applicable, processing unit updates");
                    this.onTypeCheckStarting();
                    this.compiler.reTypeCheck();
                }
                else {
                    this.logger.log("No updates to source files, no typecheck needed");
                }
            }
        }

        private attemptIncrementalTypeCheck(updateResult: TypeScript.UpdateUnitResult): bool {
            var success = this.compiler.attemptIncrementalTypeCheck(updateResult);
            if (success) {
                this.applyUpdateResult(updateResult);
            }
            return success;
        }

        private applyUpdateResult(updateResult: TypeScript.UpdateUnitResult): bool {
            switch (updateResult.kind) {
                case TypeScript.UpdateUnitKind.NoEdits:
                    return false;
                case TypeScript.UpdateUnitKind.Unknown:
                case TypeScript.UpdateUnitKind.EditsInsideSingleScope:
                    this.errorCollector.startParsing(updateResult.fileName);
                    return this.compiler.applyUpdateResult(updateResult);
            }
        }

        public getScriptAST(fileName: string): TypeScript.Script {
            return <TypeScript.Script>this.compiler.fileNameToScript.lookup(fileName);
        }

        public getSyntaxTree(fileName: string): TypeScript.SyntaxTree {
            return <TypeScript.SyntaxTree>this.compiler.fileNameToSyntaxTree.lookup(fileName);
        }

        public setSyntaxTree(fileName: string, syntaxTree: TypeScript.SyntaxTree): void {
            this.compiler.fileNameToSyntaxTree.addOrUpdate(fileName, syntaxTree);
        }

        public getLineMap(fileName: string): number[] {
            return this.compiler.fileNameToLocationInfo.lookup(fileName);
        }

        public getScopeEntries(enclosingScopeContext: TypeScript.EnclosingScopeContext, getPrettyTypeName?: bool) {
            return new TypeScript.ScopeTraversal(this.compiler).getScopeEntries(enclosingScopeContext, getPrettyTypeName);
        }

        public getErrorEntries(maxCount: number, filter: (fileName: string, error: TypeScript.ErrorEntry) =>bool): TypeScript.ErrorEntry[] {
            var entries: TypeScript.ErrorEntry[] = [];
            var count = 0;

            var addError = (error: TypeScript.ErrorEntry): bool => {
                error.message = error.message;
                entries.push(error);
                count++;
                return (count < maxCount);
            }

            var fileNames = this.errorCollector.fileNameToUnitErrors.getAllKeys();
            for (var unitIndex = 0, len = fileNames.length; unitIndex < len; unitIndex++) {
                var fileName = fileNames[unitIndex];
                var errors: UnitErrors = this.errorCollector.fileNameToUnitErrors.lookup(fileName);
                if (errors !== undefined) {
                    for (var i = 0; i < errors.parseErrors.length; i++) {
                        var error = errors.parseErrors[i];
                        if (filter(fileName, error)) {
                            if (!addError(error)) {
                                break;
                            }
                        }
                    }

                    for (i = 0; i < errors.typeCheckErrors.length; i++) {
                        error = errors.typeCheckErrors[i];
                        if (filter(fileName, error)) {
                            if (!addError(error)) {
                                break;
                            }
                        }
                    }
                }
            }

            // Convert "unitIndex" into host units
            var result: TypeScript.ErrorEntry[] = [];
            for (i = 0; i < entries.length; i++) {
                var e = entries[i];
                var ne = new TypeScript.ErrorEntry(e.fileName, e.minChar, e.limChar, e.message);
                result.push(ne);
            }

            return result;
        }

        public cleanASTTypesForReTypeCheck(ast: TypeScript.AST): void {
            this.compiler.cleanASTTypesForReTypeCheck(ast);
        }

        public getScriptTextChangeRange(script: TypeScript.Script): TypeScript.TextChangeRange {
            var lastKnownVersion = this.scriptMap.getEntry(script.locationInfo.fileName).version;
            return this.getScriptTextChangeRangeSinceVersion(script.locationInfo.fileName, lastKnownVersion);
        }

        public getScriptTextChangeRangeSinceVersion(fileName: string, lastKnownVersion: number): TypeScript.TextChangeRange {
            var currentVersion = this.hostCache.getVersion(fileName);
            if (lastKnownVersion === currentVersion) {
                return null; // "No changes"
            }

            return this.host.getScriptTextChangeRangeSinceVersion(fileName, lastKnownVersion);
        }

        public getScriptSnapshot(script: TypeScript.Script): TypeScript.IScriptSnapshot {
            return this.hostCache.getScriptSnapshot(script.locationInfo.fileName);
        }

        public getScriptSnapshot2(fileName: string): TypeScript.IScriptSnapshot {
            return this.hostCache.getScriptSnapshot(fileName);
        }

        // Since we don't have incremental parsing or typecheck, we resort to parsing the whole source text
        // and return a "syntax only" AST. For example, we use this for formatting engine.
        // We will change this when we have incremental parsing.
        public getScriptSyntaxAST(fileName: string): ScriptSyntaxAST {
            var sourceText = this.hostCache.getScriptSnapshot(fileName);

            var parser = new TypeScript.Parser();
            parser.setErrorRecovery(null);
            parser.errorCallback = (a, b, c, d) => { };

            var script = parser.parse(sourceText, fileName, 0);

            return new ScriptSyntaxAST(this.logger, script, sourceText);
        }

        public getEmitOutput(fileName: string): IOutputFile[] {
            var result: IOutputFile[] = [];

            // Check for parse errors
            var errors: UnitErrors = this.errorCollector.fileNameToUnitErrors.lookup(fileName);
            if (errors !== undefined && errors.parseErrors.length > 0) {
                return result;
            }

            var emitterIOHost = {
                createFile: (fileName: string, useUTF8encoding?: bool = false) => {
                    var outputFile = new TextWriter(fileName, useUTF8encoding);
                    result.push(outputFile);
                    return outputFile;
                },
                directoryExists: (fname: string) => true,
                fileExists: (fname: string) => false,
                resolvePath: (fname: string) => fname
            };

            // Call the emitter
            var script = <TypeScript.Script>this.compiler.fileNameToScript.lookup(fileName);
            this.compiler.parseEmitOption(emitterIOHost)
            this.compiler.emitUnit(script);
            // Only emit declarations if there are no type errors
            if (errors == undefined || errors.typeCheckErrors.length == 0) {
                this.compiler.emitDeclarationsUnit(script);
            }

            return result;
        }
    }
}
