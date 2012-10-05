// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='typescript.ts' />

module TypeScript {
    export class DeclarationsEmitter implements AstWalkerWithDetailCallback.AstWalkerDetailCallback {
        private declFile : ITextWriter = null;
        public indentAmt: number = 0;
        public indenter: Indenter;
        public declContainingAST: AST = null;

        constructor (public checker: TypeChecker, public emitOptions: IEmitOptions) { 
            this.indenter = GetGlobalIndenter();
        }

        public setDeclarationsFile(file: ITextWriter) {
            this.declFile = file;
        }

        public emitDeclarations(script: TypeScript.Script): void {
            AstWalkerWithDetailCallback.walk(script, this);
        }

        private increaseIndent() {
            this.indentAmt += this.indenter.indentStep;
        }

        private decreaseIndent() {
            this.indentAmt -= this.indenter.indentStep;
        }

        private getIndentString(declIndent? = false) {
            if (this.emitOptions.minWhitespace) {
                return "";
            }
            else {
                return this.indenter.getIndent(this.indentAmt);
            }
        }

        private emitIndent() {
            this.declFile.Write(this.getIndentString());
        }

        private canEmitSignature(declFlags: DeclFlags) {
            if (this.declContainingAST.nodeType == NodeType.Module && !hasFlag(declFlags, DeclFlags.Exported)) {
                return false;
            }

            return true;
        }

        private emitDeclFlags(declFlags: DeclFlags, typeString: string) {
            this.emitIndent();

            // Accessor strings
            var accessorString = "";
            if (hasFlag(declFlags, DeclFlags.GetAccessor)) {
                accessorString = "get ";
            }
            else if (hasFlag(declFlags, DeclFlags.SetAccessor)) {
                accessorString = "set ";
            }

            // Export?
            if (hasFlag(declFlags, DeclFlags.Exported)) {
                this.declFile.Write("export ");
            }

            // Static/public/private/global declare
            if (hasFlag(declFlags, DeclFlags.LocalStatic) || hasFlag(declFlags, DeclFlags.Static)) {
                this.declFile.Write("static " + accessorString);
            }
            else {
                if (hasFlag(declFlags, DeclFlags.Private)) {
                    this.declFile.Write("private " + accessorString);
                }
                else if (hasFlag(declFlags, DeclFlags.Public)) {
                    this.declFile.Write("public " + accessorString);
                }
                else {
                    if (accessorString == "") {
                        this.declFile.Write(typeString + " ");
                    } else {
                        this.declFile.Write(accessorString);
                    }
                }
            }
        }

        private canEmitTypeAnnotationSignature(type: Type, declFlag: DeclFlags = DeclFlags.None) {
            if (type == null) {
                return false;
            }

            if (type.primitiveTypeClass == Primitive.None &&
                ((type.symbol && type.symbol.container != undefined && type.symbol.container != this.checker.gloMod))) {
                if (hasFlag(declFlag, DeclFlags.Private)) {
                    // Private declaration, shouldnt emit type any time.
                    return false;
                }

                if (hasFlag(type.symbol.container.flags, SymbolFlags.Exported)) {
                    return true;
                }

                if (type.symbol.declAST) {
                    // Check if declaration is exported.
                    switch (type.symbol.declAST.nodeType) {
                        case NodeType.Module:
                            if (!hasFlag((<ModuleDecl>type.symbol.declAST).modFlags, ModuleFlags.Exported)) {
                                return false;
                            }
                            break;

                        case NodeType.Class:
                            if (!hasFlag((<ClassDecl>type.symbol.declAST).varFlags, VarFlags.Exported)) {
                                return false;
                            }
                            break;

                        case NodeType.Interface:
                            if (!hasFlag((<TypeDecl>type.symbol.declAST).varFlags, VarFlags.Exported)) {
                                return false;
                            }
                            break;

                        case NodeType.FuncDecl:
                            if (!hasFlag((<FuncDecl>type.symbol.declAST).fncFlags, FncFlags.Exported)) {
                                return false;
                            }
                            break;

                        default:
                            throw Error("Catch this unhandled type container");
                    }
                }
            }
            return true;
        }

