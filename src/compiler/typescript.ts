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
 
///<reference path='diagnostics.ts' />
///<reference path='flags.ts' />
///<reference path='nodeTypes.ts' />
///<reference path='hashTable.ts' />
///<reference path='ast.ts' />
///<reference path='astWalker.ts' />
///<reference path='astWalkerCallback.ts' />
///<reference path='astPath.ts' />
///<reference path='astLogger.ts' />
///<reference path='binder.ts' />
///<reference path='base64.ts' />
///<reference path='sourceMapping.ts' />
///<reference path='emitter.ts' />
///<reference path='errorReporter.ts' />
///<reference path='parser.ts' />
///<reference path='printContext.ts' />
///<reference path='scanner.ts' />
///<reference path='scopeAssignment.ts' />
///<reference path='scopeWalk.ts' />
///<reference path='signatures.ts' />
///<reference path='symbols.ts' />
///<reference path='symbolScope.ts' />
///<reference path='tokens.ts' />
///<reference path='typeChecker.ts' />
///<reference path='typeCollection.ts' />
///<reference path='typeFlow.ts' />
///<reference path='types.ts' />
///<reference path='pathUtils.ts' />
///<reference path='referenceResolution.ts' />
///<reference path='precompile.ts' />
///<reference path='incrementalParser.ts' />
///<reference path='declarationEmitter.ts' />
///<reference path='Syntax\ISyntaxNodeOrToken.ts' />
///<reference path='Syntax\Parser.ts' />
///<reference path='Text\TextFactory.ts' />
///<reference path='typecheck\dataMap.ts' />
///<reference path='typecheck\pullFlags.ts' />
///<reference path='typecheck\pullDecls.ts' />
///<reference path='typecheck\pullSymbols.ts' />
///<reference path='typecheck\pullSymbolBindingContext.ts' />
///<reference path='typecheck\pullTypeResolutionContext.ts' />
///<reference path='typecheck\pullTypeResolution.ts' />
///<reference path='typecheck\pullTypeChecker.ts' />
///<reference path='typecheck\pullDeclDiffer.ts' />
///<reference path='typecheck\pullSemanticInfo.ts' />
///<reference path='typecheck\pullDeclCollection.ts' />
///<reference path='typecheck\pullSymbolBinder.ts' />
///<reference path='typecheck\pullSymbolGraph.ts' />
///<reference path='typecheck\pullEmitter.ts' />
///<reference path='typecheck\pullErrors.ts' />
///<reference path='SyntaxTreeToAstVisitor.ts' />
///<reference path='resources.ts' />
///<reference path='resourceStrings.ts' />
///<reference path='Core\Timer.ts' />

module TypeScript {

    declare var IO;

    export enum UpdateUnitKind {
        Unknown,
        NoEdits,
        EditsInsideSingleScope,
    }

    export class ScriptEditRange {
        constructor (public minChar: number,
                     public limChar: number,
                     public delta: number) { }

        static unknown(): ScriptEditRange {
            return new ScriptEditRange(-1, -1, -1);
        }

        public isUnknown() {
            return this.minChar === -1 && this.limChar === -1 && this.delta === -1;
        }

        public containsPosition(pos: number) {
            return (this.minChar <= pos && pos < this.limChar)
                || (this.minChar <= pos && pos < this.limChar + this.delta);
        }

        public toString(): string {
            return "editRange(minChar=" + this.minChar + ", limChar=" + this.limChar + ", delta=" + this.delta + ")";
        }
    }

    export class UpdateUnitResult {
        constructor (public kind: UpdateUnitKind, public unitIndex: number, public script1: Script, public script2: Script) { }

        public scope1: AST = null;
        public scope2: AST = null;
        public editRange: ScriptEditRange = null;
        public parseErrors: ErrorEntry[] = [];

        static noEdits(unitIndex: number) {
            return new UpdateUnitResult(UpdateUnitKind.NoEdits, unitIndex, null, null);
        }

        static unknownEdits(script1: Script, script2: Script, parseErrors: ErrorEntry[]) {
            var result = new UpdateUnitResult(UpdateUnitKind.Unknown, script1.locationInfo.unitIndex, script1, script2);
            result.parseErrors = parseErrors;

            return result;
        }

        static singleScopeEdits(script1: Script, script2: Script, scope1: AST, scope2: AST, editRange: ScriptEditRange, parseErrors: ErrorEntry[]) {
            var result = new UpdateUnitResult(UpdateUnitKind.EditsInsideSingleScope, script1.locationInfo.unitIndex, script1, script2);
            result.scope1 = scope1;
            result.scope2 = scope2;
            result.editRange = editRange;
            result.parseErrors = parseErrors;
            return result;
        }
    }

    export class ErrorEntry {
        constructor(public unitIndex: number,
                    public minChar: number,
                    public limChar: number,
                    public message: string) { }
    }

    export var defaultSettings = new CompilationSettings();

    export interface EmitterIOHost {
        // function that can even create a folder structure if needed
        createFile(path: string, useUTF8?: bool): ITextWriter;

        // function to check if file exists on the disk
        fileExists(path: string): bool;

        // Function to check if the directory exists on the disk
        directoryExists(path: string): bool;

        // Resolves the path
        resolvePath(path: string): string;
    }

    export class TypeScriptCompiler {
        public parser = new Parser();
        public typeChecker: TypeChecker;
        public typeFlow: TypeFlow = null;
        public scripts = new ASTList();
        public units: LocationInfo[] = [];
        public errorReporter: ErrorReporter;
        public pullErrorReporter: PullErrorReporter;

        public pullTypeChecker: PullTypeChecker = null;
        public semanticInfoChain: SemanticInfoChain = null;

        public persistentTypeState: PersistentGlobalTypeState;

        public emitSettings: EmitOptions;

        public syntaxTrees: SyntaxTree[] = [];

        constructor(public errorOutput: ITextWriter,
                    public logger: ILogger = new NullLogger(),
                    public settings: CompilationSettings = defaultSettings,
                    public diagnosticMessages: TypeScriptDiagnosticMessages = null) {
            this.errorReporter = new ErrorReporter(this.errorOutput);
            this.pullErrorReporter = new PullErrorReporter(this.errorOutput);
            this.persistentTypeState = new PersistentGlobalTypeState(this.errorReporter);
            this.errorReporter.parser = this.parser;
            this.initTypeChecker(this.errorOutput);

            this.parser.style_requireSemi = this.settings.styleSettings.requireSemi;
            this.parser.style_funcInLoop = this.settings.styleSettings.funcInLoop;
            this.parser.inferPropertiesFromThisAssignment = this.settings.inferPropertiesFromThisAssignment;
            this.emitSettings = new EmitOptions(this.settings);

            if (this.diagnosticMessages) {
                typescriptDiagnosticMessages = diagnosticMessages
            }

            codeGenTarget = settings.codeGenTarget;
        }

        public timeFunction(funcDescription: string, func: () => any): any {
            return TypeScript.timeFunction(this.logger, funcDescription, func);
        }

