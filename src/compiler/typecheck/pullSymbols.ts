// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\typescript.ts' />

module TypeScript {

    export var pullSymbolID = 0

    export class PullSymbol {

        // private state
        private pullSymbolID = pullSymbolID++;

        private outgoingLinks: LinkList = new LinkList();
        private incomingLinks: LinkList = new LinkList();
        private declarations: LinkList = new LinkList();

        private name: string;

        private cachedDeclPath: string[];

        private declKind: PullElementKind;

        // caches - free these on invalidate
        private cachedContainerLink: PullSymbolLink = null;
        private cachedTypeLink: PullSymbolLink = null;

        private hasBeenResolved = false;

        private isOptional = false;

        public typeChangeUpdateVersion = -1;
        public addUpdateVersion = -1;
        public removeUpdateVersion = -1;


        // public surface area
        public getSymbolID() { return this.pullSymbolID; }

        public isType() { 
            return (this.declKind & PullElementKind.SomeType) != 0; 
        }

        public isSignature() {
            return (this.declKind & PullElementKind.SomeSignature) != 0;
        }

        public isArray() {
            return (this.declKind & PullElementKind.Array) != 0;
        }

        public isPrimitive() {
            return this.declKind == PullElementKind.Primitive;
        }

        constructor (name: string, declKind: PullElementKind) {
            this.name = name;
            this.declKind = declKind;
        }

        public getName() { return this.name; }

        public getKind() { return this.declKind; }        
        public setKind(declType: PullElementKind) { this.declKind = declType; }

        public setIsOptional() { this.isOptional = true; }
        public getIsOptional() { return this.isOptional; }

        public setDeclPath(declPath: string[]) { this.cachedDeclPath = declPath; }
        public getDeclPath() { return this.cachedDeclPath; }

        // declaration methods
        public addDeclaration(decl: PullDecl) { this.declarations.addItem(decl); }
        
        public getDeclarations() { return <PullDecl[]>this.declarations.find(d => d); }
        
        public removeDeclaration(decl: PullDecl) { this.declarations.remove(d => d === decl);  }
        
        public updateDeclarations(map: (item: PullDecl, context: any) => void , context: any) {
            this.declarations.update(map, context);
        }

        // link methods
        public addOutgoingLink(linkTo: PullSymbol, kind: SymbolLinkKind) {
            var link = new PullSymbolLink(this, linkTo, kind);
            this.outgoingLinks.addItem(link);
            linkTo.incomingLinks.addItem(link);
            
            return link;
        }

        public findOutgoingLinks(p: (psl: PullSymbolLink) => bool) {
            return <PullSymbolLink[]>this.outgoingLinks.find(p);
        }

        public findIncomingLinks(p: (psl: PullSymbolLink) => bool) {
            return <PullSymbolLink[]>this.incomingLinks.find(p);
        }

        public removeOutgoingLink(link: PullSymbolLink) {
            if (link) {
                this.outgoingLinks.remove(p => p === link);
                link.end.incomingLinks.remove(p => p === link);
            }
        }

        public updateOutgoingLinks(map: (item: PullSymbolLink, context: any) => void , context: any) {
            this.outgoingLinks.update(map, context);
        }

        public updateIncomingLinks(map: (item: PullSymbolLink, context: any) => void , context: any) {
            this.incomingLinks.update(map, context);
        }

        public setContainer(containerSymbol: PullTypeSymbol, relationshipKind: SymbolLinkKind) {
            //containerSymbol.addOutgoingLink(this, relationshipKind);
            
            var link = this.addOutgoingLink(containerSymbol, SymbolLinkKind.ContainedBy);
            this.cachedContainerLink = link;
        }

        public getContainer(): PullTypeSymbol {
            if (this.cachedContainerLink) {
                return <PullTypeSymbol>this.cachedContainerLink.end;
            }

            var containerList = this.findOutgoingLinks(link => link.kind == SymbolLinkKind.ContainedBy);

            if (containerList.length) {
                this.cachedContainerLink = containerList[0];
                return <PullTypeSymbol>this.cachedContainerLink.end;
            }

            return null;
        }

