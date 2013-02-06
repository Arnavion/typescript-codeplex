// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\typescript.ts' />

module TypeScript {

    export function preBindImportPullSymbols(importDecl: PullDecl, context: PullSymbolBindingContext) {
        //var importDecl = <ImportDecl>ast;
        //var isExported = hasFlag(importDecl.varFlags, VarFlags.Exported);
        //var declFlags = isExported ? PullElementFlags.Exported : PullElementFlags.None;
        //var span = new ASTSpan();
        //span.minChar = importDecl.minChar;
        //span.limChar = importDecl.limChar;

        //var decl = new PullDecl(importDecl.id.actualText, DeclType.ImportDecl, declFlags, span, context.scriptName);
        //context.getParent().addChildDecl(decl);

        return false;
    }

    export function bindModulePullSymbol(moduleDecl: PullDecl, context: PullSymbolBindingContext) {

        // 1. Test for existing decl - if it exists, use its symbol
        // 2. If no other decl exists, create a new symbol and use that one
        
        var modName = moduleDecl.getName();
        var moduleSymbol: PullTypeSymbol = <PullTypeSymbol>findSymbolInContext(modName, PullElementKind.Module, context, []);
        var createdNewSymbol = false;

        if (!moduleSymbol) {
            var declKind = moduleDecl.getDeclFlags() & PullElementFlags.Enum ? PullElementKind.Enum : PullElementKind.Module;
            var moduleSymbol = new PullTypeSymbol(modName, declKind);
            createdNewSymbol = true;
        }

        if (moduleDecl) {
            moduleSymbol.addDeclaration(moduleDecl);
            moduleDecl.setSymbol(moduleSymbol);            
        }

        //context.semanticInfo.setSymbolForDecl(moduleDecl, moduleSymbol);
        
        if (createdNewSymbol) {
            var parent = context.getParent();

            if (parent) {
                var linkKind = moduleDecl.getDeclFlags() & PullElementFlags.Exported ? SymbolLinkKind.PublicMember : SymbolLinkKind.PrivateMember;

                if (linkKind == SymbolLinkKind.PublicMember) {
                    parent.addMember(moduleSymbol, linkKind);
                }
                else {
                    moduleSymbol.addOutgoingLink(parent, SymbolLinkKind.ContainedBy);
                }
            }
        }
        else if (context.reBindingAfterChange) {
            // clear out the old decls...
            var decls = moduleSymbol.getDeclarations();
            var scriptName = moduleDecl.getScriptName();

            for (var i = 0; i < decls.length; i++) {
                if (decls[i].getScriptName() == scriptName && decls[i].getDeclID() < context.startingDeclForRebind) {
                    moduleSymbol.removeDeclaration(decls[i]);
                }
            }
        }

        context.pushParent(moduleSymbol);

        var childDecls = moduleDecl.getChildDecls();

        for (var i = 0; i < childDecls.length; i++) {
            bindDeclSymbol(childDecls[i], context);
        }

        context.popParent();
    }

