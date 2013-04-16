// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\Typescript.ts' />

module TypeScript {

    export class PullTypeCheckContext {
        public enclosingDeclStack: PullDecl[] = [];
        public enclosingDeclReturnStack: boolean[] = [];
        public semanticInfo: SemanticInfo = null;
        public inSuperConstructorCall = false;
        public inSuperConstructorTarget = false;
        public seenSuperConstructorCall = false;
        private currentImplementsClauseTypeCheckClassPublicProperties: PullSymbol[] = null;

        constructor(public compiler: TypeScriptCompiler, public script: Script, public scriptName: string) {
        }

        public getCurrentImplementsClauseTypeCheckClassPublicProperties() {
            return this.currentImplementsClauseTypeCheckClassPublicProperties;
        }
        public setCurrentImplementsClauseTypeCheckClassPublicProperties(props: PullSymbol[]) {
            this.currentImplementsClauseTypeCheckClassPublicProperties = props;
        }

        public pushEnclosingDecl(decl: PullDecl) {
            this.enclosingDeclStack[this.enclosingDeclStack.length] = decl;
            this.enclosingDeclReturnStack[this.enclosingDeclReturnStack.length] = false;
        }

        public popEnclosingDecl() {
            this.enclosingDeclStack.length--;
            this.enclosingDeclReturnStack.length--;
        }

        public getEnclosingDecl(kind: PullElementKind = PullElementKind.All) {
            for (var i = this.enclosingDeclStack.length - 1; i >= 0; i--) {
                var decl = this.enclosingDeclStack[i];
                if (decl.getKind() & kind) {
                    return decl;
                }
            }

            return null;
        }

        public getEnclosingNonLambdaDecl() {
            for (var i = this.enclosingDeclStack.length - 1; i >= 0; i--) {
                var decl = this.enclosingDeclStack[i];
                if (!(decl.getKind() == PullElementKind.FunctionExpression && (decl.getFlags() & PullElementFlags.FatArrow))) {
                    return decl;
                }
            }

            return null;
        }

        public getEnclosingClassDecl(): PullDecl {
            return this.getEnclosingDecl(PullElementKind.Class);
        }

        public getEnclosingDeclHasReturn() {
            return this.enclosingDeclReturnStack[this.enclosingDeclReturnStack.length - 1];
        }

        public setEnclosingDeclHasReturn() {
            return this.enclosingDeclReturnStack[this.enclosingDeclReturnStack.length - 1] = true;
        }
    }

    export class PullTypeChecker {

        static globalPullTypeCheckPhase = 0;

        public resolver: PullTypeResolver = null;

        private context: PullTypeResolutionContext = new PullTypeResolutionContext();

        constructor(private compilationSettings: CompilationSettings,
            public semanticInfoChain: SemanticInfoChain) {
        }

        public setUnit(unitPath: string) {
            this.resolver = new PullTypeResolver(this.compilationSettings, this.semanticInfoChain, unitPath);
        }

        private getScriptDecl(fileName: string): PullDecl {
            return this.semanticInfoChain.getUnit(fileName).getTopLevelDecls()[0];
        }

        private checkForResolutionError(typeSymbol: PullTypeSymbol, decl: PullDecl): void {
            if (typeSymbol && typeSymbol.isError()) {
                decl.addDiagnostic((<PullErrorTypeSymbol>typeSymbol).getDiagnostic());
            }
        }

        private postError(offset: number, length: number, fileName: string, message: string, enclosingDecl: PullDecl) {
            enclosingDecl.addDiagnostic(new PullDiagnostic(offset, length, fileName, message));
        }

        private validateVariableDeclarationGroups(enclosingDecl: PullDecl, typeCheckContext: PullTypeCheckContext) {
            var declGroups: PullDecl[][] = enclosingDecl.getVariableDeclGroups();
            var decl: PullDecl;
            var firstSymbol: PullSymbol;
            var symbol: PullSymbol;
            var boundDeclAST: AST;

            for (var i = 0; i < declGroups.length; i++) {

                for (var j = 0; j < declGroups[i].length; j++) {
                    decl = declGroups[i][j];
                    symbol = decl.getSymbol();
                    boundDeclAST = this.semanticInfoChain.getASTForDecl(decl);
                    this.resolver.resolveDeclaration(boundDeclAST, this.context, enclosingDecl);
                    if (!j) {
                        firstSymbol = decl.getSymbol();

                        if (this.resolver.isAnyOrEquivalent(this.resolver.widenType(firstSymbol.getType()))) {
                            return;
                        }
                        continue;
                    }

                    if (!this.resolver.typesAreIdentical(symbol.getType(), firstSymbol.getType())) {
                        this.postError(boundDeclAST.minChar, boundDeclAST.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Subsequent_variable_declarations_must_have_the_same_type___Variable__0__must_be_of_type__1___but_here_has_type___2_, [symbol.getName(), firstSymbol.getType().toString(), symbol.getType().toString()]), enclosingDecl);
                    }
                }
            }
        }

        // declarations

        private typeCheckAST(ast: AST, typeCheckContext: PullTypeCheckContext, inTypedAssignment = false): PullTypeSymbol {

            if (!ast) {
                return null;
            }

            if (ast.typeCheckPhase >= PullTypeChecker.globalPullTypeCheckPhase) {
                return null;
            }
            else {
                ast.typeCheckPhase = PullTypeChecker.globalPullTypeCheckPhase;
            }

            switch (ast.nodeType) {

                // lists
                case NodeType.List:
                    return this.typeCheckList(<ASTList>ast, typeCheckContext);

                // decarations

                case NodeType.VariableDeclarator:
                case NodeType.Parameter:
                    return this.typeCheckBoundDecl(ast, typeCheckContext);

                case NodeType.FunctionDeclaration:
                    return this.typeCheckFunction(<FunctionDeclaration>ast, typeCheckContext, inTypedAssignment);

                case NodeType.ClassDeclaration:
                    return this.typeCheckClass(ast, typeCheckContext);

                case NodeType.InterfaceDeclaration:
                    return this.typeCheckInterface(ast, typeCheckContext);

                case NodeType.ModuleDeclaration:
                    return this.typeCheckModule(ast, typeCheckContext);

                // expressions

                // assignment
                case NodeType.AssignmentExpression:
                    return this.typeCheckAssignment(<BinaryExpression>ast, typeCheckContext);

                case GenericType:
                    return this.typeCheckGenericType(ast, typeCheckContext);

                case NodeType.ObjectLiteralExpression:
                    return this.typeCheckObjectLiteral(ast, typeCheckContext, inTypedAssignment);

                case NodeType.ArrayLiteralExpression:
                    return this.typeCheckArrayLiteral(ast, typeCheckContext, inTypedAssignment);

                case NodeType.ThisExpression:
                    return this.typeCheckThisExpression(<ThisExpression>ast, typeCheckContext);

                case NodeType.SuperExpression:
                    return this.typeCheckSuper(ast, typeCheckContext);

                case NodeType.InvocationExpression:
                    return this.typeCheckCallExpression(<CallExpression>ast, typeCheckContext);

                case NodeType.ObjectCreationExpression:
                    return this.typeCheckObjectCreationExpression(<CallExpression>ast, typeCheckContext);

                case NodeType.CastExpression:
                    return this.typeCheckTypeAssertion(ast, typeCheckContext);

                case NodeType.TypeRef:
                    return this.typeCheckTypeReference(ast, typeCheckContext);

                // boolean operations
                case NodeType.NotEqualsWithTypeConversionExpression:
                case NodeType.EqualsWithTypeConversionExpression:
                case NodeType.EqualsExpression:
                case NodeType.NotEqualsExpression:
                case NodeType.LessThanExpression:
                case NodeType.LessThanOrEqualExpression:
                case NodeType.GreaterThanOrEqualExpression:
                case NodeType.GreaterThanExpression:
                    return this.typeCheckLogicalOperation(ast, typeCheckContext);

                case NodeType.CommaExpression:
                    return this.typeCheckCommaExpression(ast, typeCheckContext);

                case NodeType.AddExpression:
                case NodeType.AddAssignmentExpression:
                    return this.typeCheckBinaryAdditionOperation(<BinaryExpression>ast, typeCheckContext);

                case NodeType.SubtractExpression:
                case NodeType.MultiplyExpression:
                case NodeType.DivideExpression:
                case NodeType.ModuloExpression:
                case NodeType.BitwiseOrExpression:
                case NodeType.BitwiseAndExpression:
                case NodeType.LeftShiftExpression:
                case NodeType.SignedRightShiftExpression:
                case NodeType.UnsignedRightShiftExpression:
                case NodeType.BitwiseExclusiveOrExpression:
                case NodeType.ExclusiveOrAssignmentExpression:
                case NodeType.LeftShiftAssignmentExpression:
                case NodeType.SignedRightShiftAssignmentExpression:
                case NodeType.UnsignedRightShiftAssignmentExpression:
                case NodeType.SubtractAssignmentExpression:
                case NodeType.MultiplyAssignmentExpression:
                case NodeType.DivideAssignmentExpression:
                case NodeType.ModuloAssignmentExpression:
                case NodeType.OrAssignmentExpression:
                case NodeType.AndAssignmentExpression:
                    return this.typeCheckBinaryArithmeticOperation(<BinaryExpression>ast, typeCheckContext);

                case NodeType.PlusExpression:
                case NodeType.NegateExpression:
                case NodeType.BitwiseNotExpression:
                case NodeType.PostIncrementExpression:
                case NodeType.PreIncrementExpression:
                case NodeType.PostDecrementExpression:
                case NodeType.PreDecrementExpression:
                    return this.typeCheckUnaryArithmeticOperation(<UnaryExpression>ast, typeCheckContext, inTypedAssignment);

                case NodeType.ElementAccessExpression:
                    return this.typeCheckElementAccessExpression(<BinaryExpression>ast, typeCheckContext);

                case NodeType.LogicalNotExpression:
                    return this.typeCheckLogicalNotExpression(<UnaryExpression>ast, typeCheckContext, inTypedAssignment);

                case NodeType.LogicalOrExpression:
                case NodeType.LogicalAndExpression:
                    return this.typeCheckLogicalAndOrExpression(ast, typeCheckContext);

                case NodeType.TypeOfExpression:
                    return this.typeCheckTypeOf(ast, typeCheckContext);

                case NodeType.ConditionalExpression:
                    return this.typeCheckConditionalExpression(<ConditionalExpression>ast, typeCheckContext);

                case NodeType.VoidExpression:
                    return this.typeCheckVoidExpression(<UnaryExpression>ast, typeCheckContext);

                case NodeType.ThrowStatement:
                    return this.typeCheckThrowStatement(<ThrowStatement>ast, typeCheckContext);

                case NodeType.DeleteExpression:
                    return this.typeCheckDeleteExpression(<UnaryExpression>ast, typeCheckContext);

                case NodeType.RegularExpressionLiteral:
                    return this.typeCheckRegExpExpression(ast, typeCheckContext);

                case NodeType.InExpression:
                    return this.typeCheckInExpression(<BinaryExpression>ast, typeCheckContext);

                case NodeType.InstanceOfExpression:
                    return this.typeCheckInstanceOfExpression(<BinaryExpression>ast, typeCheckContext);

                case NodeType.ParenthesizedExpression:
                    return this.typeCheckParenthesizedExpression(<ParenthesizedExpression>ast, typeCheckContext);

                // statements
                case NodeType.ForStatement:
                    return this.typeCheckForStatement(<ForStatement>ast, typeCheckContext);

                case NodeType.ForInStatement:
                    return this.typeCheckForInStatement(ast, typeCheckContext);

                case NodeType.WhileStatement:
                    return this.typeCheckWhileStatement(<WhileStatement>ast, typeCheckContext);

                case NodeType.DoStatement:
                    return this.typeCheckDoStatement(<DoStatement>ast, typeCheckContext);

                case NodeType.IfStatement:
                    return this.typeCheckIfStatement(<IfStatement>ast, typeCheckContext);

                case NodeType.Block:
                    return this.typeCheckBlock(<Block>ast, typeCheckContext);

                case NodeType.VariableDeclaration:
                    return this.typeCheckVariableDeclaration(<VariableDeclaration>ast, typeCheckContext);

                case NodeType.VariableStatement:
                    return this.typeCheckVariableStatement(<VariableStatement>ast, typeCheckContext);

                case NodeType.WithStatement:
                    return this.typeCheckWithStatement(<WithStatement>ast, typeCheckContext);

                case NodeType.TryStatement:
                    return this.typeCheckTryStatement(<TryStatement>ast, typeCheckContext);

                case NodeType.CatchClause:
                    return this.typeCheckCatchClause(<CatchClause>ast, typeCheckContext);

                case NodeType.ReturnStatement:
                    return this.typeCheckReturnStatement(<ReturnStatement>ast, typeCheckContext);

                case NodeType.Name:
                    return this.typeCheckNameExpression(ast, typeCheckContext);

                case NodeType.MemberAccessExpression:
                    return this.typeCheckMemberAccessExpression(<BinaryExpression>ast, typeCheckContext);

                case NodeType.SwitchStatement:
                    return this.typeCheckSwitchStatement(<SwitchStatement>ast, typeCheckContext);

                case NodeType.ExpressionStatement:
                    return this.typeCheckExpressionStatement(<ExpressionStatement>ast, typeCheckContext, inTypedAssignment);

                case NodeType.CaseClause:
                    return this.typeCheckCaseClause(<CaseClause>ast, typeCheckContext);

                // primitives
                case NodeType.NumericLiteral:
                    return this.semanticInfoChain.numberTypeSymbol;

                case NodeType.StringLiteral:
                    return this.semanticInfoChain.stringTypeSymbol;

                case NodeType.NullLiteral:
                    return this.semanticInfoChain.nullTypeSymbol;

                case NodeType.TrueLiteral:
                case NodeType.FalseLiteral:
                    return this.semanticInfoChain.booleanTypeSymbol;

                default:
                    break;
            }

            return null;
        }

