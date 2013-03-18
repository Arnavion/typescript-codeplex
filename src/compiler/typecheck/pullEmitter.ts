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

///<reference path='..\typescript.ts' />

module TypeScript {
    export class PullEmitter extends Emitter {
        public locationInfo: LocationInfo = null;
        private pullTypeChecker: PullTypeChecker = null;
        private declStack: PullDecl[] = [];

        private setTypeCheckerUnit(fileName: string) {
            if (!this.pullTypeChecker.resolver) {
                this.pullTypeChecker.setUnit(fileName);
                return;
            }

            this.pullTypeChecker.resolver.setUnitPath(fileName);
        }

        constructor(emittingFileName: string, outfile: ITextWriter, emitOptions: EmitOptions, errorReporter: ErrorReporter, private semanticInfoChain: SemanticInfoChain) {
            super(null, emittingFileName, outfile, emitOptions, errorReporter);

            this.pullTypeChecker = new PullTypeChecker(semanticInfoChain);
        }

        public setUnit(locationInfo: LocationInfo) {
            this.locationInfo = locationInfo;
        }

        private getEnclosingDecl() {
            var declStackLen = this.declStack.length;
            var enclosingDecl = declStackLen > 0 ? this.declStack[declStackLen - 1] : null;
            return enclosingDecl;
        }

        public getVarDeclFromIdentifier(ident: Identifier) {
            var resolvingContext = new PullTypeResolutionContext();
            this.setTypeCheckerUnit(this.locationInfo.fileName);
            var pullSymbol = this.pullTypeChecker.resolver.resolveNameExpression(ident, this.getEnclosingDecl(), resolvingContext);
            if (pullSymbol) {
                var pullDecls = pullSymbol.getDeclarations();
                if (pullDecls.length == 1) {
                    var pullDecl = pullDecls[0];
                    var ast = this.semanticInfoChain.getASTForDecl(pullDecl, pullDecl.getScriptName());
                    if (ast && ast.nodeType == NodeType.VarDecl) {
                        return <VarDecl>ast;
                    }
                }
            }

            return null;
        }

        public getConstantDecl(dotExpr: BinaryExpression) {
            var resolvingContext = new PullTypeResolutionContext();
            this.setTypeCheckerUnit(this.locationInfo.fileName);
            var pullSymbol = this.pullTypeChecker.resolver.resolveDottedNameExpression(dotExpr, this.getEnclosingDecl(), resolvingContext);
            if (pullSymbol && pullSymbol.hasFlag(PullElementFlags.Constant)) {
                var pullDecls = pullSymbol.getDeclarations();
                if (pullDecls.length == 1) {
                    var pullDecl = pullDecls[0];
                    var ast = this.semanticInfoChain.getASTForDecl(pullDecl, pullDecl.getScriptName());
                    if (ast && ast.nodeType == NodeType.VarDecl) {
                        return <VarDecl>ast;
                    }
                }
            }

            return null;
        }

        public getClassPropertiesMustComeAfterSuperCall(funcDecl: FuncDecl, classDecl: TypeDeclaration) {
            var isClassConstructor = funcDecl.isConstructor && hasFlag(funcDecl.fncFlags, FncFlags.ClassMethod);
            var hasNonObjectBaseType = isClassConstructor && classDecl.extendsList && classDecl.extendsList.members.length > 0;
            var classPropertiesMustComeAfterSuperCall = hasNonObjectBaseType;
            return classPropertiesMustComeAfterSuperCall;
        }

        public emitInnerFunction(funcDecl: FuncDecl, printName: bool, isMember: bool,
            hasSelfRef: bool, classDecl: TypeDeclaration) {
            var pullDecl = this.semanticInfoChain.getDeclForAST(funcDecl, this.locationInfo.fileName);
            this.declStack.push(pullDecl);
            super.emitInnerFunction(funcDecl, printName, isMember, hasSelfRef, classDecl);
            this.declStack.pop();
        }

        // PULLTODO
        public getModuleImportAndDepencyList(moduleDecl: ModuleDeclaration) {
            var importList = "";
            var dependencyList = "";
            var i = 0;

            // all dependencies are quoted
            for (i = 0; i < (<ModuleType>moduleDecl.mod).importedModules.length; i++) {
                var importStatement = (<ModuleType>moduleDecl.mod).importedModules[i]

                // if the imported module is only used in a type position, do not add it as a requirement
                if (importStatement.id.sym &&
                    !(<TypeSymbol>importStatement.id.sym).onlyReferencedAsTypeRef) {
                    if (i <= (<ModuleType>moduleDecl.mod).importedModules.length - 1) {
                        dependencyList += ", ";
                        importList += ", ";
                    }

                    importList += "__" + importStatement.id.actualText + "__";
                    dependencyList += importStatement.firstAliasedModToString();
                }
            }

            // emit any potential amd dependencies
            for (i = 0; i < moduleDecl.amdDependencies.length; i++) {
                dependencyList += ", \"" + moduleDecl.amdDependencies[i] + "\"";
            }

            return {
                importList: importList,
                dependencyList: dependencyList
            };
        }