        public unsetContainer() {
            if (this.cachedContainerLink) {
                this.removeOutgoingLink(this.cachedContainerLink);
            }
            else {

                // PULLTODO: If we can guarantee that no link will exist without caching, we won't need to search
                var containerList = this.findOutgoingLinks(link => link.kind == SymbolLinkKind.ContainedBy);

                if (containerList.length) {
                    this.removeOutgoingLink(containerList[0]);
                }
            }

            this.invalidate();
        }
        
        public setType(typeRef: PullTypeSymbol) {

            // PULLTODO: Remove once we're certain that duplicate types can never be set
            //if (this.cachedTypeLink) {
            //    CompilerDiagnostics.Alert("Type '" + this.name + "' is having its type reset from '" + this.cachedTypeLink.end.getName() + "' to '" + typeRef.getName() + "'");
            //}

            var link = this.addOutgoingLink(typeRef, SymbolLinkKind.TypedAs);
            this.cachedTypeLink = link;
        }
        
        public getType(): PullTypeSymbol {
            if (this.cachedTypeLink) {
                return <PullTypeSymbol>this.cachedTypeLink.end;
            }

            var typeList = this.findOutgoingLinks(link => link.kind == SymbolLinkKind.TypedAs);

            if (typeList.length) {
                this.cachedTypeLink = typeList[0];
                return <PullTypeSymbol>this.cachedTypeLink.end;
            }

            return null;
        }

        public unsetType() {
            if (this.cachedTypeLink) {
                this.removeOutgoingLink(this.cachedTypeLink);
            }
            else {
                var typeList = this.findOutgoingLinks(link => link.kind == SymbolLinkKind.TypedAs);

                if (typeList.length) {
                    this.removeOutgoingLink(typeList[0]);
                }
            }

            this.invalidate();
        }

        public isTyped() {
            return this.getType() != null;
        }

        public setResolved() { this.hasBeenResolved = true; }
        public isResolved() { return this.hasBeenResolved; }

        // helper methods:
        // cacheInfo?

        // helper derived classes
        // PullClassSymbol
        // PullInterfaceSymbol
        // cache and convience methods
        public invalidate() {

            this.removeOutgoingLink(this.cachedContainerLink);
            this.removeOutgoingLink(this.cachedTypeLink);

            this.cachedContainerLink = null;
            this.cachedTypeLink = null;
            
            this.hasBeenResolved = false;
        }

        public toString() { 
            var str = this.name;

            var type = this.getType();
            
            if (type) {
                var typeName: string;
                if (type.isArray()) {
                    typeName = type.getElementType().getName() + "[]";
                }
                else {
                    typeName = type.getName();
                }
                str += ": " + typeName;
            }

            return this.name;
        }
    }

    export class PullSignatureSymbol extends PullSymbol {
        private parameterLinks: PullSymbolLink[] = [];
        private returnTypeLink: PullSymbolLink = null;
        private hasOptionalParam = false;
        private nonOptionalParamCount = 0;

        constructor (kind: PullElementKind) {
            super("", kind);
        }

        public isDefinition() { return false; }
        public hasVariableParamList() { return this.hasOptionalParam; }

        public addParameter(parameter: PullSymbol, isOptional = false) {
            var link = this.addOutgoingLink(parameter, SymbolLinkKind.Parameter);
            this.parameterLinks[this.parameterLinks.length] = link;
            this.hasOptionalParam = isOptional;

            if (!isOptional) {
                this.nonOptionalParamCount++;
            }
        }

        public getNonOptionalParameterCount() { return this.nonOptionalParamCount; }

        public setReturnType(returnType: PullTypeSymbol) {
            this.returnTypeLink = this.addOutgoingLink(returnType, SymbolLinkKind.ReturnType);            
        }

        public getParameters() {
            var params: PullSymbol[] = [];

            for (var i = 0; i < this.parameterLinks.length; i++) {
                params[params.length] = this.parameterLinks[i].end;
            }

            return params;
        }