        //
        // Validation
        //

        // scripts
        public typeCheckScript(script: Script, scriptName: string, compiler: TypeScriptCompiler) {

            var unit = this.semanticInfoChain.getUnit(scriptName);

            if (unit.getTypeChecked()) {
                return;
            }

            var typeCheckContext = new PullTypeCheckContext(compiler, script, scriptName);

            this.setUnit(scriptName);

            typeCheckContext.semanticInfo = typeCheckContext.compiler.semanticInfoChain.getUnit(typeCheckContext.scriptName);
            var scriptDecl = typeCheckContext.semanticInfo.getTopLevelDecls()[0];
            typeCheckContext.pushEnclosingDecl(scriptDecl);

            PullTypeChecker.globalPullTypeCheckPhase++;

            this.typeCheckAST(script.moduleElements, typeCheckContext);

            this.validateVariableDeclarationGroups(scriptDecl, typeCheckContext);

            typeCheckContext.popEnclosingDecl();

            unit.setTypeChecked();
        }

        // lists
        private typeCheckList(list: ASTList, typeCheckContext: PullTypeCheckContext) {
            if (!list) {
                return null;
            }

            for (var i = 0; i < list.members.length; i++) {
                this.typeCheckAST(list.members[i], typeCheckContext);
            }
        }

        // variable and argument declarations
        // validate:
        //  - lhs and rhs types agree (if lhs has no type annotation)
        private typeCheckBoundDecl(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var boundDeclAST = <BoundDecl>ast;

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var typeExprSymbol: PullTypeSymbol = null;

            if (boundDeclAST.typeExpr) {
                typeExprSymbol = this.typeCheckAST(boundDeclAST.typeExpr, typeCheckContext);
            }

            // if there's a type expr and an initializer, resolve the initializer
            if (boundDeclAST.init) {
                if (typeExprSymbol) {
                    this.context.pushContextualType(typeExprSymbol, this.context.inProvisionalResolution(), null);
                }

                var initTypeSymbol = this.typeCheckAST(boundDeclAST.init, typeCheckContext, !!typeExprSymbol);

                if (typeExprSymbol) {
                    this.context.popContextualType();
                }

                if (typeExprSymbol && typeExprSymbol.isContainer()) {
                    var instanceTypeSymbol = (<PullContainerTypeSymbol>typeExprSymbol.getType()).getInstanceSymbol();

                    if (!instanceTypeSymbol) {
                        this.postError(boundDeclAST.minChar, boundDeclAST.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Tried_to_set_variable_type_to_uninitialized_module_type, null), enclosingDecl);
                        typeExprSymbol = null;
                    }
                    else {
                        typeExprSymbol = instanceTypeSymbol.getType();
                    }
                }

                if (initTypeSymbol && initTypeSymbol.isContainer()) {
                    instanceTypeSymbol = (<PullContainerTypeSymbol>initTypeSymbol.getType()).getInstanceSymbol();

                    if (!instanceTypeSymbol) {
                        this.postError(boundDeclAST.minChar, boundDeclAST.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Tried_to_set_variable_type_to_uninitialized_module_type__0__, [initTypeSymbol.toString()]), enclosingDecl);
                        initTypeSymbol = null;
                    }
                    else {
                        initTypeSymbol = instanceTypeSymbol.getType();
                    }
                }

                if (initTypeSymbol && typeExprSymbol) {

                    var comparisonInfo = new TypeComparisonInfo();

                    var isAssignable = this.resolver.sourceIsAssignableToTarget(initTypeSymbol, typeExprSymbol, this.context, comparisonInfo);

                    if (!isAssignable) {
                        var message: string;
                        if (comparisonInfo.message) {
                            message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1__NL__2, [initTypeSymbol.toString(), typeExprSymbol.toString(), comparisonInfo.message]);
                        } else {
                            message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1_, [initTypeSymbol.toString(), typeExprSymbol.toString()]);
                        }

