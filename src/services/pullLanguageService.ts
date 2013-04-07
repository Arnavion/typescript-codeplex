// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='typescriptServices.ts' />
///<reference path='..\Compiler\Core\IDiagnostic.ts' />

module Services {
    export class LanguageService implements ILanguageService {
        private logger: TypeScript.ILogger;
        private compilerState: CompilerState;
        private formattingRulesProvider: TypeScript.Formatting.RulesProvider;

        private currentFileName: string = "";
        private currentFileVersion: number = -1;
        private currentFileSyntaxTree: TypeScript.SyntaxTree = null;

        constructor(public host: ILanguageServiceHost) {
            this.logger = this.host;
            this.compilerState = new CompilerState(this.host);
        }

        public refresh(): void {
            TypeScript.timeFunction(this.logger, "refresh()", () => {
                this.compilerState.refresh();
            });
        }

        private minimalRefresh(): void {
            TypeScript.timeFunction(this.logger, "minimalRefresh()", () => {
                this.compilerState.minimalRefresh();
            });
        }

        public getSymbolTree(): ISymbolTree {
            this.refresh();
            return this.compilerState.getSymbolTree();
        }

        public getReferencesAtPosition(fileName: string, pos: number): ReferenceEntry[] {
            this.refresh();

            var result: ReferenceEntry[] = [];

            var document = this.compilerState.getDocument(fileName);
            var script = document.script;
              
            /// TODO: this does not allow getting references on "constructor"

            var path = this.getAstPathToPosition(script, pos);
            if (path.ast() === null || path.ast().nodeType !== TypeScript.NodeType.Name) {
                this.logger.log("No name found at the given position");
                return result;
            }

            var symbolInfoAtPosition = this.compilerState.getSymbolInformationFromPath(path, document);
            if (symbolInfoAtPosition === null || symbolInfoAtPosition.symbol === null) {
                this.logger.log("No symbol found at the given position");
                return result;
            }

            var symbol = symbolInfoAtPosition.symbol;
            
            var fileNames = this.compilerState.getFileNames();
            for (var i = 0, len = fileNames.length; i < len; i++) {
                result = result.concat(this.getReferencesInFile(fileNames[i], symbol));
            }

            return result;
        }

        public getOccurrencesAtPosition(fileName: string, pos: number): ReferenceEntry[]{
            this.refresh();

            var result: ReferenceEntry[] = [];

            var document = this.compilerState.getDocument(fileName);
            var script = document.script;

            /// TODO: this does not allow getting references on "constructor"

            var path = this.getAstPathToPosition(script, pos);
            if (path.ast() === null || path.ast().nodeType !== TypeScript.NodeType.Name) {
                this.logger.log("No name found at the given position");
                return result;
            }

            var symbolInfoAtPosition = this.compilerState.getSymbolInformationFromPath(path, document);
            if (symbolInfoAtPosition === null || symbolInfoAtPosition.symbol === null) {
                this.logger.log("No symbol found at the given position");
                return result;
            }

            var symbol = symbolInfoAtPosition.symbol;
            return this.getReferencesInFile(fileName, symbol);
        }

        public getImplementorsAtPosition(fileName: string, position: number): ReferenceEntry[] {
            return [];
        }

        private getReferencesInFile(fileName: string, symbol: TypeScript.PullSymbol): ReferenceEntry[] {
            var result: ReferenceEntry[] = [];
            var symbolName = symbol.getName();
            
            var possiblePositions = this.getPossibleSymbolReferencePositions(fileName, symbol);
            if (possiblePositions && possiblePositions.length > 0) {
                var document = this.compilerState.getDocument(fileName);
                var script = document.script;

                possiblePositions.forEach(p => {
                    var path = this.getAstPathToPosition(script, p);
                    if (path.ast() === null || path.ast().nodeType !== TypeScript.NodeType.Name) {
                        return;
                    }

                    var searchSymbolInfoAtPosition = this.compilerState.getSymbolInformationFromPath(path, document);
                    if (searchSymbolInfoAtPosition !== null && searchSymbolInfoAtPosition.symbol === symbol) {
                        var isWriteAccess = false; // this.isWriteAccess(searchSymbolInfoAtPosition.ast, searchSymbolInfoAtPosition.parentAST);
                        result.push(new ReferenceEntry(fileName, searchSymbolInfoAtPosition.ast, isWriteAccess));
                    }
                });
            }
            

            return result;
        }

        private getPossibleSymbolReferencePositions(fileName: string, symbol: TypeScript.PullSymbol): number []{
            var positions: number[] = [];

            /// TODO: Cache symbol existence for files to save text search
            /// TODO: Use a smarter search mechanism to avoid picking up partial matches, matches in comments and in string literals

            var sourceText = this.compilerState.getScriptSnapshot(fileName);
            var text = sourceText.getText(0, sourceText.getLength());
            var symbolName = symbol.getName();

            var position = text.indexOf(symbolName);
            while (position >= 0) {
                positions.push(position);
                position = text.indexOf(symbolName, position + symbolName.length + 1);
            }

            return positions;
        }