        public initTypeChecker(errorOutput: ITextWriter) {
            // The initial "refresh" initializes the persistent type state
            this.persistentTypeState.refreshPersistentState();
            this.typeChecker = new TypeChecker(this.persistentTypeState);
            this.typeChecker.errorReporter = this.errorReporter;

            // REVIEW: These properties should be moved out of the typeCheck object
            // ideally, CF should be a separate pass, independent of control flow
            this.typeChecker.checkControlFlow = this.settings.controlFlow;
            this.typeChecker.checkControlFlowUseDef = this.settings.controlFlowUseDef;
            this.typeChecker.printControlFlowGraph = this.settings.printControlFlow;

            this.typeChecker.errorsOnWith = this.settings.errorOnWith;
            this.typeChecker.styleSettings = this.settings.styleSettings;
            this.typeChecker.canCallDefinitionSignature = this.settings.canCallDefinitionSignature;

            this.errorReporter.checker = this.typeChecker;
            this.setErrorOutput(this.errorOutput);
        }

        public setErrorOutput(outerr) {
            this.errorOutput = outerr;
            this.errorReporter.setErrOut(outerr);
            this.parser.outfile = outerr;
        }

        public emitCommentsToOutput() {
            this.emitSettings = new EmitOptions(this.settings);
        }

        public setErrorCallback(fn: (minChar: number, charLen: number, message: string,
            unitIndex: number) =>void ) {
            this.parser.errorCallback = fn;
        }

        public updateUnit(prog: string, filename: string, setRecovery: bool) {
            return this.updateSourceUnit(new StringSourceText(prog), filename, setRecovery);
        }

        public updateSourceUnit(sourceText: ISourceText, filename: string, setRecovery: bool): bool {
            return this.timeFunction("updateSourceUnit(" + filename + ")", () => {
                var updateResult = this.partialUpdateUnit(sourceText, filename, setRecovery);
                return this.applyUpdateResult(updateResult);
            });
        }

        // Apply changes to compiler state.
        // Return "false" if the change is empty and nothing was updated.
        public applyUpdateResult(updateResult: UpdateUnitResult): bool {
            switch (updateResult.kind) {
                case UpdateUnitKind.NoEdits:
                    return false;

                case UpdateUnitKind.Unknown:
                    this.scripts.members[updateResult.unitIndex] = updateResult.script2;
                    this.units[updateResult.unitIndex] = updateResult.script2.locationInfo;
                    for (var i = 0, len = updateResult.parseErrors.length; i < len; i++) {
                        var e = updateResult.parseErrors[i];
                        if (this.parser.errorCallback) {
                            this.parser.errorCallback(e.minChar, e.limChar - e.minChar, e.message, e.unitIndex);
                        }
                    }
                    return true;

                case UpdateUnitKind.EditsInsideSingleScope:
                    new IncrementalParser(this.logger).mergeTrees(updateResult);
                    return true;
            }
        }

        public partialUpdateUnit(sourceText: ISourceText, filename: string, setRecovery: bool): UpdateUnitResult {
            return this.timeFunction("partialUpdateUnit(" + filename + ")", () => {
                for (var i = 0, len = this.units.length; i < len; i++) {
                    if (this.units[i].filename == filename) {
                        if ((<Script>this.scripts.members[i]).isResident) {
                            return UpdateUnitResult.noEdits(i);
                        }

                        if (setRecovery) {
                            this.parser.setErrorRecovery(null);
                        }

                        var updateResult: UpdateUnitResult;

                        // Capture parsing errors so that they are part of "updateResult"
                        var parseErrors: ErrorEntry[] = [];
                        var errorCapture = (minChar: number, charLen: number, message: string, unitIndex: number): void => {
                            parseErrors.push(new ErrorEntry(unitIndex, minChar, minChar + charLen, message));
                        };
                        var svErrorCallback = this.parser.errorCallback;
                        if (svErrorCallback)
                            this.parser.errorCallback = errorCapture;

                        var oldScript = <Script>this.scripts.members[i];
                        var newScript = this.parser.parse(sourceText, filename, i);

                        if (svErrorCallback)
                            this.parser.errorCallback = svErrorCallback;

                        updateResult = UpdateUnitResult.unknownEdits(oldScript, newScript, parseErrors);

                        return updateResult;
                    }
                }
                throw new Error("Unknown file \"" + filename + "\"");
            });
        }

        public addUnit(prog: string, filename: string, keepResident? = false, referencedFiles?: IFileReference[] = []): Script {
            return this.addSourceUnit(new StringSourceText(prog), filename, keepResident, referencedFiles);
        }

        private stringTable: Collections.StringTable = Collections.createStringTable();
        
        private typeCollectionTime = 0;

        public addSourceUnit(sourceText: ISourceText, filename: string, keepResident:bool, referencedFiles?: IFileReference[] = []): Script {
            return this.timeFunction("addSourceUnit(" + filename + ", " + keepResident + ")", () => {
                //if (filename.indexOf("getCompletionsAtPosition5") < 0) {
                //    return;
                //}

                var timer = new Timer();
                var sharedIndex = this.units.length;
                var reParsedScript: Script = null;
                
                if (!this.settings.useFidelity) {
                    timer.start();
                    var script: Script = this.parser.parse(sourceText, filename, sharedIndex, AllowedElements.Global);
                    timer.end();

                    reParsedScript = script;
                    
                    var oldParseTime = timer.time;

                    script.referencedFiles = referencedFiles;
                    script.isResident = keepResident;
                    this.persistentTypeState.setCollectionMode(keepResident ? TypeCheckCollectionMode.Resident : TypeCheckCollectionMode.Transient);
                }
                else {
                    var text = new TypeScript.SourceSimpleText(sourceText);

                    timer.start();
                    var syntaxTree = Parser1.parse(text, LanguageVersion.EcmaScript5, this.stringTable);
                    timer.end();

                    var newParseTime = timer.time;

                    if (true || syntaxTree.diagnostics().length === 0) {
                        try {
                            timer.start();
                            var script2: Script = SyntaxTreeToAstVisitor.visit(syntaxTree, filename, sharedIndex);
                            timer.end();

                            var translateTime = timer.time;

                            //if (filename.indexOf("lib.d.ts") >= 0) {
                            //    // IO.stdout.WriteLine("");
                            //    IO.stdout.WriteLine("Old - New - Translate: " + oldParseTime + "\t" + newParseTime + "\t" + translateTime);
                            //    // IO.stdout.WriteLine("    Diff %: " + ((newParseTime + translateTime) / oldParseTime));
                            //}

                            script2.referencedFiles = referencedFiles;
                            script2.isResident = keepResident;

                            reParsedScript = script2;
                             
                            // TypeScriptCompiler.compareObjects(script, script2);
                        } catch (e1) {
                            IO.stdout.WriteLine("Error converting: " + filename);
                            IO.stdout.WriteLine("\t" + e1.message);
                        }
                    }
                     
                    this.syntaxTrees.push(syntaxTree);
                }

                var index = this.units.length;
                this.units[index] = reParsedScript.locationInfo;

                if (!this.settings.usePull) {
                    var typeCollectionStart = new Date().getTime();
                    this.typeChecker.collectTypes(reParsedScript);
                    this.typeCollectionTime += (new Date().getTime()) - typeCollectionStart;
                }

                this.scripts.append(reParsedScript);

                return reParsedScript;
            });
        }