    export function bindClassPullSymbol(classDecl: PullDecl, context: PullSymbolBindingContext) {

        var className = classDecl.getName();
        var classSymbol: PullClassSymbol = null;
        var instanceSymbol: PullTypeSymbol = null;
        var parentHadSymbol = false;

        var parent = context.getParent();

        if (context.reBindingAfterChange && parent) {
            // see if the parent already has a symbol for this class
            var members = parent.getMembers();
            var member: PullSymbol = null;

            for (var i = 0 ; i < members.length; i++) {
                member = members[i];

                if (member.getName() == className && member.getKind() == PullElementKind.Class) {
                    parentHadSymbol = true;
                    classSymbol = <PullClassSymbol>member;
                    instanceSymbol = classSymbol.getInstanceType();

                    // prune out-of-date decls
                    var decls = classSymbol.getDeclarations();
                    var scriptName = classDecl.getScriptName();

                    for (var j = 0; j < decls.length; j++) {
                        if (decls[j].getScriptName() == scriptName && decls[j].getDeclID() < context.startingDeclForRebind) {
                            classSymbol.removeDeclaration(decls[j]);
                        }
                    }

                    decls = instanceSymbol.getDeclarations();

                    for (var j = 0; j < decls.length; j++) {
                        if (decls[j].getScriptName() == scriptName && decls[j].getDeclID() < context.startingDeclForRebind) {
                            instanceSymbol.removeDeclaration(decls[j]);
                        }
                    }

                    break;
                }
            }
        }

        if (!parentHadSymbol) {
            classSymbol = new PullClassSymbol(className);
            instanceSymbol = new PullClassInstanceSymbol(className, classSymbol);
            classSymbol.setInstanceType(instanceSymbol);
        }        
        
        classSymbol.addDeclaration(classDecl);
        instanceSymbol.addDeclaration(classDecl);

        classDecl.setSymbol(classSymbol);

        //context.semanticInfo.setSymbolForDecl(classDecl, classSymbol);

        
        if (parent && !parentHadSymbol) {
            var linkKind = classDecl.getDeclFlags() & PullElementFlags.Exported ? SymbolLinkKind.PublicMember : SymbolLinkKind.PrivateMember;

            if (linkKind == SymbolLinkKind.PublicMember) {
                parent.addMember(classSymbol, linkKind);
            }
            else {
                classSymbol.addOutgoingLink(parent, SymbolLinkKind.ContainedBy);
            }
        }

        // PULLTODO: For now, remove stale signatures from the function type, but we want to be smarter about this when
        // incremental parsing comes online
        if (parentHadSymbol) {
            var callSigs = classSymbol.getCallSignatures();
            var constructSigs = classSymbol.getConstructSignatures();
            var indexSigs = classSymbol.getIndexSignatures();

            for (var i = 0; i < callSigs.length; i++) {
                classSymbol.removeCallSignature(callSigs[i], false);
            }
            for (var i = 0; i < constructSigs.length; i++) {
                classSymbol.removeConstructSignature(constructSigs[i], false);
            }
            for (var i = 0; i < indexSigs.length; i++) {
                classSymbol.removeIndexSignature(indexSigs[i], false);
            }

            // just invalidate this once, so we don't pay the cost of rebuilding caches
            // for each signature removed
            classSymbol.invalidate();
        }

        context.pushParent(classSymbol);

        var childDecls = classDecl.getChildDecls();

        for (var i = 0; i < childDecls.length; i++) {
            bindDeclSymbol(childDecls[i], context);
        }

        context.popParent();
    }

    export function bindInterfacePullSymbol(interfaceDecl: PullDecl, context: PullSymbolBindingContext) {

        // 1. Test for existing decl - if it exists, use its symbol
        // 2. If no other decl exists, create a new symbol and use that one
        var interfaceName = interfaceDecl.getName();
        var interfaceSymbol: PullTypeSymbol = <PullTypeSymbol>findSymbolInContext(interfaceName, PullElementKind.Interface, context, []);
        var createdNewSymbol = false;

        if (!interfaceSymbol) {
            interfaceSymbol = new PullTypeSymbol(interfaceName, PullElementKind.Interface);
            createdNewSymbol = true;
        }

        if (interfaceDecl) {
            interfaceSymbol.addDeclaration(interfaceDecl);
            interfaceDecl.setSymbol(interfaceSymbol);
        }

        //context.semanticInfo.setSymbolForDecl(interfaceDecl, interfaceSymbol);
        
        if (createdNewSymbol) {
            var parent = context.getParent();

            if (parent) {
                var linkKind = interfaceDecl.getDeclFlags() & PullElementFlags.Exported ? SymbolLinkKind.PublicMember : SymbolLinkKind.PrivateMember;
                
                if (linkKind == SymbolLinkKind.PublicMember) {
                    parent.addMember(interfaceSymbol, linkKind);
                }
                else {
                    interfaceSymbol.addOutgoingLink(parent, SymbolLinkKind.ContainedBy);
                }
            }
        }
        else if (context.reBindingAfterChange) {
            // clear out the old decls...
            var decls = interfaceSymbol.getDeclarations();
            var scriptName = interfaceDecl.getScriptName();

            for (var i = 0; i < decls.length; i++) {
                if (decls[i].getScriptName() == scriptName && decls[i].getDeclID() < context.startingDeclForRebind) {
                    interfaceSymbol.removeDeclaration(decls[i]);
                }
            }
        }

        context.pushParent(interfaceSymbol);

        var childDecls = interfaceDecl.getChildDecls();

        for (var i = 0; i < childDecls.length; i++) {
            bindDeclSymbol(childDecls[i], context);
        }

        context.popParent();
    }