        public getSignatureAtPosition(fileName: string, position: number): SignatureInfo {
            this.refresh();

            var document = this.compilerState.getDocument(fileName);
            var script = document.script;

            // If "pos" is the "EOF" position
            var atEOF = (position === script.limChar);

            var path = this.getAstPathToPosition(script, position);
            if (path.count() == 0) {
                return null;
            }

            // First check whether we are in a comment where quick info should not be displayed
            if (path.nodeType() === TypeScript.NodeType.Comment) {
                this.logger.log("position is inside a comment");
                return null;
            }

            /// TODO: disable signature help in string literals and regexp literals

            // Find call expression
            while (path.count() >= 2) {
                // Path we are looking for...
                if (path.isArgumentListOfCall() || path.isArgumentListOfNew()) {
                    // The caret position should be *after* the opening "(" of the argument list
                    if (atEOF || position >= path.ast().minChar) {
                        path.pop();
                    }
                    break;
                } else if (path.ast().nodeType === TypeScript.NodeType.InvocationExpression || path.ast().nodeType === TypeScript.NodeType.ObjectCreationExpression) {
                    break;
                }

                // Path that should make us stop looking up..
                if (position > path.ast().minChar) {  // If cursor is on the "{" of the body, we may wat to display param help
                    if (path.ast().nodeType !== TypeScript.NodeType.List) { 
                        break;
                    }
                }
                path.pop();
            }

            if (path.ast().nodeType !== TypeScript.NodeType.InvocationExpression && path.ast().nodeType !== TypeScript.NodeType.ObjectCreationExpression) {
                this.logger.log("No call expression for the given position");
                return null;
            }

            var callExpression = <TypeScript.CallExpression>path.ast();
            var isNew = (callExpression.nodeType === TypeScript.NodeType.ObjectCreationExpression);

            // Resolve symbol
            var callSymbolInfo = this.compilerState.getCallInformationFromPath(path, document);
            if (!callSymbolInfo || !callSymbolInfo.targetSymbol || !callSymbolInfo.resolvedSignatures) {
                this.logger.log("Could not find symbol for call expression");
                return null;
            }

            // Build the result
            var result = new SignatureInfo();

            result.formal = this.convertSignatureSymbolToSignatureInfo(callSymbolInfo.targetSymbol, isNew, callSymbolInfo.resolvedSignatures, callSymbolInfo.enclosingScopeSymbol);
            result.actual = this.convertCallExprToActualSignatureInfo(callExpression, position, atEOF);
            result.activeFormal = (callSymbolInfo.resolvedSignatures && callSymbolInfo.candidateSignature) ? callSymbolInfo.resolvedSignatures.indexOf(callSymbolInfo.candidateSignature) : -1;
            
            if (result.actual === null || result.formal === null || result.activeFormal === null) {
                this.logger.log("Can't compute actual and/or formal signature of the call expression");
                return null;
            }

            return result;
        }

        private convertSignatureSymbolToSignatureInfo(symbol: TypeScript.PullSymbol, isNew: bool, signatures: TypeScript.PullSignatureSymbol[], enclosingScopeSymbol: TypeScript.PullSymbol): FormalSignatureInfo {
            var result = new FormalSignatureInfo();
            result.isNew = isNew;
            result.name = symbol.getName();
            result.docComment = this.compilerState.getDocComments(symbol); 
            result.openParen = "(";  //(group.flags & TypeScript.SignatureFlags.IsIndexer ? "[" : "(");
            result.closeParen = ")";  //(group.flags & TypeScript.SignatureFlags.IsIndexer ? "]" : ")");

            var hasOverloads = signatures.length > 1;
            signatures
                // Same test as in "typeFlow.str: resolveOverload()": filter out the definition signature if there are overloads
                .filter(signature => !(hasOverloads && signature.isDefinition() && !this.compilerState.compilationSettings().canCallDefinitionSignature))
                .forEach(signature => {
                    var signatureGroupInfo = new FormalSignatureItemInfo();
                    signatureGroupInfo.docComment = this.compilerState.getDocComments(signature);
                    signatureGroupInfo.returnType = signature.getReturnType() === null ? "any" : signature.getReturnType().getScopedNameEx(enclosingScopeSymbol).toString();
                    var parameters = signature.getParameters();
                    parameters.forEach((p, i) => {
                        var signatureParameterInfo = new FormalParameterInfo();
                        signatureParameterInfo.isVariable = signature.hasVariableParamList() && (i === parameters.length - 1);
                        signatureParameterInfo.isOptional = p.getIsOptional();
                        signatureParameterInfo.name = p.getName();
                        signatureParameterInfo.docComment = this.compilerState.getDocComments(p);
                        signatureParameterInfo.type = p.getTypeName(enclosingScopeSymbol);
                        signatureGroupInfo.parameters.push(signatureParameterInfo);
                    });
                    result.signatureGroup.push(signatureGroupInfo);
                });
            return result;
        }

        private convertCallExprToActualSignatureInfo(ast: TypeScript.CallExpression, caretPosition: number, atEOF: bool): ActualSignatureInfo {
            if (!TypeScript.isValidAstNode(ast))
                return null;

            if (!TypeScript.isValidAstNode(ast.arguments))
                return null;

            var result = new ActualSignatureInfo();
            result.currentParameter = -1;
            result.openParenMinChar = ast.arguments.minChar;
            result.closeParenLimChar = Math.max(ast.arguments.minChar, ast.arguments.limChar);
            ast.arguments.members.forEach((arg, index) => {
                var parameter = new ActualParameterInfo();
                parameter.minChar = arg.minChar;
                parameter.limChar = Math.max(arg.minChar, arg.limChar);
                result.parameters.push(parameter);
            });

            result.parameters.forEach((parameter, index) => {
                var minChar = (index == 0 ? result.openParenMinChar : result.parameters[index - 1].limChar + 1);
                var limChar = (index == result.parameters.length - 1 ? result.closeParenLimChar : result.parameters[index + 1].minChar);
                if (caretPosition >= minChar && (atEOF ? caretPosition <= limChar : caretPosition < limChar)) {
                    result.currentParameter = index;
                }
            });
            return result;
        }