        private setDeclContainingAST(ast: AST) {
            var temp = this.declContainingAST;
            this.declContainingAST = ast;
            return temp;
        }

        private getTypeSignature(type: Type) {
            var containingScope: SymbolScope = null;
            if (this.declContainingAST) {
                switch (this.declContainingAST.nodeType) {
                    case NodeType.Module:
                    case NodeType.Interface:
                    case NodeType.FuncDecl:
                        if (this.declContainingAST.type) {
                            containingScope = this.declContainingAST.type.containedScope;
                        }
                        break;

                    case NodeType.Script:
                        var script = <Script>this.declContainingAST;
                        if (script.bod) {
                            containingScope = script.bod.enclosingScope;
                        }
                        break;

                    case NodeType.Class:
                        if (this.declContainingAST.type) {
                            containingScope = this.declContainingAST.type.instanceType.containedScope;
                        }
                        break;

                    default:
                        throw Error("Unknown containing scope");
                }
            }
            return type.getScopedTypeName(containingScope);
        }

        public VarDeclCallback(pre: bool, varDecl: VarDecl, interfaceMember?: bool = false) : bool {
            if (pre && this.canEmitSignature(ToDeclFlags(varDecl.varFlags))) {
                if (!interfaceMember) {
                    this.emitDeclFlags(ToDeclFlags(varDecl.varFlags), "var");
                    this.declFile.Write(varDecl.id.text);
                } else {
                    this.emitIndent();
                    this.declFile.Write(varDecl.id.text);
                    if (hasFlag(varDecl.id.flags, ASTFlags.OptionalName)) {
                        this.declFile.Write("?");
                    }
                }

                var type: Type = null;
                if (varDecl.typeExpr && varDecl.typeExpr.type) {
                    type = varDecl.typeExpr.type;
                }
                else if (varDecl.sym) {
                    type = (<FieldSymbol>varDecl.sym).getType();
                    // Dont emit inferred any
                    if (type == this.checker.anyType) {
                        type = null;
                    }
                }

                if (this.canEmitTypeAnnotationSignature(type, ToDeclFlags(varDecl.varFlags))) {
                    var typeName = this.getTypeSignature(type);
                    this.declFile.WriteLine(": " + typeName + ";");
                }
                else {
                    this.declFile.WriteLine(";");
                }
            }
            return false;
        }
        
        private emitArgDecl(argDecl: ArgDecl, funcDecl: FuncDecl) {
            this.declFile.Write(argDecl.id.text);
            if (argDecl.isOptionalArg()) {
                this.declFile.Write("?");
            }
            if ((argDecl.typeExpr || argDecl.type != this.checker.anyType) &&
                this.canEmitTypeAnnotationSignature(argDecl.type, ToDeclFlags(funcDecl.fncFlags))) {
                this.declFile.Write(": " + this.getTypeSignature(argDecl.type));
            }
        }