    export function bindVariablePullSymbol(varDecl: PullDecl, context: PullSymbolBindingContext) {
        var declFlags = varDecl.getDeclFlags();
        var declType = varDecl.getKind();
        var isProperty = false;
        var isStatic = false;
        var isExported = false;
        var isOptional = false;
        var linkKind = SymbolLinkKind.PrivateMember;
        var variableSymbol: PullSymbol = null;

        if (hasFlag(declFlags, PullElementFlags.Exported)) {
            isExported = true;
            linkKind = SymbolLinkKind.PublicMember;
        }
        if (hasFlag(declFlags, PullElementFlags.Public)) {
            isProperty = true;
            linkKind = SymbolLinkKind.PublicMember;
        }
        if (hasFlag(declFlags, PullElementFlags.Static)) {
            isProperty = true;
            isStatic = true;
            linkKind = SymbolLinkKind.StaticMember;
        }
        if (hasFlag(declFlags, PullElementFlags.Private)) {
            isProperty = true;
        }
        if (hasFlag(declFlags, PullElementFlags.Optional)) {
            isOptional = true;
        }

        var declType =  varDecl ? varDecl.getKind() :
                            isProperty ? PullElementKind.Property : PullElementKind.Variable;

        var declName = varDecl.getName();

        var parentHadSymbol = false;

        var parent = context.getParent();

        if (context.reBindingAfterChange && parent) {
            // see if the parent already has a symbol for this class
            var members = parent.hasBrand() && !isStatic ? (<PullClassSymbol>parent).getInstanceType().getMembers() : parent.getMembers();
            var member: PullSymbol = null;

            for (var i = 0 ; i < members.length; i++) {
                member = members[i];

                if (member.getName() == declName && member.getKind() == declType) {
                    parentHadSymbol = true;
                    variableSymbol = member;
                    
                    // prune out-of-date decls...
                    var decls = member.getDeclarations();
                    var scriptName = varDecl.getScriptName();

                    for (var j = 0; j < decls.length; j++) {
                        if (decls[j].getScriptName() == scriptName && decls[j].getDeclID() < context.startingDeclForRebind) {
                            variableSymbol.removeDeclaration(decls[j]);
                        }
                    }

                    break;
                }
            }
        }

        if (!parentHadSymbol) {
            variableSymbol = new PullSymbol(declName, declType);
        }        

        if (varDecl) {
            variableSymbol.addDeclaration(varDecl);
            varDecl.setSymbol(variableSymbol);
        }

        if (isOptional) {
            variableSymbol.setIsOptional();
        }

        if (parent && !parentHadSymbol) {
            if (parent.hasBrand()) {
                var classTypeSymbol = <PullClassSymbol>parent;
                if (isStatic) {
                    classTypeSymbol.addMember(variableSymbol, linkKind);
                }
                else {
                    classTypeSymbol.getInstanceType().addMember(variableSymbol, linkKind);
                }
            }
            else {
                if (isProperty || isStatic || isExported) {
                    parent.addMember(variableSymbol, linkKind);
                }
                else {
                    variableSymbol.addOutgoingLink(parent, SymbolLinkKind.ContainedBy);
                }
            }
        }
    }