        public removeParameter(parameterSymbol: PullSymbol) {
            var paramLink: PullSymbolLink;

            for (var i = 0; i < this.parameterLinks.length; i++) {
                if (parameterSymbol == this.parameterLinks[i].end) {
                    paramLink = this.parameterLinks[i];
                    this.removeOutgoingLink(paramLink);
                    break;
                }
            }
            
            this.invalidate();
        }

        public getReturnType(): PullTypeSymbol {
            if (this.returnTypeLink) {
                return <PullTypeSymbol> this.returnTypeLink.end;
            }
            else {
                var rtl = this.findOutgoingLinks((p) => p.kind == SymbolLinkKind.ReturnType);

                if (rtl.length) {
                    this.returnTypeLink = rtl[0];
                    return <PullTypeSymbol> this.returnTypeLink.end;
                }

                return null;
            }
        }

        // only the return type would change as a result of an invalidation
        // PULLTODO: Invalidate parameters?
        public invalidate() {
            this.removeOutgoingLink(this.returnTypeLink);
            this.returnTypeLink = null;

            this.parameterLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.Parameter);
            this.nonOptionalParamCount = 0;
            this.hasOptionalParam = false;

            // re-compute non-optional arg count, etc
            for (var i = 0; i < this.parameterLinks.length; i++) {
                if (!this.parameterLinks[i].end.getIsOptional()) {
                    this.nonOptionalParamCount++;
                }
                else {
                    this.hasOptionalParam;
                    break;
                }
            }

            super.invalidate();
        }

