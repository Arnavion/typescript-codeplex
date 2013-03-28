// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\typescript.ts' />

module TypeScript {
    export var pullSymbolID = 0
    export var lastBoundPullSymbolID = 0;
    export var globalTyvarID = 0;

    export class PullSymbol {

        // private state
        private pullSymbolID = pullSymbolID++;

        private outgoingLinks: LinkList = new LinkList();
        private incomingLinks: LinkList = new LinkList();
        private declarations: LinkList = new LinkList();

        private name: string;

        private cachedPathIDs: any = {};

        private declKind: PullElementKind;

        // caches - free these on invalidate
        private cachedContainerLink: PullSymbolLink = null;
        private cachedTypeLink: PullSymbolLink = null;

        private hasBeenResolved = false;

        private isOptional = false;

        private inResolution = false;

        private isSynthesized = false;

        private resolvingTypeArguments = false;

        private isBound = false;

        private rebindingID = 0;

        private isVarArg = false;

        private isSpecialized = false;
        private isBeingSpecialized = false;

        public typeChangeUpdateVersion = -1;
        public addUpdateVersion = -1;
        public removeUpdateVersion = -1;

        public docComments: string = null;

        public isPrinting = false;

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

        public isAccessor() {
            return false;
        }

        constructor(name: string, declKind: PullElementKind) {
            this.name = name;
            this.declKind = declKind;
        }

        public isAlias() { return false; }
        public isContainer() { return false; }        

        public getName() { return this.name; }

        public getKind() { return this.declKind; }
        public setKind(declType: PullElementKind) { this.declKind = declType; }

        public setIsOptional() { this.isOptional = true; }
        public getIsOptional() { return this.isOptional; }

        public getIsVarArg() { return this.isVarArg; }
        public setIsVarArg() { this.isVarArg = true; }

        public setIsSynthesized() { this.isSynthesized = true; }
        public getIsSynthesized() { return this.isSynthesized; }

        public setIsSpecialized() { this.isSpecialized = true; this.isBeingSpecialized = false; }
        public getIsSpecialized() { return this.isSpecialized; }
        public currentlyBeingSpecialized() { return this.isBeingSpecialized; }
        public setIsBeingSpecialized() { this.isBeingSpecialized = true; }        

        public setIsBound(rebindingID: number) {
            this.isBound = true;
            this.rebindingID = rebindingID;
        }

        public getRebindingID() {
            return this.rebindingID;
        }

        public getIsBound() { return this.isBound; }

        public addCacheID(cacheID: string) {
            if (!this.cachedPathIDs[cacheID]) {
                this.cachedPathIDs[cacheID] = true;
            }
        }

        public invalidateCachedIDs(cache: any) {
            for (var id in this.cachedPathIDs) {
                if (cache[id]) {
                    cache[id] = undefined;
                }
            }
        }

        // declaration methods
        public addDeclaration(decl: PullDecl) { this.declarations.addItem(decl); }

        public getDeclarations() { return <PullDecl[]>this.declarations.find(d => d); }

        public removeDeclaration(decl: PullDecl) { this.declarations.remove(d => d === decl); }

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