        private static compareObjects(obj1: any, obj2: any): void {
            if (obj1.alreadySeenObject) {
                // Prevent recursion.
                return;
            }
            obj1.alreadySeenObject = true;

            for (var name in obj1) {
                if (name === "limChar" ||
                    name === "minChar" ||
                    name === "astID" ||
                    name === "leftCurlyCount" ||
                    name === "rightCurlyCount" ||
                    name === "flags" ||
                    name === "varFlags" ||
                    name === "fncFlags" ||
                    name === "modFlags" ||
                    name === "nestingLevel" ||
                    name === "constructorNestingLevel" ||
                    name === "alreadySeenObject" ||
                    name === "containsUnicodeCharInComment" ||
                    name === "containsUnicodeChar" ||
                    name === "isOverload") {
                    continue; 
                }

                var value1 = obj1[name];
                if (value1) {
                    if (typeof value1 === 'number' ||
                        typeof value1 === 'string' ||
                        typeof value1 === 'boolean') {

                        var value2 = obj2[name];

                        if (typeof value1 !== typeof value2) {
                            throw new Error("Objects differed in type for key: " + name);
                        }

                        if (value1 !== value2) {
                            throw new Error("Objects differed in value for key: " + name);
                        }
                    }
                }
            }

            for (var name in obj1) {
                if (name === "preComments" ||
                    name === "postComments" ||
                    name === "docComments" ||
                    name === "sym" ||
                    name === "lineMap" ||
                    name === "resolvedTarget") {
                    continue;
                } 

                var value1 = obj1[name];
                if (value1) {
                    if (typeof value1 === 'object') {
                        var value2 = obj2[name];

                        if (typeof value1 !== typeof value2) {
                            throw new Error("Objects differed in type for key: " + name);
                        }

                        this.compareObjects(value1, value2);
                    }
                }
            }

            // obj1.alreadySeenObject = false;
        }

        public typeCheck() {
            return this.timeFunction("typeCheck()", () => {
                var binder = new Binder(this.typeChecker);
                this.typeChecker.units = this.units;
                binder.bind(this.typeChecker.globalScope, this.typeChecker.globals);
                binder.bind(this.typeChecker.globalScope, this.typeChecker.ambientGlobals);
                binder.bind(this.typeChecker.globalScope, this.typeChecker.globalTypes);
                binder.bind(this.typeChecker.globalScope, this.typeChecker.ambientGlobalTypes);
                this.typeFlow = new TypeFlow(this.logger, this.typeChecker.globalScope, this.parser, this.typeChecker);
                var i = 0;
                var script: Script = null;
                var len = this.scripts.members.length;


                this.persistentTypeState.setCollectionMode(TypeCheckCollectionMode.Resident);
                // first, typecheck resident "lib" scripts, if necessary
                for (i = 0; i < len; i++) {
                    script = <Script>this.scripts.members[i];
                    if (!script.isResident || script.hasBeenTypeChecked) { continue; }

                    this.typeFlow.assignScopes(script);
                    this.typeFlow.initLibs();
                }
                for (i = 0; i < len; i++) {
                    script = <Script>this.scripts.members[i];
                    if (!script.isResident || script.hasBeenTypeChecked) { continue; }

                    this.typeFlow.typeCheck(script);
                    script.hasBeenTypeChecked = true;
                }

                // next typecheck scripts that may change
                this.persistentTypeState.setCollectionMode(TypeCheckCollectionMode.Transient);
                len = this.scripts.members.length;
                for (i = 0; i < len; i++) {
                    script = <Script>this.scripts.members[i];
                    if (script.isResident) { continue; }
                    this.typeFlow.assignScopes(script);
                    this.typeFlow.initLibs();
                }
                for (i = 0; i < len; i++) {
                    script = <Script>this.scripts.members[i];
                    if (script.isResident) { continue; }
                    this.typeFlow.typeCheck(script);
                }

                this.logger.log("Total type collection time: " + this.typeCollectionTime);

                return null;
            });
        }

        public cleanASTTypesForReTypeCheck(ast: AST) {
            function cleanASTType(ast: AST, parent: AST): AST {
                ast.type = null;
				if (ast.nodeType == NodeType.VarDecl) {
                    var vardecl = <VarDecl>ast;
                    vardecl.sym = null;
                }
                else if (ast.nodeType == NodeType.ArgDecl) {
                    var argdecl = <ArgDecl>ast;
                    argdecl.sym = null;
                }
                else if (ast.nodeType == NodeType.Name) {
                    var name = <Identifier>ast;
                    name.sym = null;
                }
                else if (ast.nodeType == NodeType.FuncDecl) {
                    var funcdecl = <FuncDecl>ast;
                    funcdecl.signature = null;
                    funcdecl.freeVariables = []
                    funcdecl.symbols = null;
                    funcdecl.accessorSymbol = null;
                    funcdecl.scopeType = null;
                }
                else if (ast.nodeType == NodeType.ModuleDeclaration) {
                    var modDecl = <ModuleDeclaration>ast;
                    modDecl.mod = null;
                }
                else if (ast.nodeType == NodeType.With) {
                    (<WithStatement>ast).withSym = null;
                }
                else if (ast.nodeType == NodeType.Catch) {
                    (<Catch>ast).containedScope = null;
                }
				else if (ast.nodeType === NodeType.Script) {
					(<Script>ast).externallyVisibleImportedSymbols = [];
				}
                return ast;
            }
            TypeScript.getAstWalkerFactory().walk(ast, cleanASTType);
        }

        public cleanTypesForReTypeCheck() {
            return this.timeFunction("cleanTypesForReTypeCheck()", () => {
                for (var i = 0, len = this.scripts.members.length; i < len; i++) {
                    var script = this.scripts.members[i];
                    if ((<Script>script).isResident) {
                        continue;
                    }
                    this.cleanASTTypesForReTypeCheck(script);
                    this.typeChecker.collectTypes(script);
                }

                return null;
            });
        }

        // Return "true" if the incremental typecheck was successful
        // Return "false" if incremental typecheck failed, requiring a full typecheck
        public attemptIncrementalTypeCheck(updateResult: TypeScript.UpdateUnitResult): bool {
            return this.timeFunction("attemptIncrementalTypeCheck()", () => {
                // updateResult.kind == editsInsideFunction
                // updateResult.scope1 == old function
                // updateResult.scope2 == new function
                //REVIEW: What about typecheck errors? How do we replace the old ones with the new ones?
                return false;
            });
        }

        public reTypeCheck() {
            return this.timeFunction("reTypeCheck()", () => {
                CompilerDiagnostics.analysisPass++;
                this.initTypeChecker(this.errorOutput);
                this.persistentTypeState.setCollectionMode(TypeCheckCollectionMode.Transient);
                this.cleanTypesForReTypeCheck();
                return this.typeCheck();
            });
        }

        private isDynamicModuleCompilation() {
            for (var i = 0, len = this.scripts.members.length; i < len; i++) {
                var script = <Script>this.scripts.members[i];
                if (!script.isDeclareFile && script.topLevelMod != null) {
                    return true;
                }
            }
            return false;
        }