        public toString() {
            var sigString = "(";
            var params = this.getParameters();
            var paramType: PullTypeSymbol;

            for (var i = 0; i < params.length; i++) {
                sigString += params[i].getName();

                paramType = params[i].getType();

                if (paramType) {
                    sigString += ": " + paramType.getName();
                }

                if (i < params.length - 1) {
                    sigString += ", ";
                }
            }
            sigString += ")";

            var returnType = this.getReturnType();

            if (returnType) {
                sigString += ": " + returnType.getName();
            }

            return sigString;
        }
    }

    export class PullTypeSymbol extends PullSymbol {
        private memberLinks: PullSymbolLink[] = [];
        private memberCache: any = null;
        private memberTypeCache: any = null;

        private implementedTypeLinks: PullSymbolLink[] = [];
        private extendedTypeLinks: PullSymbolLink[] = [];
        
        private callSignatureLinks: PullSymbolLink[] = [];
        private constructSignatureLinks: PullSymbolLink[] = [];
        private indexSignatureLinks: PullSymbolLink[] = [];

        private arrayType: PullTypeSymbol = null;

        public isType() { return true; }
        public isClass() { return false; }
        public hasMembers() { return this.memberLinks.length != 0; }
        public isInstanceType() { return false; }
        public isFunction() { return false; }

        public getType() { return this; }

        public getArrayType() { return this.arrayType; }
        
        public getElementType(): PullTypeSymbol {
            var arrayOfLinks = this.findOutgoingLinks(link => link.kind == SymbolLinkKind.ArrayOf);

            if (arrayOfLinks.length) {
                return <PullTypeSymbol>arrayOfLinks[0].end;
            }

            return null;
        }
        public setArrayType(arrayType: PullTypeSymbol) {
            this.arrayType = arrayType;

            arrayType.addOutgoingLink(this, SymbolLinkKind.ArrayOf);
        }

        public addMember(memberSymbol: PullSymbol, linkKind: SymbolLinkKind) {
            var link = this.addOutgoingLink(memberSymbol, linkKind);

            this.memberLinks[this.memberLinks.length] = link;

            memberSymbol.setContainer(this, linkKind);

            if (!this.memberCache) {
                this.memberCache = {};
                this.memberTypeCache = {};
            }

            if (!memberSymbol.isType()) {
                this.memberCache[memberSymbol.getName()] = memberSymbol;
            }
            else {
                this.memberTypeCache[memberSymbol.getName()] = memberSymbol;
            }
        }

        public removeMember(memberSymbol: PullSymbol) {
            var memberLink: PullSymbolLink;
            var child: PullSymbol;

            for (var i = 0; i < this.memberLinks.length; i++) {
                if (memberSymbol == this.memberLinks[i].end) {
                    memberLink = this.memberLinks[i];
                    child = memberLink.end;
                    child.unsetContainer();
                    this.removeOutgoingLink(memberLink);
                    break;
                }
            }
            
            this.invalidate();
        }

        public getMembers(): PullSymbol[] {
            var members: PullSymbol[] = [];
            for (var i = 0; i < this.memberLinks.length; i++) {
                members[members.length] = this.memberLinks[i].end;
            }
            return members;
        }

        public getMemberByName(name: string): PullSymbol {
            for (var i = 0; i < this.memberLinks.length; i++) {
                if (this.memberLinks[i].end.getName() == name) {
                    return this.memberLinks[i].end;
                }
            }

            return null;
        }

        public addCallSignature(callSignature: PullSignatureSymbol) { 
            var link = this.addOutgoingLink(callSignature, SymbolLinkKind.CallSignature);
            this.callSignatureLinks[this.callSignatureLinks.length] = link;
        }

        public addCallSignatures(callSignatures: PullSignatureSymbol[]) {
            for (var i = 0; i < callSignatures.length; i++) {
                this.addCallSignature(callSignatures[i]);
            }
        }

        public addConstructSignature(constructSignature: PullSignatureSymbol) {
            var link = this.addOutgoingLink(constructSignature, SymbolLinkKind.ConstructSignature);
            this.constructSignatureLinks[this.constructSignatureLinks.length] = link;
        }

        public addConstructSignatures(constructSignatures: PullSignatureSymbol[]) {
            for (var i = 0; i < constructSignatures.length; i++) {
                this.addConstructSignature(constructSignatures[i]);
            }
        }

        public addIndexSignature(indexSignature: PullSignatureSymbol) {
            var link = this.addOutgoingLink(indexSignature, SymbolLinkKind.IndexSignature);
            this.indexSignatureLinks[this.indexSignatureLinks.length] = link;
        }

        public addIndexSignatures(indexSignatures: PullSignatureSymbol[]) {
            for (var i = 0; i < indexSignatures.length; i++) {
                this.addIndexSignature(indexSignatures[i]);
            }
        }

        public getCallSignatures(): PullSignatureSymbol[] {
            var members: PullSymbol[] = [];
            for (var i = 0; i < this.callSignatureLinks.length; i++) {
                members[members.length] = this.callSignatureLinks[i].end;
            }
            return <PullSignatureSymbol[]>members;
        }

        public getConstructSignatures(): PullSignatureSymbol[] { 
            var members: PullSymbol[] = [];
            for (var i = 0; i < this.constructSignatureLinks.length; i++) {
                members[members.length] = this.constructSignatureLinks[i].end;
            }
            return <PullSignatureSymbol[]>members;
        }

        public getIndexSignatures(): PullSignatureSymbol[] {
            var members: PullSymbol[] = [];
            for (var i = 0; i < this.indexSignatureLinks.length; i++) {
                members[members.length] = this.indexSignatureLinks[i].end;
            }
            return <PullSignatureSymbol[]>members;
        }

        public removeCallSignature(signature: PullSignatureSymbol, invalidate = true) {
            var signatureLink: PullSymbolLink;

            for (var i = 0; i < this.callSignatureLinks.length; i++) {
                if (signature == this.callSignatureLinks[i].end) {
                    signatureLink = this.callSignatureLinks[i];
                    this.removeOutgoingLink(signatureLink);
                    break;
                }
            }
            
            if (invalidate) {
                this.invalidate();
            }
        }

        public removeConstructSignature(signature: PullSignatureSymbol, invalidate = true) {
            var signatureLink: PullSymbolLink;

            for (var i = 0; i < this.constructSignatureLinks.length; i++) {
                if (signature == this.constructSignatureLinks[i].end) {
                    signatureLink = this.constructSignatureLinks[i];
                    this.removeOutgoingLink(signatureLink);
                    break;
                }
            }

            if (invalidate) {
                this.invalidate();
            }
        }

        public removeIndexSignature(signature: PullSignatureSymbol, invalidate=true) {
            var signatureLink: PullSymbolLink;

            for (var i = 0; i < this.indexSignatureLinks.length; i++) {
                if (signature == this.indexSignatureLinks[i].end) {
                    signatureLink = this.indexSignatureLinks[i];
                    this.removeOutgoingLink(signatureLink);
                    break;
                }
            }
            
            if (invalidate) {
                this.invalidate();
            }
        }

        public addImplementedType(interfaceType: PullTypeSymbol) {
            var link = this.addOutgoingLink(interfaceType, SymbolLinkKind.Implements);
            this.implementedTypeLinks[this.implementedTypeLinks.length] = link;
        }

        public getImplementedTypes(): PullTypeSymbol[] {
            var members: PullSymbol[] = [];
            for (var i = 0; i < this.implementedTypeLinks.length; i++) {
                members[members.length] = this.implementedTypeLinks[i].end;
            }
            return <PullTypeSymbol[]>members;
        }

       public removeImplementedType(implementedType: PullTypeSymbol) {
            var typeLink: PullSymbolLink;

            for (var i = 0; i < this.implementedTypeLinks.length; i++) {
                if (implementedType == this.implementedTypeLinks[i].end) {
                    typeLink = this.implementedTypeLinks[i];
                    this.removeOutgoingLink(typeLink);
                    break;
                }
            }
            
            this.invalidate();
        }

        public addExtendedType(extendedType: PullTypeSymbol) {
            var link = this.addOutgoingLink(extendedType, SymbolLinkKind.Extends);
            this.extendedTypeLinks[this.extendedTypeLinks.length] = link;
            
            var parentMembers = extendedType.getMembers();
            
			// PULLTODO: Restrict member list to public properties only
            for (var i = 0; i < parentMembers.length; i++) {
                this.addMember(parentMembers[i], SymbolLinkKind.PublicMember);
            }
        }

        public getExtendedTypes(): PullTypeSymbol[] {
            var members: PullSymbol[] = [];
            for (var i = 0; i < this.extendedTypeLinks.length; i++) {
                members[members.length] = this.extendedTypeLinks[i].end;
            }
            return <PullTypeSymbol[]>members;
        }

        public hasBase(potentialBase: PullTypeSymbol) {

            if (this == potentialBase) {
                return true;
            }

            var extendedTypes = this.getExtendedTypes();

            for (var i = 0; i < extendedTypes.length; i++) {
                if (extendedTypes[i].hasBase(potentialBase)) {
                    return true;
                }
            }

            return false;
        }

        public removeExtendedType(extendedType: PullTypeSymbol) {
            var typeLink: PullSymbolLink;

            for (var i = 0; i < this.extendedTypeLinks.length; i++) {
                if (extendedType == this.extendedTypeLinks[i].end) {
                    typeLink = this.extendedTypeLinks[i];
                    this.removeOutgoingLink(typeLink);
                    break;
                }
            }
            
            this.invalidate();
        }

        public findMember(name: string): PullSymbol {
            var memberSymbol: PullSymbol;

            if (!this.memberCache) {
                this.memberCache = {};

                for (var i = 0; i < this.memberLinks.length; i++) {
                    this.memberCache[this.memberLinks[i].end.getName()] = this.memberLinks[i].end;
                }
            }
            
            memberSymbol = this.memberCache[name];

            // check parents
            if (!memberSymbol) {
                for (var i = 0 ; i < this.extendedTypeLinks.length; i++) {
                    memberSymbol = (<PullTypeSymbol>this.extendedTypeLinks[i].end).findMember(name);
                    
                    if (memberSymbol) {
                        break;
                    }
                }
            }

            return memberSymbol;
        }

        public findNestedType(name: string): PullTypeSymbol {
            var memberSymbol: PullTypeSymbol;

            if (!this.memberTypeCache) {
                this.memberTypeCache = {};

                for (var i = 0; i < this.memberLinks.length; i++) {
                    if (this.memberLinks[i].end.isType()) {
                        this.memberTypeCache[this.memberLinks[i].end.getName()] = this.memberLinks[i].end;
                    }
                }
            }
            
            memberSymbol = this.memberTypeCache[name];

            return memberSymbol;
        }

        public invalidate() {
            this.memberCache = null;
            this.memberTypeCache = null;

            this.memberLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.StaticMember ||
                                                              psl.kind == SymbolLinkKind.PrivateMember ||
                                                              psl.kind == SymbolLinkKind.PublicMember);

            this.callSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.CallSignature);

            this.constructSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.ConstructSignature);

            this.indexSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.IndexSignature);

            this.implementedTypeLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.Implements);

            this.extendedTypeLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.Extends);

            super.invalidate();
        }

        public toString() {
            var tstring = this.getName() + " { "
            var members = this.getMembers();
            var callSigs = this.getCallSignatures();
            var constructSigs = this.getConstructSignatures();
            var indexSigs = this.getIndexSignatures();

            for (var i = 0; i < members.length; i++) {
                tstring += members[i].toString();
                tstring += "; ";
            }

            for (i = 0; i < callSigs.length; i++) {
                tstring += callSigs[i].toString();
                tstring += "; ";
            }

            for (i = 0; i < constructSigs.length; i++) {
                tstring += "new " + constructSigs[i].toString();
                tstring += "; ";
            }

            for (i = 0; i < indexSigs.length; i++) {
                tstring += "[" + indexSigs[i].toString() + "]";
                tstring += "; ";
            }

            tstring += " }";
            return tstring;
        }
    }

    export class PullPrimitiveTypeSymbol extends PullTypeSymbol {
        constructor (name: string) {
            super(name, PullElementKind.Primitive);
        }

        public isResolved() { return true; }
        public invalidate() { }

        public toString() {
            return name;
        }
    }

    export class PullClassTypeSymbol extends PullTypeSymbol {

        private constructorMethod: PullSymbol = null;

        constructor (name: string) {
            super(name, PullElementKind.Class);
        }

        public isClass() {
            return true;
        }

        public getConstructorMethod() {
            return this.constructorMethod;
        }

        public setConstructorMethod(constructorMethod: PullSymbol) {
            this.constructorMethod = constructorMethod;
        }

        public invalidate() {

            if (this.constructorMethod) {
                this.constructorMethod.invalidate();
            }

            super.invalidate();
        }
    }
    
    export class PullDefinitionSignatureSymbol extends PullSignatureSymbol {
        public isDefinition() { return true; }
    }

    export class PullFunctionTypeSymbol extends PullTypeSymbol {
        private definitionSignature: PullDefinitionSignatureSymbol = null;

        constructor () {
            super("", PullElementKind.FunctionType);
        }

        public isFunction() { return true; }

        public invalidate(sweepForNewValues = false) {

            this.definitionSignature = null;

            super.invalidate();
        }

        public addSignature(signature: PullSignatureSymbol) {
            this.addCallSignature(signature);

            if (signature.isDefinition()) {
                this.definitionSignature = <PullDefinitionSignatureSymbol>signature;
            }
        }

        public getDefinitionSignature() { return this.definitionSignature; }
    }

    export class PullConstructorTypeSymbol extends PullTypeSymbol {
        private definitionSignature: PullDefinitionSignatureSymbol = null;

        constructor () {
            super("", PullElementKind.ConstructorType);
        }

        public isFunction() { return true; }

        public invalidate(sweepForNewValues = false) {

            this.definitionSignature = null;

            super.invalidate();
        }

        public addSignature(signature: PullSignatureSymbol) {
            this.addConstructSignature(signature);

            if (signature.isDefinition()) {
                this.definitionSignature = <PullDefinitionSignatureSymbol>signature;
            }
        }

        public getDefinitionSignature() { return this.definitionSignature; }
    }

    // PULLTODO: This should be a part of the resolver class
    export function specializeToArrayType(arrayInterfaceType: PullTypeSymbol, typeToReplace: PullTypeSymbol, typeToSpecializeTo: PullTypeSymbol, resolver: PullTypeResolver, context: PullTypeResolutionContext) {

        // For the time-being, only specialize interface types
        // this way we can assume only public members and non-static methods
        if (!arrayInterfaceType || (arrayInterfaceType.getKind() & PullElementKind.Interface) == 0) {
            return null;
        }

        if (typeToSpecializeTo.getArrayType()) {
            return typeToSpecializeTo.getArrayType();
        }

        // PULLTODO: Recursive reference bug
        var newArrayType: PullTypeSymbol = new PullTypeSymbol(arrayInterfaceType.getName(), arrayInterfaceType.getKind() | PullElementKind.Array);
        newArrayType.addDeclaration(arrayInterfaceType.getDeclarations()[0]);

        typeToSpecializeTo.setArrayType(newArrayType);
        newArrayType.addOutgoingLink(typeToSpecializeTo, SymbolLinkKind.ArrayOf);

        var field: PullSymbol = null;
        var newField: PullSymbol = null;
        var fieldType: PullTypeSymbol = null;
        
        var method: PullSymbol = null;
        var methodType: PullFunctionTypeSymbol = null;
        var newMethod: PullSymbol = null;
        var newMethodType: PullFunctionTypeSymbol = null;
        
        var signatures: PullSignatureSymbol[] = null;
        var newSignature: PullSignatureSymbol = null;

        var parameters: PullSymbol[] = null;
        var newParameter: PullSymbol = null;
        var parameterType: PullTypeSymbol = null;

        var returnType: PullTypeSymbol = null;
        var newReturnType: PullTypeSymbol = null;

        var members = arrayInterfaceType.getMembers();
            
        for (var i = 0; i < members.length; i++) {
            resolver.resolveDeclaredSymbol(members[i], context);

            if (members[i].getKind() == PullElementKind.Method) { // must be a method
                method = <PullFunctionTypeSymbol> members[i];

                resolver.resolveDeclaredSymbol(method, context);

                methodType = <PullFunctionTypeSymbol>method.getType();

                newMethod = new PullSymbol(method.getName(), PullElementKind.Method);
                newMethodType = new PullFunctionTypeSymbol();
                newMethod.setType(newMethodType);

                newMethod.addDeclaration(method.getDeclarations()[0]);

                signatures = methodType.getCallSignatures();

                // specialize each signature
                for (var j = 0; j < signatures.length; j++) {

                    newSignature = new PullSignatureSymbol(PullElementKind.CallSignature);
                    newSignature.addDeclaration(signatures[j].getDeclarations[0]);

                    parameters = signatures[j].getParameters();
                    returnType = signatures[j].getReturnType();

                    if (returnType == typeToReplace) {
                        newSignature.setReturnType(typeToSpecializeTo);
                    }
                    else {
                        newSignature.setReturnType(returnType);
                    }

                    for (var k = 0; k < parameters.length; k++) {
                        newParameter = new PullSymbol(parameters[k].getName(), parameters[k].getKind());

                        parameterType = parameters[k].getType();

                        if (parameterType == typeToReplace) {
                            newParameter.setType(typeToSpecializeTo);
                        }
                        else {
                            newParameter.setType(parameterType);
                        }

                        newSignature.addParameter(newParameter);
                    }

                    newMethodType.addSignature(newSignature);
                }

                newArrayType.addMember(newMethod, SymbolLinkKind.PublicMember);
            }

            else { // must be a field
                field = members[i];

                newField = new PullSymbol(field.getName(), field.getKind());
                newField.addDeclaration(field.getDeclarations()[0]);
                
                fieldType = field.getType();

                if (fieldType == typeToReplace) {
                    newField.setType(typeToSpecializeTo);
                }
                else {
                    newField.setType(fieldType);
                }

                newArrayType.addMember(newField, SymbolLinkKind.PublicMember);
            }
        }
        newArrayType.addOutgoingLink(arrayInterfaceType, SymbolLinkKind.ArrayType);
        return newArrayType;
    }

}