        public getDefinitionAtPosition(fileName: string, position: number): DefinitionInfo {
            this.refresh();

            var result: DefinitionInfo = null;

            var document = this.compilerState.getDocument(fileName);
            var script = document.script;

            var path = this.getAstPathToPosition(script, position);
            if (path.count() == 0) {
                return null;
            }

            var symbolInfo = this.compilerState.getSymbolInformationFromPath(path, document);
            if (symbolInfo == null || symbolInfo.symbol == null) {
                this.logger.log("No identifier at the specified location.");
                return result;
            }

            var declarations = symbolInfo.symbol.getDeclarations();
            if (declarations == null || declarations.length === 0) {
                this.logger.log("Could not find declaration for symbol.");
                return result;
            }

            var symbolName = symbolInfo.symbol.getName();
            var symbolKind = this.mapPullElementKind(symbolInfo.symbol.getKind(), symbolInfo.symbol);//this.getSymbolElementKind(sym),
            var container = symbolInfo.symbol.getContainer();
            var containerName = container ? container.getName() : "<global>";//this.getSymbolContainerName(sym)
            var containerKind = "";//this.getSymbolContainerKind(sym)

            var entries: DefinitionInfo[] = [];
            var mainEntry = 0;
            for (var i = 0, n = declarations.length; i < n; i++) {
                var declaration = declarations[i];
                var span = declaration.getSpan();

                // For functions, pick the definition to be the main entry
                var signature = declaration.getSignatureSymbol();
                if (signature && signature.isDefinition()) {
                    mainEntry = i;
                }
                // TODO: find a better way of selecting the main entry for none-function overloaded types instead of selecting the first one

                entries.push(new DefinitionInfo(declaration.getScriptName(), span.start(), span.end(), symbolKind, symbolName, containerKind, containerName, null));
            }

            result = entries[mainEntry];
            if (entries.length > 1) {
                // Remove the main entry
                entries.splice(mainEntry, 1);
                result.overloads = entries;
            }
            
            return result;
        }

        public getNavigateToItems(searchValue: string): NavigateToItem[] {
            return null;
        }

        public getScriptLexicalStructure(fileName: string): NavigateToItem[] {
            this.refresh();

            var declarations = this.compilerState.getTopLevelDeclarations(fileName);
            if (!declarations) {
                return null;
            }

            var result: NavigateToItem[] = [];
            this.mapPullDeclsToNavigateToItem(declarations, result);
            return result;
        }

        private mapPullDeclsToNavigateToItem(declarations: TypeScript.PullDecl[], result: NavigateToItem[], parentSymbol?: TypeScript.PullSymbol, parentkindName?: string, includeSubcontainers:bool = true): void {
            for (var i = 0, n = declarations.length; i < n; i++) {
                var declaration = declarations[i];
                var symbol = declaration.getSymbol();
                var kindName = this.mapPullElementKind(declaration.getKind(), symbol);
                var fileName = declaration.getScriptName();

                if (this.shouldIncludeDeclarationInNavigationItems(declaration, includeSubcontainers)) {
                    var item = new NavigateToItem();
                    item.name = this.getNavigationItemDispalyName(declaration);
                    item.matchKind = MatchKind.exact;
                    item.kind = kindName;
                    item.kindModifiers = symbol ? this.getScriptElementKindModifiers(symbol) : "";
                    item.fileName = fileName;
                    item.minChar = declaration.getSpan().start();
                    item.limChar = declaration.getSpan().end();
                    item.containerName = parentSymbol ? parentSymbol.fullName() : "";
                    item.containerKind = parentkindName || "";

                    result.push(item);
                }
                
                if (includeSubcontainers && this.isContainerDeclaration(declaration)) {
                    // process child declarations
                    this.mapPullDeclsToNavigateToItem(declaration.getChildDecls(), result, symbol, kindName, /*includeSubcontainers*/ true);

                    if (symbol) {
                        // Process declarations in other files
                        var otherDeclarations = symbol.getDeclarations();
                        if (otherDeclarations.length > 1) {
                            for (var j = 0, m = otherDeclarations.length; j < m; j++) {
                                var otherDeclaration = otherDeclarations[j];
                                if (otherDeclaration.getScriptName() === fileName) {
                                    // this has already been processed 
                                    continue;
                                }
                                this.mapPullDeclsToNavigateToItem(otherDeclaration.getChildDecls(), result, symbol, kindName, /*includeSubcontainers*/ false);
                            }
                        }
                    }
                }
            }
        }

        private isContainerDeclaration(declaration: TypeScript.PullDecl): bool {
            switch (declaration.getKind()) {
                case TypeScript.PullElementKind.Script:
                case TypeScript.PullElementKind.Container:
                case TypeScript.PullElementKind.Class:
                case TypeScript.PullElementKind.Interface:
                case TypeScript.PullElementKind.DynamicModule:                
                case TypeScript.PullElementKind.Enum:
                    return true;
            }

            return false;
        }

        private shouldIncludeDeclarationInNavigationItems(declaration: TypeScript.PullDecl, includeSubcontainers: bool): bool {
            switch (declaration.getKind()) {
                case TypeScript.PullElementKind.Script:
                    // Do not include the script item
                    return false;
                case TypeScript.PullElementKind.Variable:
                case TypeScript.PullElementKind.Property:
	// Do not include the value side of modules or classes, as thier types has already been included
                    var symbol = declaration.getSymbol();
                    return !this.isModule(symbol) && !this.isDynamicModule(symbol)  && !this.isConstructorMethod(symbol) && !this.isClass(symbol);
                case TypeScript.PullElementKind.EnumMember:
	// Ignore the _map for enums. this should be removed once enum new implmentation is in place
                    return declaration.getName() !== "_map";
                case TypeScript.PullElementKind.FunctionExpression:
                case TypeScript.PullElementKind.Function:
	// Ignore anonomus functions
                    return declaration.getName() !== "";
            }

            if (this.isContainerDeclaration(declaration)) {
                return includeSubcontainers;
            }

            return true;
        }