        private updateCommonDirectoryPath() {
            var commonComponents: string[] = [];
            var commonComponentsLength = -1;
            for (var i = 0, len = this.scripts.members.length; i < len; i++) {
                var script = <Script>this.scripts.members[i];
                if (script.emitRequired(this.emitSettings)) {
                    var fileName = script.locationInfo.filename;
                    var fileComponents = filePathComponents(fileName);
                    if (commonComponentsLength == -1) {
                        // First time at finding common path
                        // So common path = directory of file
                        commonComponents = fileComponents;
                        commonComponentsLength = commonComponents.length;
                    } else {
                        var updatedPath = false;
                        for (var j = 0; j < commonComponentsLength && j < fileComponents.length; j++) {
                            if (commonComponents[j] != fileComponents[j]) {
                                // The new components = 0 ... j -1
                                commonComponentsLength = j;
                                updatedPath = true;

                                if (j == 0) {
                                    // Its error to not have common path
                                    this.errorReporter.emitterError(null, "Cannot find the common subdirectory path for the input files");
                                    return;
                                }

                                break;
                            }
                        }

                        // If the fileComponent path completely matched and less than already found update the length
                        if (!updatedPath && fileComponents.length < commonComponentsLength) {
                            commonComponentsLength = fileComponents.length;
                        }
                    }
                }
            }

            this.emitSettings.commonDirectoryPath = commonComponents.slice(0, commonComponentsLength).join("/") + "/";
            if (this.emitSettings.outputOption.charAt(this.emitSettings.outputOption.length - 1) != "/") {
                this.emitSettings.outputOption += "/";
            }
        }

        public parseEmitOption(ioHost: EmitterIOHost) {
            this.emitSettings.ioHost = ioHost;
            if (this.emitSettings.outputOption == "") {
                this.emitSettings.outputMany = true;
                this.emitSettings.commonDirectoryPath = "";
                return;
            }

            this.emitSettings.outputOption = switchToForwardSlashes(this.emitSettings.ioHost.resolvePath(this.emitSettings.outputOption));

            // Determine if output options is directory or file
            if (this.emitSettings.ioHost.directoryExists(this.emitSettings.outputOption)) {
                // Existing directory
                this.emitSettings.outputMany = true;
            } else if (this.emitSettings.ioHost.fileExists(this.emitSettings.outputOption)) {
                // Existing file
                this.emitSettings.outputMany = false;
            }
            else {
                // New File/directory
                this.emitSettings.outputMany = !isJSFile(this.emitSettings.outputOption);
            }

            // Verify if options are correct
            if (this.isDynamicModuleCompilation() && !this.emitSettings.outputMany) {
                this.errorReporter.emitterError(null, "Cannot compile dynamic modules when emitting into single file");
            }

            // Parse the directory structure
            if (this.emitSettings.outputMany) {
                this.updateCommonDirectoryPath();
            }
        }

        public useUTF8ForFile(script: Script) {
            if (this.emitSettings.outputMany) {
                return this.outputScriptToUTF8(script);
            } else {
                return this.outputScriptsToUTF8(<Script[]>(this.scripts.members));
            }
        }

        static mapToDTSFileName(fileName: string, wholeFileNameReplaced: bool) {
            return getDeclareFilePath(fileName);
        }

        private canEmitDeclarations(script?: Script) {
            if (!this.settings.generateDeclarationFiles) {
                return false;
            }

            // If its already a declare file or is resident or does not contain body 
            if (!!script && (script.isDeclareFile || script.isResident || script.bod == null)) {
                return false;
            }

            return true;
        }

        public emitDeclarationsUnit(script: Script, reuseEmitter?: bool, declarationEmitter?: DeclarationEmitter) {
            if (!this.canEmitDeclarations(script)) {
                return null;
            }

            if (!declarationEmitter) {
                var declareFileName = this.emitSettings.mapOutputFileName(script.locationInfo.filename, TypeScriptCompiler.mapToDTSFileName);
                var declareFile = this.createFile(declareFileName, this.useUTF8ForFile(script));
                declarationEmitter = new DeclarationEmitter(this.typeChecker, this.emitSettings, this.errorReporter);
                declarationEmitter.setDeclarationFile(declareFile);
            }

            declarationEmitter.emitDeclarations(script);

            if (!reuseEmitter) {
                declarationEmitter.Close();
                return null;
            } else {
                return declarationEmitter;
            }
        }

        public emitDeclarations() {
            if (!this.canEmitDeclarations()) {
                return;
            }

            if (this.errorReporter.hasErrors) {
                // There were errors reported, do not generate declaration file
                return;
            }

            if (this.scripts.members.length == 0) {
                return;
            }

            var declarationEmitter: DeclarationEmitter = null;
            for (var i = 0, len = this.scripts.members.length; i < len; i++) {
                var script = <Script>this.scripts.members[i];
                if (this.emitSettings.outputMany || declarationEmitter == null) {
                    // Create or reuse file
                    declarationEmitter = this.emitDeclarationsUnit(script, !this.emitSettings.outputMany);
                } else {
                    // Emit in existing emitter
                    this.emitDeclarationsUnit(script, true, declarationEmitter);
                }
            }

            if (declarationEmitter) {
                declarationEmitter.Close();
            }
        }

        static mapToFileNameExtension(extension: string, fileName: string, wholeFileNameReplaced: bool) {
            if (wholeFileNameReplaced) {
                // The complete output is redirected in this file so do not change extension
                return fileName;
            } else {
                // Change the extension of the file
                var splitFname = fileName.split(".");
                splitFname.pop();
                return splitFname.join(".") + extension;
            }
        }

        static mapToJSFileName(fileName: string, wholeFileNameReplaced: bool) {
            return TypeScriptCompiler.mapToFileNameExtension(".js", fileName, wholeFileNameReplaced);
        }

        public emitUnit(script: Script, reuseEmitter?: bool, emitter?: Emitter, usePullEmitter?: bool, inputOutputMapper?: (unitIndex: number, outFile: string) => void) {
            if (!script.emitRequired(this.emitSettings)) {
                return null;
            }

            var fname = script.locationInfo.filename;
            if (!emitter) {
                var outFname = this.emitSettings.mapOutputFileName(fname, TypeScriptCompiler.mapToJSFileName);
                var outFile = this.createFile(outFname, this.useUTF8ForFile(script));
                if (usePullEmitter) {
                    emitter = new PullEmitter(outFname, outFile, this.emitSettings, this.errorReporter, this.semanticInfoChain);
                }
                else {
                    emitter = new Emitter(this.typeChecker, outFname, outFile, this.emitSettings, this.errorReporter);
                }
                if (this.settings.mapSourceFiles) {
                    emitter.setSourceMappings(new TypeScript.SourceMapper(fname, outFname, outFile, this.createFile(outFname + SourceMapper.MapFileExtension, false), this.errorReporter, this.settings.emitFullSourceMapPath));
                }
                if (inputOutputMapper) {
                    // Remember the name of the outfile for this source file
                    inputOutputMapper(script.locationInfo.unitIndex, outFname);
                }
            } else if (this.settings.mapSourceFiles) {
                emitter.setSourceMappings(new TypeScript.SourceMapper(fname, emitter.emittingFileName, emitter.outfile, emitter.sourceMapper.sourceMapOut, this.errorReporter, this.settings.emitFullSourceMapPath));
            }

            // Set location info
            if (usePullEmitter) {
                (<PullEmitter>emitter).setUnit(script.locationInfo);
            } else {
                this.typeChecker.locationInfo = script.locationInfo;
            }

            emitter.emitJavascript(script, TokenID.Comma, false);
            if (!reuseEmitter) {
                emitter.Close();
                return null;
            } else {
                return emitter;
            }
        }