    export function bindParameterSymbolsUsingFidelity(parameters: ParameterListSyntax, context: PullSymbolBindingContext, signatureSymbol: PullSignatureSymbol) {
        // create a symbol for each ast
        // if it's a property, add the symbol to the enclosing type's member list
        var decl: PullDecl = null;

        var parameterSymbol: PullSymbol = null;
        var isProperty = false;
        var parameter: ParameterSyntax;

        var parameterSyntaxList = parameters.parameters;
        var parameterCount = parameterSyntaxList.nonSeparatorCount();

        if (parameterCount) {

            for (var i = 0; i < parameterCount; i++) {

                parameter = <ParameterSyntax>parameterSyntaxList.nonSeparatorAt(i);

                decl = context.semanticInfo.getDeclForSyntaxElement(parameter);

                parameterSymbol = new PullSymbol(parameter.identifier.text(), PullElementKind.Variable);
                
                if (decl) {
                    parameterSymbol.addDeclaration(decl);
                    decl.setSymbol(parameterSymbol);
                }

                signatureSymbol.addParameter(parameterSymbol);

                // PULLREVIEW: Shouldn't need this, since parameters are created off of decl collection
                // add a member to the parent type
                //if (decl && isProperty) {
                //    parameterSymbol = new PullSymbol(argDecl.id.actualText, PullElementKind.Field);

                //    parameterSymbol.addDeclaration(decl);
                //    decl.setPropertySymbol(parameterSymbol);

                //    var linkKind = (decl.getDeclFlags() & PullElementFlags.Private) ? SymbolLinkKind.PrivateProperty : SymbolLinkKind.PublicProperty;
                //    var parent = context.getParent(1);
                //    if (parent.hasBrand()) {
                //        (<PullClassSymbol>parent).getInstanceType().addMember(parameterSymbol, linkKind);
                //    }
                //    else {
                //        // PULLTODO: I don't think we ever even take this branch...
                //        parent.addMember(parameterSymbol, linkKind);
                //    }
                //}
            }
        }        
    }

    export function bindParameterSymbols(funcDecl: FuncDecl, context: PullSymbolBindingContext, signatureSymbol: PullSignatureSymbol) {
        // create a symbol for each ast
        // if it's a property, add the symbol to the enclosing type's member list
        var parameters: PullSymbol[] = [];
        var decl: PullDecl = null;
        var argDecl: BoundDecl = null;
        var parameterSymbol: PullSymbol = null;
        var isProperty = false;

        if (funcDecl.arguments) {

            for (var i = 0; i < funcDecl.arguments.members.length; i++) {
                argDecl = <BoundDecl>funcDecl.arguments.members[i];
                decl = context.semanticInfo.getDeclForAST(argDecl);
                isProperty = hasFlag(argDecl.varFlags, VarFlags.Property);
                parameterSymbol = new PullSymbol(argDecl.id.actualText, PullElementKind.Variable);
                
                if (decl) {
                    parameterSymbol.addDeclaration(decl);
                    decl.setSymbol(parameterSymbol);
                }

                context.semanticInfo.setSymbolForAST(argDecl, parameterSymbol);

                signatureSymbol.addParameter(parameterSymbol);

                // PULLREVIEW: Shouldn't need this, since parameters are created off of decl collection
                // add a member to the parent type
                //if (decl && isProperty) {
                //    parameterSymbol = new PullSymbol(argDecl.id.actualText, PullElementKind.Field);

                //    parameterSymbol.addDeclaration(decl);
                //    decl.setPropertySymbol(parameterSymbol);

                //    var linkKind = (decl.getDeclFlags() & PullElementFlags.Private) ? SymbolLinkKind.PrivateProperty : SymbolLinkKind.PublicProperty;
                //    var parent = context.getParent(1);
                //    if (parent.hasBrand()) {
                //        (<PullClassSymbol>parent).getInstanceType().addMember(parameterSymbol, linkKind);
                //    }
                //    else {
                //        // PULLTODO: I don't think we ever even take this branch...
                //        parent.addMember(parameterSymbol, linkKind);
                //    }
                //}
            }
        }        
    }