        private getNavigationItemDispalyName(declaration: TypeScript.PullDecl): string {
            switch (declaration.getKind()) {
                case TypeScript.PullElementKind.ConstructorMethod:
                    return "constructor";
                case TypeScript.PullElementKind.CallSignature:
                    return "()";
                case TypeScript.PullElementKind.ConstructSignature:
                    return "new()";
                case TypeScript.PullElementKind.IndexSignature:
                    return "[]";
            }

            return declaration.getName();
        }

        public getSyntacticDiagnostics(fileName: string): TypeScript.IDiagnostic[] {
            this.compilerState.refresh();
            return this.compilerState.getSyntacticDiagnostics(fileName);
        }

        public getSemanticDiagnostics(fileName: string): TypeScript.IDiagnostic[] {
            this.compilerState.refresh();
            return this.compilerState.getSemanticDiagnostics(fileName);
        }

        public getEmitOutput(fileName: string): IOutputFile[] {
            return [];
        }

        ///
        /// Return the stack of AST nodes containing "position"
        ///
        public getAstPathToPosition(script: TypeScript.AST, pos: number, options = TypeScript.GetAstPathOptions.Default): TypeScript.AstPath {
            if (this.logger.information()) {
                this.logger.log("getAstPathToPosition(" + script + ", " + pos + ")");
            }

            return TypeScript.getAstPathToPosition(script, pos, options);
        }

        public getIdentifierPathToPosition(script: TypeScript.AST, pos: number): TypeScript.AstPath {
            this.logger.log("getIdentifierPathToPosition(" + script + ", " + pos + ")");

            var path = this.getAstPathToPosition(script, pos, TypeScript.GetAstPathOptions.EdgeInclusive);
            if (path.count() == 0)
                return null;

            if (path.nodeType() !== TypeScript.NodeType.Name) {
                return null;
            }

            return path;
        }

        private getFullNameOfSymbol(symbol: TypeScript.PullSymbol, enclosingScopeSymbol: TypeScript.PullSymbol) {
            var container = symbol.getContainer();
            if (this.isLocal(symbol) ||
                symbol.getKind() == TypeScript.PullElementKind.Parameter) {
                // Local var
                return symbol.getScopedName(enclosingScopeSymbol);
            }

            if (symbol.getKind() == TypeScript.PullElementKind.Primitive) {
                // Primitive type symbols - do not use symbol name
                return "";
            }

            return symbol.fullName(enclosingScopeSymbol);
        }

        //
        // New Pull stuff
        //

        public getTypeAtPosition(fileName: string, position: number): TypeInfo {
            this.refresh();

            var document = this.compilerState.getDocument(fileName);
            var script = document.script;

            var path = this.getAstPathToPosition(script, position);
            if (path.count() == 0) {
                return null;
            }

            if (this.isGetTypeBlocker(position, path)) {
                return null;
            }

            var ast: TypeScript.AST;
            var symbol: TypeScript.PullSymbol;
            var typeSymbol: TypeScript.PullTypeSymbol;
            var enclosingScopeSymbol: TypeScript.PullSymbol;
            var isCallExpression: bool = false;
            var resolvedSignatures: TypeScript.PullSignatureSymbol[];
            var candidateSignature: TypeScript.PullSignatureSymbol;
            var isConstructorCall: bool;

            if (path.isNameOfClass() || path.isNameOfInterface() || path.isNameOfFunction() || path.isNameOfVariable()) {
                // Skip the name and get to the declaration
                path.pop();
            }

            if (path.isDeclaration()) {
                var declarationInformation = this.compilerState.getDeclarationSymbolInformation(path, document);

                ast = declarationInformation.ast;
                symbol = declarationInformation.symbol;
                enclosingScopeSymbol = declarationInformation.enclosingScopeSymbol;

                if (path.ast().nodeType === TypeScript.NodeType.FunctionDeclaration) {
                    var funcDecl = <TypeScript.FunctionDeclaration>(path.ast());
                    if (symbol && symbol.getKind() != TypeScript.PullElementKind.Property) {
                        var signatureInfo = TypeScript.PullHelpers.getSignatureForFuncDecl(funcDecl, this.compilerState.getSemanticInfoChain(), fileName);
                        isCallExpression = true;
                        candidateSignature = signatureInfo.signature;
                        resolvedSignatures = signatureInfo.allSignatures;
                    }
                }
            }
            else if (path.isCallExpression() || path.isCallExpressionTarget()) {
                // If this is a call we need to get the call singuatures as well
                // Move the cursor to point to the call expression
                while (!path.isCallExpression()) {
                    path.pop();
                }

                // Get the call expression symbol
                var callExpressionInformation = this.compilerState.getCallInformationFromPath(path, document);

                if (!callExpressionInformation.targetSymbol) {
                    return null;
                }

                ast = callExpressionInformation.ast;
                symbol = callExpressionInformation.targetSymbol;
                enclosingScopeSymbol = callExpressionInformation.enclosingScopeSymbol;

                // Check if this is a property or a variable, if so do not treat it as a fuction, but rather as a variable with function type
                var isPropertyOrVar = symbol.getKind() == TypeScript.PullElementKind.Property || symbol.getKind() == TypeScript.PullElementKind.Variable;
                typeSymbol = symbol.getType();
                if (isPropertyOrVar) {
                    if (typeSymbol.getName() != "") {
                        symbol = typeSymbol;
                    }
                    isPropertyOrVar = (typeSymbol.getKind() != TypeScript.PullElementKind.Interface && typeSymbol.getKind() != TypeScript.PullElementKind.ObjectType) || typeSymbol.getName() == "";
                }

                if (!isPropertyOrVar) {
                    isCallExpression = true;
                    resolvedSignatures = callExpressionInformation.resolvedSignatures;
                    candidateSignature = callExpressionInformation.candidateSignature;
                    isConstructorCall = callExpressionInformation.isConstructorCall;
                }
            }
            else {
                var symbolInformation = this.compilerState.getSymbolInformationFromPath(path, document);

                if (!symbolInformation.symbol) {
                    return null;
                }

                ast = symbolInformation.ast;
                symbol = symbolInformation.symbol;
                enclosingScopeSymbol = symbolInformation.enclosingScopeSymbol;

               
                if (symbol.getKind() === TypeScript.PullElementKind.Method || symbol.getKind() == TypeScript.PullElementKind.Function) {
                    typeSymbol = symbol.getType()
                    if (typeSymbol) {
                        isCallExpression = true;
                        resolvedSignatures = typeSymbol.getCallSignatures();
                    }
                }
            }

            if (resolvedSignatures && (!candidateSignature || candidateSignature.isDefinition())) {
                for (var i = 0, len = resolvedSignatures.length; i < len; i++) {
                    if (len > 1 && resolvedSignatures[i].isDefinition()) {
                        continue;
                    }

                    candidateSignature = resolvedSignatures[i];
                    break;
                }
            }

            var memberName = isCallExpression ?
            TypeScript.PullSignatureSymbol.getSignatureTypeMemberName(candidateSignature, resolvedSignatures, enclosingScopeSymbol) :
            symbol.getTypeNameEx(enclosingScopeSymbol, true);
            var kind = this.mapPullElementKind(symbol.getKind(), symbol, !isCallExpression, isCallExpression, isConstructorCall);
            var docComment = this.compilerState.getDocComments(candidateSignature || symbol, !isCallExpression);
            var symbolName = this.getFullNameOfSymbol(symbol, enclosingScopeSymbol);
            var minChar = ast ? ast.minChar : -1;
            var limChar = ast ? ast.limChar : -1;

            return new TypeInfo(memberName, docComment, symbolName, kind, minChar, limChar);
        }