        public emit(ioHost: EmitterIOHost, usePullEmitter?: bool, inputOutputMapper?: (unitIndex: number, outFile: string) => void) {
            this.parseEmitOption(ioHost);

            var emitter: Emitter = null;
            for (var i = 0, len = this.scripts.members.length; i < len; i++) {
                var script = <Script>this.scripts.members[i];
                if (this.emitSettings.outputMany || emitter == null) {
                    emitter = this.emitUnit(script, !this.emitSettings.outputMany, null, usePullEmitter, inputOutputMapper);
                } else {
                    this.emitUnit(script, true, emitter, usePullEmitter);
                }
            }

            if (emitter) {
                emitter.Close();
            }
        }

        public emitToOutfile(outputFile: ITextWriter) {
            if (this.settings.mapSourceFiles) {
                throw Error("Cannot generate source map");
            }

            if (this.settings.generateDeclarationFiles) {
                throw Error("Cannot generate declaration files");
            }

            if (this.settings.outputOption != "") {
                throw Error("Cannot parse output option");
            }

            var emitter: Emitter = emitter = new Emitter(this.typeChecker, "stdout", outputFile, this.emitSettings, this.errorReporter);;
            for (var i = 0, len = this.scripts.members.length; i < len; i++) {
                var script = <Script>this.scripts.members[i];
                this.typeChecker.locationInfo = script.locationInfo;
                emitter.emitJavascript(script, TokenID.Comma, false);
            }
        }

        private outputScriptToUTF8(script: Script): bool {
            return script.containsUnicodeChar || (this.emitSettings.emitComments && script.containsUnicodeCharInComment);
        }

        private outputScriptsToUTF8(scripts: Script[]): bool {
            for (var i = 0, len = scripts.length; i < len; i++) {
                var script = scripts[i];
                if (this.outputScriptToUTF8(script)) {
                    return true;
                }
            }
            return false;
        }

        private createFile(fileName: string, useUTF8: bool): ITextWriter {
            try {
                // Creating files can cause exceptions, report them.   
                return this.emitSettings.ioHost.createFile(fileName, useUTF8);
            } catch (ex) {
                this.errorReporter.emitterError(null, ex.message);
            }
        }

        //
        // Pull typecheck infrastructure
        //

        public pullResolveFile(filename: string): bool {
            if (!this.pullTypeChecker) {
                return false;
            }

            var unit = this.semanticInfoChain.getUnit(filename);

            if (!unit) {
                return false;
            }

            this.pullTypeChecker.setUnit(filename);
            this.pullTypeChecker.resolver.resolveBoundDecls(unit.getTopLevelDecls()[0], new PullTypeResolutionContext());

            return true;
        }

        public pullGetErrorsForFile(filename: string): SemanticError[] {
            var errors: PullError[] = [];

            var unit = this.semanticInfoChain.getUnit(filename);

            if (unit) {
                unit.getErrors(errors);
            }

            return errors;
        }

        public pullTypeCheck(refresh = false) {
            return this.timeFunction("pullTypeCheck()", () => {

                if (!this.pullTypeChecker || refresh) {
                    this.semanticInfoChain = new SemanticInfoChain();
                    this.pullTypeChecker = new PullTypeChecker(this.semanticInfoChain);
                }

                this.pullErrorReporter.setUnits(this.units);

                var declCollectionContext: DeclCollectionContext = null;
                var semanticInfo: SemanticInfo = null;
                var i = 0;

                var createDeclsStartTime = new Date().getTime();

                for (; i < this.scripts.members.length; i++) {

                    semanticInfo = new SemanticInfo(this.units[i].filename, this.units[i]);

                    declCollectionContext = new DeclCollectionContext(semanticInfo);

                    declCollectionContext.scriptName = this.units[i].filename;

                    // create decls
                    getAstWalkerFactory().walk(this.scripts.members[i], preCollectDecls, postCollectDecls, null, declCollectionContext);

                    semanticInfo.addTopLevelDecl(declCollectionContext.getParent());

                    this.semanticInfoChain.addUnit(semanticInfo);
                }

                var createDeclsEndTime = new Date().getTime();

                // bind declaration symbols
                var bindStartTime = new Date().getTime();

                var binder = new PullSymbolBinder(this.semanticInfoChain);

                // start at '1', so as to skip binding for global primitives such as 'any'
                for (i = 1; i < this.semanticInfoChain.units.length; i++) {
                    binder.bindDeclsForUnit(this.semanticInfoChain.units[i].getPath());
                }
                
                var bindEndTime = new Date().getTime();
                //var typeCheckStartTime = new Date().getTime();

                //// resolve symbols
                ////for (i = 0; i < this.scripts.members.length; i++) {
                ////    this.pullResolveFile(this.units[i].filename);
                ////}

                //var typeCheckEndTime = new Date().getTime();

                var findErrorsStartTime = new Date().getTime();
                // type check
                for (i = 0; i < this.scripts.members.length; i++) {
                    this.logger.log("Type checking " + this.units[i].filename);
                    this.pullTypeChecker.typeCheckScript(<Script>this.scripts.members[i], this.units[i].filename, this);
                }
                var findErrorsEndTime = new Date().getTime();                

                this.logger.log("Decl creation: " + (createDeclsEndTime - createDeclsStartTime));
                this.logger.log("Binding: " + (bindEndTime - bindStartTime));
                this.logger.log("    Time in findSymbol: " + time_in_findSymbol);
                this.logger.log("Find errors: " + (findErrorsEndTime - findErrorsStartTime));

                this.pullErrorReporter.reportErrors(this.semanticInfoChain.postErrors());
            });
        }
        
        // returns 'true' if diffs were detected
        public pullUpdateScript(oldScript: Script, newScript: Script): bool {
            return this.timeFunction("pullUpdateScript: ", () => {
                
                var declDiffer = new PullDeclDiffer();

                // want to name the new script semantic info the same as the old one
                var newScriptSemanticInfo = new SemanticInfo(oldScript.locationInfo.filename, newScript.locationInfo);
                var oldScriptSemanticInfo = this.semanticInfoChain.getUnit(oldScript.locationInfo.filename);

                lastBoundPullDeclId = pullDeclID;
                lastBoundPullSymbolID = pullSymbolID;

                var declCollectionContext = new DeclCollectionContext(newScriptSemanticInfo);

                declCollectionContext.scriptName = oldScript.locationInfo.filename;

                // create decls
                getAstWalkerFactory().walk(newScript, preCollectDecls, postCollectDecls, null, declCollectionContext);

                var oldTopLevelDecl = oldScriptSemanticInfo.getTopLevelDecls()[0];
                var newTopLevelDecl = declCollectionContext.getParent();

                newScriptSemanticInfo.addTopLevelDecl(newTopLevelDecl);

                var diffResults: PullDeclDiff[] = [];

                var diffStartTime = new Date().getTime();
                declDiffer.diffDecls(oldTopLevelDecl, newTopLevelDecl, diffResults);

                var diffEndTime = new Date().getTime();
                this.logger.log("Update Script - Diff time: " + (diffEndTime - diffStartTime));

                // replace the old semantic info
                this.semanticInfoChain.updateUnit(oldScriptSemanticInfo, newScriptSemanticInfo);

                // re-bind
                var innerBindStartTime = new Date().getTime();

                var topLevelDecls = newScriptSemanticInfo.getTopLevelDecls();

                this.semanticInfoChain.update(newScript.locationInfo.filename);

                var binder = new PullSymbolBinder(this.semanticInfoChain);
                binder.setUnit(newScript.locationInfo.filename);

                for (var i = 0; i < topLevelDecls.length; i++) {
                    binder.bindDeclToPullSymbol(topLevelDecls[i], true);
                }

                var innerBindEndTime = new Date().getTime();

                this.logger.log("Update Script - Inner bind time: " + (innerBindEndTime - innerBindStartTime));
                if (diffResults.length) {

                    // propagate changes
                    var graphUpdater = new PullSymbolGraphUpdater(this.semanticInfoChain);
                    var diff: PullDeclDiff;

                    var traceStartTime = new Date().getTime();
                    for (var i = 0; i < diffResults.length; i++) {
                        diff = diffResults[i];

                        if (diff.kind == PullDeclEdit.DeclRemoved) {
                            graphUpdater.removeDecl(diff.oldDecl);
                        }
                        else if (diff.kind == PullDeclEdit.DeclAdded) {
                            graphUpdater.addDecl(diff.newDecl);                        
                            graphUpdater.invalidateType(diff.oldDecl.getSymbol());
                            this.resolvePosition(diff.newDecl.getSpan().start(), newScript);
                        }
                        else {
                            // PULLTODO: Other kinds of edits
                        }
                    }

                    var traceEndTime = new Date().getTime();

                    this.pullTypeChecker.typeCheckScript(newScript, newScript.locationInfo.filename, this);

                    this.logger.log("Update Script - Trace time: " + (traceEndTime - traceStartTime));
                    this.logger.log("Update Script - Number of diffs: " + diffResults.length);

                    this.pullErrorReporter.setUnits(this.units);

                    this.pullErrorReporter.reportErrors(this.semanticInfoChain.postErrors())

                    return true;
                }

                this.pullErrorReporter.setUnits(this.units);

                this.pullErrorReporter.reportErrors(this.semanticInfoChain.postErrors())
                return false;
            });
        }