                if (link.end.incomingLinks) {
                    link.end.incomingLinks.remove(p => p === link);
                }
            }
        }

        public updateOutgoingLinks(map: (item: PullSymbolLink, context: any) => void , context: any) {
            if (this.outgoingLinks) {
                this.outgoingLinks.update(map, context);
            }
        }

        public updateIncomingLinks(map: (item: PullSymbolLink, context: any) => void , context: any) {
            if (this.incomingLinks) {
                this.incomingLinks.update(map, context);
            }
        }

        // remove all outgoing, as well as incoming, links
        public removeAllLinks() {
            this.updateOutgoingLinks((item) => this.removeOutgoingLink(item), null);
            this.updateIncomingLinks((item) => item.start.removeOutgoingLink(item), null);
        }        

        public setContainer(containerSymbol: PullTypeSymbol) {
            //containerSymbol.addOutgoingLink(this, relationshipKind);

            var link = this.addOutgoingLink(containerSymbol, SymbolLinkKind.ContainedBy);
            this.cachedContainerLink = link;

            containerSymbol.addContainedByLink(link);
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

            if (this.cachedTypeLink) {
                this.unsetType();
            }

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
            var foundType = false;

            if (this.cachedTypeLink) {
                this.removeOutgoingLink(this.cachedTypeLink);
                foundType = true;
            }
            else {
                var typeList = this.findOutgoingLinks(link => link.kind == SymbolLinkKind.TypedAs);

                if (typeList.length) {
                    this.removeOutgoingLink(typeList[0]);
                }

                foundType = true;
            }

            if (foundType) {
                this.invalidate();
            }
        }

        public isTyped() {
            return this.getType() != null;
        }

        public setResolved() {
            this.hasBeenResolved = true;
            this.inResolution = false;
        }
        public isResolved() { return this.hasBeenResolved; }

        public startResolving() {
            this.inResolution = true;
        }
        public isResolving() {
            return this.inResolution;
        }

        public startResolvingTypeArguments() {
            this.resolvingTypeArguments = true;
        }

        public isResolvingTypeArguments() {
            return this.resolvingTypeArguments;
        }

        public doneResolvingTypeArguments() {
            this.resolvingTypeArguments = false;
        }

        public setUnresolved() {
            this.hasBeenResolved = false;
            this.isBound = false;
        }

        public invalidate() {

            //this.removeOutgoingLink(this.cachedContainerLink);
            //this.removeOutgoingLink(this.cachedTypeLink);

            //this.cachedContainerLink = null;

            this.docComments = null;

            this.hasBeenResolved = false;
            this.isBound = false;

            // reset the errors for its decl
            this.declarations.update((pullDecl: PullDecl) => pullDecl.resetErrors(), null);
        }

        public hasFlag(flag: PullElementFlags): bool {
            var declarations = this.getDeclarations();
            for (var i = 0, n = declarations.length; i < n; i++) {
                if ((declarations[i].getFlags() & flag) !== PullElementFlags.None) {
                    return true;
                }
            }
            return false;
        }

        public allDeclsHaveFlag(flag: PullElementFlags): bool {
            var declarations = this.getDeclarations();
            for (var i = 0, n = declarations.length; i < n; i++) {
                if (!((declarations[i].getFlags() & flag) !== PullElementFlags.None)) {
                    return false;
                }
            }
            return true;
        }        

        public pathToRoot() {
            var path: PullSymbol[] = [];
            var node = this;
            while (node) {
                if (node.isType()) {
                    var associatedContainerSymbol = (<PullTypeSymbol>node).getAssociatedContainerType();
                    if (associatedContainerSymbol) {
                        node = associatedContainerSymbol;
                    }
                }
                path[path.length] = node;
                node = node.getContainer();
            }
            return path;
        }

        public findCommonAncestorPath(b: PullSymbol): PullSymbol[] {
            var aPath = this.pathToRoot();
            if (aPath.length == 1) {
                // Global symbol
                return aPath;
            }

            var bPath: PullSymbol[];
            if (b) {
                bPath = b.pathToRoot();
            } else {
                return aPath;
            }

            var commonNodeIndex = -1;
            for (var i = 0, aLen = aPath.length; i < aLen; i++) {
                var aNode = aPath[i];
                for (var j = 0, bLen = bPath.length; j < bLen; j++) {
                    var bNode = bPath[j];
                    if (aNode == bNode) {
                        commonNodeIndex = i;
                        break;
                    }
                }
                if (commonNodeIndex >= 0) {
                    break;
                }
            }

            if (commonNodeIndex >= 0) {
                return aPath.slice(0, commonNodeIndex);
            }
            else {
                return aPath;
            }
        }

        public toString() {
            var str = this.getNameAndTypeName();
            return str;
        }

        public fullName() {
            var path = this.pathToRoot();
            var fullName = "";
            for (var i = 1; i < path.length; i++) {
                fullName = path[i].getName() + "." + fullName;
            }
            fullName = fullName + this.getName();
            return fullName;
        }

        public getScopedName(scopeSymbol?: PullSymbol) {
            var path = this.findCommonAncestorPath(scopeSymbol);
            var fullName = "";
            for (var i = 1; i < path.length; i++) {
                var kind = path[i].getKind();
                if (kind == PullElementKind.Container) {
                    fullName = path[i].getName() + "." + fullName;
                } else {
                    break;
                }
            }
            fullName = fullName + this.getName();
            return fullName;
        }

        public getScopedNameEx(scopeSymbol?: PullSymbol, getPrettyTypeName?: bool) {
            var name = this.getScopedName(scopeSymbol);
            return MemberName.create(name);
        }

        public getTypeName(scopeSymbol?: PullSymbol, getPrettyTypeName?: bool) {
            var memberName = this.getTypeNameEx(scopeSymbol, getPrettyTypeName);
            return memberName.toString();
        }

        public getTypeNameEx(scopeSymbol?: PullSymbol, getPrettyTypeName?: bool) {
            var type = this.getType();
            if (type) {
                return type.getScopedNameEx(scopeSymbol, getPrettyTypeName);
            }
            return MemberName.create("");
        }

        public getNameAndTypeName(scopeSymbol?: PullSymbol) {
            var nameAndTypeName = this.getNameAndTypeNameEx(scopeSymbol);
            return nameAndTypeName.toString();
        }

        public getNameAndTypeNameEx(scopeSymbol?: PullSymbol) {
            var type = this.getType();
            var nameEx = this.getScopedNameEx(scopeSymbol);
            if (type) {
                var nameStr = nameEx.toString() + (this.getIsOptional() ? "?" : "");
                if (this.declKind != PullElementKind.Property) {
                    var signatures = type.getCallSignatures();
                    var typeName = new MemberNameArray();
                    var signatureName = PullSignatureSymbol.getSignaturesTypeNameEx(signatures, nameStr, false, false, scopeSymbol);
                    typeName.addAll(signatureName);
                    return typeName;
                } else {
                    var typeNameEx = type.getScopedNameEx(scopeSymbol);
                    var memberName = MemberName.create(typeNameEx, nameStr + ": ", "");
                    return memberName;
                }
            }
            return nameEx;
        }

        static getTypeParameterString(typars: PullTypeSymbol[], scopeSymbol?: PullSymbol) {
            var typarString = "";
            if (typars && typars.length) {
                typarString = "<";
                for (var i = 0; i < typars.length; i++) {
                    if (i) {
                        typarString += ", ";
                    }
                    typarString += typars[i].getScopedNameEx(scopeSymbol).toString();
                }
                typarString += ">";
            }
            return typarString;
        }
    }

    export class PullSignatureSymbol extends PullSymbol {
        private parameterLinks: PullSymbolLink[] = null;
        private typeParameterLinks: PullSymbolLink[] = null;

        private returnTypeLink: PullSymbolLink = null;

        private hasOptionalParam = false;
        private nonOptionalParamCount = 0;

        private hasVarArgs = false;

        private specializationCache: any = {}

        private memberTypeParameterNameCache: any = null;

        private hasAGenericParameter = false;

        constructor(kind: PullElementKind) {
            super("", kind);
        }

        public isDefinition() { return false; }

        public hasVariableParamList() { return this.hasVarArgs; }
        public setHasVariableParamList() { this.hasVarArgs = true; }

        public setHasGenericParameter() { this.hasAGenericParameter = true; }
        public hasGenericParameter() { return this.hasAGenericParameter; }

        public isGeneric() { return this.hasAGenericParameter || (this.typeParameterLinks && this.typeParameterLinks.length != 0); }

        public addParameter(parameter: PullSymbol, isOptional = false) {
            if (!this.parameterLinks) {
                this.parameterLinks = [];
            }

            var link = this.addOutgoingLink(parameter, SymbolLinkKind.Parameter);
            this.parameterLinks[this.parameterLinks.length] = link;
            this.hasOptionalParam = isOptional;

            if (!isOptional) {
                this.nonOptionalParamCount++;
            }
        }

        public addSpecialization(signature: PullSignatureSymbol, typeArguments: PullTypeSymbol[]) {
            if (typeArguments && typeArguments.length) {
                this.specializationCache[getIDForTypeSubstitutions(typeArguments)] = signature;
            }
        }

        public getSpecialization(typeArguments): PullSignatureSymbol {
            var sig = <PullSignatureSymbol>this.specializationCache[getIDForTypeSubstitutions(typeArguments)];

            if (sig) {
                return sig;
            }

            return null;
        }

        public addTypeParameter(parameter: PullTypeParameterSymbol) {
            if (!this.typeParameterLinks) {
                this.typeParameterLinks = [];
            }

            if (!this.memberTypeParameterNameCache) {
                this.memberTypeParameterNameCache = new BlockIntrinsics();
            }

            var link = this.addOutgoingLink(parameter, SymbolLinkKind.TypeParameter);
            this.typeParameterLinks[this.typeParameterLinks.length] = link;

            this.memberTypeParameterNameCache[link.end.getName()] = link.end;
        }

        public getNonOptionalParameterCount() { return this.nonOptionalParamCount; }

        public setReturnType(returnType: PullTypeSymbol) {

            if (returnType) {
                if (this.returnTypeLink) {
                    this.removeOutgoingLink(this.returnTypeLink);
                }
                this.returnTypeLink = this.addOutgoingLink(returnType, SymbolLinkKind.ReturnType);
            }
        }

        public getParameters() {
            var params: PullSymbol[] = [];

            if (this.parameterLinks) {
                for (var i = 0; i < this.parameterLinks.length; i++) {
                    params[params.length] = this.parameterLinks[i].end;
                }
            }

            return params;
        }

        public getTypeParameters(): PullTypeParameterSymbol[] {
            var params: PullTypeParameterSymbol[] = [];

            if (this.typeParameterLinks) {
                for (var i = 0; i < this.typeParameterLinks.length; i++) {
                    params[params.length] = <PullTypeParameterSymbol>this.typeParameterLinks[i].end;
                }
            }

            return params;
        }

        public findTypeParameter(name: string): PullTypeParameterSymbol {
            var memberSymbol: PullTypeParameterSymbol;

            if (!this.memberTypeParameterNameCache) {
                this.memberTypeParameterNameCache = new BlockIntrinsics();

                if (this.typeParameterLinks) {
                    for (var i = 0; i < this.typeParameterLinks.length; i++) {
                        this.memberTypeParameterNameCache[this.typeParameterLinks[i].end.getName()] = this.typeParameterLinks[i].end;
                    }
                }
            }

            memberSymbol = this.memberTypeParameterNameCache[name];

            return memberSymbol;
        }

        public removeParameter(parameterSymbol: PullSymbol) {
            var paramLink: PullSymbolLink;

            if (this.parameterLinks) {
                for (var i = 0; i < this.parameterLinks.length; i++) {
                    if (parameterSymbol == this.parameterLinks[i].end) {
                        paramLink = this.parameterLinks[i];
                        this.removeOutgoingLink(paramLink);
                        break;
                    }
                }
            }

            this.invalidate();
        }

        public mimicSignature(signature: PullSignatureSymbol) {
            // mimic type parameters
            var typeParameters = signature.getTypeParameters();
            var typeParameter: PullTypeParameterSymbol;

            if (typeParameters) {
                for (var i = 0; i < typeParameters.length; i++) {
                    typeParameter = new PullTypeParameterSymbol(typeParameters[i].getName());
                    typeParameter.addDeclaration(typeParameters[i].getDeclarations()[0]);
                    this.addTypeParameter(typeParameter);
                }
            }

            // mimic paremeteres (optionality, varargs)
            var parameters = signature.getParameters();
            var parameter: PullSymbol;

            if (parameters) {
                for (var j = 0; j < parameters.length; j++) {
                    parameter = new PullSymbol(parameters[j].getName(), PullElementKind.Parameter);
                    parameter.addDeclaration(parameters[j].getDeclarations()[0]);
                    if (parameters[j].getIsOptional()) {
                        parameter.setIsOptional();
                    }
                    if (parameters[j].getIsVarArg()) {
                        parameter.setIsVarArg();
                        this.setHasVariableParamList();
                    }
                    this.addParameter(parameter);
                }
            }

            // Don't set the return type, since that will just lead to redundant
            // calls to setReturnType when we re-resolve the signature for
            // specialization

            // var returnType = signature.getReturnType();

            // if (returnType) {
            //     this.setReturnType(returnType);
            // }
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

        public invalidate() {

            this.parameterLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.Parameter);
            this.nonOptionalParamCount = 0;
            this.hasOptionalParam = false;
            this.hasAGenericParameter = false;

            // re-compute non-optional arg count, etc
            if (this.parameterLinks) {
                for (var i = 0; i < this.parameterLinks.length; i++) {

                    this.parameterLinks[i].end.invalidate();

                    if (!this.parameterLinks[i].end.getIsOptional()) {
                        this.nonOptionalParamCount++;
                    }
                    else {
                        this.hasOptionalParam;
                        break;
                    }
                }
            }

            super.invalidate();
        }

        static getSignatureTypeMemberName(candidateSignature: PullSignatureSymbol, signatures: PullSignatureSymbol[], scopeSymbol: PullSymbol) {
            var allMemberNames = new MemberNameArray();
            var signatureMemberName = PullSignatureSymbol.getSignaturesTypeNameEx(signatures, "", false, false, scopeSymbol, true, candidateSignature);
            allMemberNames.addAll(signatureMemberName);
            return allMemberNames;
        }

        static getSignaturesTypeNameEx(signatures: PullSignatureSymbol[], prefix: string, shortform: bool, brackets: bool, scopeSymbol?: PullSymbol, getPrettyTypeName?: bool, candidateSignature?: PullSignatureSymbol) {
            var result: MemberName[] = [];
            var len = signatures.length;
            if (!getPrettyTypeName && len > 1) {
                shortform = false;
            }

            var i = 0
            var foundDefinition = false;
            if (candidateSignature && candidateSignature.isDefinition() && len > 1) {
                // Overloaded signature with candidateSignature = definition - cannot be used.
                candidateSignature = null;
            }

            for (; i < len; i++) {
                // the definition signature shouldn't be printed if there are overloads
                if (len > 1 && signatures[i].isDefinition()) {
                    foundDefinition = true;
                    continue;
                }

                var signature = signatures[i];
                if (getPrettyTypeName && candidateSignature) {
                    signature = candidateSignature;
                }

                result.push(signature.getSignatureTypeNameEx(prefix, shortform, brackets, scopeSymbol));
                if (getPrettyTypeName) {
                    break;
                }
            }

            if (getPrettyTypeName && len > 1) {
                var lastMemberName = <MemberNameArray>result[result.length - 1];
                for (i = i + 1; i < len; i++) {
                    if (signatures[i].isDefinition()) {
                        foundDefinition = true;
                        break;
                    }
                }
                var overloadString = " (+ " + (foundDefinition ? len - 2 : len - 1) + " overload(s))";
                lastMemberName.add(MemberName.create(overloadString));
            }

            return result;
        }

        public toString() {
            var s = this.getSignatureTypeNameEx(this.getScopedNameEx().toString(), false, false).toString();
            return s;
        }

        public getSignatureTypeNameEx(prefix: string, shortform: bool, brackets: bool, scopeSymbol?: PullSymbol) {
            var builder = new MemberNameArray();
            var typeParameters = this.getTypeParameters();
            var typeParameterString = PullSymbol.getTypeParameterString(typeParameters, scopeSymbol);
            if (brackets) {
                builder.prefix = prefix + typeParameterString + "[";
            }
            else {
                builder.prefix = prefix + typeParameterString + "(";
            }

            // TODO : shkamat : variable args
            var params = this.getParameters();
            var paramLen = params.length;
            var len = paramLen;
            for (var i = 0 ; i < params.length; i++) {
                var paramType = params[i].getType();
                var typeString = paramType ? ": " : "";
                builder.add(MemberName.create(params[i].getScopedNameEx(scopeSymbol).toString() + (params[i].getIsOptional() ? "?" : "") + typeString));
                if (paramType) {
                    builder.add(paramType.getScopedNameEx(scopeSymbol));
                }
                if (i < paramLen - 1) {
                    builder.add(MemberName.create(", "));
                }
            }

            if (shortform) {
                if (brackets) {
                    builder.add(MemberName.create("] => "));
                }
                else {
                    builder.add(MemberName.create(") => "));
                }
            }
            else {
                if (brackets) {
                    builder.add(MemberName.create("]: "));
                }
                else {
                    builder.add(MemberName.create("): "));
                }
            }

            var returnType = this.getReturnType();

            if (returnType) {
                builder.add(returnType.getScopedNameEx(scopeSymbol));
            }
            else {
                builder.add(MemberName.create("any"));
            }

            return builder;
        }
    }

    export class PullTypeSymbol extends PullSymbol {
        private memberLinks: PullSymbolLink[] = null;
        private typeParameterLinks: PullSymbolLink[] = null;
        private specializationLinks: PullSymbolLink[] = null;
        private containedByLinks: PullSymbolLink[] = null;

        private memberNameCache: any = null;
        private memberTypeNameCache: any = null;
        private memberTypeParameterNameCache: any = null;
        private containedMemberCache: any = null;

        private typeArguments: PullTypeSymbol[] = null;

        private specializedTypeCache: any = null;

        private memberCache: PullSymbol[] = null;

        private implementedTypeLinks: PullSymbolLink[] = null;
        private extendedTypeLinks: PullSymbolLink[] = null;

        private callSignatureLinks: PullSymbolLink[] = null;
        private constructSignatureLinks: PullSymbolLink[] = null;
        private indexSignatureLinks: PullSymbolLink[] = null;

        private arrayType: PullTypeSymbol = null;

        private isSpecialized = false;
        private isBeingSpecialized = false;
        private hasGenericSignature = false;

        private invalidatedSpecializations = false;

        private associatedContainerTypeSymbol: PullTypeSymbol = null;

        public isType() { return true; }
        public isClass() { return false; }
        public hasMembers() { return this.memberLinks && this.memberLinks.length != 0; }
        public isFunction() { return false; }
        public isTypeParameter() { return false; }
        public isTypeVariable() { return false; }

        public setHasGenericSignature() { this.hasGenericSignature = true; }

        public setAssociatedContainerType(type: PullTypeSymbol) {
            this.associatedContainerTypeSymbol = type;
        }

        public getAssociatedContainerType() {
            return this.associatedContainerTypeSymbol;
        }

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

        public addContainedByLink(containedByLink: PullSymbolLink) {
            if (!this.containedByLinks) {
                this.containedByLinks = [];
            }

            if (!this.containedMemberCache) {
                this.containedMemberCache = {};
            }

            this.containedByLinks[this.containedByLinks.length] = containedByLink;
            this.containedMemberCache[containedByLink.start.getName()] = containedByLink.start;
        }

        public findContainedMember(name: string): PullSymbol {

            if (!this.containedByLinks) {
                this.containedByLinks = this.findIncomingLinks(psl => psl.kind == SymbolLinkKind.ContainedBy);
                this.containedMemberCache = {};

                for (var i = 0; i < this.containedByLinks.length; i++) {
                    this.containedMemberCache[this.containedByLinks[i].start.getName()] = this.containedByLinks[i].start;
                }
            }

            return this.containedMemberCache[name];
        }

        public addMember(memberSymbol: PullSymbol, linkKind: SymbolLinkKind) {

            var link = this.addOutgoingLink(memberSymbol, linkKind);

            memberSymbol.setContainer(this);
            
            if (!this.memberCache) {
                this.memberCache = [];
            }

            if (!this.memberNameCache) {
                this.memberNameCache = new BlockIntrinsics();
            }

            if (!this.memberLinks) {
                this.memberLinks = [];
            }

            if (!memberSymbol.isType()) {
                this.memberLinks[this.memberLinks.length] = link;

                this.memberCache[this.memberCache.length] = memberSymbol;

                if (!this.memberNameCache) {
                    this.memberNameCache = new BlockIntrinsics();
                }
                this.memberNameCache[memberSymbol.getName()] = memberSymbol;
            }
            else {
                if ((<PullTypeSymbol>memberSymbol).isTypeParameter()) {
                    if (!this.typeParameterLinks) {
                        this.typeParameterLinks = [];
                    }
                    if (!this.memberTypeParameterNameCache) {
                        this.memberTypeParameterNameCache = new BlockIntrinsics();
                    }
                    this.typeParameterLinks[this.typeParameterLinks.length] = link;
                    this.memberTypeParameterNameCache[memberSymbol.getName()] = memberSymbol;
                }
                else {
                    if (!this.memberTypeNameCache) {
                        this.memberTypeNameCache = new BlockIntrinsics();
                    }
                    this.memberLinks[this.memberLinks.length] = link;
                    this.memberTypeNameCache[memberSymbol.getName()] = memberSymbol;
                    this.memberCache[this.memberCache.length] = memberSymbol;
                }
            }
        }

        public removeMember(memberSymbol: PullSymbol) {
            var memberLink: PullSymbolLink;
            var child: PullSymbol;

            var links = (memberSymbol.isType() && (<PullTypeSymbol>memberSymbol).isTypeParameter()) ? this.typeParameterLinks : this.memberLinks;

            if (links) {
                for (var i = 0; i < links.length; i++) {
                    if (memberSymbol == links[i].end) {
                        memberLink = links[i];
                        child = memberLink.end;
                        child.unsetContainer();
                        this.removeOutgoingLink(memberLink);
                        break;
                    }
                }
            }

            this.invalidate();
        }

        public getMembers(): PullSymbol[] {

            if (this.memberCache) {
                return this.memberCache;
            }
            else {
                var members: PullSymbol[] = [];

                if (this.memberLinks) {
                    for (var i = 0; i < this.memberLinks.length; i++) {
                        members[members.length] = this.memberLinks[i].end;
                    }
                }

                if (members.length) {
                    this.memberCache = members;
                }

                return members;
            }
        }

        public getTypeParameters(): PullTypeParameterSymbol[] {
            var members: PullTypeParameterSymbol[] = [];

            if (this.typeParameterLinks) {
                for (var i = 0; i < this.typeParameterLinks.length; i++) {
                    members[members.length] = <PullTypeParameterSymbol>this.typeParameterLinks[i].end;
                }
            }

            return members;
        }

        public isGeneric(): bool { return (this.typeParameterLinks && this.typeParameterLinks.length != 0) || this.hasGenericSignature; }

        public addSpecialization(specializedVersionOfThisType: PullTypeSymbol, substitutingTypes: PullTypeSymbol[]): void {

            if (!substitutingTypes || !substitutingTypes.length) {
                return;
            }

            if (!this.specializedTypeCache) {
                this.specializedTypeCache = {};
            }

            if (!this.specializationLinks) {
                this.specializationLinks = [];
            }

            this.specializationLinks[this.specializationLinks.length] = this.addOutgoingLink(specializedVersionOfThisType, SymbolLinkKind.SpecializedTo);

            this.specializedTypeCache[getIDForTypeSubstitutions(substitutingTypes)] = specializedVersionOfThisType;
        }

        public getSpecialization(substitutingTypes: PullTypeSymbol[]): PullTypeSymbol {
            if (!this.specializedTypeCache) {
                this.specializedTypeCache = {};

                return null;
            }

            var specialization = <PullTypeSymbol>this.specializedTypeCache[getIDForTypeSubstitutions(substitutingTypes)];

            if (!specialization) {
                return null;
            }

            return specialization;
        }

        public getKnownSpecializations(): PullTypeSymbol[] {
            var specializations: PullTypeSymbol[] = [];

            if (this.specializedTypeCache) {
                for (var specializationID in this.specializedTypeCache) {
                    specializations[specializations.length] = this.specializedTypeCache[specializationID];
                }
            }

            return specializations;
        }

        public invalidateSpecializations() {

            if (this.invalidatedSpecializations) {
                return;
            }

            var specializations = this.getKnownSpecializations();
            var i = 0;

            for (i = 0; i < specializations.length; i++) {
                specializations[i].invalidate();
            }

            if (this.specializationLinks && this.specializationLinks.length) {
            
                for (i = 0; i < this.specializationLinks.length; i++) {
                    this.removeOutgoingLink(this.specializationLinks[i]);
                }
            }

            this.specializedTypeCache = null;

            this.invalidatedSpecializations = true;
        }

        public getTypeArguments() { return this.typeArguments; }
        public setTypeArguments(typeArgs: PullTypeSymbol[]) { this.typeArguments = typeArgs; }

        public addCallSignature(callSignature: PullSignatureSymbol) {

            if (!this.callSignatureLinks) {
                this.callSignatureLinks = [];
            }

            var link = this.addOutgoingLink(callSignature, SymbolLinkKind.CallSignature);
            this.callSignatureLinks[this.callSignatureLinks.length] = link;

            if (callSignature.isGeneric()) {
                this.hasGenericSignature = true;
            }
        }

        public addCallSignatures(callSignatures: PullSignatureSymbol[]) {

            if (!this.callSignatureLinks) {
                this.callSignatureLinks = [];
            }

            for (var i = 0; i < callSignatures.length; i++) {
                this.addCallSignature(callSignatures[i]);
            }
        }

        public addConstructSignature(constructSignature: PullSignatureSymbol) {

            if (!this.constructSignatureLinks) {
                this.constructSignatureLinks = [];
            }

            var link = this.addOutgoingLink(constructSignature, SymbolLinkKind.ConstructSignature);
            this.constructSignatureLinks[this.constructSignatureLinks.length] = link;

            if (constructSignature.isGeneric()) {
                this.hasGenericSignature = true;
            }
        }

        public addConstructSignatures(constructSignatures: PullSignatureSymbol[]) {

            if (!this.constructSignatureLinks) {
                this.constructSignatureLinks = [];
            }

            for (var i = 0; i < constructSignatures.length; i++) {
                this.addConstructSignature(constructSignatures[i]);
            }
        }

        public addIndexSignature(indexSignature: PullSignatureSymbol) {
            if (!this.indexSignatureLinks) {
                this.indexSignatureLinks = [];
            }

            var link = this.addOutgoingLink(indexSignature, SymbolLinkKind.IndexSignature);
            this.indexSignatureLinks[this.indexSignatureLinks.length] = link;

            if (indexSignature.isGeneric()) {
                this.hasGenericSignature = true;
            }
        }

        public addIndexSignatures(indexSignatures: PullSignatureSymbol[]) {
            if (!this.indexSignatureLinks) {
                this.indexSignatureLinks = [];
            }

            for (var i = 0; i < indexSignatures.length; i++) {
                this.addIndexSignature(indexSignatures[i]);
            }
        }

        public getCallSignatures(): PullSignatureSymbol[] {
            var members: PullSymbol[] = [];

            if (this.callSignatureLinks) {
                for (var i = 0; i < this.callSignatureLinks.length; i++) {
                    members[members.length] = this.callSignatureLinks[i].end;
                }
            }

            return <PullSignatureSymbol[]>members;
        }

        public getConstructSignatures(): PullSignatureSymbol[] {
            var members: PullSymbol[] = [];

            if (this.constructSignatureLinks) {
                for (var i = 0; i < this.constructSignatureLinks.length; i++) {
                    members[members.length] = this.constructSignatureLinks[i].end;
                }
            }

            return <PullSignatureSymbol[]>members;
        }

        public getIndexSignatures(): PullSignatureSymbol[] {
            var members: PullSymbol[] = [];

            if (this.indexSignatureLinks) {
                for (var i = 0; i < this.indexSignatureLinks.length; i++) {
                    members[members.length] = this.indexSignatureLinks[i].end;
                }
            }

            return <PullSignatureSymbol[]>members;
        }

        public removeCallSignature(signature: PullSignatureSymbol, invalidate = true) {
            var signatureLink: PullSymbolLink;

            if (this.callSignatureLinks) {
                for (var i = 0; i < this.callSignatureLinks.length; i++) {
                    if (signature == this.callSignatureLinks[i].end) {
                        signatureLink = this.callSignatureLinks[i];
                        this.removeOutgoingLink(signatureLink);
                        break;
                    }
                }
            }

            if (invalidate) {
                this.invalidate();
            }
        }

        public recomputeCallSignatures() {
            this.callSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.CallSignature);
        }

        public removeConstructSignature(signature: PullSignatureSymbol, invalidate = true) {
            var signatureLink: PullSymbolLink;

            if (this.constructSignatureLinks) {
                for (var i = 0; i < this.constructSignatureLinks.length; i++) {
                    if (signature == this.constructSignatureLinks[i].end) {
                        signatureLink = this.constructSignatureLinks[i];
                        this.removeOutgoingLink(signatureLink);
                        break;
                    }
                }
            }

            if (invalidate) {
                this.invalidate();
            }
        }

        public recomputeConstructSignatures() {
            this.constructSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.ConstructSignature);
        }

        public removeIndexSignature(signature: PullSignatureSymbol, invalidate = true) {
            var signatureLink: PullSymbolLink;

            if (this.indexSignatureLinks) {
                for (var i = 0; i < this.indexSignatureLinks.length; i++) {
                    if (signature == this.indexSignatureLinks[i].end) {
                        signatureLink = this.indexSignatureLinks[i];
                        this.removeOutgoingLink(signatureLink);
                        break;
                    }
                }
            }

            if (invalidate) {
                this.invalidate();
            }
        }

        public recomputeIndexSignatures() {
            this.indexSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.IndexSignature);
        }

        public addImplementedType(interfaceType: PullTypeSymbol) {
            if (!this.implementedTypeLinks) {
                this.implementedTypeLinks = [];
            }

            var link = this.addOutgoingLink(interfaceType, SymbolLinkKind.Implements);
            this.implementedTypeLinks[this.implementedTypeLinks.length] = link;
        }

        public getImplementedTypes(): PullTypeSymbol[] {
            var members: PullSymbol[] = [];

            if (this.implementedTypeLinks) {
                for (var i = 0; i < this.implementedTypeLinks.length; i++) {
                    members[members.length] = this.implementedTypeLinks[i].end;
                }
            }

            return <PullTypeSymbol[]>members;
        }

        public removeImplementedType(implementedType: PullTypeSymbol) {
            var typeLink: PullSymbolLink;

            if (this.implementedTypeLinks) {
                for (var i = 0; i < this.implementedTypeLinks.length; i++) {
                    if (implementedType == this.implementedTypeLinks[i].end) {
                        typeLink = this.implementedTypeLinks[i];
                        this.removeOutgoingLink(typeLink);
                        break;
                    }
                }
            }

            this.invalidate();
        }

        public addExtendedType(extendedType: PullTypeSymbol) {
            if (!this.extendedTypeLinks) {
                this.extendedTypeLinks = [];
            }

            var link = this.addOutgoingLink(extendedType, SymbolLinkKind.Extends);
            this.extendedTypeLinks[this.extendedTypeLinks.length] = link;

            // var parentMembers = extendedType.getMembers();

            // PULLTODO: Restrict member list to public properties only
            // for (var i = 0; i < parentMembers.length; i++) {
            //     this.addMember(parentMembers[i], SymbolLinkKind.PublicMember);
            // }
        }

        public getExtendedTypes(): PullTypeSymbol[] {
            var members: PullSymbol[] = [];

            if (this.extendedTypeLinks) {
                for (var i = 0; i < this.extendedTypeLinks.length; i++) {
                    members[members.length] = this.extendedTypeLinks[i].end;
                }
            }

            return <PullTypeSymbol[]>members;
        }

        public hasBase(potentialBase: PullTypeSymbol) {

            if (this == potentialBase) {
                return true;
            }

            var extendedTypes = this.getExtendedTypes();
            var i = 0;

            for (i = 0; i < extendedTypes.length; i++) {
                if (extendedTypes[i].hasBase(potentialBase)) {
                    return true;
                }
            }

            var implementedTypes = this.getImplementedTypes();

            for (i = 0; i < implementedTypes.length; i++) {
                if (implementedTypes[i].hasBase(potentialBase)) {
                    return true;
                }
            }

            return false;
        }

        public removeExtendedType(extendedType: PullTypeSymbol) {
            var typeLink: PullSymbolLink;

            if (this.extendedTypeLinks) {
                for (var i = 0; i < this.extendedTypeLinks.length; i++) {
                    if (extendedType == this.extendedTypeLinks[i].end) {
                        typeLink = this.extendedTypeLinks[i];
                        this.removeOutgoingLink(typeLink);
                        break;
                    }
                }
            }

            this.invalidate();
        }

        public findMember(name: string): PullSymbol {
            var memberSymbol: PullSymbol;
            var i = 0;

            if (!this.memberNameCache) {
                this.populateMemberCache();
            }

            memberSymbol = this.memberNameCache[name];

            if (memberSymbol) {
                return memberSymbol;
            }

            // check parents
            if (!memberSymbol && this.extendedTypeLinks) {

                for (i = 0 ; i < this.extendedTypeLinks.length; i++) {
                    memberSymbol = (<PullTypeSymbol>this.extendedTypeLinks[i].end).findMember(name);

                    if (memberSymbol) {
                        return memberSymbol;
                    }
                }
            }

            if (!memberSymbol && this.implementedTypeLinks) {

                for (i = 0 ; i < this.implementedTypeLinks.length; i++) {
                    memberSymbol = (<PullTypeSymbol>this.implementedTypeLinks[i].end).findMember(name);

                    if (memberSymbol) {
                        return memberSymbol;
                    }
                }
            }

            // when all else fails, look for a nested type name
            return this.findNestedType(name);
        }

        public findNestedType(name: string): PullTypeSymbol {
            var memberSymbol: PullTypeSymbol;

            if (!this.memberTypeNameCache) {
                this.populateMemberTypeCache();
            }

            memberSymbol = this.memberTypeNameCache[name];

            return memberSymbol;
        }

        private populateMemberCache() {
            if (!this.memberNameCache) {
                this.memberNameCache = new BlockIntrinsics();
                this.memberCache = [];

                if (this.memberLinks) {
                    for (var i = 0; i < this.memberLinks.length; i++) {
                        this.memberNameCache[this.memberLinks[i].end.getName()] = this.memberLinks[i].end;
                        this.memberCache[this.memberCache.length] = this.memberLinks[i].end;
                    }
                }
            }
        }

        private populateMemberTypeCache() {
            if (!this.memberTypeNameCache) {
                this.memberTypeNameCache = new BlockIntrinsics();

                var setAll = false;

                if (!this.memberCache) {
                    this.memberCache = [];
                    this.memberNameCache = new BlockIntrinsics();
                    setAll = true;
                }

                if (this.memberLinks) {
                    for (var i = 0; i < this.memberLinks.length; i++) {
                        if (this.memberLinks[i].end.isType()) {
                            this.memberTypeNameCache[this.memberLinks[i].end.getName()] = this.memberLinks[i].end;
                            this.memberCache[this.memberCache.length] = this.memberLinks[i].end;
                        }
                        else if (setAll) {
                            this.memberNameCache[this.memberLinks[i].end.getName()] = this.memberLinks[i].end;
                            this.memberCache[this.memberCache.length] = this.memberLinks[i].end;
                        }
                    }
                }
            }
        }

        public getAllMembers(searchDeclKind: PullElementKind, includePrivate: bool): PullSymbol[] {

            var allMembers: PullSymbol[] = [];
            var i = 0;
            var j = 0;
            var m = 0;
            var n = 0;

            // Update the cache id needed
            if (!this.memberTypeNameCache) {
                this.populateMemberTypeCache();
            }

            // Add members
            for (i = 0, n = this.memberCache.length; i < n; i++) {
                var member = this.memberCache[i];
                if ((member.getKind() & searchDeclKind) && (includePrivate || !member.hasFlag(PullElementFlags.Private))) {
                    allMembers[allMembers.length] = member;
                }
            }

            // Add parent members
            if (this.extendedTypeLinks) {

                for (i = 0, n = this.extendedTypeLinks.length; i < n; i++) {
                    var extendedMembers = (<PullTypeSymbol>this.extendedTypeLinks[i].end).getAllMembers(searchDeclKind, includePrivate);

                    for (j = 0, m = extendedMembers.length; j < m; j++) {
                        var extendedMember = extendedMembers[j];
                        if (!this.memberNameCache[extendedMember.getName()]) {
                            allMembers[allMembers.length] = extendedMember;
                        }
                    }
                }
            }

            if (this.implementedTypeLinks) {

                for (i = 0 ; i < this.implementedTypeLinks.length; i++) {
                    var implementedMembers = (<PullTypeSymbol>this.implementedTypeLinks[i].end).getAllMembers(searchDeclKind, includePrivate);

                    for (j = 0, m = implementedMembers.length; j < m; j++) {
                        var implementedMember = implementedMembers[j];
                        if (!this.memberNameCache[implementedMember.getName()]) {
                            allMembers[allMembers.length] = implementedMember;
                        }
                    }
                }
            }

            return allMembers;
        }

        public findTypeParameter(name: string): PullTypeParameterSymbol {
            var memberSymbol: PullTypeParameterSymbol;

            if (!this.memberTypeParameterNameCache) {
                this.memberTypeParameterNameCache = new BlockIntrinsics();

                if (this.typeParameterLinks) {
                    for (var i = 0; i < this.typeParameterLinks.length; i++) {
                        this.memberTypeParameterNameCache[this.typeParameterLinks[i].end.getName()] = this.typeParameterLinks[i].end;
                    }
                }
            }

            memberSymbol = this.memberTypeParameterNameCache[name];

            return memberSymbol;
        }

        public cleanTypeParameters() {
            if (this.typeParameterLinks) {
                for (var i = 0; i < this.typeParameterLinks.length; i++) {
                    this.removeOutgoingLink(this.typeParameterLinks[i]);
                }
            }

            this.typeParameterLinks = null;
            this.memberTypeParameterNameCache = null;
        }

        public setResolved() {
            this.invalidatedSpecializations = true;
            super.setResolved();
        }

        public invalidate() {

            this.memberNameCache = null;
            this.memberCache = null;
            this.memberTypeNameCache = null;
            this.containedMemberCache = null;

            this.invalidatedSpecializations = false;

            this.containedByLinks = null;

            this.memberLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.PrivateMember ||
                                                              psl.kind == SymbolLinkKind.PublicMember);

            this.typeParameterLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.TypeParameter);

            this.callSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.CallSignature);

            this.constructSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.ConstructSignature);

            this.indexSignatureLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.IndexSignature);

            this.implementedTypeLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.Implements);

            this.extendedTypeLinks = this.findOutgoingLinks(psl => psl.kind == SymbolLinkKind.Extends);

            super.invalidate();
        }

        public getScopedName(scopeSymbol?: PullSymbol): string {
            var name = super.getScopedName(scopeSymbol);

            var typars = this.getTypeArguments();
            if (!typars || !typars.length) {
                typars = this.getTypeParameters();
            }

            var typarString = PullSymbol.getTypeParameterString(typars);
            return name + typarString;
        }

        public isNamedTypeSymbol() {
            var kind = this.getKind();
            if (kind == PullElementKind.Primitive || // primitives
                kind == PullElementKind.Class || // class
                kind == PullElementKind.Container || // module
                kind == PullElementKind.Enum || // enum
                kind == PullElementKind.TypeParameter || //TypeParameter
                ((kind == PullElementKind.Interface || kind == PullElementKind.ObjectType) && this.getName() != "")) {
                return true;
            }

            return false;
        }

        public toString() {
            var s = this.getScopedNameEx().toString();
            return s;
        }

        public getScopedNameEx(scopeSymbol?: PullSymbol, getPrettyTypeName?: bool) {
            if (!this.isNamedTypeSymbol()) {
                return this.getMemberTypeNameEx(true, scopeSymbol, getPrettyTypeName);
            }

            return super.getScopedNameEx(scopeSymbol, getPrettyTypeName);
        }

        public hasOnlyOverloadCallSignatures() {
            var members = this.getMembers();
            var callSignatures = this.getCallSignatures();
            var constructSignatures = this.getConstructSignatures();
            return members.length == 0 && constructSignatures.length == 0 && callSignatures.length > 1;
        }

        public getMemberTypeNameEx(topLevel: bool, scopeSymbol?: PullSymbol, getPrettyTypeName?: bool): MemberName {
            var members = this.getMembers();
            var callSignatures = this.getCallSignatures();
            var constructSignatures = this.getConstructSignatures();
            var indexSignatures = this.getIndexSignatures();

            if (members.length > 0 || callSignatures.length > 0 || constructSignatures.length > 0 || indexSignatures.length > 0) {
                var allMemberNames = new MemberNameArray();
                var curlies = !topLevel || indexSignatures.length != 0;
                var delim = "; ";
                for (var i = 0; i < members.length; i++) {
                    var memberTypeName = members[i].getNameAndTypeNameEx(scopeSymbol);

                    if (memberTypeName.isArray() && (<MemberNameArray>memberTypeName).delim == delim) {
                        allMemberNames.addAll((<MemberNameArray>memberTypeName).entries);
                    } else {
                        allMemberNames.add(memberTypeName);
                    }
                    curlies = true;
                }

                // Use pretty Function overload signature if this is just a call overload
                var getPrettyFunctionOverload = getPrettyTypeName && !curlies && this.hasOnlyOverloadCallSignatures();

                var signatureCount = callSignatures.length + constructSignatures.length + indexSignatures.length;
                if (signatureCount != 0 || members.length != 0) {
                    var useShortFormSignature = !curlies && (signatureCount == 1);
                    var signatureMemberName: MemberName[];

                    if (callSignatures.length > 0) {
                        signatureMemberName =
                            PullSignatureSymbol.getSignaturesTypeNameEx(callSignatures, "", useShortFormSignature, false, scopeSymbol, getPrettyFunctionOverload);
                        allMemberNames.addAll(signatureMemberName);
                    }

                    if (constructSignatures.length > 0) {
                        signatureMemberName =
                            PullSignatureSymbol.getSignaturesTypeNameEx(constructSignatures, "new", useShortFormSignature, false, scopeSymbol);
                        allMemberNames.addAll(signatureMemberName);
                    }

                    if (indexSignatures.length > 0) {
                        signatureMemberName =
                            PullSignatureSymbol.getSignaturesTypeNameEx(indexSignatures, "", useShortFormSignature, true, scopeSymbol);
                        allMemberNames.addAll(signatureMemberName);
                    }

                    if ((curlies) || (!getPrettyFunctionOverload && (signatureCount > 1) && topLevel)) {
                        allMemberNames.prefix = "{ ";
                        allMemberNames.suffix = "}";
                        allMemberNames.delim = delim;
                    } else if (allMemberNames.entries.length > 1) {
                        allMemberNames.delim = delim;
                    }

                    return allMemberNames;
                }
            }

            return MemberName.create("{}");
        }
    }

    export class PullPrimitiveTypeSymbol extends PullTypeSymbol {
        constructor(name: string) {
            super(name, PullElementKind.Primitive);
        }

        public isResolved() { return true; }
        
        public invalidate() {
            // do nothing...
        }
    }

    // PULLTODO: Unify concepts of constructor method and container
    // type instance types
    export class PullClassTypeSymbol extends PullTypeSymbol {

        private constructorMethod: PullSymbol = null;
        private hasDefaultConstructor = false;

        constructor(name: string) {
            super(name, PullElementKind.Class);
        }

        public isClass() {
            return true;
        }

        public setHasDefaultConstructor(hasOne=true) {
            this.hasDefaultConstructor = hasOne;
        }

        public getHasDefaultConstructor() {
            return this.hasDefaultConstructor;
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

    // represents the module "namespace" type
    export class PullContainerTypeSymbol extends PullTypeSymbol {
        public instanceSymbol: PullSymbol  = null;

        constructor(name: string, kind = PullElementKind.Container) {
            super(name, kind);
        }

        public isContainer() { return true; }

        public setInstanceSymbol(symbol: PullSymbol) {
            this.instanceSymbol = symbol;
        }

        public getInstanceSymbol(): PullSymbol {
            return this.instanceSymbol;
        }

        public invalidate() {

            if (this.instanceSymbol) {
                this.instanceSymbol.invalidate();
            }

            super.invalidate();
        }
    }

    export class PullTypeAliasSymbol extends PullTypeSymbol {

        private typeAliasLink: PullSymbolLink = null;
        private isUsedAsValue = false;

        constructor(name: string) {
            super(name, PullElementKind.TypeAlias);
        }

        public isAlias() { return true; }

        public setAliasedType(type: PullTypeSymbol) {
            if (this.typeAliasLink) {
                this.removeOutgoingLink(this.typeAliasLink);
            }

            this.typeAliasLink = this.addOutgoingLink(type, SymbolLinkKind.Aliases);
        }

        public getType(): PullTypeSymbol {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end);
            }

            return null;
        }

        public setType(type: PullTypeSymbol) {
            this.setAliasedType(type);
        }

        public setIsUsedAsValue() {
            this.isUsedAsValue = true;
        }

        public getIsUsedAsValue() {
            return this.isUsedAsValue;
        }

        public getMembers(): PullSymbol[] {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).getMembers();
            }

            return [];
        }

        public getCallSignatures(): PullSignatureSymbol[] {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).getCallSignatures();
            }

            return [];
        }

        public getConstructSignatures(): PullSignatureSymbol[] {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).getConstructSignatures();
            }

            return [];
        }

        public getIndexSignatures(): PullSignatureSymbol[] {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).getIndexSignatures();
            }

            return [];
        }        

        public findMember(name: string): PullSymbol {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).findMember(name);
            }

            return null;
        }

        public findNestedType(name: string): PullTypeSymbol {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).findNestedType(name);
            }

            return null;
        }

        public getAllMembers(searchDeclKind: PullElementKind, includePrivate: bool): PullSymbol[] {
            if (this.typeAliasLink) {
                return (<PullTypeSymbol>this.typeAliasLink.end).getAllMembers(searchDeclKind, includePrivate);
            }

            return [];
        }

        public invalidate() {
            this.isUsedAsValue = false;

            super.invalidate();
        }
    }

    export class PullDefinitionSignatureSymbol extends PullSignatureSymbol {
        public isDefinition() { return true; }
    }

    export class PullFunctionTypeSymbol extends PullTypeSymbol {
        private definitionSignature: PullDefinitionSignatureSymbol = null;

        constructor() {
            super("", PullElementKind.FunctionType);
        }

        public isFunction() { return true; }

        public invalidate() {

            var callSignatures = this.getCallSignatures();

            if (callSignatures.length) {
                for (var i = 0; i < callSignatures.length; i++) {
                    callSignatures[i].invalidate();
                }
            }

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

        constructor() {
            super("", PullElementKind.ConstructorType);
        }

        public isFunction() { return true; }
        public isConstructor() { return true; }

        public invalidate() {

            this.definitionSignature = null;

            super.invalidate();
        }

        public addSignature(signature: PullSignatureSymbol) {
            this.addConstructSignature(signature);

            if (signature.isDefinition()) {
                this.definitionSignature = <PullDefinitionSignatureSymbol>signature;
            }
        }

        public addTypeParameter(typeParameter: PullTypeParameterSymbol) {

            this.addMember(typeParameter, SymbolLinkKind.TypeParameter);

            var constructSignatures = this.getConstructSignatures();

            for (var i = 0; i < constructSignatures.length; i++) {
                constructSignatures[i].addTypeParameter(typeParameter);
            }
        }

        public getDefinitionSignature() { return this.definitionSignature; }
    }

    export class PullTypeParameterSymbol extends PullTypeSymbol {
        private constraintLink: PullSymbolLink = null;

        constructor(name: string) {
            super(name, PullElementKind.TypeParameter);
        }

        public isTypeParameter() { return true; }

        public setConstraint(constraintType: PullTypeSymbol) {

            if (this.constraintLink) {
                this.removeOutgoingLink(this.constraintLink);
            }

            this.constraintLink = this.addOutgoingLink(constraintType, SymbolLinkKind.TypeConstraint);
        }

        public getConstraint(): PullTypeSymbol {
            if (this.constraintLink) {
                return <PullTypeSymbol>this.constraintLink.end;
            }

            return null;
        }

        public isGeneric() { return true; }

        public getName() {

            var name = super.getName();

            if (this.isPrinting) {
                return name;
            }

            this.isPrinting = true;         

            if (this.constraintLink) {
                name += " extends " + this.constraintLink.end.toString();
            }

            this.isPrinting = false;
        
            return name;
        }
    }

    // transient type variables...
    export class PullTypeVariableSymbol extends PullTypeParameterSymbol {

        constructor(name: string) {
            super(name);
        }

        private tyvarID =  globalTyvarID++;

        public isTypeParameter() { return true; }
        public isTypeVariable() { return true; }
    }


    export class PullAccessorSymbol extends PullSymbol {

        private getterSymbolLink: PullSymbolLink = null;
        private setterSymbolLink: PullSymbolLink = null;

        constructor(name: string) {
            super(name, PullElementKind.Property);
        }

        public isAccessor() { return true; }

        public setSetter(setter: PullSymbol) {
            this.setterSymbolLink = this.addOutgoingLink(setter, SymbolLinkKind.SetterFunction);
        }

        public getSetter(): PullSymbol {
            var setter: PullSymbol = null;

            if (this.setterSymbolLink) {
                setter = this.setterSymbolLink.end;
            }

            return setter;
        }

        public removeSetter() {
            if (this.setterSymbolLink) {
                this.removeOutgoingLink(this.setterSymbolLink);
            }
        }

        public setGetter(getter: PullSymbol) {
            this.getterSymbolLink = this.addOutgoingLink(getter, SymbolLinkKind.GetterFunction);
        }

        public getGetter(): PullSymbol {
            var getter: PullSymbol = null;

            if (this.getterSymbolLink) {
                getter = this.getterSymbolLink.end;
            }

            return getter;
        }

        public removeGetter() {
            if (this.getterSymbolLink) {
                this.removeOutgoingLink(this.getterSymbolLink);
            }
        }

        public invalidate() {
            if (this.getterSymbolLink) {
                this.getterSymbolLink.end.invalidate();
            }

            if (this.setterSymbolLink) {
                this.setterSymbolLink.end.invalidate();
            }

            super.invalidate();
        }
    }

    export class PullArrayTypeSymbol extends PullTypeSymbol {
        private elementType: PullTypeSymbol = null;

        public isArray() { return true; }
        public getElementType() { return this.elementType; }
        public isGeneric() { return true; }

        constructor() {
            super("Array", PullElementKind.Array);
        }

        public setElementType(type: PullTypeSymbol) {
            this.elementType = type;
        }

        public getScopedNameEx(scopeSymbol?: PullSymbol, getPrettyTypeName?: bool) {
            var elementMemberName = this.elementType ? this.elementType.getScopedNameEx(scopeSymbol, getPrettyTypeName) : MemberName.create("any");
            return MemberName.create(elementMemberName, "", "[]");
        }

        public getMemberTypeNameEx(topLevel: bool, scopeSymbol?: PullSymbol, getPrettyTypeName?: bool): MemberName {
            var elementMemberName = this.elementType ? this.elementType.getMemberTypeNameEx(false, scopeSymbol, getPrettyTypeName) : MemberName.create("any");
            return MemberName.create(elementMemberName, "", "[]");
        }
    }

    // PULLTODO: This should be a part of the resolver class
    export function specializeToArrayType(typeToReplace: PullTypeSymbol, typeToSpecializeTo: PullTypeSymbol, resolver: PullTypeResolver, context: PullTypeResolutionContext) {

        var arrayInterfaceType = resolver.getCachedArrayType();

        // For the time-being, only specialize interface types
        // this way we can assume only public members and non-static methods
        if (!arrayInterfaceType || (arrayInterfaceType.getKind() & PullElementKind.Interface) == 0) {
            return null;
        }

        // PULLREVIEW: Accept both generic and non-generic arrays for now
        if (arrayInterfaceType.isGeneric()) {
            var enclosingDecl = arrayInterfaceType.getDeclarations()[0];
            return specializeType(arrayInterfaceType, [typeToSpecializeTo], resolver, enclosingDecl, context);
        }

        if (typeToSpecializeTo.getArrayType()) {
            return typeToSpecializeTo.getArrayType();
        }

        // PULLTODO: Recursive reference bug
        var newArrayType: PullTypeSymbol = new PullArrayTypeSymbol();
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
            resolver.resolveDeclaredSymbol(members[i], null, context);

            if (members[i].getKind() == PullElementKind.Method) { // must be a method
                method = <PullFunctionTypeSymbol> members[i];

                resolver.resolveDeclaredSymbol(method, null, context);

                methodType = <PullFunctionTypeSymbol>method.getType();

                newMethod = new PullSymbol(method.getName(), PullElementKind.Method);
                newMethodType = new PullFunctionTypeSymbol();
                newMethod.setType(newMethodType);

                newMethod.addDeclaration(method.getDeclarations()[0]);

                signatures = methodType.getCallSignatures();

                // specialize each signature
                for (var j = 0; j < signatures.length; j++) {

                    newSignature = new PullSignatureSymbol(PullElementKind.CallSignature);
                    newSignature.addDeclaration(signatures[j].getDeclarations()[0]);

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

                        if (parameterType === null) { continue; }


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

    export function specializeType(typeToSpecialize: PullTypeSymbol, typeArguments: PullTypeSymbol[], resolver: PullTypeResolver, enclosingDecl: PullDecl, context: PullTypeResolutionContext, ast?: AST): PullTypeSymbol {

        if (typeToSpecialize.isPrimitive() || !typeToSpecialize.isGeneric()) {
            return typeToSpecialize;
        }

        if (typeToSpecialize.currentlyBeingSpecialized()) {
            return typeToSpecialize;
        }

        if (typeToSpecialize.isTypeParameter()) {

            if (context.specializingToAny) {
                return resolver.semanticInfoChain.anyTypeSymbol;
            }

            var subsitution = context.findSpecializationForType(typeToSpecialize);

            if (subsitution != typeToSpecialize) {
                return subsitution;
            }

            if (typeArguments.length) {
                return typeArguments[0];
            }
        }

        // In this case, we have an array type that may have been specialized to a type variable
        if (typeToSpecialize.isArray()) {

            var elementType = (<PullArrayTypeSymbol>typeToSpecialize).getElementType();

            var newElementType = specializeType(elementType, typeArguments, resolver, enclosingDecl, context, ast);

            // we re-specialize so that we can re-use any cached array type symbols
            var newArrayType = specializeType(resolver.getCachedArrayType(), [newElementType], resolver, enclosingDecl, context);

            return newArrayType;
        }

        var typeParameters = typeToSpecialize.getTypeParameters();

        var isArray = typeToSpecialize == resolver.getCachedArrayType() || typeToSpecialize.isArray();

        //if (!typeParameters.length) {
        //    return typeToSpecialize;
        //}

        var i = 0;
        var j = 0;

        if (!typeArguments.length) {
            for (i = 0; i < typeParameters.length; i++) {
                typeArguments[typeArguments.length] = resolver.semanticInfoChain.anyTypeSymbol;
            }
        }

        var newType: PullTypeSymbol = isArray ? typeArguments[0].getArrayType() : typeToSpecialize.getSpecialization(typeArguments);

        if (newType) {
            if (!newType.isResolved() && !newType.currentlyBeingSpecialized()) {
                typeToSpecialize.invalidateSpecializations();
            }
            else {
                return newType;
            }
        }

        var newTypeDecl = typeToSpecialize.getDeclarations()[0];

        newType = typeToSpecialize.isClass() ? new PullClassTypeSymbol(typeToSpecialize.getName()) :
                    isArray ? new PullArrayTypeSymbol() :
                    typeToSpecialize.isTypeParameter() ? // watch out for replacing one tyvar with another
                        new PullTypeVariableSymbol(typeToSpecialize.getName()) :
                        new PullTypeSymbol(typeToSpecialize.getName(), typeToSpecialize.getKind());
        newType.addDeclaration(newTypeDecl);

        newType.setIsBeingSpecialized();

        newType.setTypeArguments(typeArguments);

        typeToSpecialize.addSpecialization(newType, typeArguments);

        if (isArray) {
            (<PullArrayTypeSymbol>newType).setElementType(typeArguments[0]);
            typeArguments[0].setArrayType(newType);
        }

        // create the type replacement map

        var typeReplacementMap: any = {};

        for (i = 0; i < typeParameters.length; i++) {
            if (typeParameters[i] != typeArguments[i]) {
                typeReplacementMap[typeParameters[i].getSymbolID().toString()] = typeArguments[i];
            }
            newType.addMember(typeParameters[i], SymbolLinkKind.TypeParameter);
        }

        // specialize any extends/implements types
        var extendedTypesToSpecialize = typeToSpecialize.getExtendedTypes();
        var typeDecl: PullDecl;
        var typeAST: TypeDeclaration;
        var unitPath: string;

        if (extendedTypesToSpecialize.length) {
            typeDecl = typeToSpecialize.getDeclarations()[0];
            typeAST = <TypeDeclaration>resolver.semanticInfoChain.getASTForDecl(typeDecl, typeDecl.getScriptName());
            unitPath = resolver.getUnitPath();
            resolver.setUnitPath(typeDecl.getScriptName());
            context.pushTypeSpecializationCache(typeReplacementMap);
            var extendTypeSymbol = resolver.resolveTypeReference(new TypeReference(typeAST.extendsList.members[0], 0), typeDecl, context);
            resolver.setUnitPath(unitPath);
            context.popTypeSpecializationCache();

            newType.addExtendedType(extendTypeSymbol);
        }

        var implementedTypesToSpecialize = typeToSpecialize.getImplementedTypes();

        if (implementedTypesToSpecialize.length) {
            typeDecl = typeToSpecialize.getDeclarations()[0];
            typeAST = <TypeDeclaration>resolver.semanticInfoChain.getASTForDecl(typeDecl, typeDecl.getScriptName());
            unitPath = resolver.getUnitPath();
            resolver.setUnitPath(typeDecl.getScriptName());
            context.pushTypeSpecializationCache(typeReplacementMap);
            var implementedTypeSymbol = resolver.resolveTypeReference(new TypeReference(typeAST.implementsList.members[0], 0), typeDecl, context);
            resolver.setUnitPath(unitPath);
            context.popTypeSpecializationCache();

            newType.addImplementedType(implementedTypeSymbol);
        }

        var callSignatures = typeToSpecialize.getCallSignatures();
        var constructSignatures = typeToSpecialize.getConstructSignatures();
        var indexSignatures = typeToSpecialize.getIndexSignatures();
        var members = typeToSpecialize.getMembers();

        // specialize call signatures
        var newSignature: PullSignatureSymbol;
        var signature: PullSignatureSymbol;

        var decl: PullDecl = null;
        var decls: PullDecl[] = null;
        var declAST: AST = null;
        var parameters: PullSymbol[];
        var newParameters: PullSymbol[];
        var returnType: PullTypeSymbol = null;
        var p = 0;

        for (i = 0; i < callSignatures.length; i++) {
            signature = callSignatures[i];

            if (signature.currentlyBeingSpecialized()) {
                continue;
            }

            context.pushTypeSpecializationCache(typeReplacementMap);

            decl = signature.getDeclarations()[0];
            unitPath = resolver.getUnitPath();
            resolver.setUnitPath(decl.getScriptName());

            newSignature = new PullSignatureSymbol(signature.getKind());

            newSignature.mimicSignature(signature);
            declAST = resolver.semanticInfoChain.getASTForDecl(decl, decl.getScriptName());

            decl.setSignatureSymbol(newSignature);
            resolver.resolveAST(declAST, false, newTypeDecl, context);
            decl.setSignatureSymbol(signature);

            parameters = signature.getParameters();
            newParameters = newSignature.getParameters();

            for (p = 0; p < parameters.length; p++) {
                newParameters[p].setType(parameters[p].getType());
            }
            newSignature.setResolved();

            resolver.setUnitPath(unitPath);

            returnType = newSignature.getReturnType();

            if (!returnType) {
                newSignature.setReturnType(signature.getReturnType());
            }

            signature.setIsBeingSpecialized();
            newSignature.addDeclaration(decl);
            newSignature = specializeSignature(newSignature, true, typeReplacementMap, [], resolver, newTypeDecl, context);
            signature.setIsSpecialized();

            context.popTypeSpecializationCache();

            if (!newSignature) {
                return resolver.semanticInfoChain.anyTypeSymbol;
            }            

            newType.addCallSignature(newSignature);

            if (newSignature.hasGenericParameter()) {
                newType.setHasGenericSignature();
            }
        }

        // specialize construct signatures
        for (i = 0; i < constructSignatures.length; i++) {
            signature = constructSignatures[i];

            context.pushTypeSpecializationCache(typeReplacementMap);

            decl = signature.getDeclarations()[0];
            unitPath = resolver.getUnitPath();
            resolver.setUnitPath(decl.getScriptName());

            newSignature = new PullSignatureSymbol(signature.getKind());

            newSignature.mimicSignature(signature);
            declAST = resolver.semanticInfoChain.getASTForDecl(decl, decl.getScriptName());

            decl.setSignatureSymbol(newSignature);
            resolver.resolveAST(declAST, false, newTypeDecl, context);
            decl.setSignatureSymbol(signature);

            parameters = signature.getParameters();
            newParameters = newSignature.getParameters();

            // we need to clone the parameter types, but the return type
            // was set during resolution
            for (p = 0; p < parameters.length; p++) {
                newParameters[p].setType(parameters[p].getType());
            }
            newSignature.setResolved();

            resolver.setUnitPath(unitPath);

            returnType = newSignature.getReturnType();

            if (!returnType) {
                newSignature.setReturnType(signature.getReturnType());
            }            

            signature.setIsBeingSpecialized();
            newSignature.addDeclaration(decl);
            newSignature = specializeSignature(newSignature, true, typeReplacementMap, [], resolver, newTypeDecl, context);
            signature.setIsSpecialized();

            context.popTypeSpecializationCache();

            if (!newSignature) {
                return resolver.semanticInfoChain.anyTypeSymbol;
            }

            newType.addConstructSignature(newSignature);

            if (newSignature.hasGenericParameter()) {
                newType.setHasGenericSignature();
            }
        }

        // specialize index signatures
        for (i = 0; i < indexSignatures.length; i++) {
            signature = indexSignatures[i];

            context.pushTypeSpecializationCache(typeReplacementMap);

            decl = signature.getDeclarations()[0];
            unitPath = resolver.getUnitPath();
            resolver.setUnitPath(decl.getScriptName());

            newSignature = new PullSignatureSymbol(signature.getKind());

            newSignature.mimicSignature(signature);
            declAST = resolver.semanticInfoChain.getASTForDecl(decl, decl.getScriptName());

            decl.setSignatureSymbol(newSignature);
            resolver.resolveAST(declAST, false, newTypeDecl, context);
            decl.setSignatureSymbol(signature);

            parameters = signature.getParameters();
            newParameters = newSignature.getParameters();

            // we need to clone the parameter types, but the return type
            // was set during resolution
            for (p = 0; p < parameters.length; p++) {
                newParameters[p].setType(parameters[p].getType());
            }
            newSignature.setResolved();

            resolver.setUnitPath(unitPath);

            returnType = newSignature.getReturnType();

            if (!returnType) {
                newSignature.setReturnType(signature.getReturnType());
            }            

            signature.setIsBeingSpecialized();
            newSignature.addDeclaration(decl);
            newSignature = specializeSignature(newSignature, true, typeReplacementMap, [], resolver, newTypeDecl, context);
            signature.setIsSpecialized();

            context.popTypeSpecializationCache();

            if (!newSignature) {
                return resolver.semanticInfoChain.anyTypeSymbol;
            }
            
            newType.addIndexSignature(newSignature);

            if (newSignature.hasGenericParameter()) {
                newType.setHasGenericSignature();
            }
        }        

        // specialize members

        var field: PullSymbol = null;
        var newField: PullSymbol = null;

        var fieldType: PullTypeSymbol = null;
        var newFieldType: PullTypeSymbol = null;
        var replacementType: PullTypeSymbol = null;

        var fieldSignatureSymbol: PullSignatureSymbol = null;

        for (i = 0; i < members.length; i++) {
            field = members[i];

            decls = field.getDeclarations();

            newField = new PullSymbol(field.getName(), field.getKind());

            for (j = 0; j < decls.length; j++) {
                newField.addDeclaration(decls[j]);
            }

            if (field.getIsOptional()) {
                newField.setIsOptional();
            }

            if (!field.isResolved()) {
                resolver.resolveDeclaredSymbol(field, newTypeDecl, context);
            }            

            fieldType = field.getType();

            if (!fieldType) {
                fieldType = new PullTypeVariableSymbol("tyvar" + globalTyvarID);
            }

            //newField.setType(fieldType);

            replacementType = <PullTypeSymbol>typeReplacementMap[fieldType.getSymbolID().toString()];

            if (replacementType) {
                newField.setType(replacementType);
                decl = decls[0];

                for (j = 0; j < decls.length; j++) {
                    newField.addDeclaration(decls[j]);
                }
            }
            else {
                // re-resolve all field decls using the current replacements
                if (fieldType.isGeneric()) {
                    // field.invalidate();
                    // if (fieldType.isFunction()) {
                    //     fieldType.invalidate();
                    // }

                    unitPath = resolver.getUnitPath();
                    resolver.setUnitPath(decls[0].getScriptName());

                    context.pushTypeSpecializationCache(typeReplacementMap);

                    // for (j = 0; j < decls.length; j++) {
                    //     decl = decls[j];

                    //     newField.addDeclaration(decl);

                    //     if (fieldType.getCallSignatures().length) {
                    //         fieldSignatureSymbol = decl.getSignatureSymbol();
                    //         fieldSignatureSymbol.invalidate();
                    //     }

                    //     declAST = resolver.semanticInfoChain.getASTForDecl(decl, decl.getScriptName());
                    //     fieldType = (resolver.resolveAST(declAST, false, newTypeDecl, context)).getType();
                        
                    //     if (fieldType.isFunction()) {
                    //         fieldType.addDeclaration(decl);
                    //     }
                    // }

                    newFieldType = specializeType(fieldType, typeArguments, resolver, newTypeDecl, context, ast);

                    resolver.setUnitPath(unitPath);

                    context.popTypeSpecializationCache();

                    newField.setType(newFieldType);
                }
                else {
                    newField.setType(fieldType);
                }
            }

            newType.addMember(newField, (field.hasFlag(PullElementFlags.Private)) ? SymbolLinkKind.PrivateMember : SymbolLinkKind.PublicMember);
        }

        // specialize the constructor and statics, if need be
        if (typeToSpecialize.isClass()) {
            var constructorMethod = (<PullClassTypeSymbol>typeToSpecialize).getConstructorMethod();
            var newConstructorMethod = new PullSymbol(constructorMethod.getName(), PullElementKind.ConstructorMethod);
            var newConstructorType = specializeType(constructorMethod.getType(), typeArguments, resolver, newTypeDecl, context, ast);

            newConstructorMethod.setType(newConstructorType);

            var constructorDecls: PullDecl[] = constructorMethod.getDeclarations();

            for (i = 0; i < constructorDecls.length; i++) {
                newConstructorMethod.addDeclaration(constructorDecls[i]);
                newConstructorType.addDeclaration(constructorDecls[i]);
            }

            (<PullClassTypeSymbol>newType).setConstructorMethod(newConstructorMethod);
        }

        newType.setIsSpecialized();

        newType.setResolved();

        return newType;
    }

    // PULLTODO: Replace typeReplacementMap with use of context
    export function specializeSignature(signature: PullSignatureSymbol,
        skipLocalTypeParameters: bool,
        typeReplacementMap: any,
        typeArguments: PullTypeSymbol[],
        resolver: PullTypeResolver,
        enclosingDecl: PullDecl,
        context: PullTypeResolutionContext,
        ast?: AST): PullSignatureSymbol {

        if (signature.currentlyBeingSpecialized()) {
            return signature;
        }        

        var newSignature = signature.getSpecialization(typeArguments);
        var i = 0;

        if (newSignature) {
            return newSignature;
        }

        signature.setIsBeingSpecialized();

        newSignature = new PullSignatureSymbol(signature.getKind());
        newSignature.addDeclaration(signature.getDeclarations()[0]);

        if (signature.hasVariableParamList()) {
            newSignature.setHasVariableParamList();
        }

        if (signature.hasGenericParameter()) {
            newSignature.setHasGenericParameter();
        }

        signature.addSpecialization(newSignature, typeArguments);      

        var parameters = signature.getParameters();
        var typeParameters = signature.getTypeParameters();
        var returnType = signature.getReturnType();

        // if (!returnType) {
        //     returnType = new PullTypeVariableSymbol();
        // }

        for (i = 0; i < typeParameters.length; i++) {
            newSignature.addTypeParameter(typeParameters[i]);
        }

        if (signature.hasGenericParameter()) {
            newSignature.setHasGenericParameter();
        }

        context.pushTypeSpecializationCache(typeReplacementMap);
        var newReturnType = specializeType(returnType, typeArguments, resolver, enclosingDecl, context, ast);
        context.popTypeSpecializationCache();      

        // if (newReturnType != returnType) {

        //     newReturnType.addDeclaration(returnType.getDeclarations()[0]);
        // }

        newSignature.setReturnType(newReturnType);

        var newParameter: PullSymbol;
        var newParameterType: PullTypeSymbol;
        var newParameterElementType: PullTypeSymbol;
        var parameterType: PullTypeSymbol;
        var replacementParameterType: PullTypeSymbol;
        var localTypeParameters: any = {};

        // if we specialize the signature recursive (through, say, the specialization of a method whilst specializing
        // its class), we need to prevent accidental specialization of type parameters that shadow type parameters in the
        // enclosing type.  (E.g., "class C<T> { public m<T>() {...} }" )
        if (skipLocalTypeParameters) {
            for (i = 0; i < typeParameters.length; i++) {
                localTypeParameters[typeParameters[i].getName()] = true;
            }
        }

        for (var k = 0; k < parameters.length; k++) {

            newParameter = new PullSymbol(parameters[k].getName(), parameters[k].getKind());
            newParameter.addDeclaration(parameters[k].getDeclarations()[0]);

            parameterType = parameters[k].getType();

            context.pushTypeSpecializationCache(typeReplacementMap);
            newParameterType = !localTypeParameters[parameterType.getName()] ? specializeType(parameterType, typeArguments, resolver, enclosingDecl, context, ast) : parameterType;
            context.popTypeSpecializationCache();

            // if (newParameterType != parameterType) {
            //     newParameterType.addDeclaration(parameterType.getDeclarations()[0]);
            // }

            if (parameters[k].getIsOptional()) {
                newParameter.setIsOptional();
            }

            newParameter.setType(newParameterType);
            newSignature.addParameter(newParameter, newParameter.getIsOptional());
        }

        signature.setIsSpecialized();

        return newSignature;
    }

    export function getIDForTypeSubstitutions(types: PullTypeSymbol[]): string {
        var substitution = "";

        for (var i = 0; i < types.length; i++) {
            substitution += types[i].getSymbolID().toString() + "#";
        }

        return substitution;
    }
}