        private isGetTypeBlocker(position: number, path: TypeScript.AstPath): bool {
            switch (path.ast().nodeType) {
                case TypeScript.NodeType.TrueLiteral:
                case TypeScript.NodeType.FalseLiteral:
                case TypeScript.NodeType.StringLiteral:
                case TypeScript.NodeType.RegularExpressionLiteral:
                case TypeScript.NodeType.NumericLiteral:
                case TypeScript.NodeType.NullLiteral:
                case TypeScript.NodeType.Name:
                case TypeScript.NodeType.ThisExpression:
                case TypeScript.NodeType.SuperExpression:
                case TypeScript.NodeType.MemberAccessExpression:
                    return false;
                case TypeScript.NodeType.FunctionDeclaration:
                    var funcDecl = <TypeScript.FunctionDeclaration>path.ast();
	if (TypeScript.hasFlag(funcDecl.getFunctionFlags(), TypeScript.FunctionFlags.ConstructMember) ||
	TypeScript.hasFlag(funcDecl.getFunctionFlags(), TypeScript.FunctionFlags.IndexerMember)) {
                        // constructor and index signatures
                        return false;
                    }
                    else if (funcDecl.isConstructor)
                    {
                        // constructor keyword
                        return !(position >= funcDecl.minChar && position <= funcDecl.minChar + 11 /*constructor*/);
                    }
                    break;
            }

            return true;
        }

        public getCompletionsAtPosition(fileName: string, position: number, isMemberCompletion: bool): CompletionInfo {
            this.refresh();

            var completions = new CompletionInfo();

            var document = this.compilerState.getDocument(fileName);
            var script = document.script;

            var path = this.getAstPathToPosition(script, position);
            if (this.isCompletionListBlocker(path)) {
                this.logger.log("Returning an empty list because position is inside a comment, string or regular expression");
                return null;
            }

            var isRightOfDot = false;
            if (path.count() >= 1 &&
                path.asts[path.top].nodeType === TypeScript.NodeType.MemberAccessExpression
                && (<TypeScript.BinaryExpression>path.asts[path.top]).operand1.limChar < position) {
                isRightOfDot = true;
                path.push((<TypeScript.BinaryExpression>path.asts[path.top]).operand1);
            }
            else if (path.count() >= 2 &&
                    path.asts[path.top].nodeType === TypeScript.NodeType.Name &&
                    path.asts[path.top - 1].nodeType === TypeScript.NodeType.MemberAccessExpression &&
                    (<TypeScript.BinaryExpression>path.asts[path.top - 1]).operand2 === path.asts[path.top]) {
                isRightOfDot = true;
                path.pop();
                path.push((<TypeScript.BinaryExpression>path.asts[path.top]).operand1);
            }

            if (isRightOfDot) {
                var members = this.compilerState.getVisibleMemberSymbolsFromPath(path, document);
                if (!members) {
                    return null;
                }
                completions.isMemberCompletion = true;
                completions.entries = this.getCompletionEntriesFromSymbols(members);
            }
            // Ensure we are in a position where it is ok to provide a completion list
            else if (isMemberCompletion || this.isCompletionListTriggerPoint(path)) {
                // Get scope memebers
                completions.isMemberCompletion = false;
                var symbols = this.compilerState.getVisibleSymbolsFromPath(path, document);
                completions.entries = this.getCompletionEntriesFromSymbols(symbols);
            }

            return completions;
        }