    export function bindFunctionPullSymbol(funcDecl: PullDecl, context: PullSymbolBindingContext) {  
        var declKind = funcDecl.getKind();
        var declFlags = funcDecl.getDeclFlags();
        var isProperty = false;
        var isPrivate = false;
        var isStatic = false;
        var isExported = false;

        if (declKind & PullElementKind.Method) {
            isProperty = true;
        }
        if (declFlags & PullElementFlags.Static) {
            isProperty = true;
            isStatic = true;
        }
        if (declFlags & PullElementFlags.Private) {
            isProperty = true;
            isPrivate = true;
        }
        if (declFlags & PullElementFlags.Exported) {
            isExported = true;
        }

        var funcName = funcDecl.getName();

        // 1. Test for existing decl - if it exists, use its symbol
        // 2. If no other decl exists, create a new symbol and use that one

        var isConstructor: bool = (declFlags & PullElementFlags.Constructor) != 0;
        var isIndex: bool = (declFlags & PullElementFlags.Index) != 0;
        var isSignature: bool = (declFlags & PullElementFlags.Signature) != 0;

        var parent = context.getParent();
        var parentHadSymbol = false;

        // PULLREVIEW: On a re-bind, there's no need to search far-and-wide: just look in the parent's member list
        var functionSymbol: PullFunctionSymbol = null; //<PullFunctionSymbol>findSymbolInContext(funcName, declKind, context, []);

        // if it's a function definition, add a call signature to this signature
        // if it's a function signature, add a call signature to this signature
        //
        // if it's a constructor definition, add a construct signature to the parent
        // if it's an index signature, add an index signature to the parent
        // if it's a call signature, add a call signature to the parent
        // if it's a construct signature, add a construct signature to the parent

        var linkKind = isStatic ? SymbolLinkKind.StaticMember : isPrivate ? SymbolLinkKind.PrivateMember : SymbolLinkKind.PublicMember;

        if (funcName) {
            if (context.reBindingAfterChange) {
                if (parent) {

                    var members = parent.hasBrand() && !isStatic ? (<PullClassSymbol>parent).getInstanceType().getMembers() : parent.getMembers();
                    var member: PullSymbol = null;

                    for (var i = 0 ; i < members.length; i++) {
                        member = members[i];

                        if (member.getName() == funcName && (member.getKind() & declKind)) {
                            parentHadSymbol = true;
                            functionSymbol = <PullFunctionSymbol>member;

                            break;
                        }
                    }
                }
                else {
                    functionSymbol = <PullFunctionSymbol>findSymbolInContext(funcName, declKind, context, []);
                }
                if (functionSymbol) {
                    // prune out-of-date decls...
                    var decls = functionSymbol.getDeclarations();
                    var scriptName = funcDecl.getScriptName();

                    for (var j = 0; j < decls.length; j++) {
                        if (decls[j].getScriptName() == scriptName && decls[j].getDeclID() < context.startingDeclForRebind) {
                            functionSymbol.removeDeclaration(decls[j]);
                        }
                    }

                    functionSymbol.invalidate();
                }
            }
            else {
                var candidateSym: PullSymbol;

                // if there's already a parent symbol, any preceeding overloads will be present there,
                // so we can just check the parent's children
                if (parent) {
                    candidateSym = parent.getMemberByName(funcName);
                }
                else {
                    // PULLREVIEW: This call ends up being quite expensive - need to avoid it if at all possible
                    candidateSym = <PullFunctionSymbol>findSymbolInContext(funcName, declKind, context, []);
                }

                if (candidateSym && (candidateSym.getKind() & PullElementKind.Function)) {
                    functionSymbol = <PullFunctionSymbol>candidateSym;
                }
            }
        }

        if (!functionSymbol) {
            // PULLTODO: Make sure that we properly flag signature decl types when collecting decls
            functionSymbol = new PullFunctionSymbol(funcName, isProperty ? PullElementKind.Method : PullElementKind.Function);
        }

        if (funcDecl) {
            funcDecl.setSymbol(functionSymbol);
            functionSymbol.addDeclaration(funcDecl);
            //context.semanticInfo.setSymbolForDecl(funcDecl, functionSymbol);
        }
        
        if (parent && !isConstructor && !parentHadSymbol) {

            if (parent.hasBrand()) {
                if (isStatic) {
                    (<PullClassSymbol>parent).addMember(functionSymbol, linkKind);
                }
                else {
                    (<PullClassSymbol>parent).getInstanceType().addMember(functionSymbol, linkKind);
                }

            }
            else {
                if (isProperty || isExported) {
                    parent.addMember(functionSymbol, linkKind);
                }
                else {
                    functionSymbol.addOutgoingLink(parent, SymbolLinkKind.ContainedBy);
                }
            }
        }

        if (!isSignature) {
            context.pushParent(functionSymbol);
        }

        // PULLTODO: For now, remove stale signatures from the function type, but we want to be smarter about this when
        // incremental parsing comes online
        if (parentHadSymbol) {
            var callSigs = functionSymbol.getCallSignatures();
            var constructSigs = functionSymbol.getConstructSignatures();
            var indexSigs = functionSymbol.getIndexSignatures();

            for (var i = 0; i < callSigs.length; i++) {
                functionSymbol.removeCallSignature(callSigs[i], false);
            }
            for (var i = 0; i < constructSigs.length; i++) {
                functionSymbol.removeConstructSignature(constructSigs[i], false);
            }
            for (var i = 0; i < indexSigs.length; i++) {
                functionSymbol.removeIndexSignature(indexSigs[i], false);
            }

            // just invalidate this once, so we don't pay the cost of rebuilding caches
            // for each signature removed
            functionSymbol.invalidate();
        }

        var sigKind = isConstructor ? PullElementKind.ConstructSignature :
                        isIndex ? PullElementKind.IndexSignature : PullElementKind.CallSignature;

        var signature = isSignature ? new PullSignatureSymbol(sigKind) : new PullDefinitionSignatureSymbol(sigKind);

        signature.addDeclaration(funcDecl);
        funcDecl.setSignatureSymbol(signature);

        if (context.useFidelity) {
            var syntaxElement = context.semanticInfo.getSyntaxElementForDecl(funcDecl);
            var functionSignatureElement: FunctionSignatureSyntax = (<any>syntaxElement).functionSignature();
            var parameters = functionSignatureElement.callSignature.parameterList;

            bindParameterSymbolsUsingFidelity(parameters, context, signature);
        }
        else {
            bindParameterSymbols(<FuncDecl>context.semanticInfo.getASTForDecl(funcDecl), context, signature);
        }

        // add the implicit call member for this function type
        if (funcName && !(isConstructor || isIndex)) {
            functionSymbol.addSignature(signature);
        }
        else if (parent) {
            if (isConstructor) {
                parent.addConstructSignature(signature);
            }
            else if (isIndex) {
                parent.addIndexSignature(signature);
            }
            else {
                parent.addCallSignature(signature);
            }
        }
        else { // lambda
            functionSymbol.addCallSignature(signature);
        }
        
        if (!isSignature) {
            var childDecls = funcDecl.getChildDecls();

            for (var i = 0; i < childDecls.length; i++) {
                bindDeclSymbol(childDecls[i], context);
            }

            context.popParent();
        }
    }

    export function bindDeclSymbol(decl: PullDecl, context: PullSymbolBindingContext): void {
        if (!decl) {
            return;
        }

        switch (decl.getKind()) {
            case PullElementKind.Script:
                var childDecls = decl.getChildDecls();
                for (var i = 0; i < childDecls.length; i++) {
                    bindDeclSymbol(childDecls[i], context);
                }
                break;
            case PullElementKind.Module:
                bindModulePullSymbol(decl, context);
                break;
            case PullElementKind.Interface:
                bindInterfacePullSymbol(decl, context);
                break;
            case PullElementKind.Class:
                bindClassPullSymbol(decl, context);
                break;
            case PullElementKind.Method:
            case PullElementKind.Function:
                bindFunctionPullSymbol(decl, context);
                break;
            case PullElementKind.Property:
            case PullElementKind.Variable:
                bindVariablePullSymbol(decl, context);
                break;
        }

    }

}