        public resolvePosition(pos: number, script: Script, scriptName?: string): { symbol: PullSymbol; ast: AST; enclosingDecl: PullDecl; } {

            // find the enclosing decl
            var declStack: PullDecl[] = [];
            var resultASTs: AST[] = [];
            if (!scriptName) {
                scriptName = script.locationInfo.filename;
            }
            var semanticInfo = this.semanticInfoChain.getUnit(scriptName);
            var lastDeclAST: AST = null;
            var foundAST: AST = null;
            var symbol: PullSymbol = null;

            // these are used to track intermediate nodes so that we can properly apply contextual types
            var lambdaAST: FuncDecl = null;
            var declarationInitASTs: VarDecl[] = [];
            var objectLitAST: UnaryExpression = null;
            var asgAST: BinaryExpression = null;
            var typeAssertionASTs: UnaryExpression[] = [];
            var resolutionContext = new PullTypeResolutionContext();
            var inTypeReference = false;
            var enclosingDecl: PullDecl = null;

            var pre = (cur: AST, parent: AST): AST => {
                if (isValidAstNode(cur)) {
                    if (pos >= cur.minChar && pos <= cur.limChar) {

                        var previous = resultASTs[resultASTs.length - 1];

                        if (previous == undefined || (cur.minChar >= previous.minChar && cur.limChar <= previous.limChar)) {

                            var decl = semanticInfo.getDeclForAST(cur);

                            if (decl) {
                                declStack[declStack.length] = decl;
                                lastDeclAST = cur;
                            }

                            if (cur.nodeType == NodeType.FuncDecl && hasFlag((<FuncDecl>cur).fncFlags, FncFlags.IsFunctionExpression)) {
                                lambdaAST = <FuncDecl>cur;
                            }
                            else if (cur.nodeType == NodeType.VarDecl) {
                                declarationInitASTs[declarationInitASTs.length] = <VarDecl>cur;
                            }
                            else if (cur.nodeType == NodeType.ObjectLit) {
                                objectLitAST = <UnaryExpression>cur;
                            }
                            else if (cur.nodeType == NodeType.TypeAssertion) {
                                typeAssertionASTs[typeAssertionASTs.length] = <UnaryExpression>cur;
                            }
                            else if (cur.nodeType == NodeType.Asg) {
                                asgAST = <BinaryExpression>cur;
                            }
                            else if (cur.nodeType == NodeType.TypeRef) {
                                inTypeReference = true;
                            }

                            resultASTs[resultASTs.length] = cur;
                        }
                    }
                }
                return cur;
            }

            getAstWalkerFactory().walk(script, pre);

            if (resultASTs.length) {

                this.pullTypeChecker.setUnit(script.locationInfo.filename);

                foundAST = resultASTs[resultASTs.length - 1];

                // Check if is a name of a container
                if (foundAST.nodeType == NodeType.Name && resultASTs.length > 1) {
                    var previousAST = resultASTs[resultASTs.length - 2];
                    switch (previousAST.nodeType) {
                        case NodeType.InterfaceDeclaration:
                        case NodeType.ClassDeclaration:
                        case NodeType.ModuleDeclaration:
                            if (foundAST === (<NamedDeclaration>previousAST).name) {
                                foundAST = previousAST;
                            }
                            break;
                    }
                }

                // are we within a decl?  if so, just grab its symbol
                if (lastDeclAST == foundAST) {
                    symbol = declStack[declStack.length - 1].getSymbol();
                    this.pullTypeChecker.resolver.resolveDeclaredSymbol(symbol, null, resolutionContext);
                }
                else {
                    // otherwise, it's an expression that needs to be resolved, so we must pull...

                    // first, find the enclosing decl
                    for (var i = declStack.length - 1; i >= 0; i--) {
                        if (!(declStack[i].getKind() & (PullElementKind.Variable | PullElementKind.Parameter))) {
                            enclosingDecl = declStack[i];
                            break;
                        }
                    }

                    // next, obtain the assigning AST, if applicable
                    // (this would be the ast for the last decl on the decl stack)

                    // if the found AST is a named, we want to check for previous dotted expressions,
                    // since those will give us the right typing
                    if (foundAST.nodeType == NodeType.Name && resultASTs.length > 1) {
                        for (var i = resultASTs.length - 2; i >= 0; i--) {
                            if ((resultASTs[i].nodeType === NodeType.VarDecl && (<VarDecl>resultASTs[i]).id === resultASTs[i + 1]) ||
                                //((resultASTs[i].nodeType === NodeType.Call || resultASTs[i].nodeType == NodeType.New) && (<CallExpression>resultASTs[i]).target === resultASTs[i + 1]) ||
                                (resultASTs[i].nodeType === NodeType.Dot && (<BinaryExpression>resultASTs[i]).operand2 === resultASTs[i + 1])) {
                                foundAST = resultASTs[i];   
                            }
                            else {
                                break;
                            }
                        }
                    }

                    // if it's a list, we may not have an exact AST, so find the next nearest one
                    if (foundAST.nodeType == NodeType.List) {
                        for (var i = 0; i < (<ASTList>foundAST).members.length; i++) {
                            if ((<ASTList>foundAST).members[i].minChar > pos) {
                                foundAST = (<ASTList>foundAST).members[i];
                                break;
                            }
                        }
                    }

                    resolutionContext.resolveAggressively = true;
                    resolutionContext.searchTypeSpace = inTypeReference;

                    var isTypedAssignment = false;

                    if (declarationInitASTs.length) {
                        var assigningAST: VarDecl;
                        var varSymbol: PullSymbol;

                        for (var i = 0; i < declarationInitASTs.length; i++) {

                            assigningAST = declarationInitASTs[i];
                            isTypedAssignment = (assigningAST != null) && (assigningAST.typeExpr != null);

                            this.pullTypeChecker.resolver.resolveDeclaration(assigningAST, resolutionContext);
                            varSymbol = this.semanticInfoChain.getSymbolForAST(assigningAST, scriptName);

                            if (varSymbol && isTypedAssignment) {
                                var contextualType = varSymbol.getType();
                                resolutionContext.pushContextualType(contextualType, false, null);
                            }

                            if (assigningAST.init) {
                                this.pullTypeChecker.resolver.resolveAST(assigningAST.init, isTypedAssignment, enclosingDecl, resolutionContext);
                            }
                        }
                    }

                    if (typeAssertionASTs.length) {
                        for (var i = 0; i < typeAssertionASTs.length; i++) {
                            this.pullTypeChecker.resolver.resolveAST(typeAssertionASTs[i], isTypedAssignment, enclosingDecl, resolutionContext);
                        }
                    }

                    if (asgAST) {
                        this.pullTypeChecker.resolver.resolveAST(asgAST, isTypedAssignment, enclosingDecl, resolutionContext);
                    }

                    if (objectLitAST) {
                        this.pullTypeChecker.resolver.resolveAST(objectLitAST, isTypedAssignment, enclosingDecl, resolutionContext);
                    }

                    if (lambdaAST) {
                        this.pullTypeChecker.resolver.resolveAST(lambdaAST, true, enclosingDecl, resolutionContext);
                        enclosingDecl = semanticInfo.getDeclForAST(lambdaAST);
                    }

                    symbol = this.pullTypeChecker.resolver.resolveAST(foundAST, isTypedAssignment, enclosingDecl, resolutionContext);
                }
            }

            return { symbol : symbol, ast : foundAST, enclosingDecl: enclosingDecl};
        }