        private getCompletionEntriesFromSymbols(symbolInfo: TypeScript.PullVisibleSymbolsInfo): CompletionEntry[] {
            var result: CompletionEntry[] = [];

            symbolInfo.symbols.forEach((symbol) => {
                var entry = new CompletionEntry();
                entry.name = symbol.getName();
                entry.type = symbol.getTypeName(symbolInfo.enclosingScopeSymbol, true);
                entry.kind = this.mapPullElementKind(symbol.getKind(), symbol, true);
                entry.fullSymbolName = this.getFullNameOfSymbol(symbol, symbolInfo.enclosingScopeSymbol);
                var type = symbol.getType();
                var symbolForDocComments = symbol;
                if (type && type.hasOnlyOverloadCallSignatures()) {
                    symbolForDocComments = type.getCallSignatures()[0];
                }
                entry.docComment = this.compilerState.getDocComments(symbolForDocComments, true);
                entry.kindModifiers = this.getScriptElementKindModifiers(symbol);
                result.push(entry);
            });
            return result;
        }

        private isRightOfDot(path: TypeScript.AstPath, position: number): bool {
            return (path.count() >= 1 && path.asts[path.top].nodeType === TypeScript.NodeType.MemberAccessExpression && (<TypeScript.BinaryExpression>path.asts[path.top]).operand1.limChar < position) ||
                   (path.count() >= 2 && path.asts[path.top].nodeType === TypeScript.NodeType.Name && path.asts[path.top - 1].nodeType === TypeScript.NodeType.MemberAccessExpression && (<TypeScript.BinaryExpression>path.asts[path.top - 1]).operand2 === path.asts[path.top]);
        }

        private isCompletionListBlocker(path: TypeScript.AstPath): bool {
            var asts = path.asts;
            var node = path.count() >= 1 && path.ast();
            if (node) {
                if (node.nodeType === TypeScript.NodeType.Comment ||
                    node.nodeType === TypeScript.NodeType.RegularExpressionLiteral ||
                    node.nodeType === TypeScript.NodeType.StringLiteral) {
                    return true;
                }
            }
            return false;
        }

        private isCompletionListTriggerPoint(path: TypeScript.AstPath): bool {

            if (path.isNameOfVariable() // var <here>
                || path.isNameOfArgument() // function foo(a, b<here>
                || path.isArgumentListOfFunction() // function foo(<here>
                || path.ast().nodeType === TypeScript.NodeType.Parameter // function foo(a <here>
                ) {
                return false;
            }

            if (path.isNameOfVariable() // var <here>
                || path.isNameOfFunction() // function <here>
                || path.isNameOfArgument() // function foo(<here>
                || path.isArgumentListOfFunction() // function foo(<here>
                || path.isNameOfInterface() // interface <here>
                || path.isNameOfClass() // class <here>
                || path.isNameOfModule() // module <here>
                ) {
                return false;
            }

            //var node = path.count() >= 1 && path.ast();
            //if (node) {
            //    if (node.nodeType === TypeScript.NodeType.Member // class C() { property <here>
            //    || node.nodeType === TypeScript.NodeType.TryCatch // try { } catch(<here>
            //    || node.nodeType === TypeScript.NodeType.Catch // try { } catch(<here>
            //    ) {
            //        return false
            //    }
            //}

            return true;
        }

        private isLocal(symbol: TypeScript.PullSymbol) {
            var container = symbol.getContainer();
            if (container) {
                var containerKind = container.getKind();
                if (containerKind & (TypeScript.PullElementKind.SomeFunction | TypeScript.PullElementKind.FunctionType)) {
                    return true;
                }

                if (containerKind == TypeScript.PullElementKind.ConstructorType && !symbol.hasFlag(TypeScript.PullElementFlags.Static)) {
                    return true;
                }
            }

            return false;
        }

        private isModule(symbol: TypeScript.PullSymbol) {
            return this.isOneDeclarationOfKind(symbol, TypeScript.PullElementKind.Container);
        }

        private isDynamicModule(symbol: TypeScript.PullSymbol) {
            return this.isOneDeclarationOfKind(symbol, TypeScript.PullElementKind.DynamicModule);
        }

        private isConstructorMethod(symbol: TypeScript.PullSymbol): bool {
            return this.isOneDeclarationOfKind(symbol, TypeScript.PullElementKind.ConstructorMethod);
        }

        private isClass(symbol: TypeScript.PullSymbol): bool {
            return this.isOneDeclarationOfKind(symbol, TypeScript.PullElementKind.Class);
        }

        private isOneDeclarationOfKind(symbol: TypeScript.PullSymbol, kind: TypeScript.PullElementKind): bool {
            var decls = symbol.getDeclarations();
            for (var i = 0; i < decls.length; i++) {
                if (decls[i].getKind() === kind) {
                    return true;
                }
            }

            return false;
        }