        public FuncDeclCallback(pre: bool, funcDecl: FuncDecl, isInterfaceMember?: bool = false) : bool {
            if (!pre) {
                return false;
            }
            
            if (!isInterfaceMember && !funcDecl.isOverload) {
                if (funcDecl.isConstructor) {
                    if (funcDecl.type.construct && funcDecl.type.construct.signatures.length > 1) {
                        return false;
                    }
                } else {
                    if (funcDecl.type.call && funcDecl.type.call.signatures.length > 1) {
                        // This means its implementation of overload signature. do not emit
                        return false;
                    }
                }
            }

            if (!this.canEmitSignature(ToDeclFlags(funcDecl.fncFlags))) {
                return false;
            }

            if (funcDecl.isConstructor) {
                this.emitIndent();
                this.declFile.Write("constructor ");
            }
            else {
                var id = funcDecl.getNameText();
                if (!isInterfaceMember) {
                    this.emitDeclFlags(ToDeclFlags(funcDecl.fncFlags), "function");
                    this.declFile.Write(id);
                } else {
                    this.emitIndent();
                    if (funcDecl.isConstructMember()) {
                        this.declFile.Write("new");
                    } else if (!funcDecl.isCallMember() && !funcDecl.isIndexerMember()) {
                        this.declFile.Write(id);
                        if (hasFlag(funcDecl.name.flags, ASTFlags.OptionalName)) {
                            this.declFile.Write("? ");
                        }
                    }
                }
            }

            if (!funcDecl.isIndexerMember()) {
                this.declFile.Write("(");
            } else {
                this.declFile.Write("[");
            }

            if (funcDecl.args) {
                var argsLen = funcDecl.args.members.length;
                if (funcDecl.variableArgList) {
                    argsLen--;
                }
                for (var i = 0; i < argsLen; i++) {
                    var argDecl = <ArgDecl>funcDecl.args.members[i];
                    this.emitArgDecl(argDecl, funcDecl);
                    if (i < (argsLen - 1)) {
                        this.declFile.Write(", ");
                    }
                }
            }

            if (funcDecl.variableArgList) {
                var lastArg = <ArgDecl>funcDecl.args.members[funcDecl.args.members.length - 1];
                if (funcDecl.args.members.length > 1) {
                    this.declFile.Write(", ...");
                }
                else {
                    this.declFile.Write("...");
                }
                this.emitArgDecl(lastArg, funcDecl);
            }

            if (!funcDecl.isIndexerMember()) {
                this.declFile.Write(")");
            } else {
                this.declFile.Write("]");
            }

            if (!funcDecl.isConstructor &&
                (funcDecl.returnTypeAnnotation || funcDecl.signature.returnType.type != this.checker.anyType) &&
                this.canEmitTypeAnnotationSignature(funcDecl.signature.returnType.type, ToDeclFlags(funcDecl.fncFlags))) {
                this.declFile.Write(": " + this.getTypeSignature(funcDecl.signature.returnType.type));
            }

            if (funcDecl.hasStaticDeclarations()) {
                this.declFile.WriteLine(" {");
            }
            else {
                this.declFile.WriteLine(";");
            }

            return false;
        }

        private emitBaseList(bases: ASTList, qual: string) {
            if (bases && (bases.members.length > 0)) {
                this.declFile.Write(" " + qual + " ");
                var basesLen = bases.members.length;
                for (var i = 0; i < basesLen; i++) {
                    var baseExpr = bases.members[i];
                    var baseSymbol = baseExpr.type.symbol;
                    var baseType = baseExpr.type;
                    var baseName = this.getTypeSignature(baseType);
                    if (i > 0) {
                        this.declFile.Write(", ");
                    }
                    this.declFile.Write(baseName);
                }
            }
        }

        private emitPropertyAccessorSignature(funcDecl: FuncDecl) {
            var accessorSymbol = <FieldSymbol>funcDecl.accessorSymbol;
            if (accessorSymbol.getter && accessorSymbol.getter.declAST != funcDecl) {
                // Setter is being used to emit the type info. 
                return;
            }

            this.emitDeclFlags(ToDeclFlags(accessorSymbol.flags), "var");
            this.declFile.Write(funcDecl.name.text);
            var propertyType = accessorSymbol.getType();
            if (this.canEmitTypeAnnotationSignature(propertyType, ToDeclFlags(accessorSymbol.flags))) {
                this.declFile.WriteLine(" : " + this.getTypeSignature(propertyType) + ";");
            } else {
                this.declFile.WriteLine(";");
            }
        }