        private extractResolutionContextFromPath(path: AstPath, script: Script, scriptName?: string): { ast: AST; enclosingDecl: PullDecl; resolutionContext: PullTypeResolutionContext; isTypedAssignment: bool; } {
            if (!scriptName) {
                scriptName = script.locationInfo.filename;
            }

            var semanticInfo = this.semanticInfoChain.getUnit(scriptName);
            var enclosingDecl: PullDecl = null;
            var isTypedAssignment = false;

            var resolutionContext = new PullTypeResolutionContext();
            resolutionContext.resolveAggressively = true;

            if (path.count() == 0) {
                return null;
            }

            // Extract infromation from path
            for (var i = 0, n = path.count(); i < n; i++) {
                var current = path.asts[i];
                var decl = semanticInfo.getDeclForAST(current);

                if (decl && !(decl.getKind() & (PullElementKind.Variable | PullElementKind.Parameter))) {
                    enclosingDecl = decl;
                }

                switch (current.nodeType) {
                    case NodeType.FuncDecl:
                        if (hasFlag((<FuncDecl>current).fncFlags, FncFlags.IsFunctionExpression)) {
                            this.pullTypeChecker.resolver.resolveAST((<FuncDecl>current), true, enclosingDecl, resolutionContext);
                        }

                        break;

                    case NodeType.VarDecl:
                        var assigningAST = <VarDecl> current;
                        isTypedAssignment = (assigningAST.typeExpr != null);

                        this.pullTypeChecker.resolver.resolveDeclaration(assigningAST, resolutionContext);
                        var varSymbol = this.semanticInfoChain.getSymbolForAST(assigningAST, scriptName);

                        if (varSymbol && isTypedAssignment) {
                            var contextualType = varSymbol.getType();
                            resolutionContext.pushContextualType(contextualType, false, null);
                        }

                        if (assigningAST.init) {
                            this.pullTypeChecker.resolver.resolveAST(assigningAST.init, isTypedAssignment, enclosingDecl, resolutionContext);
                        }

                        break;

                    case NodeType.ObjectLit:
                        this.pullTypeChecker.resolver.resolveAST((<UnaryExpression>current), isTypedAssignment, enclosingDecl, resolutionContext);
                        break;

                    case NodeType.Asg:
                        this.pullTypeChecker.resolver.resolveAST((<BinaryExpression>current), isTypedAssignment, enclosingDecl, resolutionContext);
                        break;

                    case NodeType.TypeAssertion:
                        this.pullTypeChecker.resolver.resolveAST((<UnaryExpression>current), isTypedAssignment, enclosingDecl, resolutionContext);
                        resolutionContext.searchTypeSpace = true;
                        break;

                    case NodeType.TypeRef:
                    case NodeType.TypeParameter:
                        resolutionContext.searchTypeSpace = true;
                        break;
                }

            }

            // Other possible type space references
            if (path.isNameOfInterface() || path.isInClassImplementsList() || path.isInInterfaceExtendsList()) {
                resolutionContext.searchTypeSpace = true;
            }

            // if the found AST is a named, we want to check for previous dotted expressions,
            // since those will give us the right typing
            if (path.ast().nodeType === NodeType.Name && path.count() > 1) {
                for (var i = path.count() - 1; i >= 0; i--) {
                    if (path.asts[path.top - 1].nodeType === NodeType.Dot &&
                        (<BinaryExpression>path.asts[path.top - 1]).operand2 === path.asts[path.top]) {
                        path.pop();
                    }
                    else {
                        break;
                    }
                }
            }

            return {
                ast: path.ast(),
                enclosingDecl: enclosingDecl,
                resolutionContext: resolutionContext,
                isTypedAssignment: isTypedAssignment
            };
        }
        
        public pullGetSymbolInformationFromPath(path: AstPath, script: Script, scriptName?: string): { symbol: PullSymbol; ast: AST; } {
            var context = this.extractResolutionContextFromPath(path, script, scriptName);
            if (!context) {
                return null;
            }

            var symbol = this.pullTypeChecker.resolver.resolveAST(path.ast(), context.isTypedAssignment, context.enclosingDecl, context.resolutionContext);

            return { symbol: symbol, ast: path.ast() };
        }

        public pullGetCallInformationFromPath(path: AstPath, script: Script, scriptName?: string): { targetSymbol: PullSymbol; resolvedSignatures: PullSignatureSymbol[]; candidateSignature: PullSignatureSymbol; ast: AST; } {
            // AST has to be a call expression
            if (path.ast().nodeType !== NodeType.Call && path.ast().nodeType !== NodeType.New) {
                return null;
            }

            var isNew = (path.ast().nodeType === NodeType.New);

            var context = this.extractResolutionContextFromPath(path, script, scriptName);
            if (!context) {
                return null;
            }

            var callResolutionResults = {
                targetSymbol: null,
                resolvedSignatures: null,
                candidateSignature: null,
                ast: path.ast()
            };

            if (isNew) {
                this.pullTypeChecker.resolver.resolveNewExpression(path.ast(), context.isTypedAssignment, context.enclosingDecl, context.resolutionContext, callResolutionResults);
            }
            else {
                this.pullTypeChecker.resolver.resolveCallExpression(path.ast(), context.isTypedAssignment, context.enclosingDecl, context.resolutionContext, callResolutionResults);
            }

            return callResolutionResults;
        }