        private mapPullElementKind(kind: TypeScript.PullElementKind, symbol?: TypeScript.PullSymbol, useConstructorAsClass?: bool, varIsFunction?: bool, functionIsConstructor?: bool): string {
            if (functionIsConstructor) {
                return ScriptElementKind.constructorImplementationElement;
            }

            if (varIsFunction) {
                switch (kind) {
                    case TypeScript.PullElementKind.Container:
                    case TypeScript.PullElementKind.DynamicModule:
                    case TypeScript.PullElementKind.TypeAlias:
                    case TypeScript.PullElementKind.Interface:
                    case TypeScript.PullElementKind.Class:
                    case TypeScript.PullElementKind.Parameter:
                        return ScriptElementKind.functionElement;
                    case TypeScript.PullElementKind.Variable:
                        return (symbol && this.isLocal(symbol)) ? ScriptElementKind.localFunctionElement : ScriptElementKind.functionElement;
                    case TypeScript.PullElementKind.Property:
                        return ScriptElementKind.memberFunctionElement;
                    case TypeScript.PullElementKind.Function:
                        return (symbol && this.isLocal(symbol)) ? ScriptElementKind.localFunctionElement : ScriptElementKind.functionElement;
                    case TypeScript.PullElementKind.ConstructorMethod:
                        return ScriptElementKind.constructorImplementationElement;
                    case TypeScript.PullElementKind.Method:
                        return ScriptElementKind.memberFunctionElement;
                    case TypeScript.PullElementKind.FunctionExpression:
                        return ScriptElementKind.localFunctionElement;
                    case TypeScript.PullElementKind.GetAccessor:
                        return ScriptElementKind.memberGetAccessorElement;
                    case TypeScript.PullElementKind.SetAccessor:
                        return ScriptElementKind.memberSetAccessorElement;
                    case TypeScript.PullElementKind.CallSignature:
                        return ScriptElementKind.callSignatureElement;
                    case TypeScript.PullElementKind.ConstructSignature:
                        return ScriptElementKind.constructSignatureElement;
                    case TypeScript.PullElementKind.IndexSignature:
                        return ScriptElementKind.indexSignatureElement;
                }
            } else {
                switch (kind) {
                    case TypeScript.PullElementKind.Script:
                        return ScriptElementKind.scriptElement;
                    case TypeScript.PullElementKind.Container:
                    case TypeScript.PullElementKind.DynamicModule:
                    case TypeScript.PullElementKind.TypeAlias:
                        return ScriptElementKind.moduleElement;
                    case TypeScript.PullElementKind.Interface:
                        return ScriptElementKind.interfaceElement;
                    case TypeScript.PullElementKind.Class:
                        return ScriptElementKind.classElement;
                    case TypeScript.PullElementKind.Enum:
                        return ScriptElementKind.enumElement;
                    case TypeScript.PullElementKind.Variable:
                        if (symbol && this.isModule(symbol)) {
                            return ScriptElementKind.moduleElement;
                        }
                        return (symbol && this.isLocal(symbol)) ? ScriptElementKind.localVariableElement : ScriptElementKind.variableElement;
                    case TypeScript.PullElementKind.Parameter:
                        return ScriptElementKind.parameterElement;
                    case TypeScript.PullElementKind.Property:
                        return ScriptElementKind.memberVariableElement;
                    case TypeScript.PullElementKind.Function:
                        return (symbol && this.isLocal(symbol)) ? ScriptElementKind.localFunctionElement : ScriptElementKind.functionElement;
                    case TypeScript.PullElementKind.ConstructorMethod:
                        return useConstructorAsClass ? ScriptElementKind.classElement : ScriptElementKind.constructorImplementationElement;
                    case TypeScript.PullElementKind.Method:
                        return ScriptElementKind.memberFunctionElement;
                    case TypeScript.PullElementKind.FunctionExpression:
                        return ScriptElementKind.localFunctionElement;
                    case TypeScript.PullElementKind.GetAccessor:
                        return ScriptElementKind.memberGetAccessorElement;
                    case TypeScript.PullElementKind.SetAccessor:
                        return ScriptElementKind.memberSetAccessorElement;
                    case TypeScript.PullElementKind.CallSignature:
                        return ScriptElementKind.callSignatureElement;
                    case TypeScript.PullElementKind.ConstructSignature:
                        return ScriptElementKind.constructSignatureElement;
                    case TypeScript.PullElementKind.IndexSignature:
                        return ScriptElementKind.indexSignatureElement;
                    case TypeScript.PullElementKind.EnumMember:
                        return ScriptElementKind.memberVariableElement;
                }
            }

            return ScriptElementKind.unknown;
        }

        private getScriptElementKindModifiers(symbol: TypeScript.PullSymbol): string {
            var result = [];

            if (symbol.hasFlag(TypeScript.PullElementFlags.Exported)) {
                result.push(ScriptElementKindModifier.exportedModifier);
            }
            if (symbol.hasFlag(TypeScript.PullElementFlags.Ambient)) {
                result.push(ScriptElementKindModifier.ambientModifier);
            }
            if (symbol.hasFlag(TypeScript.PullElementFlags.Public)) {
                result.push(ScriptElementKindModifier.publicMemberModifier);
            }
            if (symbol.hasFlag(TypeScript.PullElementFlags.Private)) {
                result.push(ScriptElementKindModifier.privateMemberModifier);
            }
            if (symbol.hasFlag(TypeScript.PullElementFlags.Static)) {
                result.push(ScriptElementKindModifier.staticModifier);
            }

            return result.length > 0 ? result.join(',') : ScriptElementKindModifier.none;
        }

        // 
        // Syntactic Single-File features
        //

        public getNameOrDottedNameSpan(fileName: string, startPos: number, endPos: number): SpanInfo {
            return null;
        }

        public getBreakpointStatementAtPosition(fileName: string, pos: number): SpanInfo {
            return null;
        }

        public getFormattingEditsForRange(fileName: string, minChar: number, limChar: number, options: FormatCodeOptions): TextEdit[] {
            this.minimalRefresh();

            var manager = this.getFormattingManager(fileName, options);
           
            return manager.formatSelection(minChar, limChar);
        }

