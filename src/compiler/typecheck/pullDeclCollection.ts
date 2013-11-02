// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\references.ts' />

module TypeScript {
    class DeclCollectionContext {
        public isDeclareFile = false;
        public parentChain: PullDecl[] = [];

        constructor(public semanticInfoChain: SemanticInfoChain, public propagateEnumConstants: boolean) {
        }

        public getParent() { return this.parentChain ? this.parentChain[this.parentChain.length - 1] : null; }

        public pushParent(parentDecl: PullDecl) { if (parentDecl) { this.parentChain[this.parentChain.length] = parentDecl; } }

        public popParent() { this.parentChain.length--; }
    }

    function containingModuleHasExportAssignment(ast: AST): boolean {
        ast = ast.parent;
        while (ast) {
            if (ast.nodeType() === NodeType.ModuleDeclaration) {
                var moduleDecl = <ModuleDeclaration>ast;
                return moduleDecl.moduleElements.any(m => m.nodeType() === NodeType.ExportAssignment);
            }

            ast = ast.parent;
        }

        return false;
    }

    function isParsingAmbientModule(ast: AST, context: DeclCollectionContext): boolean {
        ast = ast.parent;
        while (ast) {
            if (ast.nodeType() === NodeType.ModuleDeclaration) {
                if (hasModifier((<ModuleDeclaration>ast).modifiers, PullElementFlags.Ambient)) {
                    return true;
                }
            }

            ast = ast.parent;
        }

        return false;
    }