        public pullGetVisibleMemberSymbolsFromPath(path: AstPath, script: Script, scriptName?: string): PullSymbol[] {
            var context = this.extractResolutionContextFromPath(path, script, scriptName);
            if (!context) {
                return null;
            }

            return this.pullTypeChecker.resolver.getVisibleMembersFromExpresion(path.ast(), context.enclosingDecl, context.resolutionContext);
        }

        public pullGetVisibleSymbolsFromPath(path: AstPath, script: Script, scriptName?: string): PullSymbol[] {

            var context = this.extractResolutionContextFromPath(path, script, scriptName);
            if (!context) {
                return null;
            }

            return this.pullTypeChecker.resolver.getVisibleSymbols(context.enclosingDecl, context.resolutionContext);
        }

        public pullGetTypeInfoAtPosition(pos: number, script: Script, scriptName?: string): { ast: AST; typeName: string; typeInfo: string; typeSymbol: PullTypeSymbol; enclosingDecl: PullDecl; } {
            return this.timeFunction("pullGetTypeInfoAtPosition for pos " + pos + ":", () => {
                
                var info = this.resolvePosition(pos, script, scriptName);

                if (info.symbol) {
                    var type = info.symbol.getType();
                    if (type) {
                        return { ast: info.ast, typeName: type.getName(), typeInfo: type.toString(), typeSymbol: type, enclosingDecl: info.enclosingDecl };
                    }
                }

                return { ast: info.ast, typeName: "couldn't find the type...", typeInfo: "couldn't find members...", typeSymbol: null, enclosingDecl: null };
            });
        }

        public pullUpdateUnit(sourceText: ISourceText, filename: string, setRecovery: bool): bool {
            return this.timeFunction("pullUpdateUnit(" + filename + ")", () => {
                for (var i = 0, len = this.units.length; i < len; i++) {
                    if (this.units[i].filename == filename) {

                        if (setRecovery) {
                            this.parser.setErrorRecovery(null);
                        }

                        var updateResult: UpdateUnitResult;

                        // Capture parsing errors for now
                        var parseErrors: ErrorEntry[] = [];
                        var errorCapture = (minChar: number, charLen: number, message: string, unitIndex: number): void => {
                            parseErrors.push(new ErrorEntry(unitIndex, minChar, minChar + charLen, message));
                        };
                        var svErrorCallback = this.parser.errorCallback;
                        if (svErrorCallback)
                            this.parser.errorCallback = errorCapture;

                        var oldScript = <Script>this.scripts.members[i];

                        var text = new TypeScript.SourceSimpleText(sourceText);

                        var syntaxTree = Parser1.parse(text, LanguageVersion.EcmaScript5, this.stringTable);
                        var newScript: Script = null;
                        try {
                            newScript = SyntaxTreeToAstVisitor.visit(syntaxTree, filename, i);

                            // TypeScriptCompiler.compareObjects(script, script2);
                        } catch (e1) {
                            IO.stdout.WriteLine("Error converting: " + filename);
                            IO.stdout.WriteLine("\t" + e1.message);
                        }

                        this.syntaxTrees[i] = syntaxTree;

                        //var newScript = this.parser.parse(sourceText, filename, i);

                        if (svErrorCallback)
                            this.parser.errorCallback = svErrorCallback;

                        this.scripts.members[i] = newScript;
                        this.units[i] = newScript.locationInfo;

                        return this.pullUpdateScript(oldScript, newScript);
                    }
                }
                throw new Error("Unknown file \"" + filename + "\"");
            });
        }
    }

    export class ScopeEntry {
        constructor (
            public name: string,
            public type: string,
            public sym: Symbol) {
        }
    }

    export class ScopeTraversal {
        constructor (private compiler: TypeScriptCompiler) {
        }

        public getScope(enclosingScopeContext: EnclosingScopeContext): SymbolScope {
            if (enclosingScopeContext.enclosingObjectLit && enclosingScopeContext.isMemberCompletion) {
                return enclosingScopeContext.getObjectLiteralScope();
            }
            else if (enclosingScopeContext.isMemberCompletion) {
                if (enclosingScopeContext.useFullAst) {
                    return this.compiler.typeFlow.findMemberScopeAtFullAst(enclosingScopeContext)
                }
                else {
                    return this.compiler.typeFlow.findMemberScopeAt(enclosingScopeContext)
                }
            }
            else {
                return enclosingScopeContext.getScope();
            }
        }

        public getScopeEntries(enclosingScopeContext: EnclosingScopeContext, getPrettyTypeName?: bool): ScopeEntry[] {
            var scope = this.getScope(enclosingScopeContext);
            if (scope == null) {
                return [];
            }

            var inScopeNames: IHashTable = new StringHashTable();
            var allSymbolNames: string[] = scope.getAllSymbolNames(enclosingScopeContext.isMemberCompletion);

            // there may be duplicates between the type and value tables, so batch the symbols
            // getTypeNamesForNames will prefer the entry in the value table
            for (var i = 0; i < allSymbolNames.length; i++) {
                var name = allSymbolNames[i];

                // Skip global/internal symbols that won't compile in user code
                if (name == globalId || name == "_Core" || name == "_element") {
                    continue;
                }

                inScopeNames.add(name, "");
            }

            var svModuleDecl = this.compiler.typeChecker.currentModDecl;
            this.compiler.typeChecker.currentModDecl = enclosingScopeContext.deepestModuleDecl;

            var result = this.getTypeNamesForNames(enclosingScopeContext, inScopeNames.getAllKeys(), scope, getPrettyTypeName);

            this.compiler.typeChecker.currentModDecl = svModuleDecl;
            return result;
        }

        private getTypeNamesForNames(enclosingScopeContext: EnclosingScopeContext, allNames: string[], scope: SymbolScope, getPrettyTypeName? : bool): ScopeEntry[] {
            var result: ScopeEntry[] = [];

            var enclosingScope = enclosingScopeContext.getScope();
            for (var i = 0; i < allNames.length; i++) {
                var name = allNames[i];
                // Search for the id in the value space first
                // if we don't find it, search in the type space.
                // We don't want to search twice, because the first
                // search may insert the name in the symbol value table
                // if the scope is aggregate
                var publicsOnly = enclosingScopeContext.publicsOnly && enclosingScopeContext.isMemberCompletion;
                var symbol = scope.find(name, publicsOnly, false/*typespace*/);  // REVIEW: Should search public members only?
                if (symbol == null) {
                    symbol = scope.find(name, publicsOnly, true/*typespace*/);
                }

                var displayThisMember = symbol && symbol.flags & SymbolFlags.Private ? symbol.container == scope.container : true;

                if (symbol) {
                    // Do not add dynamic module names to the list, since they're not legal as identifiers
                    if (displayThisMember && !isQuoted(symbol.name) && !isRelative(symbol.name)) {
                        var getPrettyOverload = getPrettyTypeName && symbol.declAST && symbol.declAST.nodeType == NodeType.FuncDecl;
                        var type = symbol.getType();
                        var typeName = type ? type.getScopedTypeName(enclosingScope, getPrettyOverload) : "";
                        result.push(new ScopeEntry(name, typeName, symbol));
                    }
                }
                else {
                    // Special case for "true" and "false"
                    // REVIEW: This may no longer be necessary?
                    if (name == "true" || name == "false") {
                        result.push(new ScopeEntry(name, "bool", this.compiler.typeChecker.booleanType.symbol));
                    }
                }
            }

            return result;
        }
    }
}
