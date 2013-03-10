// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\typescript.ts' />
///<reference path='..\Syntax\SyntaxWalker.generated.ts' />
///<reference path='..\Text\TextSpan.ts' />

module TypeScript {
    export class DeclCollectionContext {
        public parentChain: PullDecl[] = [];

        constructor(public semanticInfo: SemanticInfo, public scriptName = "") {
        }

        public getParent() { return this.parentChain ? this.parentChain[this.parentChain.length - 1] : null; }

        public pushParent(parentDecl: PullDecl) { if (parentDecl) { this.parentChain[this.parentChain.length] = parentDecl; } }

        public popParent() { this.parentChain.length--; }

        public foundValueDecl = false;
    }

    export function preCollectImportDecls(ast: AST, parentAST: AST, context: DeclCollectionContext) {
        var importDecl = <ImportDeclaration>ast;
        var declFlags = PullElementFlags.None;
        var span = TextSpan.fromBounds(importDecl.minChar, importDecl.limChar);

        var decl = new PullDecl(importDecl.id.actualText, PullElementKind.TypeAlias, declFlags, span, context.scriptName);

        var parent = context.getParent();

        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        context.semanticInfo.setDeclForAST(ast, decl);

        context.semanticInfo.setASTForDecl(decl, ast);

        return false;
    }