        public isParentDynamicModule(moduleDecl: ModuleDeclaration) {
            var symbol = this.semanticInfoChain.getSymbolForAST(moduleDecl, this.locationInfo.fileName);
            var parentSymbol = symbol.getContainer();

            parentSymbol = parentSymbol ? parentSymbol.getAssociatedContainerType() : null;

            if (parentSymbol && parentSymbol.getKind() == PullElementKind.DynamicModule) {
                return true;
            }

            return false;
        }

        public shouldCaptureThis(ast: AST) {
            if (ast == null) {
                var scriptDecl = this.semanticInfoChain.getUnit(this.locationInfo.fileName).getTopLevelDecls()[0];
                return (scriptDecl.getFlags() & PullElementFlags.MustCaptureThis) == PullElementFlags.MustCaptureThis;
            }

            var decl = this.semanticInfoChain.getDeclForAST(ast, this.locationInfo.fileName);
            if (decl) {
                return (decl.getFlags() & PullElementFlags.MustCaptureThis) == PullElementFlags.MustCaptureThis;
            }

            return false;
        }

        public emitJavascriptModule(moduleDecl: ModuleDeclaration) {
            var pullDecl = this.semanticInfoChain.getDeclForAST(moduleDecl, this.locationInfo.fileName);
            this.declStack.push(pullDecl);
            super.emitJavascriptModule(moduleDecl);
            this.declStack.pop();
        }

        public isContainedInClassDeclaration(varDecl: VarDecl) {
            var symbol = this.semanticInfoChain.getSymbolForAST(varDecl, this.locationInfo.fileName);
            if (symbol) {
                var parentSymbol = symbol.getContainer();
                if (parentSymbol) {
                    var parentKind = parentSymbol.getKind();
                    if (parentKind == PullElementKind.Class) {
                        return true;
                    }
                }
            }

            return false;
        }

        public isContainedInModuleOrEnumDeclaration(varDecl: VarDecl) {
            var symbol = this.semanticInfoChain.getSymbolForAST(varDecl, this.locationInfo.fileName);
            var parentSymbol: PullTypeSymbol;

            if (symbol) {
                parentSymbol = symbol.getContainer();
                if (parentSymbol && parentSymbol.getKind() == PullElementKind.Enum) {
                    return true;
                }

                parentSymbol = parentSymbol ? parentSymbol.getAssociatedContainerType() : null;

                if (parentSymbol) {
                    var parentKind = parentSymbol.getKind();
                    if (parentKind == PullElementKind.Container || parentKind == PullElementKind.DynamicModule || parentKind == PullElementKind.Enum) {
                        return true;
                    }
                }
            }

            return false;
        }

        public getContainedSymbolName(varDecl: VarDecl) {
            var symbol = this.semanticInfoChain.getSymbolForAST(varDecl, this.locationInfo.fileName);
            var parentSymbol = symbol.getContainer();
            return parentSymbol.getName();
        }

        public emitJavascriptVarDecl(varDecl: VarDecl, tokenId: TokenID) {
            var pullDecl = this.semanticInfoChain.getDeclForAST(varDecl, this.locationInfo.fileName);
            this.declStack.push(pullDecl);
            super.emitJavascriptVarDecl(varDecl, tokenId);
            this.declStack.pop();
        }