                        this.postError(boundDeclAST.minChar, boundDeclAST.getLength(), typeCheckContext.scriptName, message, enclosingDecl);
                    }
                }
            }

            // now resolve the actual symbol, but supress the errors since we've already surfaced them above
            var prevSupressErrors = this.context.suppressErrors;
            this.context.suppressErrors = true;
            var varTypeSymbol = this.resolver.resolveAST(boundDeclAST, false, enclosingDecl, this.context).getType();
            this.context.suppressErrors = prevSupressErrors;

            var decl: PullDecl = this.resolver.getDeclForAST(boundDeclAST);
            var declSymbol = decl.getSymbol();

            // Check if variable satisfies type privacy
            if (declSymbol.getKind() != PullElementKind.Parameter &&
                (declSymbol.getKind() != PullElementKind.Property || declSymbol.getContainer().isNamedTypeSymbol())) {
                this.checkTypePrivacy(declSymbol, varTypeSymbol, (typeSymbol: PullTypeSymbol) =>
                    this.variablePrivacyErrorReporter(declSymbol, typeSymbol, typeCheckContext));
            }

            return varTypeSymbol;
        }

        // functions 
        // validate:
        //  - use of super calls 
        //  - signatures agree in optionality
        //  - getter/setter type agreement
        //  - body members expr
        //  - getter/setter flags agree
        //  - getters have no parameters 
        //  - getters return a value
        //  - setters return no value
        // PULLTODO: split up into separate functions for constructors, indexers, expressions, signatures, etc.
        private typeCheckFunction(funcDeclAST: FunctionDeclaration, typeCheckContext: PullTypeCheckContext, inTypedAssignment = false): PullTypeSymbol {
            if (funcDeclAST.isConstructor || hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.ConstructMember)) {
                return this.typeCheckConstructor(funcDeclAST, typeCheckContext, inTypedAssignment);
            }
            else if (hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.IndexerMember)) {
                return this.typeCheckIndexer(funcDeclAST, typeCheckContext, inTypedAssignment);
            }
            else if (funcDeclAST.isAccessor()) {
                return this.typeCheckAccessor(funcDeclAST, typeCheckContext, inTypedAssignment);
            }

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var functionSymbol = this.resolver.resolveAST(funcDeclAST, inTypedAssignment, enclosingDecl, this.context);

            var functionDecl = typeCheckContext.semanticInfo.getDeclForAST(funcDeclAST);

            typeCheckContext.pushEnclosingDecl(functionDecl);

            this.typeCheckAST(funcDeclAST.block, typeCheckContext);

            var hasReturn = typeCheckContext.getEnclosingDeclHasReturn();

            this.validateVariableDeclarationGroups(functionDecl, typeCheckContext);

            typeCheckContext.popEnclosingDecl();

            var functionSignature = functionDecl.getSignatureSymbol();

            // check for optionality
            var parameters = functionSignature.getParameters();

            if (parameters.length) {
                for (var i = 0; i < parameters.length; i++) {
                    this.checkForResolutionError(parameters[i].getType(), enclosingDecl);
                }
            }


            var returnType = functionSignature.getReturnType();

            this.checkForResolutionError(returnType, enclosingDecl);

            if (funcDeclAST.block && funcDeclAST.returnTypeAnnotation != null && !hasReturn) {
                var isVoidOrAny = this.resolver.isAnyOrEquivalent(returnType) || returnType == this.semanticInfoChain.voidTypeSymbol;

                if (!isVoidOrAny && !(funcDeclAST.block.statements.members.length > 0 && funcDeclAST.block.statements.members[0].nodeType === NodeType.ThrowStatement)) {
                    var funcName = functionDecl.getName();
                    funcName = funcName ? "'" + funcName + "'" : "expression";

                    this.postError(funcDeclAST.returnTypeAnnotation.minChar, funcDeclAST.returnTypeAnnotation.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Function__0__declared_a_non_void_return_type__but_has_no_return_expression, [funcName]), typeCheckContext.getEnclosingDecl());
                }
            }

            this.typeCheckFunctionOverloads(funcDeclAST, typeCheckContext);
            this.checkFunctionTypePrivacy(funcDeclAST, inTypedAssignment, typeCheckContext);

            return functionSymbol ? functionSymbol.getType() : null;
        }

        private typeCheckFunctionOverloads(funcDecl: FunctionDeclaration, typeCheckContext: PullTypeCheckContext) {
            var functionSignatureInfo = PullHelpers.getSignatureForFuncDecl(funcDecl, typeCheckContext.semanticInfo);
            if (functionSignatureInfo.allSignatures.length == 1 || functionSignatureInfo.signature.isDefinition()) {
                // Function deifinition doesnt need to verify anything
                return;
            }

            var signature = functionSignatureInfo.signature;
            var allSignatures = functionSignatureInfo.allSignatures;
            var funcSymbol = typeCheckContext.semanticInfo.getSymbolForAST(funcDecl);
            
            // Find the definition signature for this signature group
            var definitionSignature: PullSignatureSymbol = null;
            for (var i = allSignatures.length - 1; i >= 0; i--) {
                if (allSignatures[i].isDefinition()) {
                    definitionSignature = allSignatures[i];
                    break;
                }
            }

            // Check for if the signatures are identical, check with the signatures before the current current one
            for (var i = 0; i < allSignatures.length; i++) {
                if (allSignatures[i] == signature) {
                    break;
                }

                if (this.resolver.signaturesAreIdentical(allSignatures[i], signature)) {
                    if (funcDecl.isConstructor) {
                        message = getDiagnosticMessage(DiagnosticCode.Duplicate_constructor_overload_signature, null);
                    } else if (funcDecl.isConstructMember()) {
                        message = getDiagnosticMessage(DiagnosticCode.Duplicate_overload_construct_signature, null);
                    } else if (funcDecl.isCallMember()) {
                        message = getDiagnosticMessage(DiagnosticCode.Duplicate_overload_call_signature, null);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Duplicate_overload_signature_for__0_, [funcSymbol.getScopedNameEx().toString()]);
                    }
                    this.postError(funcDecl.minChar, funcDecl.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
                    break;
                }
            }

            var message: string;
            if (definitionSignature) {
                var comparisonInfo = new TypeComparisonInfo();
                var resolutionContext = new PullTypeResolutionContext();
                if (!definitionSignature.isResolved()) {
                    this.resolver.resolveDeclaredSymbol(definitionSignature, typeCheckContext.getEnclosingDecl(), resolutionContext);
                }

                if (!this.resolver.signatureIsAssignableToTarget(definitionSignature, signature, resolutionContext, comparisonInfo)) {
                    // definition signature is not assignable to functionSignature then its incorrect overload signature
                    if (comparisonInfo.message) {
                        message = getDiagnosticMessage(DiagnosticCode.Overload_signature_is_not_compatible_with_function_definition__NL__0, [comparisonInfo.message]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Overload_signature_is_not_compatible_with_function_definition, null);
                    }
                    this.postError(funcDecl.minChar, funcDecl.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
                }
            }

            var signatureForVisibilityCheck = definitionSignature;
            if (!definitionSignature) {
                if (allSignatures[0] == signature) {
                    return;
                }
                signatureForVisibilityCheck = allSignatures[0];
            }

            if (!funcDecl.isConstructor && !funcDecl.isConstructMember() && signature != signatureForVisibilityCheck) {
                var errorCode: DiagnosticCode;
                // verify it satisfies all the properties of definition signature or the first one incase it is ambient declaration
                if (funcSymbol.getKind() == PullElementKind.Method) {
                    if (signatureForVisibilityCheck.hasFlag(PullElementFlags.Private) == signature.hasFlag(PullElementFlags.Private)) {
                        return;
                    }
                    errorCode = DiagnosticCode.Overload_signaures_do_not_agree_in_public_private_visibility;
                } else {
                    if (signatureForVisibilityCheck.hasFlag(PullElementFlags.Exported) == signature.hasFlag(PullElementFlags.Exported)) {
                        return;
                    }
                    errorCode = DiagnosticCode.Overload_signatures_do_not_agree_with_presence_absense_of_export_modifier;
                }
                message = getDiagnosticMessage(errorCode, null);
                this.postError(funcDecl.minChar, funcDecl.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
            }
        }

        private typeCheckAccessor(ast: AST, typeCheckContext: PullTypeCheckContext, inTypedAssignment = false): PullTypeSymbol {
            var funcDeclAST = <FunctionDeclaration>ast;

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var accessorSymbol = <PullAccessorSymbol>this.resolver.resolveAST(ast, inTypedAssignment, enclosingDecl, this.context);
            this.checkForResolutionError(accessorSymbol.getType(), enclosingDecl);

            var isGetter = hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.GetAccessor);
            var isSetter = !isGetter;

            var getter = accessorSymbol.getGetter();
            var setter = accessorSymbol.getSetter();

            var functionDecl = typeCheckContext.semanticInfo.getDeclForAST(funcDeclAST);

            typeCheckContext.pushEnclosingDecl(functionDecl);

            this.typeCheckAST(funcDeclAST.block, typeCheckContext);

            var hasReturn = typeCheckContext.getEnclosingDeclHasReturn();

            this.validateVariableDeclarationGroups(functionDecl, typeCheckContext);

            typeCheckContext.popEnclosingDecl();

            var functionSignature = functionDecl.getSignatureSymbol();

            // check for optionality
            var parameters = functionSignature.getParameters();

            var returnType = functionSignature.getReturnType();

            this.checkForResolutionError(returnType, enclosingDecl);

            var funcNameAST = funcDeclAST.name;

            if (isGetter && !hasReturn) {
                if (!(funcDeclAST.block.statements.members.length > 0 && funcDeclAST.block.statements.members[0].nodeType === NodeType.ThrowStatement)) {
                    this.postError(funcNameAST.minChar, funcNameAST.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Getters_must_return_a_value, null), typeCheckContext.getEnclosingDecl());
                }
            }

            // Setter with return value is checked in typeCheckReturnExpression

            if (getter && setter) {
                var getterDecl = getter.getDeclarations()[0];
                var setterDecl = setter.getDeclarations()[0];

                var getterIsPrivate = getterDecl.getFlags() & PullElementFlags.Private;
                var setterIsPrivate = setterDecl.getFlags() & PullElementFlags.Private;

                if (getterIsPrivate != setterIsPrivate) {
                    this.postError(funcNameAST.minChar, funcNameAST.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Getter_and_setter_accessors_do_not_agree_in_visibility, null), typeCheckContext.getEnclosingDecl());
                }
            }

            this.checkFunctionTypePrivacy(funcDeclAST, inTypedAssignment, typeCheckContext);

            return null;
        }

        private typeCheckConstructor(funcDeclAST: FunctionDeclaration, typeCheckContext: PullTypeCheckContext, inTypedAssignment: boolean): PullTypeSymbol {

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var functionSymbol = this.resolver.resolveAST(funcDeclAST, inTypedAssignment, enclosingDecl, this.context);

            this.typeCheckAST(funcDeclAST.arguments, typeCheckContext, inTypedAssignment);

            var functionDecl = typeCheckContext.semanticInfo.getDeclForAST(funcDeclAST);

            // Reset the flag
            typeCheckContext.seenSuperConstructorCall = false;

            typeCheckContext.pushEnclosingDecl(functionDecl);

            this.typeCheckAST(funcDeclAST.block, typeCheckContext);

            this.validateVariableDeclarationGroups(functionDecl, typeCheckContext);

            typeCheckContext.popEnclosingDecl();

            var constructorSignature = functionDecl.getSignatureSymbol();

            // check for optionality
            var parameters = constructorSignature.getParameters();

            if (parameters.length) {
                for (var i = 0, n = parameters.length; i < n; i++) {
                    this.checkForResolutionError(parameters[i].getType(), enclosingDecl);
                }
            }

            this.checkForResolutionError(constructorSignature.getReturnType(), enclosingDecl);

            if (functionDecl.getSignatureSymbol() && functionDecl.getSignatureSymbol().isDefinition() && this.enclosingClassIsDerived(typeCheckContext)) {
                // Constructors for derived classes must contain a call to the class's 'super' constructor
                if (!typeCheckContext.seenSuperConstructorCall) {
                    this.postError(funcDeclAST.minChar, 11 /* "constructor" */, typeCheckContext.scriptName,
                        getDiagnosticMessage(DiagnosticCode.Constructors_for_derived_classes_must_contain_a__super__call, null), enclosingDecl);
                }
                // The first statement in the body of a constructor must be a super call if both of the following are true:
                //  � The containing class is a derived class.
                //  � The constructor declares parameter properties or the containing class declares instance member variables with initializers.
                else if (this.superCallMustBeFirstStatementInConstructor(functionDecl, enclosingDecl)) {
                    var firstStatement = this.getFirstStatementFromFunctionDeclAST(funcDeclAST)
                    if (!firstStatement || !this.isSuperCallNode(firstStatement)) {
                        this.postError(funcDeclAST.minChar, 11 /* "constructor" */, typeCheckContext.scriptName,
                            getDiagnosticMessage(DiagnosticCode.A__super__call_must_be_the_first_statement_in_the_constructor_when_a_class_contains_intialized_properties_or_has_parameter_properties, null), enclosingDecl);
                    }
                }
            }

            this.typeCheckFunctionOverloads(funcDeclAST, typeCheckContext);
            this.checkFunctionTypePrivacy(funcDeclAST, inTypedAssignment, typeCheckContext);
            return functionSymbol ? functionSymbol.getType() : null;
        }

        private typeCheckIndexer(ast: AST, typeCheckContext: PullTypeCheckContext, inTypedAssignment = false): PullTypeSymbol {

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            // resolve the index signature, even though we won't be needing its type
            this.resolver.resolveAST(ast, inTypedAssignment, enclosingDecl, this.context);

            var funcDeclAST = <FunctionDeclaration>ast;

            var functionDecl = typeCheckContext.semanticInfo.getDeclForAST(funcDeclAST);

            typeCheckContext.pushEnclosingDecl(functionDecl);

            this.typeCheckAST(funcDeclAST.block, typeCheckContext);

            typeCheckContext.popEnclosingDecl();

            var indexSignature = functionDecl.getSignatureSymbol();
            var parameters = indexSignature.getParameters();

            if (parameters.length) {
                var parameterType: PullTypeSymbol = null;

                for (var i = 0; i < parameters.length; i++) {
                    this.checkForResolutionError(parameters[i].getType(), enclosingDecl);
                }
            }

            this.checkForResolutionError(indexSignature.getReturnType(), enclosingDecl);
            this.checkFunctionTypePrivacy(funcDeclAST, inTypedAssignment, typeCheckContext);

            return null;
        }

        private typeCheckIfTypeMemberPropertyOkToOverride(typeSymbol: PullTypeSymbol, extendedType: PullTypeSymbol,
            typeMember: PullSymbol, extendedTypeMember: PullSymbol, comparisonInfo: TypeComparisonInfo) {

            if (!typeSymbol.isClass()) {
                return true;
            }

            var typeMemberKind = typeMember.getKind();
            var extendedMemberKind = extendedTypeMember.getKind();

            if (typeMemberKind == extendedMemberKind) {
                return true;
            }

            var errorCode: DiagnosticCode;
            if (typeMemberKind == PullElementKind.Property) {
                if (typeMember.isAccessor()) {
                    errorCode = DiagnosticCode.Class__0__defines_instance_member_accessor__1___but_extended_class__2__defines_it_as_instance_member_function;
                } else {
                    errorCode = DiagnosticCode.Class__0__defines_instance_member_property__1___but_extended_class__2__defines_it_as_instance_member_function;
                }
            } else if (typeMemberKind == PullElementKind.Method) {
                if (extendedTypeMember.isAccessor()) {
                    errorCode = DiagnosticCode.Class__0__defines_instance_member_function__1___but_extended_class__2__defines_it_as_instance_member_accessor;
                } else {
                    errorCode = DiagnosticCode.Class__0__defines_instance_member_function__1___but_extended_class__2__defines_it_as_instance_member_property;
                }
            }

            var message = getDiagnosticMessage(errorCode, [typeSymbol.toString(), typeMember.getScopedNameEx().toString(), extendedType.toString()]);
            comparisonInfo.addMessage(message);
            return false;
        }

        private typeCheckIfTypeExtendsType(typeDecl: TypeDeclaration, typeSymbol: PullTypeSymbol,
            extendedType: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {
            var typeMembers = typeSymbol.getMembers();

            var resolutionContext = new PullTypeResolutionContext();
            var comparisonInfo = new TypeComparisonInfo();
            var foundError = false;

            // Check members
            for (var i = 0; i < typeMembers.length; i++) {
                var propName = typeMembers[i].getName();
                var extendedTypeProp = extendedType.findMember(propName);
                if (extendedTypeProp) {
                    foundError = !this.typeCheckIfTypeMemberPropertyOkToOverride(typeSymbol, extendedType, typeMembers[i], extendedTypeProp, comparisonInfo);

                    if (!foundError) {
                        foundError = !this.resolver.sourcePropertyIsSubtypeOfTargetProperty(typeSymbol, extendedType, typeMembers[i], extendedTypeProp, resolutionContext, comparisonInfo);
                    }

                    if (foundError) {
                        break;
                    }
                }
            }

            // Check call signatures
            if (!foundError && typeSymbol.hasOwnCallSignatures()) {
                foundError = !this.resolver.sourceCallSignaturesAreSubtypeOfTargetCallSignatures(typeSymbol, extendedType, resolutionContext, comparisonInfo);
            }

            // Check construct signatures
            if (!foundError && typeSymbol.hasOwnConstructSignatures()) {
                foundError = !this.resolver.sourceConstructSignaturesAreSubtypeOfTargetConstructSignatures(typeSymbol, extendedType, resolutionContext, comparisonInfo);
            }

            // Check index signatures
            if (!foundError && typeSymbol.hasOwnIndexSignatures()) {
                foundError = !this.resolver.sourceIndexSignaturesAreSubtypeOfTargetIndexSignatures(typeSymbol, extendedType, resolutionContext, comparisonInfo);
            }

            if (!foundError && typeSymbol.isClass()) {
                // If there is base class verify the constructor type is subtype of base class
                var typeConstructorType = (<PullClassTypeSymbol>typeSymbol).getConstructorMethod().getType();
                var typeConstructorTypeMembers = typeConstructorType.getMembers();
                if (typeConstructorTypeMembers.length) {
                    var extendedConstructorType = (<PullClassTypeSymbol>extendedType).getConstructorMethod().getType();
                    var comparisonInfoForPropTypeCheck = new TypeComparisonInfo(comparisonInfo);

                    // Verify that all the overriden members of the constructor type are compatible
                    for (var i = 0; i < typeConstructorTypeMembers.length; i++) {
                        var propName = typeConstructorTypeMembers[i].getName();
                        var extendedConstructorTypeProp = extendedConstructorType.findMember(propName);
                        if (extendedConstructorTypeProp) {
                            if (!extendedConstructorTypeProp.isResolved()) {
                                var extendedClassAst = typeCheckContext.semanticInfo.getASTForSymbol(extendedType);
                                var extendedClassDecl = typeCheckContext.semanticInfo.getDeclForAST(extendedClassAst);
                                this.resolver.resolveDeclaredSymbol(extendedConstructorTypeProp, extendedClassDecl, resolutionContext);
                            }

                            // check if type of property is subtype of extended type's property type
                            var typeConstructorTypePropType = typeConstructorTypeMembers[i].getType();
                            var extendedConstructorTypePropType = extendedConstructorTypeProp.getType();
                            if (!this.resolver.sourceIsSubtypeOfTarget(typeConstructorTypePropType, extendedConstructorTypePropType, resolutionContext, comparisonInfoForPropTypeCheck)) {
                                var propMessage: string;
                                if (comparisonInfoForPropTypeCheck.message) {
                                    propMessage = getDiagnosticMessage(DiagnosticCode.Types_of_static_property__0__of_class__1__and_class__2__are_incompatible__NL__3,
                                        [extendedConstructorTypeProp.getScopedNameEx().toString(), typeSymbol.toString(), extendedType.toString(), comparisonInfoForPropTypeCheck.message]);
                                } else {
                                    propMessage = getDiagnosticMessage(DiagnosticCode.Types_of_static_property__0__of_class__1__and_class__2__are_incompatible,
                                        [extendedConstructorTypeProp.getScopedNameEx().toString(), typeSymbol.toString(), extendedType.toString()]);
                                }
                                comparisonInfo.addMessage(propMessage);
                                foundError = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (foundError) {
                var errorCode: DiagnosticCode;
                if (typeSymbol.isClass()) {
                    errorCode = DiagnosticCode.Class__0__cannot_extend_class__1__NL__2;
                } else {
                    if (extendedType.isClass()) {
                        errorCode = DiagnosticCode.Interface__0__cannot_extend_class__1__NL__2;
                    } else {
                        errorCode = DiagnosticCode.Interface__0__cannot_extend_interface__1__NL__2;
                    }
                }

                var message = getDiagnosticMessage(errorCode, [typeSymbol.getScopedName(), extendedType.getScopedName(), comparisonInfo.message]);
                this.postError(typeDecl.name.minChar, typeDecl.name.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
            }
        }

        private typeCheckIfClassImplementsType(classDecl: TypeDeclaration, classSymbol: PullTypeSymbol,
            implementedType: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {

            var classPropertyList = typeCheckContext.getCurrentImplementsClauseTypeCheckClassPublicProperties();
            if (!classPropertyList) {
                classPropertyList = classSymbol.getMembers();
                var extendsList = classSymbol.getExtendedTypes();
                for (var i = 0; i < extendsList.length; i++) {
                    var extendedTypePublicProperties = extendsList[i].getAllMembers(PullElementKind.SomeValue, true);
                    classPropertyList = classPropertyList.concat(extendedTypePublicProperties);
                }
                typeCheckContext.setCurrentImplementsClauseTypeCheckClassPublicProperties(classPropertyList);
            }

            var implementedTypeMembers = implementedType.getAllMembers(PullElementKind.SomeValue, true);

            var resolutionContext = new PullTypeResolutionContext();
            var comparisonInfo = new TypeComparisonInfo();
            var foundError = !this.resolver.sourceMembersAreSubtypeOfTargetMembers(classSymbol, implementedType, resolutionContext, comparisonInfo);
            if (!foundError) {
                foundError = !this.resolver.sourceCallSignaturesAreSubtypeOfTargetCallSignatures(classSymbol, implementedType, resolutionContext, comparisonInfo);
                if (!foundError) {
                    foundError = !this.resolver.sourceConstructSignaturesAreSubtypeOfTargetConstructSignatures(classSymbol, implementedType, resolutionContext, comparisonInfo);
                    if (!foundError) {
                        foundError = !this.resolver.sourceIndexSignaturesAreSubtypeOfTargetIndexSignatures(classSymbol, implementedType, resolutionContext, comparisonInfo);
                    }
                }
            }

            // Report error
            if (foundError) {
                var errorCode = implementedType.isClass() ?
                    DiagnosticCode.Class__0__declares_class__1__but_does_not_implement_it__NL__2 :
                    DiagnosticCode.Class__0__declares_interface__1__but_does_not_implement_it__NL__2;

                var message = getDiagnosticMessage(errorCode, [classSymbol.getScopedName(), implementedType.getScopedName(), comparisonInfo.message]);
                this.postError(classDecl.name.minChar, classDecl.name.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
            }
        }

        private typeCheckBase(typeDeclAst: TypeDeclaration, typeSymbol: PullTypeSymbol, baseDeclAST: AST,
            isExtendedType: boolean, typeCheckContext: PullTypeCheckContext) {

            var typeDecl = typeCheckContext.semanticInfo.getDeclForAST(typeDeclAst);
            var contextForBaseTypeResolution = new PullTypeResolutionContext();
            var baseType = this.resolver.resolveTypeReference(new TypeReference(baseDeclAST, 0), typeDecl, contextForBaseTypeResolution);
            var typeDeclIsClass = typeSymbol.isClass();
            var message: string;

            if (!typeSymbol.isValidBaseKind(baseType, isExtendedType)) {
                // Report error about invalid base kind
                if (baseType.isError()) {
                    message = (<PullErrorTypeSymbol>baseType).getDiagnostic().message();
                } else if (isExtendedType) {
                    if (typeDeclIsClass) {
                        message = getDiagnosticMessage(DiagnosticCode.A_class_may_only_extend_another_class, null);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.An_interface_may_only_extend_another_class_or_interface, null);
                    }
                } else {
                    message = getDiagnosticMessage(DiagnosticCode.A_class_may_only_implement_another_class_or_interface, null);
                }
                this.postError(baseDeclAST.minChar, baseDeclAST.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
                return;
            }

            // Check if its a recursive extend/implement type
            if (baseType.hasBase(typeSymbol)) {
                // Report error
                message = getDiagnosticMessage(typeDeclIsClass ? DiagnosticCode.Class__0__is_recursively_referenced_as_a_base_type_of_itself : DiagnosticCode.Interface__0__is_recursively_referenced_as_a_base_type_of_itself, [typeSymbol.getScopedName()]);
                this.postError(typeDeclAst.name.minChar, typeDeclAst.name.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
                return;
            }

            if (isExtendedType) {
                // Verify all own overriding members are subtype
                this.typeCheckIfTypeExtendsType(typeDeclAst, typeSymbol, baseType, typeCheckContext);
            } else {
                // If class implementes interface or class, verify all the public members are implemented
                this.typeCheckIfClassImplementsType(typeDeclAst, typeSymbol, baseType, typeCheckContext);
            }

            // Privacy error:
            this.checkTypePrivacy(typeSymbol, baseType, (errorTypeSymbol: PullTypeSymbol) =>
                this.baseListPrivacyErrorReporter(typeDeclAst, typeSymbol, baseDeclAST, isExtendedType, errorTypeSymbol, typeCheckContext));
        }

        private typeCheckBases(typeDeclAst: TypeDeclaration, typeSymbol: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {
            if (!typeDeclAst.extendsList && !typeDeclAst.implementsList) {
                return;
            }

            for (var i = 0; i < typeDeclAst.extendsList.members.length; i++) {
                this.typeCheckBase(typeDeclAst, typeSymbol, typeDeclAst.extendsList.members[i], true, typeCheckContext);
            }
            if (typeSymbol.isClass()) {
                for (var i = 0; i < typeDeclAst.implementsList.members.length; i++) {
                    this.typeCheckBase(typeDeclAst, typeSymbol, typeDeclAst.implementsList.members[i], false, typeCheckContext);
                }
                typeCheckContext.setCurrentImplementsClauseTypeCheckClassPublicProperties(null);
            } else if (typeDeclAst.implementsList) {
                var message = getDiagnosticMessage(DiagnosticCode.An_interface_may_not_implement_another_type, null);
                this.postError(typeDeclAst.implementsList.minChar, typeDeclAst.implementsList.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
            }
        }

        // Classes
        // validate:
        //  - mutually recursive base classes
        //  - duplicate implemented interfaces
        //  - mutually recursive type parameters
        //  - bases are interfaces or classes
        //  - properties satisfy implemented interfaces
        //  - properties of base class and implemented interfaces agree
        //  - type of overridden member is subtype of original
        //  - method does not overrided field, or vice-versa
        //  - body members
        private typeCheckClass(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var classAST = <ClassDeclaration>ast;
            // resolving the class also resolves its members...
            var classSymbol = <PullClassTypeSymbol>this.resolver.resolveAST(ast, false, typeCheckContext.getEnclosingDecl(), this.context).getType();
            this.checkForResolutionError(classSymbol, typeCheckContext.getEnclosingDecl());

            var classDecl = typeCheckContext.semanticInfo.getDeclForAST(classAST);
            typeCheckContext.pushEnclosingDecl(classDecl);

            this.typeCheckAST(classAST.members, typeCheckContext);

            typeCheckContext.popEnclosingDecl();
            this.typeCheckBases(classAST, classSymbol, typeCheckContext);

            return classSymbol;
        }

        // Interfaces
        // validate:
        //  - mutually recursive bases
        //  - duplicate implemented or extended interfaces
        //  - mutually recursive type parameters
        //  - properties of extended interfaces do not conflict
        //  - bases are interfaces or classes
        //  - declarations agree in generic parameters 
        private typeCheckInterface(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var interfaceAST = <InterfaceDeclaration>ast;
            // resolving the interface also resolves its members...
            var interfaceType = this.resolver.resolveAST(ast, false, typeCheckContext.getEnclosingDecl(), this.context).getType();
            this.checkForResolutionError(interfaceType, typeCheckContext.getEnclosingDecl());

            var interfaceDecl = typeCheckContext.semanticInfo.getDeclForAST(interfaceAST);
            typeCheckContext.pushEnclosingDecl(interfaceDecl);

            this.typeCheckAST(interfaceAST.members, typeCheckContext);

            typeCheckContext.popEnclosingDecl();
            this.typeCheckBases(<InterfaceDeclaration>ast, interfaceType, typeCheckContext);

            return interfaceType;
        }

        // Modules
        // validate:
        //  - No type parameters?
        private typeCheckModule(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {

            // we resolve here because resolving a module *does not* resolve its MemberScopeContext
            // PULLREVIEW: Perhaps it should?
            var moduleDeclAST = <ModuleDeclaration>ast;
            var moduleType = <PullTypeSymbol>this.resolver.resolveAST(ast, false, typeCheckContext.getEnclosingDecl(), this.context);

            this.checkForResolutionError(moduleType, typeCheckContext.getEnclosingDecl());

            var moduleDecl = typeCheckContext.semanticInfo.getDeclForAST(moduleDeclAST);
            typeCheckContext.pushEnclosingDecl(moduleDecl);

            this.typeCheckAST(moduleDeclAST.members, typeCheckContext);

            this.validateVariableDeclarationGroups(moduleDecl, typeCheckContext);

            typeCheckContext.popEnclosingDecl();

            return moduleType;
        }

        private checkAssignability(ast: AST, source: PullTypeSymbol, target: PullTypeSymbol, typeCheckContext: PullTypeCheckContext): void {
            var comparisonInfo = new TypeComparisonInfo();

            var isAssignable = this.resolver.sourceIsAssignableToTarget(source, target, this.context, comparisonInfo);

            if (!isAssignable) {
                var message: string;
                if (comparisonInfo.message) {
                    message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1__NL__2, [source.toString(), target.toString(), comparisonInfo.message]);
                } else {
                    message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1_, [source.toString(), target.toString()]);
                }

                var enclosingDecl = typeCheckContext.getEnclosingDecl();
                this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName, message, enclosingDecl);
            }
        }

        private isValidLHS(ast: AST, expressionSymbol: PullSymbol, isEnumInitializer: boolean): boolean {
            var expressionTypeSymbol = expressionSymbol.getType();

            return isEnumInitializer ||
                ast.nodeType == NodeType.ElementAccessExpression ||
                this.resolver.isAnyOrEquivalent(expressionTypeSymbol) ||
                ((!expressionSymbol.isType() || expressionTypeSymbol.isArray()) &&
                (expressionSymbol.getKind() & PullElementKind.SomeLHS) != 0);
        }

        // expressions

        // Assignment
        // validate:
        //  - lhs and rhs types agree
        //  - lhs is a valid value type
        private typeCheckAssignment(binaryExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            this.typeCheckAST(binaryExpression.operand1, typeCheckContext, false);

            var leftExpr = this.resolver.resolveAST(binaryExpression.operand1, false, typeCheckContext.getEnclosingDecl(), this.context);
            var leftType = leftExpr.getType();
            this.checkForResolutionError(leftType, enclosingDecl);
            leftType = this.resolver.widenType(leftExpr.getType()); //this.typeCheckAST(assignmentAST.operand1, typeCheckContext);

            this.context.pushContextualType(leftType, this.context.inProvisionalResolution(), null);
            var rightType = this.resolver.widenType(this.typeCheckAST(binaryExpression.operand2, typeCheckContext, true));
            this.context.popContextualType();

            // Check if LHS is a valid target
            if (!this.isValidLHS(binaryExpression.operand1, leftExpr, hasFlag(binaryExpression.getFlags(), ASTFlags.EnumInitializer))) {
                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.Invalid_left_hand_side_of_assignment_expression, null), enclosingDecl);
            }

            this.checkAssignability(binaryExpression.operand1, rightType, leftType, typeCheckContext);
            return leftType;
        }

        // Generic Type references
        // validate:
        //
        private typeCheckGenericType(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            // validate:
            //  - mutually recursive type parameters and constraints
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var genericType = this.resolver.resolveAST(ast, false, enclosingDecl, this.context).getType();
            this.checkForResolutionError(genericType, enclosingDecl);

            return genericType;
        }

        // Object literals
        // validate:
        //
        private typeCheckObjectLiteral(ast: AST, typeCheckContext: PullTypeCheckContext, inTypedAssignment = false): PullTypeSymbol {
            var objectLitAST = <UnaryExpression>ast;
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            // PULLTODO: We're really resolving these expressions twice - need a better way...
            var objectLitType = this.resolver.resolveAST(ast, inTypedAssignment, enclosingDecl, this.context).getType();
            var memberDecls = <ASTList>objectLitAST.operand;

            var contextualType = this.context.getContextualType();
            var memberType: PullTypeSymbol;


            // PULLTODO: Contextually type the members
            if (memberDecls) {
                var binex: BinaryExpression;
                var text: string;
                var member: PullSymbol = null;

                for (var i = 0; i < memberDecls.members.length; i++) {
                    binex = <BinaryExpression>memberDecls.members[i];

                    if (contextualType) {
                        if (binex.operand1.nodeType == NodeType.Name) {
                            text = (<Identifier>binex.operand1).text;
                        }
                        else if (binex.operand1.nodeType == NodeType.StringLiteral) {
                            text = (<StringLiteral>binex.operand1).text;
                            text = text.substring(1, text.length - 1);
                        }

                        member = contextualType.findMember(text);

                        if (member) {
                            this.context.pushContextualType(member.getType(), this.context.inProvisionalResolution(), null);
                        }
                    }

                    this.typeCheckAST(binex.operand2, typeCheckContext, member != null);

                    if (member) {
                        this.context.popContextualType();
                        member = null;
                    }
                }
            }

            this.checkForResolutionError(objectLitType, enclosingDecl);

            return objectLitType;
        }

        // Array literals
        // validate:
        //  - incompatible types in expression
        private typeCheckArrayLiteral(ast: AST, typeCheckContext: PullTypeCheckContext, inTypedAssignment = false): PullTypeSymbol {
            var arrayLiteralAST = <UnaryExpression>ast;
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            // PULLTODO: We're really resolving these expressions twice - need a better way...
            var type = this.resolver.resolveAST(ast, inTypedAssignment, enclosingDecl, this.context).getType();
            var memberASTs = <ASTList>arrayLiteralAST.operand;

            // Find the contextual member type
            var contextualType = this.context.getContextualType();
            var contextualMemberType: PullTypeSymbol = null;
            if (contextualType && contextualType.isArray()) {
                contextualMemberType = contextualType.getElementType();
            }

            if (memberASTs && memberASTs.members && memberASTs.members.length) {
                var elementTypes: PullTypeSymbol[] = [];

                if (contextualMemberType) {
                    this.context.pushContextualType(contextualMemberType, this.context.inProvisionalResolution(), null);
                }

                for (var i = 0; i < memberASTs.members.length; i++) {
                    elementTypes[elementTypes.length] = this.typeCheckAST(memberASTs.members[i], typeCheckContext, /*inTypedAssignment*/ false);
                }

                if (contextualMemberType) {
                    this.context.popContextualType();

                    // Check if all array members match the contextual Type
                    var collection: IPullTypeCollection = {
                        getLength: () => { return elementTypes.length; } ,
                        setTypeAtIndex: (index: number, type: PullTypeSymbol) => { elementTypes[index] = type; } ,
                        getTypeAtIndex: (index: number) => { return elementTypes[index]; }
                    };

                    var comparisonInfo = new TypeScript.TypeComparisonInfo();
                    var elementType = this.resolver.findBestCommonType(elementTypes[0], contextualMemberType, collection, false, this.context, comparisonInfo);
                    if (!elementType) {
                        this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName,
                            getDiagnosticMessage(DiagnosticCode.Type_of_array_literal_cannot_be_determined__Best_common_type_could_not_be_found_for_array_elements, null), enclosingDecl);
                    }
                }
            }

            this.checkForResolutionError(type, enclosingDecl);

            return type;
        }

        private enclosingClassIsDerived(typeCheckContext: PullTypeCheckContext): boolean {
            var enclosingClass = typeCheckContext.getEnclosingDecl(PullElementKind.Class);

            if (enclosingClass) {
                var classSymbol = <PullClassTypeSymbol>enclosingClass.getSymbol();
                if (classSymbol.getExtendedTypes().length > 0) {
                    return true;
                }
            }

            return false;
        }

        private isSuperCallNode(node: AST): boolean {
            if (node && node.nodeType === NodeType.ExpressionStatement) {
                var expressionStatement = <ExpressionStatement>node;
                if (expressionStatement.expression && expressionStatement.expression.nodeType === NodeType.InvocationExpression) {
                    var callExpression = <CallExpression>expressionStatement.expression;
                    if (callExpression.target && callExpression.target.nodeType === NodeType.SuperExpression) {
                        return true;
                    }
                }
            }
            return false;
        }

        private getFirstStatementFromFunctionDeclAST(funcDeclAST: FunctionDeclaration): AST {
            if (funcDeclAST.block && funcDeclAST.block.statements && funcDeclAST.block.statements.members) {
                return hasFlag(funcDeclAST.block.getFlags(), ASTFlags.StrictMode) ? funcDeclAST.block.statements.members[1] : funcDeclAST.block.statements.members[0];
            }

            return null;
        }

        private superCallMustBeFirstStatementInConstructor(enclosingConstructor: PullDecl, enclosingClass: PullDecl): boolean {
            /*
            The first statement in the body of a constructor must be a super call if both of the following are true:
                �	The containing class is a derived class.
                �	The constructor declares parameter properties or the containing class declares instance member variables with initializers.
            In such a required super call, it is a compile-time error for argument expressions to reference this.
            */
            if (enclosingConstructor && enclosingClass) {
                var classSymbol = <PullClassTypeSymbol>enclosingClass.getSymbol();
                if (classSymbol.getExtendedTypes().length === 0) {
                    return false;
                }

                var classMembers = classSymbol.getMembers();
                for (var i = 0, n1 = classMembers.length; i < n1; i++) {
                    var member = classMembers[i];

                    if (member.getKind() === PullElementKind.Property) {
                        var declarations = member.getDeclarations();
                        for (var j = 0, n2 = declarations.length; j < n2; j++) {
                            var declaration = declarations[j];
                            var ast = this.semanticInfoChain.getASTForDecl(declaration);
                            if (ast.nodeType === NodeType.Parameter) {
                                return true;
                            }

                            if (ast.nodeType === NodeType.VariableDeclarator) {
                                var variableDeclarator = <VariableDeclarator>ast;
                                if (variableDeclarator.init) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }

            return false;
        }

        private checkForThisCaptureInArrowFunction(thisExpressionAST: ThisExpression, typeCheckContext: PullTypeCheckContext): void {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var declPath: PullDecl[] = typeCheckContext.enclosingDeclStack;

            // work back up the decl path, until you can find a class
            // PULLTODO: Obviously not completely correct, but this sufficiently unblocks testing of the pull model
            if (declPath.length) {
                var inFatArrow = false;
                for (var i = declPath.length - 1; i >= 0; i--) {
                    var decl = declPath[i];
                    var declKind = decl.getKind();
                    var declFlags = decl.getFlags();

                    if (declKind === PullElementKind.FunctionExpression &&
                        hasFlag(declFlags, PullElementFlags.FatArrow)) {

                        inFatArrow = true;
                        continue;
                    }

                    if (inFatArrow) {
                        if (declKind === PullElementKind.Function ||
                            declKind === PullElementKind.Method ||
                            declKind === PullElementKind.ConstructorMethod ||
                            declKind === PullElementKind.GetAccessor ||
                            declKind === PullElementKind.SetAccessor ||
                            declKind === PullElementKind.FunctionExpression ||
                            declKind === PullElementKind.Class ||
                            declKind === PullElementKind.Container ||
                            declKind === PullElementKind.DynamicModule ||
                            declKind === PullElementKind.Script) {

                            decl.setFlags(decl.getFlags() | PullElementFlags.MustCaptureThis);
                            break;
                        }
                    }
                }
            }
        }

        // 'This' expressions 
        // validate:
        //
        private typeCheckThisExpression(thisExpressionAST: ThisExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var enclosingNonLambdaDecl = typeCheckContext.getEnclosingNonLambdaDecl();

            if (typeCheckContext.inSuperConstructorCall &&
                this.superCallMustBeFirstStatementInConstructor(typeCheckContext.getEnclosingDecl(PullElementKind.ConstructorMethod), typeCheckContext.getEnclosingDecl(PullElementKind.Class))) {

                this.postError(thisExpressionAST.minChar, thisExpressionAST.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode._this__may_not_be_referenced_in_current_location, null), enclosingDecl);
            }
            else if (enclosingNonLambdaDecl) {
                if (enclosingNonLambdaDecl.getKind() === PullElementKind.Class) {
                    this.postError(thisExpressionAST.minChar, thisExpressionAST.getLength(), typeCheckContext.scriptName,
                        getDiagnosticMessage(DiagnosticCode._this__may_not_be_referenced_in_initializers_in_a_class_body, null), enclosingDecl);
                }
                else if (enclosingNonLambdaDecl.getKind() === PullElementKind.Container || enclosingNonLambdaDecl.getKind() === PullElementKind.DynamicModule) {
                    this.postError(thisExpressionAST.minChar, thisExpressionAST.getLength(), typeCheckContext.scriptName,
                        getDiagnosticMessage(DiagnosticCode._this__cannot_be_referenced_within_module_bodies, null), enclosingDecl);
                }
            }

            this.checkForThisCaptureInArrowFunction(thisExpressionAST, typeCheckContext);

            var type = this.resolver.resolveAST(thisExpressionAST, false, enclosingDecl, this.context).getType();
            this.checkForResolutionError(type, enclosingDecl);
            return type;
        }

        // 'Super' expressions 
        // validate:
        //
        private typeCheckSuper(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var nonLambdaEnclosingDecl = typeCheckContext.getEnclosingNonLambdaDecl();
            var nonLambdaEnclosingDeclKind = nonLambdaEnclosingDecl.getKind();
            var inSuperConstructorTarget = typeCheckContext.inSuperConstructorTarget;

            var type = this.resolver.resolveAST(ast, false, enclosingDecl, this.context).getType();

            // Super calls are not permitted outside constructors or in local functions inside constructors.
            if (inSuperConstructorTarget && enclosingDecl.getKind() !== PullElementKind.ConstructorMethod) {
                this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.Super_calls_are_not_permitted_outside_constructors_or_in_local_functions_inside_constructors, null), enclosingDecl);
            }
            // A super property access is permitted only in a constructor, instance member function, or instance member accessor
            else if ((nonLambdaEnclosingDeclKind !== PullElementKind.Method && nonLambdaEnclosingDeclKind !== PullElementKind.GetAccessor && nonLambdaEnclosingDeclKind !== PullElementKind.SetAccessor && nonLambdaEnclosingDeclKind !== PullElementKind.ConstructorMethod) ||
                ((nonLambdaEnclosingDecl.getFlags() & PullElementFlags.Static) !== 0)) {
                this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode._super__property_access_is_permitted_only_in_a_constructor__instance_member_function__or_instance_member_accessor_of_a_derived_class, null), enclosingDecl);
            }
            // A super is permitted only in a derived class 
            else if (!this.enclosingClassIsDerived(typeCheckContext)) {
                this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode._super__may_not_be_referenced_in_non_derived_classes, null), enclosingDecl);
            }

            this.checkForResolutionError(type, enclosingDecl);
            return type;
        }

        // Call expressions 
        // validate:
        //
        private typeCheckCallExpression(callExpression: CallExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            // "use of new expression as a statement"
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var inSuperConstructorCall = (callExpression.target.nodeType === NodeType.SuperExpression);

            var callResolutionData = new PullAdditionalCallResolutionData();
            var resultType = this.resolver.resolveCallExpression(callExpression, false, enclosingDecl, this.context, callResolutionData).getType();

            this.checkForResolutionError(resultType, enclosingDecl);

            // Type check the target
            if (!resultType.isError()) {
                var savedInSuperConstructorTarget = typeCheckContext.inSuperConstructorTarget;
                if (inSuperConstructorCall) {
                    typeCheckContext.inSuperConstructorTarget = true;
                }

                this.typeCheckAST(callExpression.target, typeCheckContext);

                typeCheckContext.inSuperConstructorTarget = savedInSuperConstructorTarget;
            }

            if (inSuperConstructorCall && enclosingDecl.getKind() === PullElementKind.ConstructorMethod) {
                typeCheckContext.seenSuperConstructorCall = true;
            }

            // Type check the arguments
            var savedInSuperConstructorCall = typeCheckContext.inSuperConstructorCall;
            if (inSuperConstructorCall) {
                typeCheckContext.inSuperConstructorCall = true;
            }

            // Apply contextual typing
            var contextTypes = callResolutionData.actualParametersContextTypeSymbols;
            if (callExpression.arguments) {
                var argumentASTs = callExpression.arguments.members;
                for (var i = 0, n = argumentASTs.length; i < n; i++) {
                    var argumentAST = argumentASTs[i];

                    if (contextTypes && contextTypes[i]) {
                        this.context.pushContextualType(contextTypes[i], this.context.inProvisionalResolution(), null);
                    }

                    this.typeCheckAST(argumentAST, typeCheckContext);

                    if (contextTypes && contextTypes[i]) {
                        this.context.popContextualType();
                    }
                }
            }

            typeCheckContext.inSuperConstructorCall = savedInSuperConstructorCall;

            return resultType;
        }

        // 'New' expressions 
        // validate:
        //
        private typeCheckObjectCreationExpression(callExpression: CallExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var callResolutionData = new PullAdditionalCallResolutionData();
            var resultType = this.resolver.resolveNewExpression(callExpression, false, enclosingDecl, this.context, callResolutionData).getType();

            this.checkForResolutionError(resultType, enclosingDecl);

            this.typeCheckAST(callExpression.typeArguments, typeCheckContext);

            // Type check the arguments
            var contextTypes = callResolutionData.actualParametersContextTypeSymbols;
            if (callExpression.arguments) {
                var argumentASTs = callExpression.arguments.members;
                for (var i = 0, n = argumentASTs.length; i < n; i++) {
                    var argumentAST = argumentASTs[i];

                    if (contextTypes && contextTypes[i]) {
                        this.context.pushContextualType(contextTypes[i], this.context.inProvisionalResolution(), null);
                    }

                    this.typeCheckAST(argumentAST, typeCheckContext);

                    if (contextTypes && contextTypes[i]) {
                        this.context.popContextualType();
                    }
                }
            }

            return resultType;
        }

        // Type assertion expressions 
        // validate:
        //  - the type assertion and the expression it's applied to are assignment compatible
        private typeCheckTypeAssertion(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var returnType = this.resolver.resolveAST(ast, false, enclosingDecl, this.context).getType();

            this.checkForResolutionError(returnType, enclosingDecl);

            this.context.pushContextualType(returnType, this.context.inProvisionalResolution(), null);
            var exprType = this.typeCheckAST((<UnaryExpression>ast).operand, typeCheckContext, true);
            this.context.popContextualType();

            var comparisonInfo = new TypeComparisonInfo();
            var isAssignable = this.resolver.sourceIsAssignableToTarget(returnType, exprType, this.context, comparisonInfo) ||
                this.resolver.sourceIsAssignableToTarget(exprType, returnType, this.context, comparisonInfo);

            if (!isAssignable) {
                var message: string;
                if (comparisonInfo.message) {
                    message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1__NL__2, [exprType.toString(), returnType.toString(), comparisonInfo.message]);
                } else {
                    message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1_, [exprType.toString(), returnType.toString()]);
                }

                this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName, message, typeCheckContext.getEnclosingDecl());
            }

            return returnType;
        }

        // Logical operations
        // validate:
        //  - lhs and rhs are compatible
        private typeCheckLogicalOperation(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var binex = <BinaryExpression>ast;
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var type = this.resolver.resolveAST(ast, false, typeCheckContext.getEnclosingDecl(), this.context).getType();

            this.checkForResolutionError(type, enclosingDecl);

            var leftType = this.typeCheckAST(binex.operand1, typeCheckContext);
            var rightType = this.typeCheckAST(binex.operand2, typeCheckContext);

            var comparisonInfo = new TypeComparisonInfo();
            if (!this.resolver.sourceIsAssignableToTarget(leftType, rightType, this.context, comparisonInfo) &&
                !this.resolver.sourceIsAssignableToTarget(rightType, leftType, this.context, comparisonInfo)) {

                this.postError(ast.minChar, ast.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.Operator__0__cannot_be_applied_to_types__1__and__2_, [binex.printLabel(), leftType.toString(), rightType.toString()]), enclosingDecl);
            }
            return type;
        }

        // Logical 'And' and 'Or' expressions 
        // validate:
        // - lhs and rhs are compatible
        private typeCheckLogicalAndOrExpression(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var binex = <BinaryExpression>ast;
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var type = this.resolver.resolveAST(ast, false, enclosingDecl, this.context).getType();

            this.checkForResolutionError(type, enclosingDecl);

            this.typeCheckAST(binex.operand1, typeCheckContext);
            this.typeCheckAST(binex.operand2, typeCheckContext);

            return type;
        }


        private typeCheckCommaExpression(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var binex = <BinaryExpression>ast;
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var type = this.resolver.resolveAST(ast, false, enclosingDecl, this.context).getType();

            this.checkForResolutionError(type, enclosingDecl);

            this.typeCheckAST(binex.operand1, typeCheckContext);
            this.typeCheckAST(binex.operand2, typeCheckContext);

            return type;
        }

        private typeCheckBinaryAdditionOperation(binaryExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var type = this.resolver.resolveAST(binaryExpression, false, enclosingDecl, this.context).getType();

            this.checkForResolutionError(type, enclosingDecl);

            var lhsType = this.typeCheckAST(binaryExpression.operand1, typeCheckContext);
            var rhsType = this.typeCheckAST(binaryExpression.operand2, typeCheckContext);

            if (lhsType.getKind() == PullElementKind.Enum) {
                lhsType = this.semanticInfoChain.numberTypeSymbol;
            }
            else if (lhsType == this.semanticInfoChain.nullTypeSymbol || lhsType == this.semanticInfoChain.undefinedTypeSymbol) {
                if (rhsType != this.semanticInfoChain.nullTypeSymbol && rhsType != this.semanticInfoChain.undefinedTypeSymbol) {
                    lhsType = rhsType;
                }
                else {
                    lhsType = this.semanticInfoChain.anyTypeSymbol;
                }
            }

            if (rhsType.getKind() == PullElementKind.Enum) {
                rhsType = this.semanticInfoChain.numberTypeSymbol;
            }
            else if (rhsType == this.semanticInfoChain.nullTypeSymbol || rhsType == this.semanticInfoChain.undefinedTypeSymbol) {
                if (lhsType != this.semanticInfoChain.nullTypeSymbol && lhsType != this.semanticInfoChain.undefinedTypeSymbol) {
                    rhsType = lhsType;
                }
                else {
                    rhsType = this.semanticInfoChain.anyTypeSymbol;
                }
            }

            var exprType: PullTypeSymbol = null;

            if (lhsType == this.semanticInfoChain.stringTypeSymbol || rhsType == this.semanticInfoChain.stringTypeSymbol) {
                exprType = this.semanticInfoChain.stringTypeSymbol;
            }
            else if (this.resolver.isAnyOrEquivalent(lhsType) || this.resolver.isAnyOrEquivalent(rhsType)) {
                exprType = this.semanticInfoChain.anyTypeSymbol;
            }
            else if (rhsType == this.semanticInfoChain.numberTypeSymbol && lhsType == this.semanticInfoChain.numberTypeSymbol) {
                exprType = this.semanticInfoChain.numberTypeSymbol;
            }

            if (exprType) {
                if (binaryExpression.nodeType === NodeType.AddAssignmentExpression) {
                    // Check if LHS is a valid target
                    var lhsExpression = this.resolver.resolveAST(binaryExpression.operand1, false, typeCheckContext.getEnclosingDecl(), this.context);
                    if (!this.isValidLHS(binaryExpression.operand1, lhsExpression, hasFlag(binaryExpression.getFlags(), ASTFlags.EnumInitializer))) {
                        this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                            getDiagnosticMessage(DiagnosticCode.Invalid_left_hand_side_of_assignment_expression, null), enclosingDecl);
                    }

                    this.checkAssignability(binaryExpression.operand1, exprType, lhsType, typeCheckContext);
                }
            }
            else {
                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Invalid__addition__expression___types_do_not_agree, null), typeCheckContext.getEnclosingDecl());
                exprType = this.semanticInfoChain.anyTypeSymbol;
            }

            return exprType;
        }

        // Binary arithmetic expressions 
        // validate:
        //  - lhs and rhs are compatible
        private typeCheckBinaryArithmeticOperation(binaryExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var type = this.resolver.resolveAST(binaryExpression, false, enclosingDecl, this.context).getType();
            this.checkForResolutionError(type, enclosingDecl);

            var lhsType = this.typeCheckAST(binaryExpression.operand1, typeCheckContext);
            var rhsType = this.typeCheckAST(binaryExpression.operand2, typeCheckContext);

            var lhsIsFit = this.resolver.isAnyOrEquivalent(lhsType) || lhsType == this.semanticInfoChain.numberTypeSymbol || lhsType.getKind() == PullElementKind.Enum;
            var rhsIsFit = this.resolver.isAnyOrEquivalent(rhsType) || rhsType == this.semanticInfoChain.numberTypeSymbol || rhsType.getKind() == PullElementKind.Enum;

            if (!rhsIsFit) {
                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_right_hand_side_of_an_arithmetic_operation_must_be_of_type__any____number__or_an_enum_type, null), typeCheckContext.getEnclosingDecl());
            }

            if (!lhsIsFit) {
                this.postError(binaryExpression.operand2.minChar, binaryExpression.operand2.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_left_hand_side_of_an_arithmetic_operation_must_be_of_type__any____number__or_an_enum_type, null), typeCheckContext.getEnclosingDecl());
            }

            // If we havne't already reported an error, then check for assignment compatibility.
            if (rhsIsFit && lhsIsFit) {
                switch (binaryExpression.nodeType) {
                    case NodeType.LeftShiftAssignmentExpression:
                    case NodeType.SignedRightShiftAssignmentExpression:
                    case NodeType.UnsignedRightShiftAssignmentExpression:
                    case NodeType.SubtractAssignmentExpression:
                    case NodeType.MultiplyAssignmentExpression:
                    case NodeType.DivideAssignmentExpression:
                    case NodeType.ModuloAssignmentExpression:
                    case NodeType.OrAssignmentExpression:
                    case NodeType.AndAssignmentExpression:
                    case NodeType.ExclusiveOrAssignmentExpression:
                        // Check if LHS is a valid target
                        var lhsExpression = this.resolver.resolveAST(binaryExpression.operand1, false, typeCheckContext.getEnclosingDecl(), this.context);
                        if (!this.isValidLHS(binaryExpression.operand1, lhsExpression, hasFlag(binaryExpression.getFlags(), ASTFlags.EnumInitializer))) {
                            this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                                getDiagnosticMessage(DiagnosticCode.Invalid_left_hand_side_of_assignment_expression, null), enclosingDecl);
                        }

                        this.checkAssignability(binaryExpression.operand1, rhsType, lhsType, typeCheckContext);
                        break;
                }
            }

            return this.semanticInfoChain.numberTypeSymbol;
        }

        private typeCheckLogicalNotExpression(unaryExpression: UnaryExpression, typeCheckContext: PullTypeCheckContext, inTypedAssignment: boolean): PullTypeSymbol {
            this.typeCheckAST(unaryExpression.operand, typeCheckContext, inTypedAssignment);
            return this.semanticInfoChain.booleanTypeSymbol;
        }

        // Unary arithmetic expressions 
        // validate:
        //  -
        private typeCheckUnaryArithmeticOperation(unaryExpression: UnaryExpression, typeCheckContext: PullTypeCheckContext, inTypedAssignment: boolean): PullTypeSymbol {
            var operandType = this.typeCheckAST(unaryExpression.operand, typeCheckContext, inTypedAssignment);

            switch (unaryExpression.nodeType) {
                case NodeType.PlusExpression:
                case NodeType.NegateExpression:
                case NodeType.BitwiseNotExpression:
                    return this.semanticInfoChain.numberTypeSymbol;
            }

            var operandIsFit = this.resolver.isAnyOrEquivalent(operandType) || operandType == this.semanticInfoChain.numberTypeSymbol || operandType.getKind() == PullElementKind.Enum;

            if (!operandIsFit) {
                this.postError(unaryExpression.operand.minChar, unaryExpression.operand.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_type_of_a_unary_arithmetic_operation_operand_must_be_of_type__any____number__or_an_enum_type, null), typeCheckContext.getEnclosingDecl());
            }

            switch (unaryExpression.nodeType) {
                case NodeType.PostIncrementExpression:
                case NodeType.PreIncrementExpression:
                case NodeType.PostDecrementExpression:
                case NodeType.PreDecrementExpression:
                    // Check that operand is classified as a reference 
                    var expression = this.resolver.resolveAST(unaryExpression.operand, false, typeCheckContext.getEnclosingDecl(), this.context);
                    if (!this.isValidLHS(unaryExpression.operand, expression, false)) {
                        this.postError(unaryExpression.operand.minChar, unaryExpression.operand.getLength(), typeCheckContext.scriptName,
                            getDiagnosticMessage(DiagnosticCode.The_operand_of_an_increment_or_decrement_operator_must_be_a_variable__property_or_indexer, null), typeCheckContext.getEnclosingDecl());
                    }

                    break;
            }

            return operandType;
        }

        // Index expression 
        // validate:
        //  -
        private typeCheckElementAccessExpression(binaryExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(binaryExpression.operand1, typeCheckContext);
            this.typeCheckAST(binaryExpression.operand2, typeCheckContext);

            var type = this.resolver.resolveAST(binaryExpression, false, typeCheckContext.getEnclosingDecl(), this.context).getType();
            this.checkForResolutionError(type, typeCheckContext.getEnclosingDecl());
            return type;
        }

        // 'typeof' expression 
        // validate:
        //  -
        private typeCheckTypeOf(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST((<UnaryExpression>ast).operand, typeCheckContext);

            return this.semanticInfoChain.stringTypeSymbol;
        }

        // Type reference expression
        // validate:
        //  -
        private typeCheckTypeReference(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var type = this.resolver.resolveAST(ast, false, typeCheckContext.getEnclosingDecl(), this.context).getType();
            this.checkForResolutionError(type, typeCheckContext.getEnclosingDecl());
            return type;
        }

        // Conditional expressions
        // validate:
        //  -
        private typeCheckConditionalExpression(conditionalExpression: ConditionalExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(conditionalExpression.operand1, typeCheckContext);
            this.typeCheckAST(conditionalExpression.operand2, typeCheckContext);
            this.typeCheckAST(conditionalExpression.operand3, typeCheckContext);

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var type = this.resolver.resolveAST(conditionalExpression, false, enclosingDecl, this.context).getType();
            this.checkForResolutionError(type, enclosingDecl);

            return type;
        }

        // new expression types
        private typeCheckThrowStatement(throwStatement: ThrowStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(throwStatement.expression, typeCheckContext);

            var type = this.resolver.resolveAST(throwStatement.expression, false, typeCheckContext.getEnclosingDecl(), this.context).getType();
            this.checkForResolutionError(type, typeCheckContext.getEnclosingDecl());
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckDeleteExpression(unaryExpression: UnaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(unaryExpression.operand, typeCheckContext);

            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var type = this.resolver.resolveAST(unaryExpression, false, enclosingDecl, this.context).getType();
            this.checkForResolutionError(type, enclosingDecl);

            return type;
        }

        private typeCheckVoidExpression(unaryExpression: UnaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(unaryExpression.operand, typeCheckContext);

            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var type = this.resolver.resolveAST(unaryExpression, false, enclosingDecl, this.context).getType();
            this.checkForResolutionError(type, enclosingDecl);

            return type;
        }

        private typeCheckRegExpExpression(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var type = this.resolver.resolveStatementOrExpression(ast, false, typeCheckContext.getEnclosingDecl(), this.context).getType();
            this.checkForResolutionError(type, typeCheckContext.getEnclosingDecl());
            return type;
        }

        // statements

        private typeCheckForStatement(forStatement: ForStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(forStatement.init, typeCheckContext);
            this.typeCheckAST(forStatement.cond, typeCheckContext);
            this.typeCheckAST(forStatement.body, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckForInStatement(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {

            var forInStatement = <ForInStatement>ast;

            var rhsType = this.resolver.widenType(this.typeCheckAST(forInStatement.obj, typeCheckContext));
            var lval = forInStatement.lval;

            if (lval.nodeType === NodeType.VariableDeclaration) {
                var declaration = <VariableDeclaration>forInStatement.lval;
                var varDecl = <VariableDeclarator>declaration.declarators.members[0];

                if (varDecl.typeExpr) {
                    this.postError(lval.minChar, lval.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Variable_declarations_for_for_in_expressions_cannot_contain_a_type_annotation, null), typeCheckContext.getEnclosingDecl());
                }
            }

            var varSym = this.resolver.resolveAST(forInStatement.lval, false, typeCheckContext.getEnclosingDecl(), this.context);
            this.checkForResolutionError(varSym.getType(), typeCheckContext.getEnclosingDecl());

            var isStringOrAny = varSym.getType() == this.semanticInfoChain.stringTypeSymbol || this.resolver.isAnyOrEquivalent(varSym.getType());
            var isValidRHS = rhsType && (this.resolver.isAnyOrEquivalent(rhsType) || !rhsType.isPrimitive());

            if (!isStringOrAny) {
                this.postError(lval.minChar, lval.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Variable_declarations_for_for_in_expressions_must_be_of_types__string__or__any_, null), typeCheckContext.getEnclosingDecl());
            }

            if (!isValidRHS) {
                this.postError(forInStatement.obj.minChar, forInStatement.obj.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.The_right_operand_of_a_for_in_expression_must_be_of_type__any____an_object_type_or_a_type_parameter, null), typeCheckContext.getEnclosingDecl());
            }

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckInExpression(binaryExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var lhsType = this.resolver.widenType(this.typeCheckAST(binaryExpression.operand1, typeCheckContext));
            var rhsType = this.resolver.widenType(this.typeCheckAST(binaryExpression.operand2, typeCheckContext));

            var isStringOrAny = lhsType.getType() == this.semanticInfoChain.stringTypeSymbol || this.resolver.isAnyOrEquivalent(lhsType.getType());
            var isValidRHS = rhsType && (this.resolver.isAnyOrEquivalent(rhsType) || !rhsType.isPrimitive());

            if (!isStringOrAny) {
                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_left_hand_side_of_an__in__expression_must_be_of_types__string__or__any_, null), typeCheckContext.getEnclosingDecl());
            }

            if (!isValidRHS) {

                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_right_hand_side_of_an__in__expression_must_be_of_type__any___an_object_type_or_a_type_parameter, null), typeCheckContext.getEnclosingDecl());
            }

            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private typeCheckInstanceOfExpression(binaryExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var lhsType = this.resolver.widenType(this.typeCheckAST(binaryExpression.operand1, typeCheckContext));
            var rhsType = this.typeCheckAST(binaryExpression.operand2, typeCheckContext);

            var isValidLHS = lhsType && (this.resolver.isAnyOrEquivalent(lhsType) || !lhsType.isPrimitive());
            var isValidRHS = rhsType && (this.resolver.isAnyOrEquivalent(rhsType) || rhsType.isClass() || this.resolver.typeIsSubtypeOfFunction(rhsType, this.context))

            if (!isValidLHS) {
                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_left_hand_side_of_an__instanceOf__expression_must_be_of_type__any___an_object_type_or_a_type_parameter, null), typeCheckContext.getEnclosingDecl());
            }

            if (!isValidRHS) {
                this.postError(binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), typeCheckContext.scriptName,
                    getDiagnosticMessage(DiagnosticCode.The_right_hand_side_of_an__instanceOf__expression_must_be_of_type__any__or_a_subtype_of_the__Function__interface_type, null), typeCheckContext.getEnclosingDecl());
            }

            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private typeCheckParenthesizedExpression(parenthesizedExpression: ParenthesizedExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            return this.typeCheckAST(parenthesizedExpression.expression, typeCheckContext);
        }

        private typeCheckWhileStatement(whileStatement: WhileStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(whileStatement.cond, typeCheckContext);
            this.typeCheckAST(whileStatement.body, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckDoStatement(doStatement: DoStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(doStatement.cond, typeCheckContext);
            this.typeCheckAST(doStatement.body, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckIfStatement(ifStatement: IfStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(ifStatement.cond, typeCheckContext);
            this.typeCheckAST(ifStatement.thenBod, typeCheckContext);
            this.typeCheckAST(ifStatement.elseBod, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckBlock(block: Block, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(block.statements, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckVariableDeclaration(variableDeclaration: VariableDeclaration, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(variableDeclaration.declarators, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckVariableStatement(variableStatement: VariableStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(variableStatement.declaration, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckWithStatement(withStatement: WithStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.postError(withStatement.expr.minChar, withStatement.expr.getLength(), typeCheckContext.scriptName,
                getDiagnosticMessage(DiagnosticCode.All_symbols_within_a__with__block_will_be_resolved_to__any__, null), typeCheckContext.getEnclosingDecl());

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckTryStatement(tryStatement: TryStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(tryStatement.tryBody, typeCheckContext);
            this.typeCheckAST(tryStatement.catchClause, typeCheckContext);
            this.typeCheckAST(tryStatement.finallyBody, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckCatchClause(catchClause: CatchClause, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var catchDecl = this.resolver.getDeclForAST(catchClause);

            typeCheckContext.pushEnclosingDecl(catchDecl);
            this.typeCheckAST(catchClause.body, typeCheckContext);
            typeCheckContext.popEnclosingDecl();

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckReturnStatement(returnAST: ReturnStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            typeCheckContext.setEnclosingDeclHasReturn();
            var returnExpr = returnAST.returnExpression;
            var returnType = this.typeCheckAST(returnExpr, typeCheckContext);

            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            if (enclosingDecl.getKind() == PullElementKind.SetAccessor && returnExpr) {
                this.postError(returnExpr.minChar, returnExpr.getLength(), typeCheckContext.scriptName, getDiagnosticMessage(DiagnosticCode.Setters_may_not_return_a_value, null), typeCheckContext.getEnclosingDecl());
            }

            if (enclosingDecl.getKind() & PullElementKind.SomeFunction) {
                var signatureSymbol = enclosingDecl.getSignatureSymbol();
                var sigReturnType = signatureSymbol.getReturnType();

                if (returnType && sigReturnType) {
                    var comparisonInfo = new TypeComparisonInfo();
                    var upperBound: PullTypeSymbol = null;

                    if (returnType.isTypeParameter()) {
                        upperBound = (<PullTypeParameterSymbol>returnType).getConstraint();

                        if (upperBound) {
                            returnType = upperBound;
                        }
                    }

                    if (sigReturnType.isTypeParameter()) {
                        upperBound = (<PullTypeParameterSymbol>sigReturnType).getConstraint();

                        if (upperBound) {
                            sigReturnType = upperBound;
                        }
                    }

                    if (!returnType.isResolved()) {
                        this.resolver.resolveDeclaredSymbol(returnType, enclosingDecl, this.context);
                    }

                    if (!sigReturnType.isResolved()) {
                        this.resolver.resolveDeclaredSymbol(sigReturnType, enclosingDecl, this.context);
                    }

                    var isAssignable = this.resolver.sourceIsAssignableToTarget(returnType, sigReturnType, this.context, comparisonInfo);

                    if (!isAssignable) {
                        var message: string;
                        if (comparisonInfo.message) {
                            message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1__NL__2, [returnType.toString(), sigReturnType.toString(), comparisonInfo.message]);
                        } else {
                            message = getDiagnosticMessage(DiagnosticCode.Cannot_convert__0__to__1_, [returnType.toString(), sigReturnType.toString()]);
                        }

                        this.postError(returnExpr.minChar, returnExpr.getLength(), typeCheckContext.scriptName, message, enclosingDecl);
                    }
                }
            }

            return returnType;
        }

        private typeCheckNameExpression(ast: AST, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var type = this.resolver.resolveNameExpression(<Identifier>ast, enclosingDecl, this.context).getType();
            this.checkForResolutionError(type, enclosingDecl);
            return type;
        }

        private typeCheckMemberAccessExpression(memberAccessExpression: BinaryExpression, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            var expressionType = this.typeCheckAST(memberAccessExpression.operand1, typeCheckContext);

            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var resolvedName = this.resolver.resolveDottedNameExpression(memberAccessExpression, enclosingDecl, this.context);
            var type = resolvedName.getType();
            this.checkForResolutionError(type, enclosingDecl);

            if (expressionType && resolvedName && resolvedName.hasFlag(PullElementFlags.Private)) {
                if (expressionType.getKind() === PullElementKind.ConstructorType) {
                    expressionType = expressionType.getAssociatedContainerType();
                }

                if (expressionType.isClass()) {
                    // We're accessing a private member of a class.  We can only do that if we're 
                    // actually contained within that class.
                    var containingClass = typeCheckContext.getEnclosingClassDecl();
                    if (!containingClass || containingClass.getSymbol() !== expressionType) {
                        var name = <Identifier>memberAccessExpression.operand2;
                        this.postError(name.minChar, name.getLength(), typeCheckContext.scriptName,
                            getDiagnosticMessage(DiagnosticCode._0_1__is_inaccessible, [expressionType.toString(false), name.actualText]), enclosingDecl);
                    }
                }
            }

            return type;
        }

        private typeCheckSwitchStatement(switchStatement: SwitchStatement, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(switchStatement.val, typeCheckContext);
            this.typeCheckAST(switchStatement.caseList, typeCheckContext);
            this.typeCheckAST(switchStatement.defaultCase, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private typeCheckExpressionStatement(ast: ExpressionStatement, typeCheckContext: PullTypeCheckContext, inTypedAssignment: boolean): PullTypeSymbol {
            return this.typeCheckAST(ast.expression, typeCheckContext, inTypedAssignment);
        }

        private typeCheckCaseClause(caseClause: CaseClause, typeCheckContext: PullTypeCheckContext): PullTypeSymbol {
            this.typeCheckAST(caseClause.expr, typeCheckContext);
            this.typeCheckAST(caseClause.body, typeCheckContext);

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private checkTypePrivacy(declSymbol: PullSymbol, typeSymbol: PullTypeSymbol, privacyErrorReporter: (typeSymbol: PullTypeSymbol) => void ) {
            if (!typeSymbol || typeSymbol.getKind() == PullElementKind.Primitive) {
                return;
            }

            if (typeSymbol.isArray()) {
                this.checkTypePrivacy(declSymbol, (<PullArrayTypeSymbol>typeSymbol).getElementType(), privacyErrorReporter);
                return;
            }

            if (!typeSymbol.isNamedTypeSymbol()) {
                // Check the privacy of members, constructors, calls, index signatures
                var members = typeSymbol.getMembers();
                for (var i = 0; i < members.length; i++) {
                    this.checkTypePrivacy(declSymbol, members[i].getType(), privacyErrorReporter);
                }

                this.checkTypePrivacyOfSignatures(declSymbol, typeSymbol.getCallSignatures(), privacyErrorReporter);
                this.checkTypePrivacyOfSignatures(declSymbol, typeSymbol.getConstructSignatures(), privacyErrorReporter);
                this.checkTypePrivacyOfSignatures(declSymbol, typeSymbol.getIndexSignatures(), privacyErrorReporter);

                return;
            }

            // Check flags for the symbol itself
            if (declSymbol.isExternallyVisible()) {
                // Check if type symbol is externally visible
                var typeSymbolIsVisible = typeSymbol.isExternallyVisible();
                // If Visible check if the type is part of dynamic module
                if (typeSymbolIsVisible) {
                    var typeSymbolPath = typeSymbol.pathToRoot();
                    if (typeSymbolPath.length && typeSymbolPath[typeSymbolPath.length - 1].getKind() == PullElementKind.DynamicModule) {
                        // Type from the dynamic module
                        var declSymbolPath = declSymbol.pathToRoot();
                        if (declSymbolPath.length && declSymbolPath[declSymbolPath.length - 1] != typeSymbolPath[typeSymbolPath.length - 1]) {
                            // Declaration symbol is from different unit
                            var aliasSymbol = (<PullContainerTypeSymbol>typeSymbolPath[typeSymbolPath.length - 1]).getAliasedSymbol(declSymbol);
                            if (aliasSymbol) {
                                // Visible type.
                                // Also mark this Import declaration as visible
                                CompilerDiagnostics.assert(aliasSymbol.getKind() == PullElementKind.TypeAlias, "dynamic module need to be referenced by type alias");
                                (<PullTypeAliasSymbol>aliasSymbol).setIsTypeUsedExternally();
                            } else {
                                // Type from different module without import statement
                                typeSymbolIsVisible = false;
                            }
                        }
                    }
                }

                if (!typeSymbolIsVisible) {
                    // declaration is visible from outside but the type isnt - Report error
                    privacyErrorReporter(typeSymbol);
                }
            }
        }

        private checkTypePrivacyOfSignatures(declSymbol: PullSymbol, signatures: PullSignatureSymbol[], privacyErrorReporter: (typeSymbol: PullTypeSymbol) => void ) {
            for (var i = 0; i < signatures.length; i++) {
                var signature = signatures[i];
                if (signatures.length && signature.isDefinition()) {
                    continue;
                }

                var typeParams = signature.getTypeParameters();
                for (var j = 0; j < typeParams.length; j++) {
                    this.checkTypePrivacy(declSymbol, typeParams[j], privacyErrorReporter);
                }

                var params = signature.getParameters();
                for (var j = 0; j < params.length; j++) {
                    var paramType = params[j].getType();
                    this.checkTypePrivacy(declSymbol, paramType, privacyErrorReporter);
                }

                var returnType = signature.getReturnType();
                this.checkTypePrivacy(declSymbol, returnType, privacyErrorReporter);
            }
        }

        private baseListPrivacyErrorReporter(declAST: TypeDeclaration, declSymbol: PullTypeSymbol, baseAst: AST, isExtendedType: boolean, typeSymbol: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {
            var decl: PullDecl = this.resolver.getDeclForAST(declAST);
            var enclosingDecl = typeCheckContext.getEnclosingDecl();
            var message: string;

            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }
                if (declAST.nodeType == NodeType.ClassDeclaration) {
                    // Class
                    if (isExtendedType) {
                        message = getDiagnosticMessage(DiagnosticCode.Exported_class__0__extends_class_from_inaccessible_module__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Exported_class__0__implements_interface_from_inaccessible_module__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    }
                } else {
                    // Interface
                    message = getDiagnosticMessage(DiagnosticCode.Exported_interface__0__extends_interface_from_inaccessible_module__1_, [declSymbol.getName(), typeSymbolName]);
                }
            } else {
                if (declAST.nodeType == NodeType.ClassDeclaration) {
                    // Class
                    if (isExtendedType) {
                        message = getDiagnosticMessage(DiagnosticCode.Exported_class__0__extends_private_class__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Exported_class__0__implements_private_interface__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    }
                } else {
                    // Interface
                    message = getDiagnosticMessage(DiagnosticCode.Exported_interface__0__extends_private_interface__1_, [declSymbol.getName(), typeSymbolName]);
                }
            }

            this.context.postError(baseAst.minChar, baseAst.getLength(), typeCheckContext.scriptName, message, enclosingDecl, true);
        }

        private variablePrivacyErrorReporter(declSymbol: PullSymbol, typeSymbol: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {
            var declAST = <VariableDeclarator>this.resolver.getASTForSymbol(declSymbol);
            var decl: PullDecl = this.resolver.getDeclForAST(declAST);
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var isProperty = declSymbol.getKind() == PullElementKind.Property;
            var isPropertyOfClass = false;
            var declParent = declSymbol.getContainer();
            if (declParent && (declParent.getKind() == PullElementKind.Class || declParent.getKind() == PullElementKind.ConstructorMethod)) {
                isPropertyOfClass = true;
            }

            var message: string;
            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }

                if (decl.getFlags() & PullElementFlags.Static) {
                    message = getDiagnosticMessage(DiagnosticCode.Public_static_property__0__of__exported_class_is_using_inaccessible_module__1_, [declSymbol.getScopedName(), typeSymbolName]);
                } else if (isProperty) {
                    if (isPropertyOfClass) {
                        message = getDiagnosticMessage(DiagnosticCode.Public_property__0__of__exported_class_is_using_inaccessible_module__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Property__0__of__exported_interface_is_using_inaccessible_module__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    }
                } else {
                    message = getDiagnosticMessage(DiagnosticCode.Exported_variable__0__is_using_inaccessible_module__1_, [declSymbol.getScopedName(), typeSymbolName]);
                }
            } else {
                if (decl.getFlags() & PullElementFlags.Static) {
                    message = getDiagnosticMessage(DiagnosticCode.Public_static_property__0__of__exported_class_has_or_is_using_private_type__1_, [declSymbol.getScopedName(), typeSymbolName]);
                } else if (isProperty) {
                    if (isPropertyOfClass) {
                        message = getDiagnosticMessage(DiagnosticCode.Public_property__0__of__exported_class_has_or_is_using_private_type__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Property__0__of__exported_interface_has_or_is_using_private_type__1_, [declSymbol.getScopedName(), typeSymbolName]);
                    }
                } else {
                    message = getDiagnosticMessage(DiagnosticCode.Exported_variable__0__has_or_is_using_private_type__1_, [declSymbol.getScopedName(), typeSymbolName]);
                }
            }

            this.context.postError(declAST.minChar, declAST.getLength(), typeCheckContext.scriptName, message, enclosingDecl, true);
        }

        private checkFunctionTypePrivacy(funcDeclAST: FunctionDeclaration, inTypedAssignment: boolean, typeCheckContext: PullTypeCheckContext) {
            if (inTypedAssignment || (funcDeclAST.getFunctionFlags() & FunctionFlags.IsFunctionExpression)) {
                return;
            }

            var functionDecl = typeCheckContext.semanticInfo.getDeclForAST(funcDeclAST);
            var functionSymbol = functionDecl.getSymbol();;
            var functionSignature: PullSignatureSymbol;

            var isGetter = funcDeclAST.isGetAccessor();
            var isSetter = funcDeclAST.isSetAccessor();

            if (isGetter || isSetter) {
                var accessorSymbol = <PullAccessorSymbol> functionSymbol;
                functionSignature = (isGetter ? accessorSymbol.getGetter() : accessorSymbol.getSetter()).getType().getCallSignatures()[0];
            } else {
                if (!functionSymbol) {
                    var parentDecl = functionDecl.getParentDecl();
                    functionSymbol = parentDecl.getSymbol();
                    if (functionSymbol && functionSymbol.isType() && !(<PullTypeSymbol>functionSymbol).isNamedTypeSymbol()) {
                        // Signature from the non named type
                        return;
                    }
                }
                functionSignature = functionDecl.getSignatureSymbol();
            }

            // Check function parameters
            if (!isGetter) {
                var funcParams = functionSignature.getParameters();
                for (var i = 0; i < funcParams.length; i++) {
                    this.checkTypePrivacy(functionSymbol, funcParams[i].getType(), (typeSymbol: PullTypeSymbol) =>
                        this.functionArgumentTypePrivacyErrorReporter(funcDeclAST, i, funcParams[i], typeSymbol, typeCheckContext));
                }
            }

            // Check return type
            if (!isSetter) {
                this.checkTypePrivacy(functionSymbol, functionSignature.getReturnType(), (typeSymbol: PullTypeSymbol) =>
                    this.functionReturnTypePrivacyErrorReporter(funcDeclAST, functionSignature.getReturnType(), typeSymbol, typeCheckContext));
            }
        }

        private functionArgumentTypePrivacyErrorReporter(declAST: FunctionDeclaration, argIndex: number, paramSymbol: PullSymbol, typeSymbol: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {
            var decl: PullDecl = this.resolver.getDeclForAST(declAST);
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var isGetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.GetAccessor);
            var isSetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.SetAccessor);
            var isStatic = (decl.getFlags() & PullElementFlags.Static) == PullElementFlags.Static;
            var isMethod = decl.getKind() == PullElementKind.Method;
            var isMethodOfClass = false;
            var declParent = decl.getParentDecl();
            if (declParent && (declParent.getKind() == PullElementKind.Class || declParent.getKind() == PullElementKind.ConstructorMethod)) {
                isMethodOfClass = true;
            }

            var message: string = null;
            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }

                if (declAST.isConstructor) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_constructor_from_exported_class_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                } else if (isSetter) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_static_property_setter_from_exported_class_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_property_setter_from_exported_class_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    }
                } else if (declAST.isConstructMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_constructor_signature_from_exported_interface_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                } else if (declAST.isCallMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_call_signature_from_exported_interface_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                } else if (isMethod) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_static_method_from_exported_class_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    } else if (isMethodOfClass) {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_method_from_exported_class_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_method_from_exported_interface_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    }
                } else if (!isGetter) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_exported_function_is_using_inaccessible_module__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                }
            } else {
                if (declAST.isConstructor) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_constructor_from_exported_class_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                } else if (isSetter) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_static_property_setter_from_exported_class_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_property_setter_from_exported_class_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    }
                } else if (declAST.isConstructMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_constructor_signature_from_exported_interface_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                } else if (declAST.isCallMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_call_signature_from_exported_interface_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                } else if (isMethod) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_static_method_from_exported_class_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    } else if (isMethodOfClass) {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_public_method_from_exported_class_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_method_from_exported_interface_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                    }
                } else if (!isGetter && !declAST.isIndexerMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Parameter__0__of_exported_function_has_or_is_using_private_type__1_, [paramSymbol.getScopedName(), typeSymbolName]);
                }
            }

            if (message) {
                this.context.postError(declAST.arguments.members[argIndex].minChar, declAST.arguments.members[argIndex].getLength(), typeCheckContext.scriptName, message, enclosingDecl, true);
            }
        }

        private functionReturnTypePrivacyErrorReporter(declAST: FunctionDeclaration, funcReturnType: PullTypeSymbol, typeSymbol: PullTypeSymbol, typeCheckContext: PullTypeCheckContext) {
            var decl: PullDecl = this.resolver.getDeclForAST(declAST);
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var isGetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.GetAccessor);
            var isSetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.SetAccessor);
            var isStatic = (decl.getFlags() & PullElementFlags.Static) == PullElementFlags.Static;
            var isMethod = decl.getKind() == PullElementKind.Method;
            var isMethodOfClass = false;
            var declParent = decl.getParentDecl();
            if (declParent && (declParent.getKind() == PullElementKind.Class || declParent.getKind() == PullElementKind.ConstructorMethod)) {
                isMethodOfClass = true;
            }

            var message: string = null;
            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }

                if (isGetter) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_static_property_getter_from_exported_class_is_using_inaccessible_module__0_, [typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_property_getter_from_exported_class_is_using_inaccessible_module__0_, [typeSymbolName]);
                    }
                } else if (declAST.isConstructMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_constructor_signature_from_exported_interface_is_using_inaccessible_module__0_, [typeSymbolName]);
                } else if (declAST.isCallMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_call_signature_from_exported_interface_is_using_inaccessible_module__0_, [typeSymbolName]);
                } else if (declAST.isIndexerMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_index_signature_from_exported_interface_is_using_inaccessible_module__0_, [typeSymbolName]);
                } else if (isMethod) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_static_method_from_exported_class_is_using_inaccessible_module__0_, [typeSymbolName]);
                    } else if (isMethodOfClass) {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_method_from_exported_class_is_using_inaccessible_module__0_, [typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_method_from_exported_interface_is_using_inaccessible_module__0_, [typeSymbolName]);
                    }
                } else if (!isSetter && !declAST.isConstructor) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_exported_function_is_using_inaccessible_module__0_, [typeSymbolName]);
                }
            } else {
                if (isGetter) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_static_property_getter_from_exported_class_has_or_is_using_private_type__0_, [typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_property_getter_from_exported_class_has_or_is_using_private_type__0_, [typeSymbolName]);
                    }
                } else if (declAST.isConstructMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_private_type__0_, [typeSymbolName]);
                } else if (declAST.isCallMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_call_signature_from_exported_interface_has_or_is_using_private_type__0_, [typeSymbolName]);
                } else if (declAST.isIndexerMember()) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_index_signature_from_exported_interface_has_or_is_using_private_type__0_, [typeSymbolName]);
                } else if (isMethod) {
                    if (isStatic) {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_static_method_from_exported_class_has_or_is_using_private_type__0_, [typeSymbolName]);
                    } else if (isMethodOfClass) {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_public_method_from_exported_class_has_or_is_using_private_type__0_, [typeSymbolName]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Return_type_of_method_from_exported_interface_has_or_is_using_private_type__0_, [typeSymbolName]);
                    }
                } else if (!isSetter && !declAST.isConstructor) {
                    message = getDiagnosticMessage(DiagnosticCode.Return_type_of_exported_function_has_or_is_using_private_type__0_, [typeSymbolName]);
                }
            }

            if (message) {
                var reportOnFuncDecl = false;
                var contextForReturnTypeResolution = new PullTypeResolutionContext();
                var returnExpressionSymbol: PullTypeSymbol;
                if (declAST.returnTypeAnnotation != null) {
                    var returnTypeRef = <TypeReference>declAST.returnTypeAnnotation;
                    returnExpressionSymbol = this.resolver.resolveTypeReference(returnTypeRef, decl, contextForReturnTypeResolution);
                    if (returnExpressionSymbol == funcReturnType) {
                        // Error coming from return annotation
                        this.context.postError(declAST.returnTypeAnnotation.minChar, declAST.returnTypeAnnotation.getLength(), typeCheckContext.scriptName, message, enclosingDecl, true);
                    }
                }

                if (declAST.block) {
                    var reportErrorOnReturnExpressions = (ast: AST, parent: AST, walker: IAstWalker) => {
                        var go = true;
                        switch (ast.nodeType) {
                            case NodeType.FunctionDeclaration:
                                // don't recurse into a function decl - we don't want to confuse a nested
                                // return type with the top-level function's return type
                                go = false;
                                break;

                            case NodeType.ReturnStatement:
                                var returnStatement: ReturnStatement = <ReturnStatement>ast;
                                returnExpressionSymbol = this.resolver.resolveStatementOrExpression(returnStatement.returnExpression, false, decl, contextForReturnTypeResolution).getType();
                                // Check if return statement's type matches the one that we concluded
                                if (returnExpressionSymbol == funcReturnType) {
                                    this.context.postError(returnStatement.minChar, returnStatement.getLength(), typeCheckContext.scriptName, message, enclosingDecl, true);
                                } else {
                                    reportOnFuncDecl = true;
                                }
                                go = false;
                                break;

                            default:
                                break;
                        }

                        walker.options.goChildren = go;
                        return ast;
                    }

                    getAstWalkerFactory().walk(declAST.block, reportErrorOnReturnExpressions);
                }

                if (reportOnFuncDecl) {
                    // Show on function decl
                    this.context.postError(declAST.minChar, declAST.getLength(), typeCheckContext.scriptName, message, enclosingDecl, true);
                }
            }
        }
    }
}