    export function preCollectModuleDecls(ast: AST, parentAST: AST, context: DeclCollectionContext) {
        var moduleDecl: ModuleDeclaration = <ModuleDeclaration>ast;
        var declFlags = PullElementFlags.None;
        var modName = (<Identifier>moduleDecl.name).text;
        var isDynamic = isQuoted(modName);
        var kind: PullElementKind = PullElementKind.Container;

        if (hasFlag(moduleDecl.modFlags, ModuleFlags.Ambient)) {
            declFlags |= PullElementFlags.Ambient;
        }

        if (hasFlag(moduleDecl.modFlags, ModuleFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (hasFlag(moduleDecl.modFlags, ModuleFlags.IsEnum)) {
            declFlags |= PullElementFlags.Enum;
            kind = PullElementKind.Enum;
        }
        else {
            kind = isDynamic ? PullElementKind.DynamicModule : PullElementKind.Container;
        }

        var span = TextSpan.fromBounds(moduleDecl.minChar, moduleDecl.limChar);

        var decl = new PullDecl(modName, kind, declFlags, span, context.scriptName);
        var parent = context.getParent();
        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(ast, decl);

        context.semanticInfo.setASTForDecl(decl, ast);

        return true;
    }

    export function preCollectClassDecls(ast: AST, parenAST: AST, context: DeclCollectionContext) {
        var classDecl = <ClassDeclaration>ast;
        var declFlags = PullElementFlags.None;
        var constructorDeclKind = PullElementKind.Variable;

        if (hasFlag(classDecl.varFlags, VarFlags.Ambient)) {
            declFlags |= PullElementFlags.Ambient;
        }

        if (hasFlag(classDecl.varFlags, VarFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
            constructorDeclKind = PullElementKind.Property;
        }

        var span = TextSpan.fromBounds(classDecl.minChar, classDecl.limChar);

        var decl = new PullDecl(classDecl.name.text, PullElementKind.Class, declFlags, span, context.scriptName);

        var constructorDecl = new PullDecl(classDecl.name.text, constructorDeclKind, declFlags | PullElementFlags.ClassConstructorVariable, span, context.scriptName);

        decl.setValueDecl(constructorDecl);

        var parent = context.getParent();
        parent.addChildDecl(decl);
        parent.addChildDecl(constructorDecl);
        decl.setParentDecl(parent);
        constructorDecl.setParentDecl(parent);

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(ast, decl);

        context.semanticInfo.setASTForDecl(decl, ast);

        return true;
    }

    export function createInferfaceDeclaration(interfaceDecl: InterfaceDeclaration, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;

        if (hasFlag(interfaceDecl.varFlags, VarFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
        }

        var span = TextSpan.fromBounds(interfaceDecl.minChar, interfaceDecl.limChar);

        var decl = new PullDecl(interfaceDecl.name.text, PullElementKind.Interface, declFlags, span, context.scriptName);

        var parent = context.getParent();

        // if we're collecting a decl for a type annotation, we don't want to add the decl to the parent scope
        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(interfaceDecl, decl);
        context.semanticInfo.setASTForDecl(decl, interfaceDecl);

        return true;
    }

    export function createObjectTypeDeclaration(interfaceDecl: InterfaceDeclaration, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;

        if (hasFlag(interfaceDecl.varFlags, VarFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
        }

        var span = TextSpan.fromBounds(interfaceDecl.minChar, interfaceDecl.limChar);

        var decl = new PullDecl("", PullElementKind.ObjectType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        // if we're collecting a decl for a type annotation, we don't want to add the decl to the parent scope
        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(interfaceDecl, decl);
        context.semanticInfo.setASTForDecl(decl, interfaceDecl);

        return true;
    }

    export function preCollectInterfaceDecls(ast: AST, parentAST: AST, context: DeclCollectionContext) {

        var interfaceDecl = <InterfaceDeclaration>ast;
        var declFlags = PullElementFlags.None;

        // PULLTODO
        //if (ast.flags & ASTFlags.TypeReference) {
        //    return createObjectTypeDeclaration(interfaceDecl, context);
        //}

        if (hasFlag(interfaceDecl.varFlags, VarFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
        }

        var span = TextSpan.fromBounds(interfaceDecl.minChar, interfaceDecl.limChar);

        var decl = new PullDecl(interfaceDecl.name.text, PullElementKind.Interface, declFlags, span, context.scriptName);

        var parent = context.getParent();

        // if we're collecting a decl for a type annotation, we don't want to add the decl to the parent scope
        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(ast, decl);
        context.semanticInfo.setASTForDecl(decl, ast);

        return true;
    }

    export function preCollectParameterDecl(ast: AST, parentAST: AST, context: DeclCollectionContext) {
        var argDecl = <BoundDecl>ast;
        var declFlags = PullElementFlags.None;

        if (hasFlag(argDecl.varFlags, VarFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        if (hasFlag(argDecl.flags, ASTFlags.OptionalName) || hasFlag(argDecl.id.flags, ASTFlags.OptionalName)) {
            declFlags |= PullElementFlags.Optional;
        }

        var span = TextSpan.fromBounds(argDecl.minChar, argDecl.limChar);

        var decl = new PullDecl(argDecl.id.text, PullElementKind.Parameter, declFlags, span, context.scriptName);

        var parent = context.getParent();
        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        // if it's a property type, we'll need to add it to the parent's parent as well
        if (hasFlag(argDecl.varFlags, VarFlags.Property)) {
            var propDecl = new PullDecl(argDecl.id.text, PullElementKind.Property, declFlags, span, context.scriptName);
            propDecl.setValueDecl(decl);
            context.parentChain[context.parentChain.length - 2].addChildDecl(propDecl);
            propDecl.setParentDecl(context.parentChain[context.parentChain.length - 2]);
            context.semanticInfo.setASTForDecl(propDecl, ast);
            context.semanticInfo.setDeclForAST(ast, propDecl);
        }
        else {
            context.semanticInfo.setASTForDecl(decl, ast);
            context.semanticInfo.setDeclForAST(ast, decl);
        }

        if (argDecl.typeExpr &&
            ((<TypeReference>argDecl.typeExpr).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>argDecl.typeExpr).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>argDecl.typeExpr).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return false;
    }

    export function preCollectTypeParameterDecl(ast: AST, parentAST: AST, context: DeclCollectionContext) {
        var typeParameterDecl = <TypeParameter>ast;
        var declFlags = PullElementFlags.None;

        var span = TextSpan.fromBounds(typeParameterDecl.minChar, typeParameterDecl.limChar);

        var decl = new PullDecl(typeParameterDecl.name.actualText, PullElementKind.TypeParameter, declFlags, span, context.scriptName);

        context.semanticInfo.setASTForDecl(decl, ast);
        context.semanticInfo.setDeclForAST(ast, decl);

        var parent = context.getParent();
        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        if (typeParameterDecl.constraint &&
            ((<TypeReference>typeParameterDecl.constraint).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>typeParameterDecl.constraint).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>typeParameterDecl.constraint).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // interface properties
    export function createPropertySignature(propertyDecl: VarDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Public;
        var declType = PullElementKind.Property;

        if (hasFlag(propertyDecl.id.flags, ASTFlags.OptionalName)) {
            declFlags |= PullElementFlags.Optional;
        }

        if (hasFlag(propertyDecl.varFlags, VarFlags.Constant)) {
            declFlags |= PullElementFlags.Constant;
        }

        var span = TextSpan.fromBounds(propertyDecl.minChar, propertyDecl.limChar);

        var decl = new PullDecl(propertyDecl.id.text, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();
        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        context.semanticInfo.setDeclForAST(propertyDecl, decl);

        context.semanticInfo.setASTForDecl(decl, propertyDecl);

        if (propertyDecl.typeExpr &&
            ((<TypeReference>propertyDecl.typeExpr).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>propertyDecl.typeExpr).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>propertyDecl.typeExpr).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return false;
    }

    // class member variables
    export function createMemberVariableDeclaration(memberDecl: VarDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Property;

        if (hasFlag(memberDecl.varFlags, VarFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        if (hasFlag(memberDecl.varFlags, VarFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        var span = TextSpan.fromBounds(memberDecl.minChar, memberDecl.limChar);

        var decl = new PullDecl(memberDecl.id.text, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();
        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        context.semanticInfo.setDeclForAST(memberDecl, decl);

        context.semanticInfo.setASTForDecl(decl, memberDecl);

        if (memberDecl.typeExpr &&
            ((<TypeReference>memberDecl.typeExpr).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>memberDecl.typeExpr).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>memberDecl.typeExpr).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return false;
    }

    export function createVariableDeclaration(varDecl: VarDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Variable;

        if (hasFlag(varDecl.varFlags, VarFlags.Ambient)) {
            declFlags |= PullElementFlags.Ambient;
        }

        if (hasFlag(varDecl.varFlags, VarFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
        }

        var span = TextSpan.fromBounds(varDecl.minChar, varDecl.limChar);

        var decl = new PullDecl(varDecl.id.text, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();
        parent.addChildDecl(decl);
        decl.setParentDecl(parent);

        context.semanticInfo.setDeclForAST(varDecl, decl);

        context.semanticInfo.setASTForDecl(decl, varDecl);

        if (varDecl.typeExpr &&
            ((<TypeReference>varDecl.typeExpr).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>varDecl.typeExpr).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>varDecl.typeExpr).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return false;
    }

    export function preCollectVarDecls(ast: AST, parentAST: AST, context: DeclCollectionContext) {
        var varDecl = <VarDecl>ast;
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Variable;
        var isProperty = false;
        var isStatic = false;

        if (hasFlag(varDecl.varFlags, VarFlags.ClassProperty)) {
            return createMemberVariableDeclaration(varDecl, context);
        }
        else if (hasFlag(varDecl.varFlags, VarFlags.Property)) {
            return createPropertySignature(varDecl, context);
        }

        return createVariableDeclaration(varDecl, context);
    }

    // function type expressions
    export function createFunctionTypeDeclaration(functionTypeDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.FunctionType;

        var span = TextSpan.fromBounds(functionTypeDeclAST.minChar, functionTypeDeclAST.limChar);

        var decl = new PullDecl("", declType, declFlags, span, context.semanticInfo.getPath());

        // parent could be null if we're collecting decls for a lambda expression
        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(functionTypeDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, functionTypeDeclAST);

        if (functionTypeDeclAST.returnTypeAnnotation &&
            ((<TypeReference>functionTypeDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>functionTypeDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>functionTypeDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // constructor types
    export function createConstructorTypeDeclaration(constructorTypeDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.ConstructorType;

        var span = TextSpan.fromBounds(constructorTypeDeclAST.minChar, constructorTypeDeclAST.limChar);

        var decl = new PullDecl("{new}", declType, declFlags, span, context.semanticInfo.getPath());

        // parent could be null if we're collecting decls for a lambda expression
        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(constructorTypeDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, constructorTypeDeclAST);

        if (constructorTypeDeclAST.returnTypeAnnotation &&
            ((<TypeReference>constructorTypeDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>constructorTypeDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>constructorTypeDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // function declaration
    export function createFunctionDeclaration(funcDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Function;

        if (hasFlag(funcDeclAST.fncFlags, FncFlags.Ambient)) {
            declFlags |= PullElementFlags.Ambient;
        }

        if (hasFlag(funcDeclAST.fncFlags, FncFlags.Exported)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (!funcDeclAST.bod) {
            declFlags |= PullElementFlags.Signature;
        }

        var span = TextSpan.fromBounds(funcDeclAST.minChar, funcDeclAST.limChar);

        var decl = new PullDecl(funcDeclAST.name.actualText, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(funcDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, funcDeclAST);

        if (funcDeclAST.returnTypeAnnotation &&
            ((<TypeReference>funcDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>funcDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>funcDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // function expression
    export function createFunctionExpressionDeclaration(functionExpressionDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.FunctionExpression;

        if (hasFlag(functionExpressionDeclAST.fncFlags, FncFlags.IsFatArrowFunction)) {
            declFlags |= PullElementFlags.FatArrow;
        }

        var span = TextSpan.fromBounds(functionExpressionDeclAST.minChar, functionExpressionDeclAST.limChar);

        var decl = new PullDecl("", declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(functionExpressionDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, functionExpressionDeclAST);

        if (functionExpressionDeclAST.returnTypeAnnotation &&
            ((<TypeReference>functionExpressionDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>functionExpressionDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>functionExpressionDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // methods
    export function createMemberFunctionDeclaration(memberFunctionDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Method;

        if (hasFlag(memberFunctionDeclAST.fncFlags, FncFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        if (hasFlag(memberFunctionDeclAST.fncFlags, FncFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        if (!memberFunctionDeclAST.bod || !memberFunctionDeclAST.bod.members.length) {
            declFlags |= PullElementFlags.Signature;
        }

        if (hasFlag(memberFunctionDeclAST.name.flags, ASTFlags.OptionalName)) {
            declFlags |= PullElementFlags.Optional;
        }

        var span = TextSpan.fromBounds(memberFunctionDeclAST.minChar, memberFunctionDeclAST.limChar);

        var decl = new PullDecl(memberFunctionDeclAST.name.actualText, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(memberFunctionDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, memberFunctionDeclAST);

        if (memberFunctionDeclAST.returnTypeAnnotation &&
            ((<TypeReference>memberFunctionDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>memberFunctionDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>memberFunctionDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // index signatures
    export function createIndexSignatureDeclaration(indexSignatureDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Signature | PullElementFlags.Index;
        var declType = PullElementKind.IndexSignature;

        var span = TextSpan.fromBounds(indexSignatureDeclAST.minChar, indexSignatureDeclAST.limChar);

        var decl = new PullDecl("[]", declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(indexSignatureDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, indexSignatureDeclAST);

        if (indexSignatureDeclAST.returnTypeAnnotation &&
            ((<TypeReference>indexSignatureDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>indexSignatureDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>indexSignatureDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // call signatures
    export function createCallSignatureDeclaration(callSignatureDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Signature | PullElementFlags.Call;
        var declType = PullElementKind.CallSignature;

        var span = TextSpan.fromBounds(callSignatureDeclAST.minChar, callSignatureDeclAST.limChar);

        var decl = new PullDecl("()", declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(callSignatureDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, callSignatureDeclAST);

        if (callSignatureDeclAST.returnTypeAnnotation &&
            ((<TypeReference>callSignatureDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>callSignatureDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>callSignatureDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // construct signatures
    export function createConstructSignatureDeclaration(constructSignatureDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Signature | PullElementFlags.Call;
        var declType = PullElementKind.ConstructSignature;

        var span = TextSpan.fromBounds(constructSignatureDeclAST.minChar, constructSignatureDeclAST.limChar);

        var decl = new PullDecl("new", declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(constructSignatureDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, constructSignatureDeclAST);

        if (constructSignatureDeclAST.returnTypeAnnotation &&
            ((<TypeReference>constructSignatureDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>constructSignatureDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>constructSignatureDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // class constructors
    export function createClassConstructorDeclaration(constructorDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Constructor;
        var declType = PullElementKind.ConstructorMethod;

        if (!constructorDeclAST.bod) {
            declFlags |= PullElementFlags.Signature;
        }

        var span = TextSpan.fromBounds(constructorDeclAST.minChar, constructorDeclAST.limChar);

        var decl = new PullDecl(constructorDeclAST.name.actualText, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(constructorDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, constructorDeclAST);

        if (constructorDeclAST.returnTypeAnnotation &&
            ((<TypeReference>constructorDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>constructorDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>constructorDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    export function createGetAccessorDeclaration(getAccessorDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Public;
        var declType = PullElementKind.GetAccessor;

        if (hasFlag(getAccessorDeclAST.fncFlags, FncFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        if (hasFlag(getAccessorDeclAST.name.flags, ASTFlags.OptionalName)) {
            declFlags |= PullElementFlags.Optional;
        }

        var span = TextSpan.fromBounds(getAccessorDeclAST.minChar, getAccessorDeclAST.limChar);

        var decl = new PullDecl(getAccessorDeclAST.name.actualText, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(getAccessorDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, getAccessorDeclAST);

        if (getAccessorDeclAST.returnTypeAnnotation &&
            ((<TypeReference>getAccessorDeclAST.returnTypeAnnotation).term.nodeType == NodeType.InterfaceDeclaration ||
            (<TypeReference>getAccessorDeclAST.returnTypeAnnotation).term.nodeType == NodeType.FuncDecl)) {

            var declCollectionContext = new DeclCollectionContext(context.semanticInfo);

            declCollectionContext.scriptName = context.scriptName;

            getAstWalkerFactory().walk((<TypeReference>getAccessorDeclAST.returnTypeAnnotation).term, preCollectDecls, postCollectDecls, null, declCollectionContext);
        }

        return true;
    }

    // set accessors
    export function createSetAccessorDeclaration(setAccessorDeclAST: FuncDecl, context: DeclCollectionContext) {
        var declFlags = PullElementFlags.Public;
        var declType = PullElementKind.SetAccessor;

        if (hasFlag(setAccessorDeclAST.fncFlags, FncFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        if (hasFlag(setAccessorDeclAST.name.flags, ASTFlags.OptionalName)) {
            declFlags |= PullElementFlags.Optional;
        }

        var span = TextSpan.fromBounds(setAccessorDeclAST.minChar, setAccessorDeclAST.limChar);

        var decl = new PullDecl(setAccessorDeclAST.name.actualText, declType, declFlags, span, context.scriptName);

        var parent = context.getParent();

        if (parent) {
            parent.addChildDecl(decl);
            decl.setParentDecl(parent);
        }

        context.pushParent(decl);

        context.semanticInfo.setDeclForAST(setAccessorDeclAST, decl);

        context.semanticInfo.setASTForDecl(decl, setAccessorDeclAST);

        return true;
    }

    export function preCollectFuncDecls(ast: AST, parentAST: AST, context: DeclCollectionContext) {

        var funcDecl = <FuncDecl>ast;

        if (hasFlag(funcDecl.fncFlags, (FncFlags.IsFunctionExpression | FncFlags.IsFatArrowFunction))) {
            return createFunctionExpressionDeclaration(funcDecl, context);
        }
        else if (funcDecl.isConstructor) {
            return createClassConstructorDeclaration(funcDecl, context);
        }
        else if (funcDecl.isGetAccessor()) {
            return createGetAccessorDeclaration(funcDecl, context);
        }
        else if (funcDecl.isSetAccessor()) {
            return createSetAccessorDeclaration(funcDecl, context);
        }
        else if (hasFlag(funcDecl.fncFlags, FncFlags.ConstructMember)) {
            return hasFlag(funcDecl.flags, ASTFlags.TypeReference) ?
                createConstructorTypeDeclaration(funcDecl, context) :
                createConstructSignatureDeclaration(funcDecl, context);
        }
        else if (hasFlag(funcDecl.fncFlags, FncFlags.CallMember)) {
            return createCallSignatureDeclaration(funcDecl, context);
        }
        else if (hasFlag(funcDecl.fncFlags, FncFlags.IndexerMember)) {
            return createIndexSignatureDeclaration(funcDecl, context);
        }
        else if (hasFlag(funcDecl.flags, ASTFlags.TypeReference)) {
            return createFunctionTypeDeclaration(funcDecl, context);
        }
        else if (hasFlag(funcDecl.fncFlags, FncFlags.Method) ||
                 hasFlag(funcDecl.fncFlags, FncFlags.ClassMethod)) {
            return createMemberFunctionDeclaration(funcDecl, context);
        }

        return createFunctionDeclaration(funcDecl, context);
    }

    export function preCollectDecls(ast: AST, parentAST: AST, walker: IAstWalker) {
        var context: DeclCollectionContext = walker.state;
        var go = false;

        if (ast.nodeType == NodeType.Script) {
            var script: Script = <Script>ast;
            var span = TextSpan.fromBounds(script.minChar, script.limChar);

            var decl = new PullDecl(context.scriptName, PullElementKind.Script, PullElementFlags.None, span, context.scriptName);

            context.pushParent(decl);

            go = true;
        }
        else if (ast.nodeType == NodeType.List) {
            go = true;
        }
        else if (ast.nodeType == NodeType.Block) {
            go = true;
        }
        else if (ast.nodeType == NodeType.ModuleDeclaration) {
            go = preCollectModuleDecls(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.ClassDeclaration) {
            go = preCollectClassDecls(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.InterfaceDeclaration) {
            go = preCollectInterfaceDecls(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.ArgDecl) {
            go = preCollectParameterDecl(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.VarDecl) {
            go = preCollectVarDecls(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.FuncDecl) {
            go = preCollectFuncDecls(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.ImportDeclaration) {
            go = preCollectImportDecls(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.TypeParameter) {
            go = preCollectTypeParameterDecl(ast, parentAST, context);
        }
        else if (ast.nodeType == NodeType.If) {
            go = true;
        }
        else if (ast.nodeType == NodeType.For) {
            go = true;
        }
        else if (ast.nodeType == NodeType.ForIn) {
            go = true;
        }
        else if (ast.nodeType == NodeType.While) {
            go = true;
        }
        else if (ast.nodeType == NodeType.DoWhile) {
            go = true;
        }
        else if (ast.nodeType == NodeType.Comma) {
            go = true;
        }
        else if (ast.nodeType == NodeType.Return) {
            // want to be able to bind lambdas in return positions
            go = true;
        }
        else if (ast.nodeType == NodeType.Switch || ast.nodeType == NodeType.Case) {
            go = true;
        }

            // call and 'new' expressions may contain lambdas with bindings...
        else if (ast.nodeType == NodeType.Call) {
            // want to be able to bind lambdas in return positions
            go = true;
        }
        else if (ast.nodeType == NodeType.New) {
            // want to be able to bind lambdas in return positions
            go = true;
        }

        walker.options.goChildren = go;

        return ast;
    }

    export function postCollectDecls(ast: AST, parentAST: AST, walker: IAstWalker) {
        var context: DeclCollectionContext = walker.state;
        var parentDecl: PullDecl;

        // Note that we never pop the Script - after the traversal, it should be the
        // one parent left in the context

        if (ast.nodeType == NodeType.ModuleDeclaration) {
            var thisModule = context.getParent();
            context.popParent();
            parentDecl = context.getParent();
            if (thisModule.getFlags() & PullElementFlags.InitializedModule) {
                if (parentDecl && parentDecl.getKind() == PullElementKind.Container) {
                    parentDecl.setFlags(parentDecl.getFlags() | PullElementFlags.InitializedModule);
                }

                // create the value decl
                var valueDecl = new PullDecl(thisModule.getName(), PullElementKind.Variable, thisModule.getFlags(), thisModule.getSpan(), context.scriptName);

                thisModule.setValueDecl(valueDecl);

                context.semanticInfo.setASTForDecl(valueDecl, ast);

                if (parentDecl) {
                    parentDecl.addChildDecl(valueDecl);
                    valueDecl.setParentDecl(parentDecl);
                }
            }
        }
        else if (ast.nodeType == NodeType.ClassDeclaration) {
            context.popParent();

            parentDecl = context.getParent();

            if (parentDecl && parentDecl.getKind() == PullElementKind.Container) {
                parentDecl.setFlags(parentDecl.getFlags() | PullElementFlags.InitializedModule);
            }
        }
        else if (ast.nodeType == NodeType.InterfaceDeclaration) {
            context.popParent();
        }
        else if (ast.nodeType == NodeType.FuncDecl) {
            context.popParent();

            parentDecl = context.getParent();

            if (parentDecl && parentDecl.getKind() == PullElementKind.Container) {
                parentDecl.setFlags(parentDecl.getFlags() | PullElementFlags.InitializedModule);
            }
        }
        else if (ast.nodeType == NodeType.VarDecl) { // PULLREVIEW: What if we just have a for loop in a module body?
            parentDecl = context.getParent();

            if (parentDecl && parentDecl.getKind() == PullElementKind.Container) {
                parentDecl.setFlags(parentDecl.getFlags() | PullElementFlags.InitializedModule);
            }
        }

        return ast;
    }
}