    function preCollectImportDecls(ast: AST, context: DeclCollectionContext): void {
        var importDecl = <ImportDeclaration>ast;
        var declFlags = PullElementFlags.None;
        var span = TextSpan.fromBounds(importDecl.start(), importDecl.end());

        var parent = context.getParent();

        if (hasModifier(importDecl.modifiers, PullElementFlags.Exported) && !containingModuleHasExportAssignment(ast)) {
            declFlags |= PullElementFlags.Exported;
        }

        var decl = new NormalPullDecl(importDecl.identifier.valueText(), importDecl.identifier.text(), PullElementKind.TypeAlias, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(ast, decl);
        context.semanticInfoChain.setASTForDecl(decl, ast);

        // Note: it is intentional that a import does not get added to hte context stack.  An
        // import does not introduce a new name scope, so it shouldn't be in the context decl stack.
        // context.pushParent(decl);
    }

    function preCollectScriptDecls(script: Script, context: DeclCollectionContext): void {
        var span = TextSpan.fromBounds(script.start(), script.end());

        var fileName = script.fileName();
        var decl = new RootPullDecl(
            /*name:*/ fileName, fileName, PullElementKind.Script, PullElementFlags.None, span, context.semanticInfoChain, script.isExternalModule);
        context.semanticInfoChain.setDeclForAST(script, decl);
        context.semanticInfoChain.setASTForDecl(decl, script);

        context.isDeclareFile = script.isDeclareFile();

        context.pushParent(decl);
    }

    function preCollectEnumDecls(enumDecl: EnumDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var enumName = enumDecl.identifier.valueText();
        var kind: PullElementKind = PullElementKind.Container;

        if ((hasModifier(enumDecl.modifiers, PullElementFlags.Exported) || isParsingAmbientModule(enumDecl, context)) && !containingModuleHasExportAssignment(enumDecl)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (hasModifier(enumDecl.modifiers, PullElementFlags.Ambient) || isParsingAmbientModule(enumDecl, context) || context.isDeclareFile) {
            declFlags |= PullElementFlags.Ambient;
        }

        // Consider an enum 'always initialized'.
        declFlags |= PullElementFlags.Enum;
        kind = PullElementKind.Enum;

        var span = TextSpan.fromBounds(enumDecl.start(), enumDecl.end());

        var enumDeclaration = new NormalPullDecl(enumName, enumDecl.identifier.text(), kind, declFlags, context.getParent(), span);
        context.semanticInfoChain.setDeclForAST(enumDecl, enumDeclaration);
        context.semanticInfoChain.setASTForDecl(enumDeclaration, enumDecl);

        var enumIndexerDecl = new NormalPullDecl("", "", PullElementKind.IndexSignature, PullElementFlags.Signature, enumDeclaration, span);
        var enumIndexerParameter = new NormalPullDecl("x", "x", PullElementKind.Parameter, PullElementFlags.None, enumIndexerDecl, span);

        // create the value decl
        var valueDecl = new NormalPullDecl(enumDeclaration.name, enumDeclaration.getDisplayName(), PullElementKind.Variable, enumDeclaration.flags, context.getParent(), enumDeclaration.getSpan());
        enumDeclaration.setValueDecl(valueDecl);
        context.semanticInfoChain.setASTForDecl(valueDecl, enumDecl);

        context.pushParent(enumDeclaration);
    }

    function createEnumElementDecls(propertyDecl: EnumElement, context: DeclCollectionContext): void {
        var parent = context.getParent();

        var span = TextSpan.fromBounds(propertyDecl.start(), propertyDecl.end());

        var decl = new PullEnumElementDecl(propertyDecl.propertyName.valueText(), propertyDecl.propertyName.text(), parent, span);
        context.semanticInfoChain.setDeclForAST(propertyDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, propertyDecl);

        // Note: it is intentional that a enum element does not get added to hte context stack.  An 
        // enum element does not introduce a new name scope, so it shouldn't be in the context decl stack.
        // context.pushParent(decl);
    }

    function preCollectModuleDecls(moduleDecl: ModuleDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var isDynamic = moduleDecl.stringLiteral !== null || moduleDecl.isExternalModule;

        if ((hasModifier(moduleDecl.modifiers, PullElementFlags.Exported) || isParsingAmbientModule(moduleDecl, context)) && !containingModuleHasExportAssignment(moduleDecl)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (hasModifier(moduleDecl.modifiers, PullElementFlags.Ambient) || isParsingAmbientModule(moduleDecl, context) || context.isDeclareFile) {
            declFlags |= PullElementFlags.Ambient;
        }

        var kind = isDynamic ? PullElementKind.DynamicModule : PullElementKind.Container;

        var span = TextSpan.fromBounds(moduleDecl.start(), moduleDecl.end());

        var valueText = moduleDecl.stringLiteral ? quoteStr(moduleDecl.stringLiteral.valueText()) : moduleDecl.name.valueText();
        var text = moduleDecl.stringLiteral ? moduleDecl.stringLiteral.text() : moduleDecl.name.text();

        var decl = new NormalPullDecl(valueText, text, kind, declFlags, context.getParent(), span);
        context.semanticInfoChain.setDeclForAST(moduleDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, moduleDecl);

        // If we contain any code that requires initialization, then mark us as an initialized.
        if (containsExecutableCode(moduleDecl.moduleElements)) {
            decl.setFlags(declFlags | getInitializationFlag(decl));

            // create the value decl
            var valueDecl = new NormalPullDecl(decl.name, decl.getDisplayName(), PullElementKind.Variable, decl.flags, context.getParent(), decl.getSpan());
            decl.setValueDecl(valueDecl);
            context.semanticInfoChain.setASTForDecl(valueDecl, moduleDecl);
        }

        context.pushParent(decl);
    }

    function containsExecutableCode(members: ASTList): boolean {
        for (var i = 0, n = members.childCount(); i < n; i++) {
            var member = members.childAt(i);

            // October 11, 2013
            // Internal modules are either instantiated or non-instantiated. A non-instantiated 
            // module is an internal module containing only interface types and other non - 
            // instantiated modules. 
            //
            // Note: small spec deviation.  We don't consider an import statement sufficient to
            // consider a module instantiated.  After all, if there is an import, but no actual
            // code that references the imported value, then there's no need to emit the import
            // or the module.
            if (member.nodeType() === NodeType.ModuleDeclaration) {
                var moduleDecl = <ModuleDeclaration>member;

                // If we have a module in us, and it contains executable code, then we
                // contain executable code.
                if (containsExecutableCode(moduleDecl.moduleElements)) {
                    return true;
                }
            }
            else if (member.nodeType() !== NodeType.InterfaceDeclaration && member.nodeType() !== NodeType.ImportDeclaration) {
                // If we contain anything that's not an interface declaration, then we contain
                // executable code.
                return true;
            }
        }

        return false;
    }

    function preCollectClassDecls(classDecl: ClassDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var constructorDeclKind = PullElementKind.Variable;

        if ((hasModifier(classDecl.modifiers, PullElementFlags.Exported) || isParsingAmbientModule(classDecl, context)) && !containingModuleHasExportAssignment(classDecl)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (hasModifier(classDecl.modifiers, PullElementFlags.Ambient) || isParsingAmbientModule(classDecl, context) || context.isDeclareFile) {
            declFlags |= PullElementFlags.Ambient;
        }

        var span = TextSpan.fromBounds(classDecl.start(), classDecl.end());
        var parent = context.getParent();

        var decl = new NormalPullDecl(classDecl.identifier.valueText(), classDecl.identifier.text(), PullElementKind.Class, declFlags, parent, span);

        var constructorDecl = new NormalPullDecl(classDecl.identifier.valueText(), classDecl.identifier.text(), constructorDeclKind, declFlags | PullElementFlags.ClassConstructorVariable, parent, span);

        decl.setValueDecl(constructorDecl);

        context.semanticInfoChain.setDeclForAST(classDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, classDecl);
        context.semanticInfoChain.setASTForDecl(constructorDecl, classDecl);

        context.pushParent(decl);
    }

    function preCollectObjectTypeDecls(objectType: ObjectType, context: DeclCollectionContext): void {
        // if this is the 'body' of an interface declaration, then we don't want to create a decl 
        // here.  We want the interface decl to be the parent decl of all the members we visit.
        if (objectType.parent.nodeType() === NodeType.InterfaceDeclaration) {
            return;
        }

        var declFlags = PullElementFlags.None;

        var span = TextSpan.fromBounds(objectType.start(), objectType.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl("", "", PullElementKind.ObjectType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(objectType, decl);
        context.semanticInfoChain.setASTForDecl(decl, objectType);

        context.pushParent(decl);
    }

    function preCollectInterfaceDecls(interfaceDecl: InterfaceDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;

        if ((hasModifier(interfaceDecl.modifiers, PullElementFlags.Exported) || isParsingAmbientModule(interfaceDecl, context)) && !containingModuleHasExportAssignment(interfaceDecl)) {
            declFlags |= PullElementFlags.Exported;
        }

        var span = TextSpan.fromBounds(interfaceDecl.start(), interfaceDecl.end());
        var parent = context.getParent();

        var decl = new NormalPullDecl(interfaceDecl.identifier.valueText(), interfaceDecl.identifier.text(), PullElementKind.Interface, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(interfaceDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, interfaceDecl);

        context.pushParent(decl);
    }

    function preCollectParameterDecl(argDecl: Parameter, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;

        if (hasModifier(argDecl.modifiers, PullElementFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        if (argDecl.questionToken !== null || argDecl.equalsValueClause !== null || argDecl.dotDotDotToken !== null) {
            declFlags |= PullElementFlags.Optional;
        }

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var span = TextSpan.fromBounds(argDecl.start(), argDecl.end());

        var decl = new NormalPullDecl(argDecl.identifier.valueText(), argDecl.identifier.text(), PullElementKind.Parameter, declFlags, parent, span);

        // If it has a default arg, record the fact that the parent has default args (we will need this during resolution)
        if (argDecl.equalsValueClause) {
            parent.flags |= PullElementFlags.HasDefaultArgs;
        }

        if (parent.kind == PullElementKind.ConstructorMethod) {
            decl.setFlag(PullElementFlags.ConstructorParameter);
        }

        // if it's a property type, we'll need to add it to the parent's parent as well
        var isPublicOrPrivate = hasModifier(argDecl.modifiers, PullElementFlags.Public | PullElementFlags.Private);
        var isInConstructor = parent.kind === PullElementKind.ConstructorMethod;
        if (isPublicOrPrivate && isInConstructor) {
            var parentsParent = context.parentChain[context.parentChain.length - 2];
            var propDecl = new NormalPullDecl(argDecl.identifier.valueText(), argDecl.identifier.text(), PullElementKind.Property, declFlags, parentsParent, span);
            propDecl.setValueDecl(decl);
            decl.setFlag(PullElementFlags.PropertyParameter);
            propDecl.setFlag(PullElementFlags.PropertyParameter);

            if (parent.kind == PullElementKind.ConstructorMethod) {
                propDecl.setFlag(PullElementFlags.ConstructorParameter);
            }

            context.semanticInfoChain.setASTForDecl(decl, argDecl);
            context.semanticInfoChain.setASTForDecl(propDecl, argDecl);
            context.semanticInfoChain.setDeclForAST(argDecl, propDecl);
        }
        else {
            context.semanticInfoChain.setASTForDecl(decl, argDecl);
            context.semanticInfoChain.setDeclForAST(argDecl, decl);
        }

        // Record this decl in its parent in the declGroup with the corresponding name
        parent.addVariableDeclToGroup(decl);
        
        // Note: it is intentional that a parameter does not get added to hte context stack.  A 
        // parameter does not introduce a new name scope, so it shouldn't be in the context decl stack.
        // context.pushParent(decl);
    }

    function preCollectTypeParameterDecl(typeParameterDecl: TypeParameter, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;

        var span = TextSpan.fromBounds(typeParameterDecl.start(), typeParameterDecl.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl(typeParameterDecl.identifier.valueText(), typeParameterDecl.identifier.text(), PullElementKind.TypeParameter, declFlags, parent, span);
        context.semanticInfoChain.setASTForDecl(decl, typeParameterDecl);
        context.semanticInfoChain.setDeclForAST(typeParameterDecl, decl);

        // Note: it is intentional that a type parameter does not get added to hte context stack.
        // A type parameter does not introduce a new name scope, so it shouldn't be in the 
        // context decl stack.
        // context.pushParent(decl);
    }

    // interface properties
    function createPropertySignature(propertyDecl: PropertySignature, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.Public;
        var parent = context.getParent();
        var declType = PullElementKind.Property;

        if (propertyDecl.questionToken !== null) {
            declFlags |= PullElementFlags.Optional;
        }

        var span = TextSpan.fromBounds(propertyDecl.start(), propertyDecl.end());

        var decl = new NormalPullDecl(propertyDecl.propertyName.valueText(), propertyDecl.propertyName.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(propertyDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, propertyDecl);

        // Note: it is intentional that a var decl does not get added to hte context stack.  A var
        // decl does not introduce a new name scope, so it shouldn't be in the context decl stack.
        // context.pushParent(decl);
    }

    // class member variables
    function createMemberVariableDeclaration(memberDecl: MemberVariableDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Property;

        if (hasModifier(memberDecl.modifiers, PullElementFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        if (hasModifier(memberDecl.modifiers, PullElementFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        var span = TextSpan.fromBounds(memberDecl.start(), memberDecl.end());
        var parent = context.getParent();

        var decl = new NormalPullDecl(memberDecl.variableDeclarator.identifier.valueText(), memberDecl.variableDeclarator.identifier.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(memberDecl, decl);
        context.semanticInfoChain.setDeclForAST(memberDecl.variableDeclarator, decl);
        context.semanticInfoChain.setASTForDecl(decl, memberDecl);

        // Note: it is intentional that a var decl does not get added to hte context stack.  A var
        // decl does not introduce a new name scope, so it shouldn't be in the context decl stack.
        // context.pushParent(decl);
    }

    function createVariableDeclaration(varDecl: VariableDeclarator, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Variable;

        var modifiers = getVariableDeclaratorModifiers(varDecl);
        if ((hasModifier(modifiers, PullElementFlags.Exported) || isParsingAmbientModule(varDecl, context)) && !containingModuleHasExportAssignment(varDecl)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (hasModifier(modifiers, PullElementFlags.Ambient) || isParsingAmbientModule(varDecl, context) || context.isDeclareFile) {
            declFlags |= PullElementFlags.Ambient;
        }

        var span = TextSpan.fromBounds(varDecl.start(), varDecl.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl(varDecl.identifier.valueText(), varDecl.identifier.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(varDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, varDecl);

        if (parent) {
            // Record this decl in its parent in the declGroup with the corresponding name
            parent.addVariableDeclToGroup(decl);
        }

        // Note: it is intentional that a var decl does not get added to hte context stack.  A var
        // decl does not introduce a new name scope, so it shouldn't be in the context decl stack.
        // context.pushParent(decl);
    }

    function preCollectVarDecls(ast: AST, context: DeclCollectionContext): void {
        if (ast.parent.nodeType() === NodeType.MemberVariableDeclaration) {
            // Already handled this node.
            return;
        }

        var varDecl = <VariableDeclarator>ast;
        createVariableDeclaration(varDecl, context);
    }

    // function type expressions
    function createFunctionTypeDeclaration(functionTypeDeclAST: FunctionType, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.Signature;
        var declType = PullElementKind.FunctionType;

        var span = TextSpan.fromBounds(functionTypeDeclAST.start(), functionTypeDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl("", "", declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(functionTypeDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, functionTypeDeclAST);

        context.pushParent(decl);
    }

    // constructor types
    function createConstructorTypeDeclaration(constructorTypeDeclAST: ConstructorType, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.ConstructorType;

        var span = TextSpan.fromBounds(constructorTypeDeclAST.start(), constructorTypeDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl("", "", declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(constructorTypeDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, constructorTypeDeclAST);

        context.pushParent(decl);
    }

    // function declaration
    function createFunctionDeclaration(funcDeclAST: FunctionDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Function;

        if ((hasModifier(funcDeclAST.modifiers, PullElementFlags.Exported) || isParsingAmbientModule(funcDeclAST, context)) && !containingModuleHasExportAssignment(funcDeclAST)) {
            declFlags |= PullElementFlags.Exported;
        }

        if (hasModifier(funcDeclAST.modifiers, PullElementFlags.Ambient) || isParsingAmbientModule(funcDeclAST, context) || context.isDeclareFile) {
            declFlags |= PullElementFlags.Ambient;
        }

        if (!funcDeclAST.block) {
            declFlags |= PullElementFlags.Signature;
        }

        var span = TextSpan.fromBounds(funcDeclAST.start(), funcDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl(funcDeclAST.identifier.valueText(), funcDeclAST.identifier.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(funcDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, funcDeclAST);

        context.pushParent(decl);
    }

    // function expression
    function createAnyFunctionExpressionDeclaration(
        functionExpressionDeclAST: AST,
        id: Identifier,
        context: DeclCollectionContext,
        displayName: Identifier = null): void {

        var declFlags = PullElementFlags.None;

        if (functionExpressionDeclAST.nodeType() === NodeType.SimpleArrowFunctionExpression ||
            functionExpressionDeclAST.nodeType() === NodeType.ParenthesizedArrowFunctionExpression) {
            declFlags |= PullElementFlags.ArrowFunction;
        }

        var span = TextSpan.fromBounds(functionExpressionDeclAST.start(), functionExpressionDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var name = id ? id.text() : "";
        var displayNameText = displayName ? displayName.text() : "";
        var decl: PullDecl = new PullFunctionExpressionDecl(name, declFlags, parent, span, displayNameText);
        context.semanticInfoChain.setDeclForAST(functionExpressionDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, functionExpressionDeclAST);

        context.pushParent(decl);

        if (functionExpressionDeclAST.nodeType() === NodeType.SimpleArrowFunctionExpression) {
            var simpleArrow = <SimpleArrowFunctionExpression>functionExpressionDeclAST;
            var declFlags = PullElementFlags.Public;

            var parent = context.getParent();

            if (hasFlag(parent.flags, PullElementFlags.DeclaredInAWithBlock)) {
                declFlags |= PullElementFlags.DeclaredInAWithBlock;
            }

            var span = TextSpan.fromBounds(simpleArrow.identifier.start(), simpleArrow.identifier.end());

            var decl: PullDecl = new NormalPullDecl(simpleArrow.identifier.valueText(), simpleArrow.identifier.text(), PullElementKind.Parameter, declFlags, parent, span);

            context.semanticInfoChain.setASTForDecl(decl, simpleArrow.identifier);
            context.semanticInfoChain.setDeclForAST(simpleArrow.identifier, decl);

            // Record this decl in its parent in the declGroup with the corresponding name
            parent.addVariableDeclToGroup(decl);
        }
    }

    function createMemberFunctionDeclaration(funcDecl: MemberFunctionDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Method;

        if (hasModifier(funcDecl.modifiers, PullElementFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        if (hasModifier(funcDecl.modifiers, PullElementFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        if (!funcDecl.block) {
            declFlags |= PullElementFlags.Signature;
        }

        var span = TextSpan.fromBounds(funcDecl.start(), funcDecl.end());
        var parent = context.getParent();

        var decl = new NormalPullDecl(funcDecl.propertyName.valueText(), funcDecl.propertyName.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(funcDecl, decl);
        context.semanticInfoChain.setASTForDecl(decl, funcDecl);

        context.pushParent(decl);
    }

    // index signatures
    function createIndexSignatureDeclaration(indexSignatureDeclAST: IndexSignature, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.Signature;
        var declType = PullElementKind.IndexSignature;

        var span = TextSpan.fromBounds(indexSignatureDeclAST.start(), indexSignatureDeclAST.end());

        var parent = context.getParent();

        var decl = new NormalPullDecl("", "" , declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(indexSignatureDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, indexSignatureDeclAST);

        context.pushParent(decl);
    }

    // call signatures
    function createCallSignatureDeclaration(callSignature: CallSignature, context: DeclCollectionContext): void {
        var isChildOfObjectType = callSignature.parent && callSignature.parent.parent &&
            callSignature.parent.nodeType() === NodeType.SeparatedList &&
            callSignature.parent.parent.nodeType() === NodeType.ObjectType;

        if (!isChildOfObjectType) {
            // This was a call signature that was part of some other entity (like a function 
            // declaration or construct signature).  Those are already handled specially and
            // we don't want to end up making another call signature for them.  We only want
            // to make an actual call signature if we're a standalone call signature in an 
            // object/interface type.
            return;
        }

        var declFlags = PullElementFlags.Signature;
        var declType = PullElementKind.CallSignature;

        var span = TextSpan.fromBounds(callSignature.start(), callSignature.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl("", "", declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(callSignature, decl);
        context.semanticInfoChain.setASTForDecl(decl, callSignature);

        context.pushParent(decl);
    }

    function createMethodSignatureDeclaration(method: MethodSignature, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.Method;

        declFlags |= PullElementFlags.Public;
        declFlags |= PullElementFlags.Signature;

        if (method.questionToken !== null) {
            declFlags |= PullElementFlags.Optional;
        }

        var span = TextSpan.fromBounds(method.start(), method.end());
        var parent = context.getParent();

        var decl = new NormalPullDecl(method.propertyName.valueText(), method.propertyName.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(method, decl);
        context.semanticInfoChain.setASTForDecl(decl, method);

        context.pushParent(decl);
    }

    // construct signatures
    function createConstructSignatureDeclaration(constructSignatureDeclAST: ConstructSignature, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.Signature;
        var declType = PullElementKind.ConstructSignature;

        var span = TextSpan.fromBounds(constructSignatureDeclAST.start(), constructSignatureDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl("", "", declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(constructSignatureDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, constructSignatureDeclAST);

        context.pushParent(decl);
    }

    // class constructors
    function createClassConstructorDeclaration(constructorDeclAST: ConstructorDeclaration, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.ConstructorMethod;

        if (!constructorDeclAST.block) {
            declFlags |= PullElementFlags.Signature;
        }

        var span = TextSpan.fromBounds(constructorDeclAST.start(), constructorDeclAST.end());

        var parent = context.getParent();

        if (parent) {
            // if the parent is exported, the constructor decl must be as well
            var parentFlags = parent.flags;

            if (parentFlags & PullElementFlags.Exported) {
                declFlags |= PullElementFlags.Exported;
            }
        }

        var decl = new NormalPullDecl(parent.name, parent.getDisplayName(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(constructorDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, constructorDeclAST);

        context.pushParent(decl);
    }

    function createGetAccessorDeclaration(getAccessorDeclAST: GetAccessor, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.Public;
        var declType = PullElementKind.GetAccessor;

        if (hasModifier(getAccessorDeclAST.modifiers, PullElementFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        if (hasModifier(getAccessorDeclAST.modifiers, PullElementFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        var span = TextSpan.fromBounds(getAccessorDeclAST.start(), getAccessorDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl(getAccessorDeclAST.propertyName.valueText(), getAccessorDeclAST.propertyName.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(getAccessorDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, getAccessorDeclAST);

        context.pushParent(decl);
    }

    function createFunctionExpressionDeclaration(expression: FunctionExpression, context: DeclCollectionContext): void {
        createAnyFunctionExpressionDeclaration(expression, expression.identifier, context);
    }

    function createSetAccessorDeclaration(setAccessorDeclAST: SetAccessor, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.Public;
        var declType = PullElementKind.SetAccessor;

        if (hasModifier(setAccessorDeclAST.modifiers, PullElementFlags.Static)) {
            declFlags |= PullElementFlags.Static;
        }

        if (hasModifier(setAccessorDeclAST.modifiers, PullElementFlags.Private)) {
            declFlags |= PullElementFlags.Private;
        }
        else {
            declFlags |= PullElementFlags.Public;
        }

        var span = TextSpan.fromBounds(setAccessorDeclAST.start(), setAccessorDeclAST.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl(setAccessorDeclAST.propertyName.valueText(), setAccessorDeclAST.propertyName.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(setAccessorDeclAST, decl);
        context.semanticInfoChain.setASTForDecl(decl, setAccessorDeclAST);

        context.pushParent(decl);
    }

    function preCollectCatchDecls(ast: CatchClause, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.CatchBlock;

        var span = TextSpan.fromBounds(ast.start(), ast.end());

        var parent = context.getParent();

        if (parent && (parent.kind === PullElementKind.WithBlock || (parent.flags & PullElementFlags.DeclaredInAWithBlock))) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl("", "", declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(ast, decl);
        context.semanticInfoChain.setASTForDecl(decl, ast);

        context.pushParent(decl);

        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.CatchVariable;

        // Create a decl for the catch clause variable.
        var span = TextSpan.fromBounds(ast.identifier.start(), ast.identifier.end());

        var parent = context.getParent();

        if (hasFlag(parent.flags, PullElementFlags.DeclaredInAWithBlock)) {
            declFlags |= PullElementFlags.DeclaredInAWithBlock;
        }

        var decl = new NormalPullDecl(ast.identifier.valueText(), ast.identifier.text(), declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(ast.identifier, decl);
        context.semanticInfoChain.setASTForDecl(decl, ast.identifier);

        if (parent) {
            // Record this decl in its parent in the declGroup with the corresponding name
            parent.addVariableDeclToGroup(decl);
        }
    }

    function preCollectWithDecls(ast: AST, context: DeclCollectionContext): void {
        var declFlags = PullElementFlags.None;
        var declType = PullElementKind.WithBlock;

        var span = TextSpan.fromBounds(ast.start(), ast.end());

        var parent = context.getParent();

        var decl = new NormalPullDecl("", "", declType, declFlags, parent, span);
        context.semanticInfoChain.setDeclForAST(ast, decl);
        context.semanticInfoChain.setASTForDecl(decl, ast);

        context.pushParent(decl);
    }

    function preCollectObjectLiteralDecls(ast: AST, context: DeclCollectionContext): void {
        var span = TextSpan.fromBounds(ast.start(), ast.end());
        var decl = new NormalPullDecl(
            "", "", PullElementKind.ObjectLiteral, PullElementFlags.None, context.getParent(), span);

        context.semanticInfoChain.setDeclForAST(ast, decl);
        context.semanticInfoChain.setASTForDecl(decl, ast);

        context.pushParent(decl);
    }

    function preCollectSimplePropertyAssignmentDecls(propertyAssignment: SimplePropertyAssignment, context: DeclCollectionContext): void {
        var assignmentText = getPropertyAssignmentNameTextFromIdentifier(propertyAssignment.propertyName);
        var span = TextSpan.fromBounds(propertyAssignment.start(), propertyAssignment.end());

        var decl = new NormalPullDecl(assignmentText.memberName, assignmentText.actualText, PullElementKind.Property, PullElementFlags.Public, context.getParent(), span);

        context.semanticInfoChain.setDeclForAST(propertyAssignment, decl);
        context.semanticInfoChain.setASTForDecl(decl, propertyAssignment);

        // Note: it is intentional that a property assignment does not get added to hte context 
        // stack.  A prop assignment does not introduce a new name scope, so it shouldn't be in
        // the context decl stack.
        // context.pushParent(decl);
    }

    function preCollectFunctionPropertyAssignmentDecls(propertyAssignment: FunctionPropertyAssignment, context: DeclCollectionContext): void {
        var assignmentText = getPropertyAssignmentNameTextFromIdentifier(propertyAssignment.propertyName);
        var span = TextSpan.fromBounds(propertyAssignment.start(), propertyAssignment.end());

        var decl = new NormalPullDecl(assignmentText.memberName, assignmentText.actualText, PullElementKind.Property, PullElementFlags.Public, context.getParent(), span);

        context.semanticInfoChain.setDeclForAST(propertyAssignment, decl);
        context.semanticInfoChain.setASTForDecl(decl, propertyAssignment);

        createAnyFunctionExpressionDeclaration(
            propertyAssignment, propertyAssignment.propertyName, context, propertyAssignment.propertyName);
    }

    function preCollectDecls(ast: AST, context: DeclCollectionContext) {
        switch (ast.nodeType()) {
            case NodeType.Script:
                preCollectScriptDecls(<Script>ast, context);
                break;
            case NodeType.EnumDeclaration:
                preCollectEnumDecls(<EnumDeclaration>ast, context);
                break;
            case NodeType.EnumElement:
                createEnumElementDecls(<EnumElement>ast, context);
                break;
            case NodeType.ModuleDeclaration:
                preCollectModuleDecls(<ModuleDeclaration>ast, context);
                break;
            case NodeType.ClassDeclaration:
                preCollectClassDecls(<ClassDeclaration>ast, context);
                break;
            case NodeType.InterfaceDeclaration:
                preCollectInterfaceDecls(<InterfaceDeclaration>ast, context);
                break;
            case NodeType.ObjectType:
                preCollectObjectTypeDecls(<ObjectType>ast, context);
                break;
            case NodeType.Parameter:
                preCollectParameterDecl(<Parameter>ast, context);
                break;
            case NodeType.MemberVariableDeclaration:
                createMemberVariableDeclaration(<MemberVariableDeclaration>ast, context);
                break;
            case NodeType.PropertySignature:
                createPropertySignature(<PropertySignature>ast, context);
                break;
            case NodeType.VariableDeclarator:
                preCollectVarDecls(ast, context);
                break;
            case NodeType.ConstructorDeclaration:
                createClassConstructorDeclaration(<ConstructorDeclaration>ast, context);
                break;
            case NodeType.GetAccessor:
                createGetAccessorDeclaration(<GetAccessor>ast, context);
                break;
            case NodeType.SetAccessor:
                createSetAccessorDeclaration(<SetAccessor>ast, context);
                break;
            case NodeType.FunctionExpression:
                createFunctionExpressionDeclaration(<FunctionExpression>ast, context);
                break;
            case NodeType.MemberFunctionDeclaration:
                createMemberFunctionDeclaration(<MemberFunctionDeclaration>ast, context);
                break;
            case NodeType.IndexSignature:
                createIndexSignatureDeclaration(<IndexSignature>ast, context);
                break;
            case NodeType.FunctionType:
                createFunctionTypeDeclaration(<FunctionType>ast, context);
                break;
            case NodeType.ConstructorType:
                createConstructorTypeDeclaration(<ConstructorType>ast, context);
                break;
            case NodeType.CallSignature:
                createCallSignatureDeclaration(<CallSignature>ast, context);
                break;
            case NodeType.ConstructSignature:
                createConstructSignatureDeclaration(<ConstructSignature>ast, context);
                break;
            case NodeType.MethodSignature:
                createMethodSignatureDeclaration(<MethodSignature>ast, context);
                break;
            case NodeType.FunctionDeclaration:
                createFunctionDeclaration(<FunctionDeclaration>ast, context);
                break;
            case NodeType.SimpleArrowFunctionExpression:
            case NodeType.ParenthesizedArrowFunctionExpression:
                createAnyFunctionExpressionDeclaration(ast, /*id*/null, context);
                break;
            case NodeType.ImportDeclaration:
                preCollectImportDecls(ast, context);
                break;
            case NodeType.TypeParameter:
                preCollectTypeParameterDecl(<TypeParameter>ast, context);
                break;
            case NodeType.CatchClause:
                preCollectCatchDecls(<CatchClause>ast, context);
                break;
            case NodeType.WithStatement:
                preCollectWithDecls(ast, context);
                break;
            case NodeType.ObjectLiteralExpression:
                preCollectObjectLiteralDecls(ast, context);
                break;
            case NodeType.SimplePropertyAssignment:
                preCollectSimplePropertyAssignmentDecls(<SimplePropertyAssignment>ast, context);
                break;
            case NodeType.FunctionPropertyAssignment:
                preCollectFunctionPropertyAssignmentDecls(<FunctionPropertyAssignment>ast, context);
                break;
        }
    }

    function isContainer(decl: PullDecl): boolean {
        return decl.kind === PullElementKind.Container || decl.kind === PullElementKind.DynamicModule || decl.kind === PullElementKind.Enum;
    }

    function getInitializationFlag(decl: PullDecl): PullElementFlags {
        if (decl.kind & PullElementKind.Container) {
            return PullElementFlags.InitializedModule;
        }
        else if (decl.kind & PullElementKind.DynamicModule) {
            return PullElementFlags.InitializedDynamicModule;
        }

        return PullElementFlags.None;
    }

    function hasInitializationFlag(decl: PullDecl): boolean {
        var kind = decl.kind;

        if (kind & PullElementKind.Container) {
            return (decl.flags & PullElementFlags.InitializedModule) !== 0;
        }
        else if (kind & PullElementKind.DynamicModule) {
            return (decl.flags & PullElementFlags.InitializedDynamicModule) !== 0;
        }

        return false;
    }

    function postCollectDecls(ast: AST, context: DeclCollectionContext) {
        var currentDecl = context.getParent();

        if (ast.nodeType() === NodeType.EnumDeclaration) {
            // Now that we've created all the child decls for the enum elements, determine what 
            // (if any) their constant values should be.
            computeEnumElementConstantValues(<EnumDeclaration>ast, currentDecl, context);
        }

        // Don't pop the topmost decl.  We return that out at the end.
        if (ast.nodeType() !== NodeType.Script && currentDecl.ast() === ast) {
            context.popParent();
        }
    }

    function computeEnumElementConstantValues(ast: EnumDeclaration, enumDecl: PullDecl, context: DeclCollectionContext): void {
        Debug.assert(enumDecl.kind === PullElementKind.Enum);

        // If this is a non ambient enum, then it starts with a constant section of enum elements.
        // Thus, elements without an initializer in these sections will be assumed to have a 
        // constant value.
        //
        // However, if this an enum in an ambient context, then non initialized elements are 
        // thought to have a computed value and are not in a constant section.
        var isAmbientEnum = hasFlag(enumDecl.flags, PullElementFlags.Ambient);
        var inConstantSection = !isAmbientEnum;
        var currentConstantValue = 0;
        var enumMemberDecls = <PullEnumElementDecl[]>enumDecl.getChildDecls();

        for (var i = 0, n = ast.enumElements.nonSeparatorCount(); i < n; i++) {
            var enumElement = <EnumElement>ast.enumElements.nonSeparatorAt(i);
            var enumElementDecl = ArrayUtilities.first(enumMemberDecls, d =>
                context.semanticInfoChain.getASTForDecl(d) === enumElement);

            Debug.assert(enumElementDecl.kind === PullElementKind.EnumMember);

            if (enumElement.equalsValueClause === null) {
                // Didn't have an initializer.  If we're in a constant section, then this appears
                // to have the value of the current constant.  If we're in a non-constant section
                // then this gets no value.
                if (inConstantSection) {
                    enumElementDecl.constantValue = currentConstantValue;
                    currentConstantValue++;
                }
            }
            else {
                // Enum element had an initializer.  If it's a constant, then then enum gets that 
                // value, and we transition to (or stay in) a constant section (as long as we're
                // not in an ambient context.
                //
                // If it's not a constant, then we transition to a non-constant section.
                enumElementDecl.constantValue = computeEnumElementConstantValue(enumElement.equalsValueClause.value, enumMemberDecls, context);
                if (enumElementDecl.constantValue !== null && !isAmbientEnum) {
                    // This enum element had a constant value.  We're now in a constant section.
                    // Any successive enum elements should get their values from this constant
                    // value onwards.
                    inConstantSection = true;
                    currentConstantValue = enumElementDecl.constantValue + 1;
                }
                else {
                    // Didn't get a constant value.  We're not in a constant section.
                    inConstantSection = false;
                }
            }

            Debug.assert(enumElementDecl.constantValue !== undefined);
        }
    }

    function computeEnumElementConstantValue(expression: AST, enumMemberDecls: PullEnumElementDecl[], context: DeclCollectionContext): number {
        Debug.assert(expression);

        if (isIntegerLiteralAST(expression)) {
            // Always produce a value for an integer literal.
            var token: NumericLiteral;
            switch (expression.nodeType()) {
                case NodeType.PlusExpression:
                case NodeType.NegateExpression:
                    token = <NumericLiteral>(<PrefixUnaryExpression>expression).operand;
                    break;
                default:
                    token = <NumericLiteral>expression;
            }

            var value = token.value();
            return value && expression.nodeType() === NodeType.NegateExpression ? -value : value;
        }
        else if (context.propagateEnumConstants) {
            // It wasn't a numeric literal.  However, the experimental switch to be more aggressive
            // about propogating enum constants is enabled.  See if we can still figure out the
            // constant value for this enum element.
            switch (expression.nodeType()) {
                case NodeType.Name:
                    // If it's a name, see if we already had an enum value named this.  If so,
                    // return that value.  Note, only search backward in the enum for a match.
                    var name = <Identifier>expression;
                    var matchingEnumElement = ArrayUtilities.firstOrDefault(enumMemberDecls, d => d.name === name.valueText());

                    return matchingEnumElement ? matchingEnumElement.constantValue : null;

                case NodeType.LeftShiftExpression:
                    // Handle the common case of a left shifted value.
                    var binaryExpression = <BinaryExpression>expression;
                    var left = computeEnumElementConstantValue(binaryExpression.left, enumMemberDecls, context);
                    var right = computeEnumElementConstantValue(binaryExpression.right, enumMemberDecls, context);
                    if (left === null || right === null) {
                        return null;
                    }

                    return left << right;

                case NodeType.BitwiseOrExpression:
                    // Handle the common case of an or'ed value.
                    var binaryExpression = <BinaryExpression>expression;
                    var left = computeEnumElementConstantValue(binaryExpression.left, enumMemberDecls, context);
                    var right = computeEnumElementConstantValue(binaryExpression.right, enumMemberDecls, context);
                    if (left === null || right === null) {
                        return null;
                    }

                    return left | right;
            }

            // TODO: add more cases.
            return null;
        }
        else {
            // Wasn't an integer literal, and we're not aggressively propagating constants.
            // There is no constant value for this expression.
            return null;
        }
    }

    export module DeclarationCreator {
        export function create(script: Script, semanticInfoChain: SemanticInfoChain, compilationSettings: ImmutableCompilationSettings): PullDecl {
            var declCollectionContext = new DeclCollectionContext(semanticInfoChain, compilationSettings.propagateEnumConstants());
            
            // create decls
            getAstWalkerFactory().simpleWalk(script, preCollectDecls, postCollectDecls, declCollectionContext);

            return declCollectionContext.getParent();
        }
    }
}