// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='typescriptServices.ts' />

module Services {
    export class PullCompilerState {

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

            var newScript = compiler.addSourceUnit(this.hostCache.getScriptSnapshot(fileName), fileName);
        }

        private getHostCompilationSettings(): TypeScript.CompilationSettings {
            var settings = this.host.getCompilationSettings();
            if (settings !== null) {
                return settings;
            }

            // Set "ES5" target by default for language service
            settings = new TypeScript.CompilationSettings();
            settings.codeGenTarget = TypeScript.CodeGenTarget.ES5;
            settings.usePull = true;
            return settings;
        }

        private createCompiler() {
            var outfile = { Write: (s) => { }, WriteLine: (s) => { }, Close: () => { } };
            var outerr = { Write: (s) => { }, WriteLine: (s) => { }, Close: () => { } };

            // Create and initialize compiler
            this.logger.log("Initializing compiler");

            this.compilationSettings = new TypeScript.CompilationSettings();
            
            Services.copyDataObject(this.compilationSettings, this.getHostCompilationSettings());
            this.compilationSettings.usePull = true;
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
            this.compiler.pullTypeCheck();
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
            //if (!Services.compareDataObjects(this.compilationSettings, this.getHostCompilationSettings())) {
            //    this.logger.log("Creating new compiler instance because compilation settings have changed.");
            //    this.createCompiler();
            //    return true;
            //}

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

        public getScriptAST(fileName: string): TypeScript.Script {
            return <TypeScript.Script>this.compiler.fileNameToScript.lookup(fileName);
        }

        public createSyntaxTree(fileName: string): TypeScript.SyntaxTree {
            var sourceText = this.getScriptSnapshot2(fileName);
            var text = new TypeScript.SegmentedScriptSnapshot(sourceText);
            return TypeScript.Parser1.parse(text);
        }

        public getSyntaxTree(fileName: string): TypeScript.SyntaxTree {
            var syntaxTree = this.compiler.fileNameToSyntaxTree.lookup(fileName);
            if (syntaxTree === null) {
                syntaxTree = this.createSyntaxTree(fileName);
                this.compiler.fileNameToSyntaxTree.addOrUpdate(fileName, syntaxTree);
            }

            return syntaxTree;
        }

        public setSyntaxTree(fileName: string, syntaxTree: TypeScript.SyntaxTree): void {
            this.compiler.fileNameToSyntaxTree.addOrUpdate(fileName, syntaxTree);
        }

        public getLineMap(fileName: string): number[] {
            return this.compiler.fileNameToLocationInfo.lookup(fileName).lineMap;
        }

        public getScopeEntries(enclosingScopeContext: TypeScript.EnclosingScopeContext) {
            return new TypeScript.ScopeTraversal(this.compiler).getScopeEntries(enclosingScopeContext);
        }

        public pullGetErrorsForFile(fileName: string): TypeScript.SemanticError[] {
            return this.compiler.pullGetErrorsForFile(fileName);
        }

        public cleanASTTypesForReTypeCheck(ast: TypeScript.AST): void {
            this.compiler.cleanASTTypesForReTypeCheck(ast);
        }

        public getScriptTextChangeRange(fileName: string): TypeScript.TextChangeRange {
            var lastKnownVersion = this.scriptMap.getEntry(fileName).version;
            return this.getScriptTextChangeRangeSinceVersion(fileName, lastKnownVersion);
        }

        public getScriptTextChangeRangeSinceVersion(fileName: string, lastKnownVersion: number): TypeScript.TextChangeRange {
            var currentVersion = this.hostCache.getVersion(fileName);
            if (lastKnownVersion === currentVersion) {
                return TypeScript.TextChangeRange.unchanged; // "No changes"
            }
            
            return this.host.getScriptTextChangeRangeSinceVersion(fileName, lastKnownVersion);
        }

        public getScriptSnapshot(script: TypeScript.Script) {
            return this.hostCache.getScriptSnapshot(script.locationInfo.fileName);
        }

        public getScriptSnapshot2(fileName: string) {
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

        //
        // New Pull stuff
        //
        public getPullTypeInfoAtPosition(pos: number, script: TypeScript.Script) {
            return this.compiler.pullGetTypeInfoAtPosition(pos, script);
        }

        public getPullSymbolAtPosition(pos: number, script: TypeScript.Script) {
            return this.compiler.resolvePosition(pos, script);
        }

        public getSymbolInformationFromPath(path: TypeScript.AstPath, script: TypeScript.Script) {
            return this.compiler.pullGetSymbolInformationFromPath(path, script);
        }

        public getCallInformationFromPath(path: TypeScript.AstPath, script: TypeScript.Script) {
            return this.compiler.pullGetCallInformationFromPath(path, script);
        }

        public getVisibleMemberSymbolsFromPath(path: TypeScript.AstPath, script: TypeScript.Script) {
            return this.compiler.pullGetVisibleMemberSymbolsFromPath(path, script);
        }

        public getVisibleSymbolsFromPath(path: TypeScript.AstPath, script: TypeScript.Script) {
            return this.compiler.pullGetVisibleSymbolsFromPath(path, script);
        }

        private updateCompilerUnit(compiler: TypeScript.TypeScriptCompiler, fileName: string): bool {
            var previousEntry = this.scriptMap.getEntry(fileName);

            //
            // If file version is the same, assume no update
            //
            var version = this.hostCache.getVersion(fileName);
            if (previousEntry.version === version) {
                //logger.log("Assumed unchanged unit: " + unitIndex + "-"+ fileName);
                return false;
            }

            if (this.compilationSettings.usePull) {
                this.updateSyntaxTree(fileName);
            }

            //
            // Otherwise, we need to re-parse/retypecheck the file (maybe incrementally)
            //

            var sourceText = this.hostCache.getScriptSnapshot(fileName);
            this.setUnitMapping(fileName);
            return compiler.pullUpdateUnit(sourceText, fileName, true/*setRecovery*/);
        }

        private updateSyntaxTree(fileName: string): void {
            var newText = new TypeScript.SegmentedScriptSnapshot(this.getScriptSnapshot2(fileName));

            var editRange = this.getScriptTextChangeRange(fileName);
            if (editRange === null) {
                // Unknown edit.  Do a full parse.
                this.setSyntaxTree(fileName, TypeScript.Parser1.parse(newText));
            }
            else {
                // DO an incremental parser.
                this.setSyntaxTree(
                    fileName,
                    TypeScript.Parser1.incrementalParse(this.getSyntaxTree(fileName), editRange, newText));
            }
        }

        // Attempt an incremental refresh of the compiler state.
        private partialRefresh(): void {
            this.logger.log("Updating files...");

            var fileAdded: bool = false;

            var fileNames = this.host.getScriptFileNames();
            for (var i = 0, n = fileNames.length; i < n; i++) {
                var fileName = fileNames[i];

                if (this.compiler.fileNameToLocationInfo.lookup(fileName)) {
                    this.updateCompilerUnit(this.compiler, fileName);
                }
                else {
                    this.addCompilerUnit(this.compiler, fileName);
                    fileAdded = true;
                }
            }

            if (fileAdded) {
                this.compiler.pullTypeCheck(true);
            }
        }
    }
}