        private emitClassMembersFromConstructorDefinition(funcDecl: FuncDecl) {
            if (funcDecl.args) {
                var argsLen = funcDecl.args.members.length; if (funcDecl.variableArgList) { argsLen--; }
                for (var i = 0; i < argsLen; i++) {
                    var argDecl = <ArgDecl>funcDecl.args.members[i]; if (hasFlag(argDecl.varFlags, VarFlags.Property)) {
                        this.emitDeclFlags(ToDeclFlags(argDecl.varFlags), "var");
                        this.declFile.Write(argDecl.id.text);

                        if (argDecl.typeExpr && this.canEmitTypeAnnotationSignature(argDecl.type, ToDeclFlags(argDecl.varFlags))) {
                            var typeName = this.getTypeSignature(argDecl.type);
                            this.declFile.WriteLine(": " + typeName + ";");
                        } else {
                            this.declFile.WriteLine(";");
                        }
                    }
                }
            }
        }

        public ClassCallback(pre: bool, classDecl: ClassDecl) : bool {
            if (!pre || !this.canEmitSignature(ToDeclFlags(classDecl.varFlags))) {
                return false;
            }

            var className = classDecl.name.text;
            this.emitDeclFlags(ToDeclFlags(classDecl.varFlags), "class");
            this.declFile.Write(className);
            this.emitBaseList(classDecl.baseClass, "extends");
            this.emitBaseList(classDecl.implementsList, "implements");
            this.declFile.WriteLine(" {");

            var oldDeclContainingAST = this.setDeclContainingAST(classDecl);
            this.increaseIndent();
            if (classDecl.constructorDecl) {
                this.emitClassMembersFromConstructorDefinition(classDecl.constructorDecl);
            }

            var membersLen = classDecl.definitionMembers.members.length;
            for (var j = 0; j < membersLen; j++) {
                var memberDecl: AST = classDecl.definitionMembers.members[j];
                if (memberDecl.nodeType == NodeType.FuncDecl) {
                    var fn = <FuncDecl>memberDecl;
                    if (!fn.isAccessor()) {
                        this.FuncDeclCallback(true, fn);
                    } else {
                        this.emitPropertyAccessorSignature(fn);
                    }
                }
                else if (memberDecl.nodeType == NodeType.VarDecl) {
                    this.VarDeclCallback(true, <VarDecl>memberDecl);
                }
                else {
                    throw Error("We want to catch this");
                }
            }
            this.decreaseIndent();
            this.setDeclContainingAST(oldDeclContainingAST);

            this.emitIndent();
            this.declFile.WriteLine("}");
            
            return false;
        }

        public InterfaceCallback(pre: bool, interfaceDecl: TypeDecl) : bool {
            if (pre && this.canEmitSignature(ToDeclFlags(interfaceDecl.varFlags))) {
                
                var interfaceName = interfaceDecl.name.text;
                this.emitDeclFlags(ToDeclFlags(interfaceDecl.varFlags), "interface");
                this.declFile.Write(interfaceName);
                this.emitBaseList(interfaceDecl.extendsList, "extends");
                this.declFile.WriteLine(" {");

                this.increaseIndent();
                var oldDeclContainingAST = this.setDeclContainingAST(interfaceDecl);
                var typeMemberList = <ASTList>interfaceDecl.members;
                for (var i = 0; i < typeMemberList.members.length; i++) {
                    var typeMember = typeMemberList.members[i];
                    switch (typeMember.nodeType) {
                        case NodeType.FuncDecl:
                            this.FuncDeclCallback(true, <FuncDecl>typeMember, true);
                            break;

                        case NodeType.VarDecl:
                            this.VarDeclCallback(true, <VarDecl>typeMember, true);
                            break;

                        default:
                            throw Error("Not allowed");

                    }
                }
                this.setDeclContainingAST(oldDeclContainingAST);
                this.decreaseIndent();

                this.emitIndent();
                this.declFile.WriteLine("}");
            }

            return false;
        }

        public ImportCallback(pre: bool, importDecl: ImportDecl) : bool {
            if (pre && this.canEmitSignature(ToDeclFlags(importDecl.varFlags))) {
                this.emitDeclFlags(ToDeclFlags(importDecl.varFlags), "import");
                
                this.declFile.Write(importDecl.id.text + " = ");
                if (importDecl.isDynamicImport) {
                    this.declFile.WriteLine("module (" + importDecl.getAliasName() + ");");
                } else {
                    this.declFile.WriteLine(importDecl.getAliasName() + ";");
                }
            }

            return false;
        }