        public getFormattingEditsForDocument(fileName: string, minChar: number, limChar: number, options: FormatCodeOptions): TextEdit[] {
            this.minimalRefresh();

            var manager = this.getFormattingManager(fileName, options);

            return manager.formatDocument(minChar, limChar);
        }

        public getFormattingEditsOnPaste(fileName: string, minChar: number, limChar: number, options: FormatCodeOptions): TextEdit[] {
            this.minimalRefresh();

            var manager = this.getFormattingManager(fileName, options);

            return manager.formatOnPaste(minChar, limChar);
        }

        public getFormattingEditsAfterKeystroke(fileName: string, position: number, key: string, options: FormatCodeOptions): TextEdit[] {
            this.minimalRefresh();

            var manager = this.getFormattingManager(fileName, options);

            if (key === "}") {
                return manager.formatOnClosingCurlyBrace(position);
            }
            else if (key === ";") {
                return manager.formatOnSemicolon(position);
            }
            else if (key === "\n") {
                return manager.formatOnEnter(position);
            }

            return [];
        }

        private getFormattingManager(fileName: string, options: FormatCodeOptions) {
            // Ensure rules are initialized and up to date wrt to formatting options
            if (this.formattingRulesProvider == null) {
                this.formattingRulesProvider = new TypeScript.Formatting.RulesProvider(this.logger);
            }

            this.formattingRulesProvider.ensureUptodate(options);

            // Get the Syntax Tree
            var syntaxTree = this.getSyntaxTree(fileName);

            // Convert IScriptSnapshot to ITextSnapshot
            var scriptSnapshot = this.compilerState.getScriptSnapshot(fileName);
            var scriptText = TypeScript.SimpleText.fromScriptSnapshot(scriptSnapshot);
            var textSnapshot = new TypeScript.Formatting.TextSnapshot(scriptText);

            var manager = new TypeScript.Formatting.FormattingManager(syntaxTree, textSnapshot, this.formattingRulesProvider, options);

            return manager;
        }

        public getOutliningRegions(fileName: string): TypeScript.TextSpan[] {
            this.minimalRefresh();

            var syntaxTree = this.getSyntaxTree(fileName);

            return OutliningElementsCollector.collectElements(syntaxTree.sourceUnit());
        }

        // Given a script name and position in the script, return a string representing 
        // the desired smart indent text (assuming the line is empty).
        // Return "null" in case the smart indent cannot be determined.
        public getSmartIndentAtLineNumber(fileName: string, position: number, editorOptions: EditorOptions): number {
            this.minimalRefresh();

            var syntaxTree = this.getSyntaxTree(fileName);

            var scriptSnapshot = this.compilerState.getScriptSnapshot(fileName);
            var scriptText = TypeScript.SimpleText.fromScriptSnapshot(scriptSnapshot);
            var textSnapshot = new TypeScript.Formatting.TextSnapshot(scriptText);
            var options = new FormattingOptions(!editorOptions.ConvertTabsToSpaces, editorOptions.TabSize, editorOptions.IndentSize, editorOptions.NewLineCharacter)
            
            return TypeScript.Formatting.SingleTokenIndenter.getIndentationAmount(position, syntaxTree.sourceUnit(), textSnapshot, options);
        }

        // Given a script name and position in the script, return a pair of text range if the 
        // position corresponds to a "brace matchin" characters (e.g. "{" or "(", etc.)
        // If the position is not on any range, return "null".
        public getBraceMatchingAtPosition(fileName: string, position: number): TypeScript.TextSpan[] {
            this.minimalRefresh();

            var syntaxTree = this.getSyntaxTree(fileName);

            return BraceMatcher.getMatchSpans(syntaxTree, position);
        }

        //
        // Manage Single file syntax tree state
        //
        private getSyntaxTree(fileName: string): TypeScript.SyntaxTree {
            var version = this.compilerState.getScriptVersion(fileName);
            var syntaxTree: TypeScript.SyntaxTree = null;

            if (this.currentFileSyntaxTree === null || this.currentFileName !== fileName) {
                syntaxTree = this.createSyntaxTree(fileName);
            }
            else if (this.currentFileVersion !== version) {
                syntaxTree = this.updateSyntaxTree(fileName, this.currentFileSyntaxTree, this.currentFileVersion);
            }

            if (syntaxTree !== null) {
                // All done, ensure state is up to date
                this.currentFileVersion = version;
                this.currentFileName = fileName;
                this.currentFileSyntaxTree = syntaxTree;
            }

            return this.currentFileSyntaxTree;
        }

        private createSyntaxTree(fileName: string): TypeScript.SyntaxTree {
            var scriptSnapshot = this.compilerState.getScriptSnapshot(fileName);
            var text = TypeScript.SimpleText.fromScriptSnapshot(scriptSnapshot);

            var syntaxTree = TypeScript.Parser.parse(fileName, text, TypeScript.isDTSFile(fileName));

            return syntaxTree
        }

        private updateSyntaxTree(fileName: string, previousSyntaxTree: TypeScript.SyntaxTree, previousFileVersion: number): TypeScript.SyntaxTree {
            var editRange = this.compilerState.getScriptTextChangeRangeSinceVersion(fileName, previousFileVersion);

            // If "no changes", tree is good to go as is
            if (editRange === null) {
                return previousSyntaxTree;
            }

            // Debug.assert(newLength >= 0);

            var newScriptSnapshot = this.compilerState.getScriptSnapshot(fileName);
            var newSegmentedScriptSnapshot = TypeScript.SimpleText.fromScriptSnapshot(newScriptSnapshot);

            var nextSyntaxTree = TypeScript.Parser.incrementalParse(
                previousSyntaxTree, editRange, newSegmentedScriptSnapshot);

            return nextSyntaxTree;
        }
    }
}