        public emitJavascriptName(name: Identifier, addThis: bool) {
            this.emitParensAndCommentsInPlace(name, true);
            this.recordSourceMappingStart(name);
            if (!name.isMissing()) {
                var resolvingContext = new PullTypeResolutionContext();
                this.setTypeCheckerUnit(this.locationInfo.fileName);
                var pullSymbol = this.pullTypeChecker.resolver.resolveNameExpression(name,
                    this.getEnclosingDecl(), resolvingContext);
                var pullSymbolKind = pullSymbol.getKind();
                if (addThis && (this.emitState.container != EmitContainer.Args) && pullSymbol) {
                    var pullSymbolContainer = pullSymbol.getContainer();
                    if (pullSymbolContainer) {
                        var pullSymbolContainerKind = pullSymbolContainer.getKind();
                        if (pullSymbolContainerKind == PullElementKind.Class) {
                            if (pullSymbol.hasFlag(PullElementFlags.Static)) {
                                // This is static symbol
                                this.writeToOutput(pullSymbolContainer.getName() + ".");
                            }
                            else if (pullSymbolKind == PullElementKind.Property) {
                                this.emitThis();
                                this.writeToOutput(".");
                            }
                        }
                        else if (pullSymbolContainerKind == PullElementKind.Container || pullSymbolContainerKind == PullElementKind.Enum) {
                            // If property
                            if (pullSymbolKind == PullElementKind.Property || pullSymbol.hasFlag(PullElementFlags.Exported)) {
                                this.writeToOutput(pullSymbolContainer.getName() + ".");
                            }
                        }
                        else if (pullSymbolContainerKind == PullElementKind.DynamicModule) {
                            if (pullSymbolKind == PullElementKind.Property || pullSymbol.hasFlag(PullElementFlags.Exported)) {
                                // If dynamic module
                                this.writeToOutput("exports.");
                            }
                        }
                        else if (pullSymbolKind == PullElementKind.Property) {
                            if (pullSymbolContainer.getKind() == PullElementKind.Class) {
                                this.emitThis();
                                this.writeToOutput(".");
                            }
                        }
                        else {
                            var pullDecls = pullSymbol.getDeclarations();
                            var emitContainerName = true;
                            for (var i = 0 ; i < pullDecls.length; i++) {
                                if (pullDecls[i].getScriptName() == this.locationInfo.fileName) {
                                    emitContainerName = false;
                                }
                            }
                            if (emitContainerName) {
                                this.writeToOutput(pullSymbolContainer.getName() + ".");
                            }
                        }
                    }
                }

                // If it's a dynamic module, we need to print the "require" invocation
                if (pullSymbol && pullSymbolKind == PullElementKind.DynamicModule) {
                    if (moduleGenTarget == ModuleGenTarget.Asynchronous) {
                        this.writeLineToOutput("__" + this.modAliasId + "__;");
                    }
                    else {
                        var moduleDecl: ModuleDeclaration = <ModuleDeclaration>this.semanticInfoChain.getASTForSymbol(pullSymbol, this.locationInfo.fileName);
                        var modPath = name.actualText;
                        var isAmbient = pullSymbol.hasFlag(PullElementFlags.Ambient);
                        modPath = isAmbient ? modPath : this.firstModAlias ? this.firstModAlias : quoteBaseName(modPath);
                        modPath = isAmbient ? modPath : (!isRelative(stripQuotes(modPath)) ? quoteStr("./" + stripQuotes(modPath)) : modPath);
                        this.writeToOutput("require(" + modPath + ")");
                    }
                }
                else {
                    this.writeToOutput(name.actualText);
                }
            }

            this.recordSourceMappingEnd(name);
            this.emitParensAndCommentsInPlace(name, false);
        }

        public getLineMap(): ILineMap {
            return this.locationInfo.lineMap1;
        }

        public isAccessorEmitted(funcDecl: FuncDecl) {
            if (hasFlag(funcDecl.fncFlags, FncFlags.GetAccessor)) {
                return false;
            }

            var accessorSymbol = PullHelpers.getAccessorSymbol(funcDecl, this.semanticInfoChain, this.locationInfo.fileName);
            if (accessorSymbol.getGetter()) {
                return true;
            }

            return false;
        }

        public getGetterAndSetterFunction(funcDecl: FuncDecl): { getter: FuncDecl; setter: FuncDecl; } {
            var result = PullHelpers.getGetterAndSetterFunction(funcDecl, this.semanticInfoChain, this.locationInfo.fileName);
            return result;
        }

        public isAccessorInObjectLiteral(funcDecl: FuncDecl) {
            var accessorSymbol = PullHelpers.getAccessorSymbol(funcDecl, this.semanticInfoChain, this.locationInfo.fileName);
            var container = accessorSymbol.getContainer();
            var containerKind = container.getKind();
            return containerKind != PullElementKind.Class && containerKind != PullElementKind.ConstructorType;
        }

        public emitJavascriptClass(classDecl: ClassDeclaration) {
            var pullDecl = this.semanticInfoChain.getDeclForAST(classDecl, this.locationInfo.fileName);
            this.declStack.push(pullDecl);
            super.emitJavascriptClass(classDecl);
            this.declStack.pop();
        }
    }
}