        private emitEnumSignature(moduleDecl: ModuleDecl) {
            if (!this.canEmitSignature(ToDeclFlags(moduleDecl.modFlags))) {
                return false;
            }

            this.emitDeclFlags(ToDeclFlags(moduleDecl.modFlags), "enum");
            this.declFile.WriteLine(moduleDecl.name.text + " {");

            this.increaseIndent();
            var membersLen = moduleDecl.members.members.length;
            for (var j = 1; j < membersLen; j++) {
                var memberDecl: AST = moduleDecl.members.members[j];
                if (memberDecl.nodeType == NodeType.VarDecl) {
                    this.emitIndent();
                    this.declFile.WriteLine((<VarDecl>memberDecl).id.text + ",");
                } else if (memberDecl.nodeType != NodeType.Asg) {
                    throw Error("We want to catch this");
                }
            }
            this.decreaseIndent();

            this.emitIndent();
            this.declFile.WriteLine("}");

            return true;
        }

        public ModuleCallback(pre: bool, moduleDecl: ModuleDecl, isDottedModuleName? : bool = false) : bool {
            if (!pre) {
                return false;
            }

            if (hasFlag(moduleDecl.modFlags, ModuleFlags.IsWholeFile)) {
                return true;
            }

            if (moduleDecl.isEnum()) {
                this.emitEnumSignature(moduleDecl);
            } else {
                if (!this.canEmitSignature(ToDeclFlags(moduleDecl.modFlags))) {
                    return false;
                }

                if (isDottedModuleName) {
                    this.declFile.Write(".");
                } else {
                    this.emitDeclFlags(ToDeclFlags(moduleDecl.modFlags), "module");
                }
                this.declFile.Write(moduleDecl.name.text);


                if (moduleDecl.members.members.length == 1 &&
                    moduleDecl.members.members[0].nodeType == NodeType.Module &&
                    !(<ModuleDecl>moduleDecl.members.members[0]).isEnum() &&
                    hasFlag((<ModuleDecl>moduleDecl.members.members[0]).modFlags, ModuleFlags.Exported)) {
                    this.ModuleCallback(true, <ModuleDecl>moduleDecl.members.members[0], true);
                }
                else {
                    var oldDeclContainingAST = this.setDeclContainingAST(moduleDecl);
                    this.declFile.WriteLine(" {");
                    this.increaseIndent();
                    var membersLen = moduleDecl.members.members.length;
                    for (var j = 0; j < membersLen; j++) {
                        var memberDecl: AST = moduleDecl.members.members[j];
                        switch (memberDecl.nodeType) {
                            case NodeType.VarDecl:
                                this.VarDeclCallback(true, <VarDecl>memberDecl);
                                break;

                            case NodeType.FuncDecl:
                                this.FuncDeclCallback(true, <FuncDecl>memberDecl);
                                break;

                            case NodeType.Class:
                                this.ClassCallback(true, <ClassDecl>memberDecl);
                                break;

                            case NodeType.Interface:
                                this.InterfaceCallback(true, <TypeDecl>memberDecl);
                                break;

                            case NodeType.Module:
                                this.ModuleCallback(true, <ModuleDecl>memberDecl);
                                break;

                            case NodeType.Import:
                                this.ImportCallback(true, <ImportDecl>memberDecl);
                                break;

                            default:
                                break;
                        }
                    }
                    this.decreaseIndent();
                    this.emitIndent();
                    this.declFile.WriteLine("}");
                    this.setDeclContainingAST(oldDeclContainingAST);
                }
            }

            return false;
        }

        public ScriptCallback(pre: bool, script: Script) : bool {
            if (pre) {
                this.setDeclContainingAST(script);
            }
            else {
                this.setDeclContainingAST(null);
            }
            return true;
        }
    }
}