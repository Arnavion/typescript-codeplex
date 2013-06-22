
///<reference path='..\typescript.ts' />

module TypeScript {

    export interface IPullTypeCollection {
        // returns null when types are exhausted
        getLength(): number;
        setTypeAtIndex(index: number, type: PullTypeSymbol): void ;
        getTypeAtIndex(index: number): PullTypeSymbol;
    }

    export interface IPullResolutionData {
        actuals: PullTypeSymbol[];
        exactCandidates: PullSignatureSymbol[];
        conversionCandidates: PullSignatureSymbol[];

        id: number;
    }

    export class PullResolutionDataCache {
        private cacheSize = 16;
        private rdCache: IPullResolutionData[] = [];
        private nextUp: number = 0;

        constructor() {
            for (var i = 0; i < this.cacheSize; i++) {
                this.rdCache[i] = {
                    actuals: <PullTypeSymbol[]>[],
                    exactCandidates: <PullSignatureSymbol[]>[],
                    conversionCandidates: <PullSignatureSymbol[]>[],
                    id: i
                };
            }
        }

        public getResolutionData(): IPullResolutionData {
            var rd: IPullResolutionData = null;

            if (this.nextUp < this.cacheSize) {
                rd = this.rdCache[this.nextUp];
            }

            if (rd === null) {
                this.cacheSize++;
                rd = {
                    actuals: <PullTypeSymbol[]>[],
                    exactCandidates: <PullSignatureSymbol[]>[],
                    conversionCandidates: <PullSignatureSymbol[]>[],
                    id: this.cacheSize
                };
                this.rdCache[this.cacheSize] = rd;
            }

            // cache operates as a stack - RD is always served up in-order
            this.nextUp++;

            return rd;
        }

        public returnResolutionData(rd: IPullResolutionData) {
            // Pop to save on array allocations, which are a bottleneck
            // REVIEW: On some VMs, Array.pop doesn't always pop the last value in the array
            rd.actuals.length = 0;
            rd.exactCandidates.length = 0;
            rd.conversionCandidates.length = 0;

            this.nextUp = rd.id;
        }
    }

    export interface PullApplicableSignature {
        signature: PullSignatureSymbol;
        hadProvisionalErrors: boolean;
    }

    export class PullAdditionalCallResolutionData {
        public targetSymbol: PullSymbol = null;
        public targetTypeSymbol: PullTypeSymbol = null;
        public resolvedSignatures: PullSignatureSymbol[] = null;
        public candidateSignature: PullSignatureSymbol = null;
        public actualParametersContextTypeSymbols: PullTypeSymbol[] = null;
    }

    export class PullAdditionalObjectLiteralResolutionData {
        public membersContextTypeSymbols: PullTypeSymbol[] = null;
    }

    // The resolver associates types with a given AST
    export class PullTypeResolver {
        private _cachedArrayInterfaceType: PullTypeSymbol = null;
        private _cachedNumberInterfaceType: PullTypeSymbol = null;
        private _cachedStringInterfaceType: PullTypeSymbol = null;
        private _cachedBooleanInterfaceType: PullTypeSymbol = null;
        private _cachedObjectInterfaceType: PullTypeSymbol = null;
        private _cachedFunctionInterfaceType: PullTypeSymbol = null;
        private _cachedIArgumentsInterfaceType: PullTypeSymbol = null;
        private _cachedRegExpInterfaceType: PullTypeSymbol = null;

        private cachedFunctionArgumentsSymbol: PullSymbol = null;

        private seenSuperConstructorCall = false;

        private assignableCache: any[] = <any>{};
        private subtypeCache: any[] = <any>{};
        private identicalCache: any[] = <any>{};

        private resolutionDataCache = new PullResolutionDataCache();

        private currentUnit: SemanticInfo = null;

        public cleanCachedGlobals() {
            this._cachedArrayInterfaceType = null;
            this._cachedNumberInterfaceType = null;
            this._cachedStringInterfaceType = null;
            this._cachedBooleanInterfaceType = null;
            this._cachedObjectInterfaceType = null;
            this._cachedFunctionInterfaceType = null;
            this._cachedIArgumentsInterfaceType = null;
            this._cachedRegExpInterfaceType = null;
            this.cachedFunctionArgumentsSymbol = null;

            this.identicalCache = <any[]>{};
            this.subtypeCache = <any[]>{};
            this.assignableCache = <any[]>{};
        }

        private cachedArrayInterfaceType() {
            if (!this._cachedArrayInterfaceType) {
                this._cachedArrayInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("Array", [], PullElementKind.Interface);
            }

            if (!this._cachedArrayInterfaceType) {
                this._cachedArrayInterfaceType = this.semanticInfoChain.anyTypeSymbol;
            }

            if (!this._cachedArrayInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedArrayInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedArrayInterfaceType;
        }

        public getCachedArrayType() {
            return this.cachedArrayInterfaceType();
        }

        private cachedNumberInterfaceType() {
            if (!this._cachedNumberInterfaceType) {
                this._cachedNumberInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("Number", [], PullElementKind.Interface);
            }

            if (this._cachedNumberInterfaceType && !this._cachedNumberInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedNumberInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedNumberInterfaceType;
        }

        private cachedStringInterfaceType() {
            if (!this._cachedStringInterfaceType) {
                this._cachedStringInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("String", [], PullElementKind.Interface);
            }

            if (this._cachedStringInterfaceType && !this._cachedStringInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedStringInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedStringInterfaceType;
        }

        private cachedBooleanInterfaceType() {
            if (!this._cachedBooleanInterfaceType) {
                this._cachedBooleanInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("Boolean", [], PullElementKind.Interface);
            }

            if (this._cachedBooleanInterfaceType && !this._cachedBooleanInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedBooleanInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedBooleanInterfaceType;
        }

        private cachedObjectInterfaceType() {
            if (!this._cachedObjectInterfaceType) {
                this._cachedObjectInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("Object", [], PullElementKind.Interface);
            }

            if (!this._cachedObjectInterfaceType) {
                this._cachedObjectInterfaceType = this.semanticInfoChain.anyTypeSymbol;
            }

            if (!this._cachedObjectInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedObjectInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedObjectInterfaceType;
        }

        private cachedFunctionInterfaceType() {
            if (!this._cachedFunctionInterfaceType) {
                this._cachedFunctionInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("Function", [], PullElementKind.Interface);
            }

            if (this._cachedFunctionInterfaceType && !this._cachedFunctionInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedFunctionInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedFunctionInterfaceType;
        }

        private cachedIArgumentsInterfaceType() {
            if (!this._cachedIArgumentsInterfaceType) {
                this._cachedIArgumentsInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("IArguments", [], PullElementKind.Interface);
            }

            if (this._cachedIArgumentsInterfaceType && !this._cachedIArgumentsInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedIArgumentsInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedIArgumentsInterfaceType;
        }

        private cachedRegExpInterfaceType() {
            if (!this._cachedRegExpInterfaceType) {
                this._cachedRegExpInterfaceType = <PullTypeSymbol>this.getSymbolFromDeclPath("RegExp", [], PullElementKind.Interface);
            }

            if (!this._cachedRegExpInterfaceType.isResolved) {
                this.resolveDeclaredSymbol(this._cachedRegExpInterfaceType, null, new PullTypeResolutionContext());
            }

            return this._cachedRegExpInterfaceType;
        }

        constructor(private compilationSettings: CompilationSettings, public semanticInfoChain: SemanticInfoChain, private unitPath: string, public inTypeCheck: boolean) {

            this.cachedFunctionArgumentsSymbol = new PullSymbol("arguments", PullElementKind.Variable);
            this.cachedFunctionArgumentsSymbol.type = this.cachedIArgumentsInterfaceType() ? this.cachedIArgumentsInterfaceType() : this.semanticInfoChain.anyTypeSymbol;
            this.cachedFunctionArgumentsSymbol.setResolved();

            var functionArgumentsDecl = new PullDecl("arguments", "arguments", PullElementKind.Parameter, PullElementFlags.None, new TextSpan(0, 0), unitPath);
            functionArgumentsDecl.setSymbol(this.cachedFunctionArgumentsSymbol);
            this.cachedFunctionArgumentsSymbol.addDeclaration(functionArgumentsDecl);

            this.currentUnit = this.semanticInfoChain.getUnit(unitPath);
        }

        public getUnitPath() { return this.unitPath; }

        public setUnitPath(unitPath: string) {
            this.unitPath = unitPath;

            this.currentUnit = this.semanticInfoChain.getUnit(unitPath);
        }

        public getDeclForAST(ast: AST): PullDecl {
            return this.semanticInfoChain.getDeclForAST(ast, this.unitPath);
        }

        public getSymbolForAST(ast: IAST): PullSymbol {
            return this.semanticInfoChain.getSymbolForAST(ast, this.unitPath);
        }

        private setSymbolForAST(ast: AST, symbol: PullSymbol, context: PullTypeResolutionContext): void {
            if (context && (context.inProvisionalResolution() || context.inSpecialization)) {
                return;
            }

            this.semanticInfoChain.setSymbolForAST(ast, symbol, this.unitPath);
        }

        public getASTForSymbol(symbol: PullSymbol): AST {
            return this.semanticInfoChain.getASTForSymbol(symbol, this.unitPath);
        }

        public getASTForDecl(decl: PullDecl): AST {
            return this.semanticInfoChain.getASTForDecl(decl);
        }

        public getNewErrorTypeSymbol(diagnostic: Diagnostic, data?): PullErrorTypeSymbol {
            return new PullErrorTypeSymbol(diagnostic, this.semanticInfoChain.anyTypeSymbol, data);
        }

        public getEnclosingDecl(decl: PullDecl): PullDecl {
            var declPath = getPathToDecl(decl);

            if (!declPath.length) {
                return null;
            }
            else if (declPath.length > 1 && declPath[declPath.length - 1] === decl) {
                return declPath[declPath.length - 2];
            }
            else {
                return declPath[declPath.length - 1];
            }
        }

        private getExportedMemberSymbol(symbol: PullSymbol, parent: PullTypeSymbol): PullSymbol {

            if (!(symbol.kind & (PullElementKind.Method | PullElementKind.Property))) {
                var containerType = !parent.isContainer() ? parent.getAssociatedContainerType() : parent;

                if (containerType && containerType.isContainer() && !PullHelpers.symbolIsEnum(parent)) {
                    if (symbol.hasFlag(PullElementFlags.Exported)) {
                        return symbol;
                    }

                    return null;
                }
            }

            return symbol;
        }

        private getMemberSymbol(symbolName: string, declSearchKind: PullElementKind, parent: PullTypeSymbol, searchContainedMembers= false) {

            var member: PullSymbol = null;

            if (declSearchKind & PullElementKind.SomeValue) {
                member = parent.findMember(symbolName);
            }
            else {
                member = parent.findNestedType(symbolName);
            }

            if (member) {
                return this.getExportedMemberSymbol(member, parent);
            }

            var containerType = parent.getAssociatedContainerType();

            if (containerType) {

                // If we were searching over the constructor type, we don't want to also search
                // over the class instance type (we only want to consider static fields)
                if (containerType.isClass()) {
                    return null;
                }

                parent = containerType;
            }

            if (declSearchKind & PullElementKind.SomeValue) {
                member = parent.findMember(symbolName);
            }
            else {
                member = parent.findNestedType(symbolName);
            }

            if (member) {
                return this.getExportedMemberSymbol(member, parent);
            }

            var typeDeclarations = parent.getDeclarations();
            var childDecls: PullDecl[] = null;

            for (var j = 0; j < typeDeclarations.length; j++) {
                childDecls = typeDeclarations[j].searchChildDecls(symbolName, declSearchKind);

                if (childDecls.length) {
                    return this.getExportedMemberSymbol(childDecls[0].getSymbol(), parent);
                }
            }
        }

        // search for an unqualified symbol name within a given decl path
        private getSymbolFromDeclPath(symbolName: string, declPath: PullDecl[], declSearchKind: PullElementKind): PullSymbol {
            var symbol: PullSymbol = null;

            // search backwards through the decl list
            //  - if the decl in question is a function, search its members
            //  - if the decl in question is a module, search the decl then the symbol
            //  - Otherwise, search globally

            var decl: PullDecl = null;
            var childDecls: PullDecl[];
            var declSymbol: PullTypeSymbol = null;
            var declMembers: PullSymbol[];
            var pathDeclKind: PullElementKind;
            var valDecl: PullDecl = null;
            var kind: PullElementKind;
            var instanceSymbol: PullSymbol = null;
            var instanceType: PullTypeSymbol = null;
            var childSymbol: PullSymbol = null;

            for (var i = declPath.length - 1; i >= 0; i--) {
                decl = declPath[i];
                pathDeclKind = decl.kind;

                if (decl.flags & PullElementFlags.DeclaredInAWithBlock) {
                    return this.semanticInfoChain.anyTypeSymbol;
                }

                if (pathDeclKind & (PullElementKind.Container | PullElementKind.DynamicModule)) {

                    // first check locally
                    childDecls = decl.searchChildDecls(symbolName, declSearchKind);

                    if (childDecls.length) {
                        return childDecls[0].getSymbol();
                    }

                    if (declSearchKind & PullElementKind.SomeValue) {

                        childDecls = decl.searchChildDecls(symbolName, declSearchKind);

                        if (childDecls.length) {
                            valDecl = childDecls[0];

                            if (valDecl) {
                                return valDecl.getSymbol();
                            }
                        }

                        // search "split" exported members
                        instanceSymbol = (<PullContainerTypeSymbol>decl.getSymbol()).getInstanceSymbol();

                        if (instanceSymbol) {
                            instanceType = instanceSymbol.type;

                            childSymbol = this.getMemberSymbol(symbolName, declSearchKind, instanceType);

                            if (childSymbol && (childSymbol.kind & declSearchKind)) {
                                return childSymbol;
                            }
                        }

                        // Maybe there's an import statement aliasing an initalized value?
                        childDecls = decl.searchChildDecls(symbolName, PullElementKind.TypeAlias);

                        if (childDecls.length) {
                            var sym = childDecls[0].getSymbol();

                            if (sym.isAlias()) {
                                return sym;
                            }
                        }

                        valDecl = decl.getValueDecl();

                        if (valDecl) {
                            decl = valDecl;
                        }
                    }

                    // otherwise, check the members
                    declSymbol = decl.getSymbol().type;

                    var childSymbol = this.getMemberSymbol(symbolName, declSearchKind, declSymbol);

                    if (childSymbol) {
                        return childSymbol;
                    }
                }
                else if ((declSearchKind & (PullElementKind.SomeType | PullElementKind.SomeContainer)) || !(pathDeclKind & PullElementKind.Class)) {
                    var candidateSymbol: PullSymbol = null;

                    // If the decl is a function expression, we still want to check its children since it may be shadowed by one
                    // of its parameters
                    if (pathDeclKind === PullElementKind.FunctionExpression && symbolName === (<PullFunctionExpressionDecl>decl).getFunctionExpressionName()) {
                        candidateSymbol = decl.getSymbol();
                    }

                    childDecls = decl.searchChildDecls(symbolName, declSearchKind);

                    if (childDecls.length) {
                        // if the enclosing decl is a function of some sort, we need to ensure that it's bound
                        // otherwise, the child decl may not be properly bound if it's a parameter (since they're
                        // bound when binding the function symbol)
                        if (decl.kind & PullElementKind.SomeFunction) {
                            decl.ensureSymbolIsBound();
                        }
                        return childDecls[0].getSymbol();
                    }

                    if (candidateSymbol) {
                        return candidateSymbol;
                    }

                    if (declSearchKind & PullElementKind.SomeValue) {
                        childDecls = decl.searchChildDecls(symbolName, PullElementKind.TypeAlias);

                        if (childDecls.length) {
                            var sym = childDecls[0].getSymbol();

                            if (sym.isAlias()) {
                                return sym;
                            }
                        }
                    }
                }
            }

            // otherwise, search globally
            symbol = this.semanticInfoChain.findSymbol([symbolName], declSearchKind);

            return symbol;
        }

        private getVisibleDeclsFromDeclPath(declPath: PullDecl[], declSearchKind: PullElementKind): PullDecl[] {
            var result: PullDecl[] = [];
            var decl: PullDecl = null;
            var childDecls: PullDecl[];
            var pathDeclKind: PullElementKind;
            var parameters: PullTypeParameterSymbol[];

            for (var i = declPath.length - 1; i >= 0; i--) {
                decl = declPath[i];
                pathDeclKind = decl.kind;
                var declSymbol = <PullTypeSymbol>decl.getSymbol();
                var declKind = decl.kind;

                // First add locals
                // Child decls of classes and interfaces are members, and should only be visible as members of 'this'
                if (declKind !== PullElementKind.Class && declKind !== PullElementKind.Interface) {
                    this.addFilteredDecls(decl.getChildDecls(), declSearchKind, result);
                }

                switch (declKind) {
                    case PullElementKind.Container:
                    case PullElementKind.DynamicModule:
                        // Add members from other instances
                        if (declSymbol) {
                            var otherDecls = declSymbol.getDeclarations();
                            for (var j = 0, m = otherDecls.length; j < m; j++) {
                                var otherDecl = otherDecls[j];
                                if (otherDecl === decl) {
                                    continue;
                                }

                                var otherDeclChildren = otherDecl.getChildDecls();
                                for (var k = 0, s = otherDeclChildren.length; k < s; k++) {
                                    var otherDeclChild = otherDeclChildren[k];
                                    if ((otherDeclChild.flags & PullElementFlags.Exported) && (otherDeclChild.kind & declSearchKind)) {
                                        result.push(otherDeclChild);
                                    }
                                }
                            }
                        }

                        break;

                    case PullElementKind.Class:
                    case PullElementKind.Interface:
                        // Add generic types prameters
                        if (declSymbol && declSymbol.isGeneric()) {
                            parameters = declSymbol.getTypeParameters();
                            for (var k = 0; k < parameters.length; k++) {
                                result.push(parameters[k].getDeclarations()[0]);
                            }
                        }

                        break;

                    case PullElementKind.FunctionExpression:
                        var functionExpressionName = (<PullFunctionExpressionDecl>decl).getFunctionExpressionName();
                        if (declSymbol && functionExpressionName) {
                            result.push(declSymbol.getDeclarations()[0]);
                        }
                    // intentional fall through

                    case PullElementKind.Function:
                    case PullElementKind.ConstructorMethod:
                    case PullElementKind.Method:
                        if (declSymbol) {
                            var functionType = declSymbol.type;
                            if (functionType.getHasGenericSignature()) {
                                var signatures = (pathDeclKind === PullElementKind.ConstructorMethod) ? functionType.getConstructSignatures() : functionType.getCallSignatures();
                                if (signatures && signatures.length) {
                                    for (var j = 0; j < signatures.length; j++) {
                                        var signature = signatures[j];
                                        if (signature.isGeneric()) {
                                            parameters = signature.getTypeParameters();
                                            for (var k = 0; k < parameters.length; k++) {
                                                result.push(parameters[k].getDeclarations()[0]);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        break;
                }
            }

            // Get the global decls
            var units = this.semanticInfoChain.units;
            for (var i = 0, n = units.length; i < n; i++) {
                var unit = units[i];
                if (unit === this.currentUnit && declPath.length != 0) {
                    // Current unit has already been processed. skip it.
                    continue;
                }
                var topLevelDecls = unit.getTopLevelDecls();
                if (topLevelDecls.length) {
                    for (var j = 0, m = topLevelDecls.length; j < m; j++) {
                        var topLevelDecl = topLevelDecls[j];
                        if (topLevelDecl.kind === PullElementKind.Script || topLevelDecl.kind === PullElementKind.Global) {
                            this.addFilteredDecls(topLevelDecl.getChildDecls(), declSearchKind, result);
                        }
                    }
                }
            }

            return result;
        }

        private addFilteredDecls(decls: PullDecl[], declSearchKind: PullElementKind, result: PullDecl[]): void {
            if (decls.length) {
                for (var i = 0, n = decls.length; i < n; i++) {
                    var decl = decls[i];
                    if (decl.kind & declSearchKind) {
                        result.push(decl);
                    }
                }
            }
        }

        public getVisibleDecls(enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullDecl[] {

            var declPath: PullDecl[] = enclosingDecl !== null ? getPathToDecl(enclosingDecl) : [];

            if (enclosingDecl && !declPath.length) {
                declPath = [enclosingDecl];
            }

            var declSearchKind: PullElementKind = PullElementKind.SomeType | PullElementKind.SomeContainer | PullElementKind.SomeValue;

            return this.getVisibleDeclsFromDeclPath(declPath, declSearchKind);
        }

        public getVisibleContextSymbols(enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol[] {
            var contextualTypeSymbol = context.getContextualType();
            if (!contextualTypeSymbol || this.isAnyOrEquivalent(contextualTypeSymbol)) {
                return null;
            }

            var declSearchKind: PullElementKind = PullElementKind.SomeType | PullElementKind.SomeContainer | PullElementKind.SomeValue;
            var members: PullSymbol[] = contextualTypeSymbol.getAllMembers(declSearchKind, /*includePrivate*/ false);

            for (var i = 0; i < members.length; i++) {
                members[i].setUnresolved();
            }

            return members;
        }

        public getVisibleMembersFromExpression(expression: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol[] {

            var prevCanUseTypeSymbol = context.canUseTypeSymbol;
            var prevResolvingNamespaceMemberAccess = context.resolvingNamespaceMemberAccess;
            context.canUseTypeSymbol = true;
            context.resolvingNamespaceMemberAccess = true;
            var lhs = this.resolveAST(expression, false, enclosingDecl, context);
            context.canUseTypeSymbol = prevCanUseTypeSymbol;
            context.resolvingNamespaceMemberAccess = prevResolvingNamespaceMemberAccess;

            if (context.resolvingTypeReference && (lhs.kind === PullElementKind.Class || lhs.kind === PullElementKind.Interface)) {
                // No more sub types in these types
                return null;
            }

            var lhsType = lhs.type;
            if (!lhsType) {
                return null;
            }

            if (this.isAnyOrEquivalent(lhsType)) {
                return null;
            }

            if (!lhsType.isResolved) {
                this.resolveDeclaredSymbol(lhsType, enclosingDecl, context);
            }

            // Figure out if privates are available under the current scope
            var includePrivate = false;
            var containerSymbol = lhsType;
            if (containerSymbol.kind === PullElementKind.ConstructorType) {
                containerSymbol = containerSymbol.getConstructSignatures()[0].returnType;
            }

            if (containerSymbol && containerSymbol.isClass()) {
                var declPath = getPathToDecl(enclosingDecl);
                if (declPath && declPath.length) {
                    var declarations = containerSymbol.getDeclarations();
                    for (var i = 0, n = declarations.length; i < n; i++) {
                        var declaration = declarations[i];
                        if (declPath.indexOf(declaration) >= 0) {
                            includePrivate = true;
                            break;
                        }
                    }
                }
            }

            var declSearchKind: PullElementKind = PullElementKind.SomeType | PullElementKind.SomeContainer | PullElementKind.SomeValue;

            var members: PullSymbol[] = [];

            if (lhsType.isContainer()) {
                if ((<PullContainerTypeSymbol>lhsType).getExportAssignedContainerSymbol()) {
                    lhsType = (<PullContainerTypeSymbol>lhsType).getExportAssignedContainerSymbol();
                }
            }

            // could be a type parameter with a contraint
            if (lhsType.isTypeParameter()) {
                var constraint = (<PullTypeParameterSymbol>lhsType).getConstraint();

                if (constraint) {
                    lhsType = constraint;
                    members = lhsType.getAllMembers(declSearchKind, /*includePrivate*/ false);
                }
            }
            else {
                // could be an enum member
                if (lhs.kind == PullElementKind.EnumMember) {
                    lhsType = this.semanticInfoChain.numberTypeSymbol;
                }

                // could be a number
                if (lhsType === this.semanticInfoChain.numberTypeSymbol && this.cachedNumberInterfaceType()) {
                    lhsType = this.cachedNumberInterfaceType();
                }
                // could be a string
                else if (lhsType === this.semanticInfoChain.stringTypeSymbol && this.cachedStringInterfaceType()) {
                    lhsType = this.cachedStringInterfaceType();
                }
                // could be a boolean
                else if (lhsType === this.semanticInfoChain.booleanTypeSymbol && this.cachedBooleanInterfaceType()) {
                    lhsType = this.cachedBooleanInterfaceType();
                }

                if (!lhsType.isResolved) {
                    var potentiallySpecializedType = <PullTypeSymbol>this.resolveDeclaredSymbol(lhsType, enclosingDecl, context);

                    if (potentiallySpecializedType != lhsType) {
                        if (!lhs.isType()) {
                            context.setTypeInContext(lhs, potentiallySpecializedType);
                        }

                        lhsType = potentiallySpecializedType;
                    }
                }

                members = lhsType.getAllMembers(declSearchKind, includePrivate);

                if (lhsType.isContainer()) {
                    var associatedInstance = (<PullContainerTypeSymbol>lhsType).getInstanceSymbol();
                    if (associatedInstance) {
                        var instanceType = associatedInstance.type;
                        if (!instanceType.isResolved) {
                            this.resolveDeclaredSymbol(instanceType, enclosingDecl, context);
                        }
                        var instanceMembers = instanceType.getAllMembers(declSearchKind, includePrivate);
                        members = members.concat(instanceMembers);
                    }

                    var exportedContainer = (<PullContainerTypeSymbol>lhsType).getExportAssignedContainerSymbol();
                    if (exportedContainer) {
                        var exportedContainerMembers = exportedContainer.getAllMembers(declSearchKind, includePrivate);
                        members = members.concat(exportedContainerMembers);
                    }
                }
                // Constructor types have a "prototype" property
                else if (lhsType.isConstructor()) {
                    var prototypeStr = "prototype";
                    var prototypeSymbol = new PullSymbol(prototypeStr, PullElementKind.Property);
                    var parentDecl = lhsType.getDeclarations()[0];
                    var prototypeDecl = new PullDecl(prototypeStr, prototypeStr, parentDecl.kind, parentDecl.flags, parentDecl.getSpan(), parentDecl.getScriptName());
                    this.currentUnit.addSynthesizedDecl(prototypeDecl);
                    prototypeDecl.setParentDecl(parentDecl);
                    prototypeSymbol.addDeclaration(prototypeDecl);
                    // prototypeSymbol.setType(lhsType);
                    members.push(prototypeSymbol);
                }
                else {
                    var associatedContainerSymbol = lhsType.getAssociatedContainerType();
                    if (associatedContainerSymbol) {
                        var containerType = associatedContainerSymbol.type;
                        if (!containerType.isResolved) {
                            this.resolveDeclaredSymbol(containerType, enclosingDecl, context);
                        }
                        var containerMembers = containerType.getAllMembers(declSearchKind, includePrivate);
                        members = members.concat(containerMembers);
                    }
                }
            }

            // could be a function symbol
            if (lhsType.getCallSignatures().length && this.cachedFunctionInterfaceType()) {
                members = members.concat(this.cachedFunctionInterfaceType().getAllMembers(declSearchKind, /*includePrivate*/ false));
            }

            for (var i = 0; i < members.length; i++) {
                if (!members[i].isResolved) {
                    this.resolveDeclaredSymbol(members[i], enclosingDecl, context);
                }
                members[i].setUnresolved();
            }

            return members;
        }

        public isAnyOrEquivalent(type: PullTypeSymbol) {
            return (type === this.semanticInfoChain.anyTypeSymbol) || type.isError();
        }

        public isNumberOrEquivalent(type: PullTypeSymbol) {
            return (type === this.semanticInfoChain.numberTypeSymbol) || (this.cachedNumberInterfaceType() && type === this.cachedNumberInterfaceType());
        }

        public isTypeArgumentOrWrapper(type: PullTypeSymbol) {
            if (!type) {
                return false;
            }

            if (!type.isGeneric()) {
                return false;
            }

            if (type.isTypeParameter()) {
                return true;
            }

            if (type.isArray()) {
                return this.isTypeArgumentOrWrapper(type.getElementType());
            }

            var typeArguments = type.getTypeArguments();

            if (typeArguments) {
                for (var i = 0; i < typeArguments.length; i++) {
                    if (this.isTypeArgumentOrWrapper(typeArguments[i])) {
                        return true;
                    }
                }
            }
            else {
                // if there are no type arguments, but the type is generic, we're just returning
                // the unspecialized version of the type (e.g., via a recursive call)
                return true;
            }

            return false;
        }

        public isArrayOrEquivalent(type: PullTypeSymbol) {
            return (type.isArray() && type.getElementType()) || type == this.cachedArrayInterfaceType();
        }

        private findTypeSymbolForDynamicModule(idText: string, currentFileName: string, search: (id: string) => PullTypeSymbol): PullTypeSymbol {
            var originalIdText = idText;
            var symbol = search(idText);

            if (symbol === null) {
                // perhaps it's a dynamic module?
                if (!symbol) {
                    idText = swapQuotes(originalIdText);
                    symbol = search(idText);
                }

                // Check the literal path first
                if (!symbol) {
                    idText = stripQuotes(originalIdText) + ".d.ts";
                    symbol = search(idText);
                }

                if (!symbol) {
                    idText = stripQuotes(originalIdText) + ".ts";
                    symbol = search(idText);
                }

                // If the literal path doesn't work, begin the search
                if (!symbol && !isRelative(originalIdText)) {
                    // check the full path first, as this is the most likely scenario
                    idText = originalIdText;

                    var strippedIdText = stripQuotes(idText);

                    // REVIEW: Technically, we shouldn't have to normalize here - we should normalize in addUnit.
                    // Still, normalizing here alows any language services to be free of assumptions
                    var path = getRootFilePath(switchToForwardSlashes(currentFileName));

                    while (symbol === null && path != "") {
                        // Check for .d.ts
                        idText = normalizePath(path + strippedIdText + ".d.ts");
                        symbol = search(idText);

                        // check for .ts
                        if (symbol === null) {
                            idText = normalizePath(path + strippedIdText + ".ts");
                            symbol = search(idText);
                        }

                        if (symbol === null) {
                            if (path === '/') {
                                path = '';
                            } else {
                                path = normalizePath(path + "..");
                                path = path && path != '/' ? path + '/' : path;
                            }
                        }
                    }
                }
            }

            return symbol;
        }

        // PULLTODO: VERY IMPORTANT
        // Right now, the assumption is that the declaration's parse tree is still in memory
        // we need to add a cache-in/cache-out mechanism so that we can break the dependency on in-memory ASTs
        public resolveDeclaredSymbol(symbol: PullSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            // This is called while we're resolving type references.  Make sure we're no longer
            // considered to be in that state when we resolve the actual declaration.
            var savedResolvingTypeReference = context.resolvingTypeReference;
            context.resolvingTypeReference = false;

            var result = this.resolveDeclaredSymbolWorker(symbol, enclosingDecl, context);
            context.resolvingTypeReference = savedResolvingTypeReference;

            return result;
        }

        private resolveDeclaredSymbolWorker(symbol: PullSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (!symbol || symbol.isResolved) {
                return symbol;
            }

            if (symbol.inResolution) {
                if (!symbol.currentlyBeingSpecialized()) {
                    if (!symbol.isType()) {
                        symbol.type = this.semanticInfoChain.anyTypeSymbol;
                    }

                    return symbol;
                }
            }

            var thisUnit = this.unitPath;

            var decls = symbol.getDeclarations();

            var ast: AST = null;

            // We want to walk and resolve all associated decls, so we can catch
            // cases like function overloads that may be spread across multiple
            // logical declarations
            for (var i = 0; i < decls.length; i++) {
                var decl = decls[i];

                ast = this.semanticInfoChain.getASTForDecl(decl);

                // if it's an object literal member, just return the symbol and wait for
                // the object lit to be resolved
                if (!ast || ast.nodeType() === NodeType.Member) {

                    // We'll return the cached results, and let the decl be corrected on the next invalidation
                    this.setUnitPath(thisUnit);
                    return symbol;
                }

                this.setUnitPath(decl.getScriptName());
                var resolvedSym = this.resolveAST(ast, /*inContextuallyTypedAssignment*/false, enclosingDecl, context);

                if (resolvedSym &&
                    resolvedSym != symbol &&
                    resolvedSym.kind == PullElementKind.Property &&
                    resolvedSym.isResolved &&
                    resolvedSym.type) {
                    symbol.type = resolvedSym.type;
                    symbol.setResolved();
                }
            }

            var typeArgs = symbol.isType() ? (<PullTypeSymbol>symbol).getTypeArguments() : null;

            if (typeArgs && typeArgs.length) {
                var typeParameters = (<PullTypeSymbol>symbol).getTypeParameters();
                var typeCache: any = {};

                for (var i = 0; i < typeParameters.length; i++) {
                    typeCache[typeParameters[i].pullSymbolIDString] = typeArgs[i];
                }

                context.pushTypeSpecializationCache(typeCache);
                var rootType = getRootType(symbol.type);

                var specializedSymbol = specializeType(rootType, typeArgs, this, enclosingDecl, context, ast);

                context.popTypeSpecializationCache();

                symbol = specializedSymbol;
            }

            this.setUnitPath(thisUnit);

            return symbol;
        }

        //
        // Resolve a module declaration
        //
        //
        private resolveModuleDeclaration(ast: ModuleDeclaration, context: PullTypeResolutionContext): PullTypeSymbol {
            var containerDecl = this.getDeclForAST(ast);
            var containerSymbol = <PullContainerTypeSymbol>containerDecl.getSymbol();

            if (containerSymbol.isResolved) {
                return containerSymbol;
            }

            containerSymbol.setResolved();

            var containerDecls = containerSymbol.getDeclarations();

            for (var i = 0; i < containerDecls.length; i++) {

                var childDecls = containerDecls[i].getChildDecls();

                for (var j = 0; j < childDecls.length; j++) {
                    childDecls[j].ensureSymbolIsBound();
                }
            }
            var members = ast.members.members;

            if (containerDecl.kind != PullElementKind.Enum) {

                var instanceSymbol = containerSymbol.getInstanceSymbol();

                // resolve the instance variable, if neccesary
                if (instanceSymbol) {
                    this.resolveDeclaredSymbol(instanceSymbol, containerDecl.getParentDecl(), context);
                }

                // resolve any export assignments up-front
                // (if we're in typecheck, we'll do this anyway
                if (!context.typeCheck()) {
                    for (var i = 0; i < members.length; i++) {
                        if (members[i].nodeType() == NodeType.ExportAssignment) {
                            this.resolveExportAssignmentStatement(<ExportAssignment>members[i], containerDecl, context);
                            break;
                        }
                    }
                }
            }

            if (context.typeCheck()) {
                var subModuleAST: ModuleDeclaration = null;
                var currentPath = this.unitPath;
                for (var i = 0; i < containerDecls.length; i++) {

                    subModuleAST = <ModuleDeclaration>this.getASTForDecl(containerDecls[i]);

                    if (subModuleAST) {
                        this.setUnitPath(containerDecls[i].getScriptName());
                        this.resolveAST(subModuleAST.members, false, containerDecls[i], context);
                    }
                }
                this.setUnitPath(currentPath);
            }

            return containerSymbol;
        }

        public isTypeRefWithoutTypeArgs(typeRef: TypeReference) {
            if (typeRef.nodeType() != NodeType.TypeRef) {
                return false;
            }

            if (typeRef.term.nodeType() == NodeType.Name) {
                return true;
            }
            else if (typeRef.term.nodeType() == NodeType.MemberAccessExpression) {
                var binex = <BinaryExpression>typeRef.term;

                if (binex.operand2.nodeType() == NodeType.Name) {
                    return true;
                }
            }

            return false;
        }

        //
        // Resolve a reference type (class or interface) type parameters, implements and extends clause, members, call, construct and index signatures
        //
        private resolveReferenceTypeDeclaration(typeDeclAST: TypeDeclaration, context: PullTypeResolutionContext): PullSymbol {
            var typeDecl: PullDecl = this.getDeclForAST(typeDeclAST);
            var enclosingDecl = this.getEnclosingDecl(typeDecl);
            var typeDeclSymbol = <PullTypeSymbol>typeDecl.getSymbol();
            var typeDeclIsClass = typeDeclAST.nodeType() === NodeType.ClassDeclaration;
            var hasVisited = this.getSymbolForAST(typeDeclAST) != null;
            var extendedTypes: PullTypeSymbol[] = [];
            var implementedTypes: PullTypeSymbol[] = [];

            if ((typeDeclSymbol.isResolved && hasVisited) || (typeDeclSymbol.inResolution && !context.isInBaseTypeResolution())) {
                return typeDeclSymbol;
            }

            var wasResolving = typeDeclSymbol.inResolution;
            typeDeclSymbol.startResolving();

            // Resolve Type Parameters

            if (!typeDeclSymbol.isResolved) {
                var typeDeclTypeParameters = typeDeclSymbol.getTypeParameters();
                for (var i = 0; i < typeDeclTypeParameters.length; i++) {
                    this.resolveDeclaredSymbol(typeDeclTypeParameters[i], typeDecl, context);
                }
            }

            // ensure that all members are bound
            var typeRefDecls = typeDeclSymbol.getDeclarations();

            for (var i = 0; i < typeRefDecls.length; i++) {

                var childDecls = typeRefDecls[i].getChildDecls();

                for (var j = 0; j < childDecls.length; j++) {
                    childDecls[j].ensureSymbolIsBound();
                }
            }


            var wasInBaseTypeResolution = context.startBaseTypeResolution();

            // if it's a "split" interface type, we'll need to consider constituent extends lists separately
            if (!typeDeclIsClass && !hasVisited) {
                typeDeclSymbol.resetKnownBaseTypeCount();
            }

            // Extends list
            if (typeDeclAST.extendsList) {
                var savedIsResolvingClassExtendedType = context.isResolvingClassExtendedType;
                if (typeDeclIsClass) {
                    context.isResolvingClassExtendedType = true;
                }

                for (var i = typeDeclSymbol.getKnownBaseTypeCount(); i < typeDeclAST.extendsList.members.length; i = typeDeclSymbol.getKnownBaseTypeCount()) {
                    typeDeclSymbol.incrementKnownBaseCount();
                    var parentType = this.resolveTypeReference(new TypeReference(typeDeclAST.extendsList.members[i], 0), typeDecl, context);

                    if (typeDeclSymbol.isValidBaseKind(parentType, true)) {
                        var resolvedParentType = parentType;
                        extendedTypes[extendedTypes.length] = parentType;
                        if (parentType.isGeneric() && parentType.isResolved && !parentType.getIsSpecialized()) {
                            parentType = this.specializeTypeToAny(parentType, enclosingDecl, context);
                            typeDecl.addDiagnostic(new Diagnostic(typeDecl.getScriptName(), typeDeclAST.minChar, typeDeclAST.getLength(), DiagnosticCode.Generic_type_references_must_include_all_type_arguments));
                        }
                        if (!typeDeclSymbol.hasBase(parentType)) {
                            this.setSymbolForAST(typeDeclAST.extendsList.members[i], resolvedParentType, context);
                            typeDeclSymbol.addExtendedType(parentType);

                            var specializations = typeDeclSymbol.getKnownSpecializations();

                            for (var j = 0; j < specializations.length; j++) {
                                specializations[j].addExtendedType(parentType);
                            }
                        }
                    }
                }

                context.isResolvingClassExtendedType = savedIsResolvingClassExtendedType;
            }

            // Remove any extends links that are not in the AST extendsList if this is the first pass after a re-bind
            //if (!typeDeclSymbol.isResolved() && !wasResolving) {
            //    var baseTypeSymbols = typeDeclSymbol.getExtendedTypes();
            //    for (var i = 0; i < baseTypeSymbols.length; i++) {
            //        var baseType = baseTypeSymbols[i];

            //        for (var j = 0; j < extendedTypes.length; j++) {
            //            if (baseType == extendedTypes[j]) {
            //                break;
            //            }
            //        }

            //        if (j == extendedTypes.length) {
            //            typeDeclSymbol.removeExtendedType(baseType);
            //        }
            //    }
            //}

            if (typeDeclAST.implementsList && typeDeclIsClass) {
                var extendsCount = typeDeclAST.extendsList ? typeDeclAST.extendsList.members.length : 0;
                for (var i = typeDeclSymbol.getKnownBaseTypeCount(); ((i - extendsCount) >= 0) && ((i - extendsCount) < typeDeclAST.implementsList.members.length); i = typeDeclSymbol.getKnownBaseTypeCount()) {
                    typeDeclSymbol.incrementKnownBaseCount();
                    var implementedType = this.resolveTypeReference(new TypeReference(typeDeclAST.implementsList.members[i - extendsCount], 0), typeDecl, context);

                    if (typeDeclSymbol.isValidBaseKind(implementedType, false)) {
                        var resolvedImplementedType = implementedType;
                        implementedTypes[implementedTypes.length] = implementedType;
                        if (implementedType.isGeneric() && implementedType.isResolved && !implementedType.getIsSpecialized()) {
                            implementedType = this.specializeTypeToAny(implementedType, enclosingDecl, context);
                            typeDecl.addDiagnostic(new Diagnostic(typeDecl.getScriptName(), typeDeclAST.minChar, typeDeclAST.getLength(), DiagnosticCode.Generic_type_references_must_include_all_type_arguments));
                            this.setSymbolForAST(
                                typeDeclAST.implementsList.members[i - extendsCount], implementedType, context);
                            typeDeclSymbol.addImplementedType(implementedType);
                        }
                        else if (!typeDeclSymbol.hasBase(implementedType)) {
                            this.setSymbolForAST(
                                typeDeclAST.implementsList.members[i - extendsCount], resolvedImplementedType, context);
                            typeDeclSymbol.addImplementedType(implementedType);
                        }
                    }
                }
            }

            // On the first pass after a re-binding, remove any stale implements links that are not in the AST implementsList
            //if (!typeDeclSymbol.isResolved() && !wasResolving) {
            //    var baseTypeSymbols = typeDeclSymbol.getImplementedTypes();
            //    for (var i = 0; i < baseTypeSymbols.length; i++) {
            //        var baseType = baseTypeSymbols[i];

            //        for (var j = 0; j < implementedTypes.length; j++) {
            //            if (baseType == implementedTypes[j]) {
            //                break;
            //            }
            //        }

            //        if (j == implementedTypes.length) {
            //            typeDeclSymbol.removeImplementedType(baseType);
            //        }
            //    }
            //}

            context.doneBaseTypeResolution(wasInBaseTypeResolution);
            if (wasInBaseTypeResolution && (typeDeclAST.implementsList || typeDeclAST.extendsList)) {
                // Do not resolve members as yet
                return typeDeclSymbol;
            }

            if (!typeDeclSymbol.isResolved) {

                // Resolve members
                var typeDeclMembers = typeDeclSymbol.getMembers();

                if (globalBinder) {
                    globalBinder.resetTypeParameterCache();
                }

                for (var i = 0; i < typeDeclMembers.length; i++) {
                    this.resolveDeclaredSymbol(typeDeclMembers[i], typeDecl, context);
                }

                if (!typeDeclIsClass) {
                    // Resolve call, construct and index signatures
                    var callSignatures = typeDeclSymbol.getCallSignatures();
                    for (var i = 0; i < callSignatures.length; i++) {
                        this.resolveDeclaredSymbol(callSignatures[i], typeDecl, context);
                    }

                    var constructSignatures = typeDeclSymbol.getConstructSignatures();
                    for (var i = 0; i < constructSignatures.length; i++) {
                        this.resolveDeclaredSymbol(constructSignatures[i], typeDecl, context);
                    }

                    var indexSignatures = typeDeclSymbol.getIndexSignatures();
                    for (var i = 0; i < indexSignatures.length; i++) {
                        this.resolveDeclaredSymbol(indexSignatures[i], typeDecl, context);
                    }
                }
            }

            this.setSymbolForAST(typeDeclAST.name, typeDeclSymbol, context);
            this.setSymbolForAST(typeDeclAST, typeDeclSymbol, context);

            typeDeclSymbol.setResolved();

            return typeDeclSymbol;
        }

        //
        // Resolve a class declaration
        //
        // A class's implements and extends lists are not pre-bound, so they must be bound here
        // Once bound, we can add the parent type's members to the class
        //
        private resolveClassDeclaration(classDeclAST: ClassDeclaration, context: PullTypeResolutionContext): PullTypeSymbol {
            var classDecl: PullDecl = this.getDeclForAST(classDeclAST);
            var classDeclSymbol = <PullTypeSymbol>classDecl.getSymbol();
            if (classDeclSymbol.isResolved) {
                return classDeclSymbol;
            }

            this.resolveReferenceTypeDeclaration(classDeclAST, context);

            var constructorMethod = classDeclSymbol.getConstructorMethod();
            var extendedTypes = classDeclSymbol.getExtendedTypes();
            var parentType = extendedTypes.length ? extendedTypes[0] : null;

            if (constructorMethod) {
                var constructorTypeSymbol = constructorMethod.type;

                var constructSignatures = constructorTypeSymbol.getConstructSignatures();

                if (!constructSignatures.length) {
                    var constructorSignature: PullSignatureSymbol;

                    // inherit parent's constructor signatures
                    if (parentType) {
                        var parentClass = parentType;
                        var parentConstructor = parentClass.getConstructorMethod();
                        var parentConstructorType = parentConstructor.type;
                        var parentConstructSignatures = parentConstructorType.getConstructSignatures();

                        var parentConstructSignature: PullSignatureSymbol;
                        var parentParameters: PullSymbol[];
                        for (var i = 0; i < parentConstructSignatures.length; i++) {
                            // create a new signature for each parent constructor
                            parentConstructSignature = parentConstructSignatures[i];
                            parentParameters = parentConstructSignature.parameters;

                            constructorSignature = parentConstructSignature.isDefinition() ?
                            new PullDefinitionSignatureSymbol(PullElementKind.ConstructSignature) : new PullSignatureSymbol(PullElementKind.ConstructSignature);
                            constructorSignature.returnType = classDeclSymbol;

                            for (var j = 0; j < parentParameters.length; j++) {
                                constructorSignature.addParameter(parentParameters[j], parentParameters[j].isOptional);
                            }

                            var typeParameters = constructorTypeSymbol.getTypeParameters();

                            for (var j = 0; j < typeParameters.length; j++) {
                                constructorSignature.addTypeParameter(typeParameters[j]);
                            }

                            constructorTypeSymbol.addConstructSignature(constructorSignature);
                            constructorSignature.addDeclaration(classDecl);
                        }
                    }
                    else { // PULLREVIEW: This likely won't execute, unless there's some serious out-of-order resolution issues
                        constructorSignature = new PullSignatureSymbol(PullElementKind.ConstructSignature);
                        constructorSignature.returnType = classDeclSymbol;
                        constructorTypeSymbol.addConstructSignature(constructorSignature);
                        constructorSignature.addDeclaration(classDecl);

                        var typeParameters = constructorTypeSymbol.getTypeParameters();

                        for (var i = 0; i < typeParameters.length; i++) {
                            constructorSignature.addTypeParameter(typeParameters[i]);
                        }
                    }
                }

                if (!classDeclSymbol.isResolved) {
                    return classDeclSymbol;
                }

                var constructorMembers = constructorTypeSymbol.getMembers();

                this.resolveDeclaredSymbol(constructorMethod, classDecl, context);

                for (var i = 0; i < constructorMembers.length; i++) {
                    this.resolveDeclaredSymbol(constructorMembers[i], classDecl, context);
                }

                if (parentType) {
                    var parentConstructorSymbol = parentType.getConstructorMethod();
                    var parentConstructorTypeSymbol = parentConstructorSymbol.type;

                    if (!constructorTypeSymbol.hasBase(parentConstructorTypeSymbol)) {
                        constructorTypeSymbol.addExtendedType(parentConstructorTypeSymbol);
                    }
                }
            }

            return classDeclSymbol;
        }

        private resolveInterfaceDeclaration(interfaceDeclAST: TypeDeclaration, context: PullTypeResolutionContext): PullTypeSymbol {
            var interfaceDecl: PullDecl = this.getDeclForAST(interfaceDeclAST);
            var interfaceDeclSymbol = <PullTypeSymbol>interfaceDecl.getSymbol();

            this.resolveReferenceTypeDeclaration(interfaceDeclAST, context);
            return interfaceDeclSymbol;
        }

        private resolveImportDeclaration(importStatementAST: ImportDeclaration, context: PullTypeResolutionContext): PullTypeSymbol {
            // internal or external? (Does it matter?)
            var importDecl: PullDecl = this.getDeclForAST(importStatementAST);
            var enclosingDecl = this.getEnclosingDecl(importDecl);
            var importDeclSymbol = <PullTypeAliasSymbol>importDecl.getSymbol();

            var aliasName = importStatementAST.id.text();
            var aliasedType: PullTypeSymbol = null;

            if (importDeclSymbol.isResolved) {
                return importDeclSymbol;
            }

            importDeclSymbol.startResolving();

            // the alias name may be a string literal, in which case we'll need to convert it to a type
            // reference
            if (importStatementAST.alias.nodeType() === NodeType.TypeRef) { // dotted name
                aliasedType = this.resolveTypeReference(<TypeReference>importStatementAST.alias, enclosingDecl, context);
            }
            else if (importStatementAST.alias.nodeType() === NodeType.Name) { // name or dynamic module name
                var text = (<Identifier>importStatementAST.alias).actualText;

                if (!isQuoted(text)) {
                    aliasedType = this.resolveTypeReference(new TypeReference(importStatementAST.alias, 0), enclosingDecl, context);
                }
                else { // dynamic module name (string literal)
                    var modPath = (<StringLiteral>importStatementAST.alias).actualText;
                    var declPath = getPathToDecl(enclosingDecl);

                    importStatementAST.isDynamicImport = true;

                    aliasedType = this.findTypeSymbolForDynamicModule(modPath, importDecl.getScriptName(), (s: string) => <PullTypeSymbol>this.getSymbolFromDeclPath(s, declPath, PullElementKind.SomeContainer));

                    if (aliasedType) {
                        this.currentUnit.addDynamicModuleImport(importDeclSymbol);
                    }
                    else {
                        importDecl.addDiagnostic(
                            new Diagnostic(this.currentUnit.getPath(), importStatementAST.minChar, importStatementAST.getLength(), DiagnosticCode.Unable_to_resolve_external_module_0, [text]));
                        aliasedType = this.semanticInfoChain.anyTypeSymbol;
                    }
                }
            }

            if (aliasedType) {
                if (!aliasedType.isContainer()) {
                    importDecl.addDiagnostic(
                        new Diagnostic(this.currentUnit.getPath(), importStatementAST.minChar, importStatementAST.getLength(), DiagnosticCode.Module_cannot_be_aliased_to_a_non_module_type));
                    aliasedType = this.semanticInfoChain.anyTypeSymbol;
                }
                else if ((<PullContainerTypeSymbol>aliasedType).getExportAssignedValueSymbol()) {
                    importDeclSymbol.setIsUsedAsValue();
                }

                importDeclSymbol.setAliasedType(aliasedType);
                importDeclSymbol.setResolved();

                // Import declaration isn't contextual so set the symbol and diagnostic message irrespective of the context
                this.semanticInfoChain.setSymbolForAST(importStatementAST.alias, aliasedType, this.unitPath);
            }

            return importDeclSymbol;
        }

        public resolveExportAssignmentStatement(exportAssignmentAST: ExportAssignment, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            // get the identifier text
            var id = exportAssignmentAST.id.text();
            var valueSymbol: PullSymbol = null;
            var typeSymbol: PullSymbol = null;
            var containerSymbol: PullSymbol = null;

            var parentSymbol = enclosingDecl.getSymbol();

            if (!parentSymbol.isType() && (<PullTypeSymbol>parentSymbol).isContainer()) {
                // Error
                // Export assignments may only be used at the top-level of external modules
                enclosingDecl.addDiagnostic(
                    new Diagnostic(enclosingDecl.getScriptName(), exportAssignmentAST.minChar, exportAssignmentAST.getLength(), DiagnosticCode.Export_assignments_may_only_be_used_at_the_top_level_of_external_modules));
                return this.semanticInfoChain.anyTypeSymbol;
            }

            // The Identifier of an export assignment must name a variable, function, class, interface, 
            // enum, or internal module declared at the top level in the external module.
            // So look for the id only from this dynamic module
            var declPath: PullDecl[] = enclosingDecl !== null ? [enclosingDecl] : [];

            containerSymbol = this.getSymbolFromDeclPath(id, declPath, PullElementKind.SomeContainer);

            var acceptableAlias = true;

            if (containerSymbol) {
                acceptableAlias = (containerSymbol.kind & PullElementKind.AcceptableAlias) != 0;
            }

            if (!acceptableAlias && containerSymbol && containerSymbol.kind == PullElementKind.TypeAlias) {
                if (!containerSymbol.isResolved) {
                    this.resolveDeclaredSymbol(containerSymbol, enclosingDecl, context);
                }
                var aliasedType = (<PullTypeAliasSymbol>containerSymbol).type;

                // It's ok if the import statement aliases an internal module
                if (aliasedType.kind != PullElementKind.DynamicModule) {
                    acceptableAlias = true;
                }
                else {
                    // If the import statement aliases an external module, see if there's an export assignment
                    var aliasedAssignedValue = (<PullTypeAliasSymbol>containerSymbol).getExportAssignedValueSymbol();
                    var aliasedAssignedType = (<PullTypeAliasSymbol>containerSymbol).getExportAssignedTypeSymbol();
                    var aliasedAssignedContainer = (<PullTypeAliasSymbol>containerSymbol).getExportAssignedContainerSymbol();

                    if (aliasedAssignedValue || aliasedAssignedType || aliasedAssignedContainer) {
                        if (aliasedAssignedValue) {
                            valueSymbol = aliasedAssignedValue;
                        }
                        if (aliasedAssignedType) {
                            typeSymbol = aliasedAssignedType;
                        }
                        if (aliasedAssignedContainer) {
                            containerSymbol = aliasedAssignedContainer;
                        }
                        acceptableAlias = true;
                    }
                }
            }

            // check for valid export assignment type (variable, function, class, interface, enum, internal module)
            if (!acceptableAlias) {
                // Error
                // Export assignments may only be made with variables, functions, classes, interfaces, enums and internal modules
                enclosingDecl.addDiagnostic(
                    new Diagnostic(enclosingDecl.getScriptName(), exportAssignmentAST.minChar, exportAssignmentAST.getLength(), DiagnosticCode.Export_assignments_may_only_be_made_with_variables_functions_classes_interfaces_enums_and_internal_modules));
                return this.semanticInfoChain.voidTypeSymbol;
            }

            // if we haven't already gotten a value or type from the alias, look for them now
            if (!valueSymbol) {
                valueSymbol = this.getSymbolFromDeclPath(id, declPath, PullElementKind.SomeValue);
            }
            if (!typeSymbol) {
                typeSymbol = this.getSymbolFromDeclPath(id, declPath, PullElementKind.SomeType);
            }

            if (!valueSymbol && !typeSymbol && !containerSymbol) {
                // Error
                context.postError(enclosingDecl.getScriptName(), exportAssignmentAST.minChar, exportAssignmentAST.getLength(), DiagnosticCode.Could_not_find_symbol_0, [id]);
                return this.semanticInfoChain.voidTypeSymbol;
            }

            if (valueSymbol) {
                if (!valueSymbol.isResolved) {
                    this.resolveDeclaredSymbol(valueSymbol, enclosingDecl, context);
                }
                (<PullContainerTypeSymbol>parentSymbol).setExportAssignedValueSymbol(valueSymbol);
            }
            if (typeSymbol) {
                if (!typeSymbol.isResolved) {
                    this.resolveDeclaredSymbol(typeSymbol, enclosingDecl, context);
                }

                (<PullContainerTypeSymbol>parentSymbol).setExportAssignedTypeSymbol(<PullTypeSymbol>typeSymbol);
            }
            if (containerSymbol) {
                if (!containerSymbol.isResolved) {
                    this.resolveDeclaredSymbol(containerSymbol, enclosingDecl, context);
                }

                (<PullContainerTypeSymbol>parentSymbol).setExportAssignedContainerSymbol(<PullContainerTypeSymbol>containerSymbol);
            }

            return this.semanticInfoChain.voidTypeSymbol;
        }

        public resolveFunctionTypeSignature(funcDeclAST: FunctionDeclaration, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {

            var funcDeclSymbol: PullTypeSymbol = null;

            var functionDecl = this.getDeclForAST(funcDeclAST);

            if (!functionDecl || !functionDecl.hasSymbol()) {

                var semanticInfo = this.semanticInfoChain.getUnit(this.unitPath);
                var declCollectionContext = new DeclCollectionContext(semanticInfo);

                declCollectionContext.scriptName = this.unitPath;

                if (enclosingDecl) {
                    declCollectionContext.pushParent(enclosingDecl);
                }

                getAstWalkerFactory().walk(funcDeclAST, preCollectDecls, postCollectDecls, null, declCollectionContext);

                functionDecl = this.getDeclForAST(funcDeclAST);
                this.currentUnit.addSynthesizedDecl(functionDecl);

                var binder = new PullSymbolBinder(this.semanticInfoChain);
                binder.setUnit(this.unitPath);
                if (functionDecl.kind === PullElementKind.ConstructorType) {
                    binder.bindConstructorTypeDeclarationToPullSymbol(functionDecl);
                }
                else {
                    binder.bindFunctionTypeDeclarationToPullSymbol(functionDecl);
                }
            }

            funcDeclSymbol = <PullTypeSymbol>functionDecl.getSymbol();

            var signature = funcDeclSymbol.kind === PullElementKind.ConstructorType ? funcDeclSymbol.getConstructSignatures()[0] : funcDeclSymbol.getCallSignatures()[0];

            // resolve the return type annotation
            if (funcDeclAST.returnTypeAnnotation) {
                var returnTypeSymbol = this.resolveTypeReference(<TypeReference>funcDeclAST.returnTypeAnnotation, enclosingDecl, context);

                signature.returnType = returnTypeSymbol;

                if (this.isTypeArgumentOrWrapper(returnTypeSymbol)) {
                    signature.hasAGenericParameter = true;

                    if (funcDeclSymbol) {
                        funcDeclSymbol.type.setHasGenericSignature();
                    }
                }
            }
            else {
                signature.returnType = this.semanticInfoChain.anyTypeSymbol;
            }

            // link parameters and resolve their annotations
            if (funcDeclAST.arguments) {
                for (var i = 0; i < funcDeclAST.arguments.members.length; i++) {
                    this.resolveFunctionTypeSignatureParameter(<Parameter>funcDeclAST.arguments.members[i], signature, enclosingDecl, context);
                }
            }

            // Flag if one of the arguments has a generic parameter
            if (funcDeclSymbol && signature.hasAGenericParameter) {
                funcDeclSymbol.type.setHasGenericSignature();
            }

            if (signature.hasAGenericParameter) {
                // PULLREVIEW: This is split into a spearate if statement to make debugging slightly easier...
                if (funcDeclSymbol) {
                    funcDeclSymbol.type.setHasGenericSignature();
                }
            }

            funcDeclSymbol.setResolved();

            return funcDeclSymbol;
        }

        private resolveFunctionTypeSignatureParameter(argDeclAST: Parameter, signature: PullSignatureSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext) {
            var paramDecl = this.getDeclForAST(argDeclAST);
            var paramSymbol = paramDecl.getSymbol();

            if (argDeclAST.typeExpr) {
                var typeRef = this.resolveTypeReference(<TypeReference>argDeclAST.typeExpr, enclosingDecl, context);

                if (paramSymbol.isVarArg && !(typeRef.isArray() || typeRef == this.cachedArrayInterfaceType())) {
                    var diagnostic = context.postError(this.unitPath, argDeclAST.minChar, argDeclAST.getLength(), DiagnosticCode.Rest_parameters_must_be_array_types, null, enclosingDecl);
                    typeRef = this.getNewErrorTypeSymbol(diagnostic);
                }

                context.setTypeInContext(paramSymbol, typeRef);

                // if the typeExprSymbol is generic, set the "hasGenericParameter" field on the enclosing signature
                if (this.isTypeArgumentOrWrapper(typeRef)) {
                    signature.hasAGenericParameter = true;
                }
            } // PULLTODO: default values?
            else {
                if (paramSymbol.isVarArg && paramSymbol.type) {
                    if (this.cachedArrayInterfaceType()) {
                        context.setTypeInContext(paramSymbol, specializeType(this.cachedArrayInterfaceType(), [paramSymbol.type], this, this.cachedArrayInterfaceType().getDeclarations()[0], context));
                    }
                    else {
                        context.setTypeInContext(paramSymbol, paramSymbol.type);
                    }
                }
                else {
                    context.setTypeInContext(paramSymbol, this.semanticInfoChain.anyTypeSymbol);
                }
            }

            paramSymbol.setResolved();
        }

        private resolveFunctionExpressionParameter(argDeclAST: Parameter, contextParam: PullSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext) {
            var paramDecl = this.getDeclForAST(argDeclAST);
            var paramSymbol = paramDecl.getSymbol();

            if (argDeclAST.typeExpr) {
                var typeRef = this.resolveTypeReference(<TypeReference>argDeclAST.typeExpr, enclosingDecl, context);

                if (paramSymbol.isVarArg && !(typeRef.isArray() || typeRef == this.cachedArrayInterfaceType())) {
                    var diagnostic = context.postError(this.unitPath, argDeclAST.minChar, argDeclAST.getLength(), DiagnosticCode.Rest_parameters_must_be_array_types, null, enclosingDecl);
                    typeRef = this.getNewErrorTypeSymbol(diagnostic);
                }

                context.setTypeInContext(paramSymbol, typeRef);
            } // PULLTODO: default values?
            else {
                if (paramSymbol.isVarArg && paramSymbol.type) {
                    if (this.cachedArrayInterfaceType()) {
                        context.setTypeInContext(paramSymbol, specializeType(this.cachedArrayInterfaceType(), [paramSymbol.type], this, this.cachedArrayInterfaceType().getDeclarations()[0], context));
                    }
                    else {
                        context.setTypeInContext(paramSymbol, paramSymbol.type);
                    }
                }
                else if (contextParam) {
                    context.setTypeInContext(paramSymbol, contextParam.type);
                }
                else {
                    context.setTypeInContext(paramSymbol, this.semanticInfoChain.anyTypeSymbol);
                }
            }

            paramSymbol.setResolved();
        }

        public resolveInterfaceTypeReference(interfaceDeclAST: InterfaceDeclaration, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            var interfaceSymbol: PullTypeSymbol = null;

            var interfaceDecl = this.getDeclForAST(interfaceDeclAST);

            if (!interfaceDecl) {

                var semanticInfo = this.semanticInfoChain.getUnit(this.unitPath);
                var declCollectionContext = new DeclCollectionContext(semanticInfo);

                declCollectionContext.scriptName = this.unitPath;

                if (enclosingDecl) {
                    declCollectionContext.pushParent(enclosingDecl);
                }

                getAstWalkerFactory().walk(interfaceDeclAST, preCollectDecls, postCollectDecls, null, declCollectionContext);

                var interfaceDecl = this.getDeclForAST(interfaceDeclAST);
                this.currentUnit.addSynthesizedDecl(interfaceDecl);

                var binder = new PullSymbolBinder(this.semanticInfoChain);

                binder.setUnit(this.unitPath);
                binder.bindObjectTypeDeclarationToPullSymbol(interfaceDecl);
            }

            interfaceSymbol = <PullTypeSymbol>interfaceDecl.getSymbol();

            if (interfaceDeclAST.members) {
                var memberDecl: PullDecl = null;
                var memberSymbol: PullSymbol = null;
                var memberType: PullTypeSymbol = null;
                var typeMembers = <ASTList> interfaceDeclAST.members;

                for (var i = 0; i < typeMembers.members.length; i++) {
                    memberDecl = this.getDeclForAST(typeMembers.members[i]);
                    memberSymbol = (memberDecl.kind & PullElementKind.SomeSignature) ? memberDecl.getSignatureSymbol() : memberDecl.getSymbol();

                    this.resolveDeclaredSymbol(memberSymbol, enclosingDecl, context);

                    memberType = memberSymbol.type;

                    if ((memberType && memberType.isGeneric()) || (memberSymbol.isSignature() && (<PullSignatureSymbol>memberSymbol).isGeneric())) {
                        interfaceSymbol.setHasGenericMember();
                    }
                }
            }

            interfaceSymbol.setResolved();

            return interfaceSymbol;
        }

        public resolveTypeReference(typeRef: TypeReference, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            if (typeRef === null) {
                return null;
            }

            var symbol = <PullTypeSymbol>this.getSymbolForAST(typeRef);
            if (!symbol) {
                symbol = this.computeTypeReferenceSymbol(typeRef, enclosingDecl, context);

                if (symbol && !symbol.isGeneric()) {
                    this.setSymbolForAST(typeRef, symbol, context);
                }
            }

            return symbol;
        }

        private computeTypeReferenceSymbol(typeRef: TypeReference, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            // the type reference can be
            // a name
            // a function
            // an interface
            // a dotted name
            // an array of any of the above

            var typeDeclSymbol: PullTypeSymbol = null;
            var diagnostic: Diagnostic = null;
            var typeSymbol: PullTypeSymbol = null;

            // a name
            if (typeRef.term.nodeType() === NodeType.Name) {
                var prevResolvingTypeReference = context.resolvingTypeReference;
                context.resolvingTypeReference = true;
                typeSymbol = this.resolveTypeNameExpression(<Identifier>typeRef.term, enclosingDecl, context);
                typeDeclSymbol = <PullTypeSymbol>typeSymbol;

                context.resolvingTypeReference = prevResolvingTypeReference;

                //if (typeDeclSymbol && typeDeclSymbol.isError()) {
                //    return symbolAndDiagnostic;
                //}
            }
            // a function
            else if (typeRef.term.nodeType() === NodeType.FunctionDeclaration) {
                typeDeclSymbol = this.resolveFunctionTypeSignature(<FunctionDeclaration>typeRef.term, enclosingDecl, context);
            }
            // an interface
            else if (typeRef.term.nodeType() === NodeType.InterfaceDeclaration) {
                typeDeclSymbol = this.resolveInterfaceTypeReference(<InterfaceDeclaration>typeRef.term, enclosingDecl, context);
            }
            else if (typeRef.term.nodeType() === NodeType.GenericType) {
                typeSymbol = this.resolveGenericTypeReference(<GenericType>typeRef.term, enclosingDecl, context);
                typeDeclSymbol = typeSymbol;

                //if (typeDeclSymbol && typeDeclSymbol.isError()) {
                //    return symbolAndDiagnostic;
                //}
            }
            // a dotted name
            else if (typeRef.term.nodeType() === NodeType.MemberAccessExpression) {
                // assemble the dotted name path
                var dottedName = <BinaryExpression> typeRef.term;

                // find the decl
                prevResolvingTypeReference = context.resolvingTypeReference;
                typeSymbol = this.resolveDottedTypeNameExpression(dottedName, enclosingDecl, context);
                typeDeclSymbol = typeSymbol;
                context.resolvingTypeReference = prevResolvingTypeReference;

                //if (typeDeclSymbol && typeDeclSymbol.isError()) {
                //    return symbolAndDiagnostic;
                //}
            }
            else if (typeRef.term.nodeType() === NodeType.StringLiteral) {
                var stringConstantAST = <StringLiteral>typeRef.term;
                typeDeclSymbol = new PullStringConstantTypeSymbol(stringConstantAST.actualText);
                var decl = new PullDecl(stringConstantAST.actualText, stringConstantAST.actualText,
                    typeDeclSymbol.kind, null,
                    new TextSpan(stringConstantAST.minChar, stringConstantAST.getLength()), enclosingDecl.getScriptName());
                this.currentUnit.addSynthesizedDecl(decl);
                typeDeclSymbol.addDeclaration(decl);
            }

            if (!typeDeclSymbol) {
                context.postError(this.unitPath, typeRef.term.minChar, typeRef.term.getLength(), DiagnosticCode.Unable_to_resolve_type);
                return this.getNewErrorTypeSymbol(null);
            }

            if (typeDeclSymbol.isError()) {
                // TODO(cyrusn): We shouldn't be returning early here.  Even if we couldn't resolve 
                // the type name, we still want to be able to create an array from it if it had
                // array parameters.
                // 
                return typeDeclSymbol;
            }

            // an array of any of the above
            if (typeRef.arrayCount) {

                var arraySymbol: PullTypeSymbol = typeDeclSymbol.getArrayType();

                // otherwise, create a new array symbol
                if (!arraySymbol) {
                    // for each member in the array interface symbol, substitute in the the typeDecl symbol for "_element"

                    if (!this.cachedArrayInterfaceType().isResolved) {
                        this.resolveDeclaredSymbol(this.cachedArrayInterfaceType(), enclosingDecl, context);
                    }

                    if (typeDeclSymbol.isNamedTypeSymbol() &&
                        typeDeclSymbol.isGeneric() &&
                        !typeDeclSymbol.isTypeParameter() &&
                        typeDeclSymbol.isResolved &&
                        !typeDeclSymbol.getIsSpecialized() &&
                        typeDeclSymbol.getTypeParameters().length &&
                        (typeDeclSymbol.getTypeArguments() == null && !this.isArrayOrEquivalent(typeDeclSymbol)) &&
                        this.isTypeRefWithoutTypeArgs(typeRef)) {

                        context.postError(this.unitPath, typeRef.minChar, typeRef.getLength(), DiagnosticCode.Generic_type_references_must_include_all_type_arguments, null, enclosingDecl, true);
                        typeDeclSymbol = this.specializeTypeToAny(typeDeclSymbol, enclosingDecl, context);
                    }

                    arraySymbol = specializeType(this.cachedArrayInterfaceType(), [typeDeclSymbol], this, this.cachedArrayInterfaceType().getDeclarations()[0], context, typeRef);

                    if (!arraySymbol) {
                        arraySymbol = this.semanticInfoChain.anyTypeSymbol;
                    }
                }

                if (typeRef.arrayCount > 1) {
                    for (var arity = typeRef.arrayCount - 1; arity > 0; arity--) {
                        var existingArraySymbol = arraySymbol.getArrayType();

                        if (!existingArraySymbol) {
                            arraySymbol = specializeType(this.cachedArrayInterfaceType(), [arraySymbol], this, this.cachedArrayInterfaceType().getDeclarations()[0], context, typeRef);
                        }
                        else {
                            arraySymbol = existingArraySymbol;
                        }
                    }
                }

                typeDeclSymbol = arraySymbol;
            }

            return typeDeclSymbol;
        }

        // Also resolves parameter declarations
        private resolveVariableDeclaration(varDecl: BoundDecl, context: PullTypeResolutionContext, enclosingDecl?: PullDecl): PullSymbol {

            var decl: PullDecl = this.getDeclForAST(varDecl);

            // if the enlosing decl is a lambda, we may not have bound the parent symbol
            if (enclosingDecl && decl.kind == PullElementKind.Parameter) {
                enclosingDecl.ensureSymbolIsBound();
            }

            var declSymbol = decl.getSymbol();
            var declParameterSymbol: PullSymbol = decl.getValueDecl() ? decl.getValueDecl().getSymbol() : null;

            if (declSymbol.isResolved) {
                var declType = declSymbol.type;
                var valDecl = decl.getValueDecl();

                if (valDecl) {
                    var valSymbol = valDecl.getSymbol();

                    if (valSymbol && !valSymbol.isResolved) {
                        valSymbol.type = declType;
                        valSymbol.setResolved();
                    }
                }

                return declType;
            }

            if (declSymbol.inResolution) {
                // PULLTODO: Error or warning?
                if (!context.inSpecialization) {
                    declSymbol.type = this.semanticInfoChain.anyTypeSymbol;
                    declSymbol.setResolved();
                    return declSymbol;//this.semanticInfoChain.anyTypeSymbol;
                }
            }

            declSymbol.startResolving();

            var wrapperDecl = this.getEnclosingDecl(decl);
            wrapperDecl = wrapperDecl ? wrapperDecl : enclosingDecl;

            var diagnostic: Diagnostic = null;

            var typeExprSymbol: PullTypeSymbol = null;
            var initExprSymbol: PullSymbol = null;
            var initTypeSymbol: PullTypeSymbol = null;

            // Does this have a type expression? If so, that's the type
            if (varDecl.typeExpr) {
                typeExprSymbol = this.resolveTypeReference(<TypeReference>varDecl.typeExpr, wrapperDecl, context);

                if (!typeExprSymbol) {
                    diagnostic = context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Unable_to_resolve_type_of_0, [varDecl.id.actualText], decl);
                    declSymbol.type = this.getNewErrorTypeSymbol(diagnostic);

                    if (declParameterSymbol) {
                        context.setTypeInContext(declParameterSymbol, this.semanticInfoChain.anyTypeSymbol);
                    }
                }
                else if (typeExprSymbol.isError()) {
                    context.setTypeInContext(declSymbol, typeExprSymbol);
                }
                else {
                    if (typeExprSymbol.isNamedTypeSymbol() &&
                        typeExprSymbol.isGeneric() &&
                        !typeExprSymbol.isTypeParameter() &&
                        typeExprSymbol.isResolved &&
                        !typeExprSymbol.getIsSpecialized() &&
                        typeExprSymbol.getTypeParameters().length &&
                        (typeExprSymbol.getTypeArguments() == null && !this.isArrayOrEquivalent(typeExprSymbol)) &&
                        this.isTypeRefWithoutTypeArgs(<TypeReference>varDecl.typeExpr)) {

                        context.postError(this.unitPath, varDecl.typeExpr.minChar, varDecl.typeExpr.getLength(), DiagnosticCode.Generic_type_references_must_include_all_type_arguments, null, enclosingDecl, true);
                        typeExprSymbol = this.specializeTypeToAny(typeExprSymbol, enclosingDecl, context);
                    }

                    // PULLREVIEW: If the type annotation is a container type, use the module instance type
                    if (typeExprSymbol.isContainer()) {

                        var exportedTypeSymbol = (<PullContainerTypeSymbol>typeExprSymbol).getExportAssignedTypeSymbol();

                        if (exportedTypeSymbol) {
                            typeExprSymbol = exportedTypeSymbol;
                        }
                        else {
                            typeExprSymbol = typeExprSymbol.type;
                            if (typeExprSymbol.isContainer()) {
                                var instanceSymbol = (<PullContainerTypeSymbol>typeExprSymbol).getInstanceSymbol();

                                if (!instanceSymbol || !PullHelpers.symbolIsEnum(instanceSymbol)) {
                                    typeExprSymbol = this.getNewErrorTypeSymbol(diagnostic);
                                }
                                else {
                                    typeExprSymbol = instanceSymbol.type;
                                }
                            }
                        }
                    }
                    else if (declSymbol.isVarArg && !(typeExprSymbol.isArray() || typeExprSymbol == this.cachedArrayInterfaceType())) {
                        var diagnostic = context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Rest_parameters_must_be_array_types, null, enclosingDecl);
                        typeExprSymbol = this.getNewErrorTypeSymbol(diagnostic);
                    }

                    context.setTypeInContext(declSymbol, typeExprSymbol);

                    if (declParameterSymbol) {
                        declParameterSymbol.type = typeExprSymbol;
                    }

                    // We associate the value with the function type here because we couldn't do so at biding
                    // but need this information to get correct doc comments
                    if (typeExprSymbol.kind == PullElementKind.FunctionType) {
                        typeExprSymbol.setFunctionSymbol(declSymbol);
                    }

                    // if the typeExprSymbol is generic, set the "hasGenericParameter" field on the enclosing signature
                    // we filter out arrays, since for those we just want to know if their element type is a type parameter...
                    if ((varDecl.nodeType() === NodeType.Parameter) && enclosingDecl && ((typeExprSymbol.isGeneric() && !typeExprSymbol.isArray()) || this.isTypeArgumentOrWrapper(typeExprSymbol))) {
                        var signature = enclosingDecl.getSpecializingSignatureSymbol();

                        if (signature) {
                            signature.hasAGenericParameter = true;
                        }
                    }
                }
            }
            
            // If we're not type checking, and have a type expression, don't bother looking at the initializer expression
            if (varDecl.init && (context.typeCheck() || !varDecl.typeExpr)) {
                initExprSymbol = this.resolveAST(varDecl.init, false, wrapperDecl, context);

                if (!initExprSymbol) {
                    diagnostic = context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Unable_to_resolve_type_of_0, [varDecl.id.actualText], decl);

                    context.setTypeInContext(declSymbol, this.getNewErrorTypeSymbol(diagnostic));

                    if (declParameterSymbol) {
                        context.setTypeInContext(declParameterSymbol, this.semanticInfoChain.anyTypeSymbol);
                    }
                }
                else {
                    initTypeSymbol = initExprSymbol.type;

                    context.setTypeInContext(declSymbol, this.widenType(initTypeSymbol));

                    if (declParameterSymbol) {
                        context.setTypeInContext(declParameterSymbol, initTypeSymbol);
                    }
                }
            }
            //else if (declSymbol.kind === PullElementKind.Container) { // module instance value
            //    instanceSymbol = (<PullContainerTypeSymbol>declSymbol).getInstanceSymbol();
            //    var instanceType = instanceSymbol.type;

            //    if (instanceType) {
            //        context.setTypeInContext(declSymbol, instanceType);
            //    }
            //    else {
            //        context.setTypeInContext(declSymbol, this.semanticInfoChain.anyTypeSymbol);
            //    }
            //}
            //else if () {} // class instance value

            // If we're lacking both a type annotation and an initialization expression, the type is 'any'
            if (!(varDecl.typeExpr || varDecl.init)) {
                var defaultType = this.semanticInfoChain.anyTypeSymbol;

                if (declSymbol.isVarArg) {
                    defaultType = specializeType(this.cachedArrayInterfaceType(), [defaultType], this, this.cachedArrayInterfaceType().getDeclarations()[0], context);
                }

                context.setTypeInContext(declSymbol, defaultType);

                if (declParameterSymbol) {
                    declParameterSymbol.type = defaultType;
                }
            }

            // Otherwise, if we're type checking, test the initializer and type annotation for assignment compatibility
            else if (context.typeCheck()) {
                if (typeExprSymbol && typeExprSymbol.isContainer()) {

                    var exportedTypeSymbol = (<PullContainerTypeSymbol>typeExprSymbol).getExportAssignedTypeSymbol();

                    if (exportedTypeSymbol) {
                        typeExprSymbol = exportedTypeSymbol;
                    }
                    else {
                        var instanceTypeSymbol = (<PullContainerTypeSymbol>typeExprSymbol.type).getInstanceSymbol().type;

                        if (!instanceTypeSymbol || !PullHelpers.symbolIsEnum(instanceTypeSymbol)) {
                            context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Tried_to_set_variable_type_to_container_type_0, [typeExprSymbol.toString()], enclosingDecl);
                            typeExprSymbol = null;
                        }
                        else {
                            typeExprSymbol = instanceTypeSymbol.type;
                        }
                    }
                }

                if (initTypeSymbol && initTypeSymbol.isContainer()) {

                    instanceTypeSymbol = (<PullContainerTypeSymbol>initTypeSymbol).getInstanceSymbol().type;

                    if (!instanceTypeSymbol) {
                        context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Tried_to_set_variable_type_to_uninitialized_module_type_0, [initTypeSymbol.toString()], enclosingDecl);
                        initTypeSymbol = null;
                    }
                    else {
                        initTypeSymbol = instanceTypeSymbol.type;
                    }
                }

                if (initTypeSymbol && typeExprSymbol) {
                    var comparisonInfo = new TypeComparisonInfo();

                    var isAssignable = this.sourceIsAssignableToTarget(initTypeSymbol, typeExprSymbol, context, comparisonInfo);

                    if (!isAssignable) {
                        if (comparisonInfo.message) {
                            context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Cannot_convert_0_to_1_NL_2, [initTypeSymbol.toString(), typeExprSymbol.toString(), comparisonInfo.message], enclosingDecl);
                        } else {
                            context.postError(this.unitPath, varDecl.minChar, varDecl.getLength(), DiagnosticCode.Cannot_convert_0_to_1, [initTypeSymbol.toString(), typeExprSymbol.toString()], enclosingDecl);
                        }
                    }
                }
            }

            declSymbol.setResolved();

            if (declParameterSymbol) {
                declParameterSymbol.setResolved();
            }

            return declSymbol;
        }

        private resolveTypeParameterDeclaration(typeParameterAST: TypeParameter, context: PullTypeResolutionContext): PullTypeSymbol {
            var typeParameterDecl = this.getDeclForAST(typeParameterAST);
            var typeParameterSymbol = <PullTypeParameterSymbol>typeParameterDecl.getSymbol();

            if (typeParameterSymbol.isResolved || typeParameterSymbol.inResolution) {
                return typeParameterSymbol;
            }

            typeParameterSymbol.startResolving();

            if (typeParameterAST.constraint) {
                var enclosingDecl = this.getEnclosingDecl(typeParameterDecl);
                var constraintTypeSymbol = this.resolveTypeReference(<TypeReference>typeParameterAST.constraint, enclosingDecl, context);


                if (constraintTypeSymbol && constraintTypeSymbol.isPrimitive() && !constraintTypeSymbol.isError()) {
                    context.postError(this.unitPath, typeParameterAST.minChar, typeParameterAST.getLength(), DiagnosticCode.Type_parameter_constraint_cannot_be_a_primitive_type, null, this.getEnclosingDecl(typeParameterDecl));
                    constraintTypeSymbol = this.specializeTypeToAny(constraintTypeSymbol, enclosingDecl, context);
                }
                else if (constraintTypeSymbol.isNamedTypeSymbol() &&
                    constraintTypeSymbol.isGeneric() &&
                    !constraintTypeSymbol.isTypeParameter() &&
                    constraintTypeSymbol.getTypeParameters().length &&
                    (constraintTypeSymbol.getTypeArguments() == null && !this.isArrayOrEquivalent(constraintTypeSymbol)) &&
                    constraintTypeSymbol.isResolved &&
                    this.isTypeRefWithoutTypeArgs(<TypeReference>typeParameterAST.constraint)) {

                    context.postError(this.unitPath, typeParameterAST.constraint.minChar, typeParameterAST.constraint.getLength(), DiagnosticCode.Generic_type_references_must_include_all_type_arguments, null, enclosingDecl, true);
                    constraintTypeSymbol = this.specializeTypeToAny(constraintTypeSymbol, enclosingDecl, context);
                }

                if (constraintTypeSymbol) {
                    typeParameterSymbol.setConstraint(constraintTypeSymbol);
                }
            }

            typeParameterSymbol.setResolved();

            return typeParameterSymbol;
        }

        private resolveFunctionBodyReturnTypes(funcDeclAST: FunctionDeclaration, signature: PullSignatureSymbol, useContextualType: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext) {
            var returnStatements: {
                returnStatement: ReturnStatement; enclosingDecl: PullDecl;
            }[] = [];

            var enclosingDeclStack: PullDecl[] = [enclosingDecl];

            var preFindReturnExpressionTypes = (ast: AST, parent: AST, walker: IAstWalker) => {
                var go = true;

                switch (ast.nodeType()) {
                    case NodeType.FunctionDeclaration:
                        // don't recurse into a function decl - we don't want to confuse a nested
                        // return type with the top-level function's return type
                        go = false;
                        break;

                    case NodeType.ReturnStatement:
                        var returnStatement: ReturnStatement = <ReturnStatement>ast;
                        enclosingDecl.setFlag(PullElementFlags.HasReturnStatement);
                        returnStatements[returnStatements.length] = { returnStatement: returnStatement, enclosingDecl: enclosingDeclStack[enclosingDeclStack.length - 1] };
                        go = false;
                        break;

                    case NodeType.CatchClause:
                    case NodeType.WithStatement:
                        enclosingDeclStack[enclosingDeclStack.length] = this.getDeclForAST(ast);
                        break;

                    default:
                        break;
                }

                walker.options.goChildren = go;

                return ast;
            };

            var postFindReturnExpressionEnclosingDecls = function (ast: AST, parent: AST, walker: IAstWalker) {
                switch (ast.nodeType()) {
                    case NodeType.CatchClause:
                    case NodeType.WithStatement:
                        enclosingDeclStack.length--;
                        break;
                    default:
                        break;
                }

                walker.options.goChildren = true;

                return ast;
            };

            getAstWalkerFactory().walk(funcDeclAST.block, preFindReturnExpressionTypes, postFindReturnExpressionEnclosingDecls);

            if (!returnStatements.length) {
                signature.returnType = this.semanticInfoChain.voidTypeSymbol;
            }

            else {
                var returnExpressionSymbols: PullTypeSymbol[] = [];
                var returnType: PullTypeSymbol;

                for (var i = 0; i < returnStatements.length; i++) {
                    if (returnStatements[i].returnStatement.returnExpression) {
                        returnType = this.resolveAST(returnStatements[i].returnStatement.returnExpression, useContextualType, returnStatements[i].enclosingDecl, context).type;

                        if (returnType.isError()) {
                            signature.returnType = returnType;
                            return;
                        }
                        else {
                            this.setSymbolForAST(returnStatements[i].returnStatement, returnType, context);
                        }

                        returnExpressionSymbols[returnExpressionSymbols.length] = returnType;
                    }
                }

                if (!returnExpressionSymbols.length) {
                    signature.returnType = this.semanticInfoChain.voidTypeSymbol;
                }
                else {

                    // combine return expression types for best common type
                    var collection: IPullTypeCollection = {
                        getLength: () => { return returnExpressionSymbols.length; },
                        setTypeAtIndex: (index: number, type: PullTypeSymbol) => { },
                        getTypeAtIndex: (index: number) => {
                            return returnExpressionSymbols[index].type;
                        }
                    };

                    returnType = this.findBestCommonType(returnExpressionSymbols[0], null, collection, context, new TypeComparisonInfo());

                    if (useContextualType && returnType == this.semanticInfoChain.anyTypeSymbol) {
                        var contextualType = context.getContextualType();

                        if (contextualType) {
                            returnType = contextualType;
                        }
                    }

                    signature.returnType = returnType ? this.widenType(returnType) : this.semanticInfoChain.anyTypeSymbol;

                    if (this.isTypeArgumentOrWrapper(returnType)) {
                        var functionDecl = this.getDeclForAST(funcDeclAST);
                        var functionSymbol = functionDecl.getSymbol();

                        if (functionSymbol) {
                            functionSymbol.type.setHasGenericSignature();
                        }
                    }
                }
            }
        }

        private resolveFunctionDeclaration(funcDeclAST: FunctionDeclaration, context: PullTypeResolutionContext): PullSymbol {

            var funcDecl: PullDecl = this.getDeclForAST(funcDeclAST);

            var funcSymbol = funcDecl.getSymbol();

            var signature: PullSignatureSymbol = funcDecl.getSpecializingSignatureSymbol();

            var hadError = false;

            var isConstructor = funcDeclAST.isConstructor || hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.ConstructMember);

            if (signature) {

                if (signature.isResolved) {
                    return funcSymbol;
                }

                if (isConstructor && !signature.inResolution) {
                    var classAST = funcDeclAST.classDecl;

                    if (classAST) {
                        var classDecl = this.getDeclForAST(classAST);
                        var classSymbol = classDecl.getSymbol();

                        if (!classSymbol.isResolved && !classSymbol.inResolution) {
                            this.resolveDeclaredSymbol(classSymbol, this.getEnclosingDecl(classDecl), context);
                        }
                    }
                }

                var diagnostic: Diagnostic;

                if (signature.inResolution) {

                    // try to set the return type, even though we may be lacking in some information
                    if (funcDeclAST.returnTypeAnnotation) {
                        var returnTypeSymbol = this.resolveTypeReference(<TypeReference>funcDeclAST.returnTypeAnnotation, funcDecl, context);
                        if (!returnTypeSymbol) {
                            diagnostic = context.postError(this.unitPath, funcDeclAST.returnTypeAnnotation.minChar, funcDeclAST.returnTypeAnnotation.getLength(), DiagnosticCode.Cannot_resolve_return_type_reference, null, funcDecl);
                            signature.returnType = this.getNewErrorTypeSymbol(diagnostic);
                            hadError = true;
                        } else {
                            if (this.isTypeArgumentOrWrapper(returnTypeSymbol)) {
                                signature.hasAGenericParameter = true;
                                if (funcSymbol) {
                                    funcSymbol.type.setHasGenericSignature();
                                }
                            }
                            signature.returnType = returnTypeSymbol;

                            if (isConstructor && returnTypeSymbol === this.semanticInfoChain.voidTypeSymbol) {
                                context.postError(this.unitPath, funcDeclAST.minChar, funcDeclAST.getLength(), DiagnosticCode.Constructors_cannot_have_a_return_type_of_void, null, funcDecl, true);
                            }
                        }
                    }
                    else {
                        signature.returnType = this.semanticInfoChain.anyTypeSymbol;
                    }

                    signature.setResolved();
                    return funcSymbol;
                }

                signature.startResolving();

                if (funcDeclAST.typeArguments) {
                    for (var i = 0; i < funcDeclAST.typeArguments.members.length; i++) {
                        this.resolveTypeParameterDeclaration(<TypeParameter>funcDeclAST.typeArguments.members[i], context);
                    }
                }

                // resolve parameter type annotations as necessary
                if (funcDeclAST.arguments) {
                    for (var i = 0; i < funcDeclAST.arguments.members.length; i++) {
                        this.resolveVariableDeclaration(<BoundDecl>funcDeclAST.arguments.members[i], context, funcDecl);
                    }
                }

                if (signature.isGeneric()) {
                    // PULLREVIEW: This is split into a spearate if statement to make debugging slightly easier...
                    if (funcSymbol) {
                        funcSymbol.type.setHasGenericSignature();
                    }
                }

                // resolve the return type annotation
                if (funcDeclAST.returnTypeAnnotation) {

                    // We may have a return type from a previous resolution - if the function's generic,
                    // we can reuse it
                    var prevReturnTypeSymbol = signature.returnType;

                    // use the funcDecl for the enclosing decl, since we want to pick up any type parameters 
                    // on the function when resolving the return type
                    returnTypeSymbol = this.resolveTypeReference(<TypeReference>funcDeclAST.returnTypeAnnotation, funcDecl, context);

                    if (!returnTypeSymbol) {
                        diagnostic = context.postError(this.unitPath, funcDeclAST.returnTypeAnnotation.minChar, funcDeclAST.returnTypeAnnotation.getLength(), DiagnosticCode.Cannot_resolve_return_type_reference, null, funcDecl);
                        signature.returnType = this.getNewErrorTypeSymbol(diagnostic);

                        hadError = true;
                    }
                    else if (!(this.isTypeArgumentOrWrapper(returnTypeSymbol) && prevReturnTypeSymbol && !this.isTypeArgumentOrWrapper(prevReturnTypeSymbol))) {
                        if (this.isTypeArgumentOrWrapper(returnTypeSymbol)) {
                            signature.hasAGenericParameter = true;

                            if (funcSymbol) {
                                funcSymbol.type.setHasGenericSignature();
                            }
                        }

                        signature.returnType = returnTypeSymbol;

                        if (isConstructor && returnTypeSymbol === this.semanticInfoChain.voidTypeSymbol) {
                            context.postError(this.unitPath, funcDeclAST.minChar, funcDeclAST.getLength(), DiagnosticCode.Constructors_cannot_have_a_return_type_of_void, null, funcDecl, true);
                        }
                    }
                }
                // if there's no return-type annotation
                //     - if it's not a definition signature, set the return type to 'any'
                //     - if it's a definition sigature, take the best common type of all return expressions
                //     - if it's a constructor, we set the return type link during binding
                else if (!funcDeclAST.isConstructor) {
                    if (funcDeclAST.isSignature()) {
                        signature.returnType = this.semanticInfoChain.anyTypeSymbol;
                    }
                    else {
                        this.resolveFunctionBodyReturnTypes(funcDeclAST, signature, false, funcDecl, context);
                    }
                }

                if (!hadError) {
                    signature.setResolved();
                }
            }

            if (context.typeCheck()) {
                this.seenSuperConstructorCall = false;

                this.resolveAST(funcDeclAST.block, false, funcDecl, context);

                this.validateVariableDeclarationGroups(funcDecl, context);

                var enclosingDecl = this.getEnclosingDecl(funcDecl);

                var hasReturn = (funcDecl.flags & (PullElementFlags.Signature | PullElementFlags.HasReturnStatement)) != 0;

                var parameters = signature.parameters;

                // Is it a constructor?
                if (funcDeclAST.isConstructor || hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.ConstructMember)) {
                    if (funcDecl.getSignatureSymbol() && funcDecl.getSignatureSymbol().isDefinition() && this.enclosingClassIsDerived(funcDecl)) {
                        // Constructors for derived classes must contain a call to the class's 'super' constructor
                        if (!this.seenSuperConstructorCall) {
                            context.postError(this.unitPath, funcDeclAST.minChar, 11 /* "constructor" */,
                                DiagnosticCode.Constructors_for_derived_classes_must_contain_a_super_call, null, enclosingDecl);
                        }
                        // The first statement in the body of a constructor must be a super call if both of the following are true:
                        //  - The containing class is a derived class.
                        //  - The constructor declares parameter properties or the containing class declares instance member variables with initializers.
                        else if (this.superCallMustBeFirstStatementInConstructor(funcDecl, enclosingDecl)) {
                            var firstStatement = this.getFirstStatementFromFunctionDeclAST(funcDeclAST);
                            if (!firstStatement || !this.isSuperCallNode(firstStatement)) {
                                context.postError(this.unitPath, funcDeclAST.minChar, 11 /* "constructor" */,
                                    DiagnosticCode.A_super_call_must_be_the_first_statement_in_the_constructor_when_a_class_contains_initialized_properties_or_has_parameter_properties, null, enclosingDecl);
                            }
                        }
                    }
                }

                // Is it an indexer?
                else if (hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.IndexerMember)) {

                    var allIndexSignatures = enclosingDecl.getSymbol().type.getIndexSignatures();

                    for (var i = 0; i < allIndexSignatures.length; i++) {
                        if (!allIndexSignatures[i].isResolved) {
                            this.resolveDeclaredSymbol(allIndexSignatures[i], allIndexSignatures[i].getDeclarations()[0].getParentDecl(), context);
                        }

                        if (allIndexSignatures[i].parameters[0].type !== parameters[0].type) {
                            var stringIndexSignature: PullSignatureSymbol = null;
                            var numberIndexSignature: PullSignatureSymbol = null;

                            var indexSignature = signature;

                            var isNumericIndexer = parameters[0].type === this.semanticInfoChain.numberTypeSymbol;

                            if (isNumericIndexer) {
                                numberIndexSignature = indexSignature;
                                stringIndexSignature = allIndexSignatures[i];
                            }
                            else {
                                numberIndexSignature = allIndexSignatures[i];
                                stringIndexSignature = indexSignature;

                                // If we are a string indexer sharing a container with a number index signature, the number will report the error
                                // TODO: use indexSignature.getContainer() and allIndexSignatures[i].getContainer() once the symbol container relationship stabilizes
                                if (enclosingDecl.getSymbol() === numberIndexSignature.getDeclarations()[0].getParentDecl().getSymbol()) {
                                    break;
                                }
                            }
                            var comparisonInfo = new TypeComparisonInfo();
                            var resolutionContext = new PullTypeResolutionContext();
                            if (!this.sourceIsSubtypeOfTarget(numberIndexSignature.returnType, stringIndexSignature.returnType, resolutionContext, comparisonInfo)) {
                                if (comparisonInfo.message) {
                                    context.postError(this.unitPath, funcDeclAST.minChar, funcDeclAST.getLength(), DiagnosticCode.Numeric_indexer_type_0_must_be_a_subtype_of_string_indexer_type_1_NL_2,
                                        [numberIndexSignature.returnType.toString(), stringIndexSignature.returnType.toString(), comparisonInfo.message], enclosingDecl);
                                } else {
                                    context.postError(this.unitPath, funcDeclAST.minChar, funcDeclAST.getLength(), DiagnosticCode.Numeric_indexer_type_0_must_be_a_subtype_of_string_indexer_type_1,
                                        [numberIndexSignature.returnType.toString(), stringIndexSignature.returnType.toString()], enclosingDecl);
                                }
                            }
                            break;
                        }
                    }

                    // Check that property names comply with indexer constraints (both string and numeric)
                    var allMembers = enclosingDecl.getSymbol().type.getAllMembers(PullElementKind.All, /*includePrivate*/ true);
                    for (var i = 0; i < allMembers.length; i++) {
                        var name = allMembers[i].name;
                        if (name) {
                            if (!allMembers[i].isResolved) {
                                this.resolveDeclaredSymbol(allMembers[i], allMembers[i].getDeclarations()[0].getParentDecl(), context);
                            }
                            // Skip members in the same container, they will be checked during their member type check
                            if (enclosingDecl.getSymbol() !== allMembers[i].getContainer()) {
                                // Check if the member name is numerical
                                var isMemberNumeric = isFinite(+name);
                                if (isNumericIndexer === isMemberNumeric) {
                                    this.checkThatMemberIsSubtypeOfIndexer(allMembers[i], indexSignature, funcDeclAST, context, enclosingDecl, isNumericIndexer);
                                }
                            }
                        }
                    }
                }

                // Is it an accessor?
                else if (funcDeclAST.isAccessor()) {
                    var accessorSymbol = <PullAccessorSymbol>funcSymbol;

                    var isGetter = hasFlag(funcDeclAST.getFunctionFlags(), FunctionFlags.GetAccessor);
                    var isSetter = !isGetter;

                    var getter = accessorSymbol.getGetter();
                    var setter = accessorSymbol.getSetter();

                    var parameters = signature.parameters;

                    var funcNameAST = funcDeclAST.name;

                    if (isGetter && !hasReturn) {
                        if (!(funcDeclAST.block.statements.members.length > 0 && funcDeclAST.block.statements.members[0].nodeType() === NodeType.ThrowStatement)) {
                            context.postError(this.unitPath, funcNameAST.minChar, funcNameAST.getLength(), DiagnosticCode.Getters_must_return_a_value, null, enclosingDecl);
                        }
                    }

                    // Setter with return value is checked in typeCheckReturnExpression

                    if (getter && setter) {
                        var getterDecl = getter.getDeclarations()[0];
                        var setterDecl = setter.getDeclarations()[0];

                        var getterIsPrivate = getterDecl.flags & PullElementFlags.Private;
                        var setterIsPrivate = setterDecl.flags & PullElementFlags.Private;

                        if (getterIsPrivate != setterIsPrivate) {
                            context.postError(this.unitPath, funcNameAST.minChar, funcNameAST.getLength(), DiagnosticCode.Getter_and_setter_accessors_do_not_agree_in_visibility, null, enclosingDecl);
                        }
                    }
                }

                // It's just a conventional function or method
                else {

                    if (funcDeclAST.block && funcDeclAST.returnTypeAnnotation != null && !hasReturn) {
                        var isVoidOrAny = this.isAnyOrEquivalent(returnTypeSymbol) || returnTypeSymbol === this.semanticInfoChain.voidTypeSymbol;

                        if (!isVoidOrAny && !(funcDeclAST.block.statements.members.length > 0 && funcDeclAST.block.statements.members[0].nodeType() === NodeType.ThrowStatement)) {
                            var funcName = funcDecl.getDisplayName();
                            funcName = funcName ? "'" + funcName + "'" : "expression";

                            context.postError(this.unitPath, funcDeclAST.returnTypeAnnotation.minChar, funcDeclAST.returnTypeAnnotation.getLength(), DiagnosticCode.Function_0_declared_a_non_void_return_type_but_has_no_return_expression, [funcName], enclosingDecl);
                        }
                    }
                }

                this.typeCheckFunctionOverloads(funcDeclAST, context);
                this.checkFunctionTypePrivacy(funcDeclAST, false, context);
            }

            return funcSymbol;
        }

        private resolveGetAccessorDeclaration(funcDeclAST: FunctionDeclaration, context: PullTypeResolutionContext): PullSymbol {

            var funcDecl: PullDecl = this.getDeclForAST(funcDeclAST);
            var accessorSymbol = <PullAccessorSymbol> funcDecl.getSymbol();

            var getterSymbol = accessorSymbol.getGetter();
            var getterTypeSymbol = <PullTypeSymbol>getterSymbol.type;

            var signature: PullSignatureSymbol = getterTypeSymbol.getCallSignatures()[0];

            var hadError = false;
            var diagnostic: Diagnostic;

            if (signature) {

                if (signature.isResolved) {
                    return accessorSymbol;
                }

                if (signature.inResolution) {
                    // PULLTODO: Error or warning?
                    signature.returnType = this.semanticInfoChain.anyTypeSymbol;
                    signature.setResolved();

                    return accessorSymbol;
                }

                signature.startResolving();

                // resolve parameter type annotations as necessary
                if (funcDeclAST.arguments) {
                    for (var i = 0; i < funcDeclAST.arguments.members.length; i++) {
                        this.resolveVariableDeclaration(<BoundDecl>funcDeclAST.arguments.members[i], context, funcDecl);
                    }
                }

                if (signature.hasAGenericParameter) {
                    // PULLREVIEW: This is split into a spearate if statement to make debugging slightly easier...
                    if (getterSymbol) {
                        getterTypeSymbol.setHasGenericSignature();
                    }
                }

                // resolve the return type annotation
                if (funcDeclAST.returnTypeAnnotation) {
                    // use the funcDecl for the enclosing decl, since we want to pick up any type parameters 
                    // on the function when resolving the return type
                    var returnTypeSymbol = this.resolveTypeReference(<TypeReference>funcDeclAST.returnTypeAnnotation, funcDecl, context);

                    if (!returnTypeSymbol) {
                        diagnostic = context.postError(this.unitPath, funcDeclAST.returnTypeAnnotation.minChar, funcDeclAST.returnTypeAnnotation.getLength(), DiagnosticCode.Cannot_resolve_return_type_reference, null, funcDecl);
                        signature.returnType = this.getNewErrorTypeSymbol(diagnostic);

                        hadError = true;
                    }
                    else {

                        if (this.isTypeArgumentOrWrapper(returnTypeSymbol)) {
                            signature.hasAGenericParameter = true;

                            if (getterSymbol) {
                                getterTypeSymbol.setHasGenericSignature();
                            }
                        }

                        signature.returnType = returnTypeSymbol;
                    }
                }

                // if there's no return-type annotation
                //     - if it's not a definition signature, set the return type to 'any'
                //     - if it's a definition sigature, take the best common type of all return expressions
                else {
                    if (funcDeclAST.isSignature()) {
                        signature.returnType = this.semanticInfoChain.anyTypeSymbol;
                    }
                    else {
                        this.resolveFunctionBodyReturnTypes(funcDeclAST, signature, false, funcDecl, context);
                    }
                }


                if (!hadError) {
                    signature.setResolved();
                }
            }

            var accessorType = signature.returnType;

            var setter = accessorSymbol.getSetter();

            if (setter) {
                var setterType = setter.type;
                var setterSig = setterType.getCallSignatures()[0];

                if (setterSig.isResolved) {
                    // compare setter parameter type and getter return type
                    var setterParameters = setterSig.parameters;

                    if (setterParameters.length) {
                        var setterParameter = setterParameters[0];
                        var setterParameterType = setterParameter.type;

                        if (!this.typesAreIdentical(accessorType, setterParameterType)) {
                            diagnostic = context.postError(this.unitPath, funcDeclAST.minChar, funcDeclAST.getLength(), DiagnosticCode.get_and_set_accessor_must_have_the_same_type, null, this.getEnclosingDecl(funcDecl));
                            accessorSymbol.type = this.getNewErrorTypeSymbol(diagnostic);
                        }
                    }
                }
                else {
                    accessorSymbol.type = accessorType;
                }

            }
            else {
                accessorSymbol.type = accessorType;
            }

            return accessorSymbol;
        }

        private resolveSetAccessorDeclaration(funcDeclAST: FunctionDeclaration, context: PullTypeResolutionContext): PullSymbol {

            var funcDecl: PullDecl = this.getDeclForAST(funcDeclAST);
            var accessorSymbol = <PullAccessorSymbol> funcDecl.getSymbol();

            var setterSymbol = accessorSymbol.getSetter();
            var setterTypeSymbol = <PullTypeSymbol>setterSymbol.type;

            var signature: PullSignatureSymbol = setterTypeSymbol.getCallSignatures()[0];

            var hadError = false;

            if (signature) {

                if (signature.isResolved) {
                    return accessorSymbol;
                }

                if (signature.inResolution) {
                    // PULLTODO: Error or warning?
                    signature.returnType = this.semanticInfoChain.anyTypeSymbol;
                    signature.setResolved();

                    return accessorSymbol;
                }

                signature.startResolving();

                // resolve parameter type annotations as necessary
                if (funcDeclAST.arguments) {
                    for (var i = 0; i < funcDeclAST.arguments.members.length; i++) {
                        this.resolveVariableDeclaration(<BoundDecl>funcDeclAST.arguments.members[i], context, funcDecl);
                    }
                }

                if (signature.hasAGenericParameter) {
                    // PULLREVIEW: This is split into a spearate if statement to make debugging slightly easier...
                    if (setterSymbol) {
                        setterTypeSymbol.setHasGenericSignature();
                    }
                }

                if (!hadError) {
                    signature.setResolved();
                }
            }

            var parameters = signature.parameters;

            var getter = accessorSymbol.getGetter();

            var accessorType = parameters.length ? parameters[0].type : getter ? getter.type : this.semanticInfoChain.undefinedTypeSymbol;

            if (getter) {
                var getterType = getter.type;
                var getterSig = getterType.getCallSignatures()[0];

                if (accessorType == this.semanticInfoChain.undefinedTypeSymbol) {
                    accessorType = getterType;
                }

                if (getterSig.isResolved) {
                    // compare setter parameter type and getter return type
                    var getterReturnType = getterSig.returnType;

                    if (!this.typesAreIdentical(accessorType, getterReturnType)) {
                        if (this.isAnyOrEquivalent(accessorType)) {
                            accessorSymbol.type = getterReturnType;
                            if (!accessorType.isError()) {
                                parameters[0].type = getterReturnType;
                            }
                        }
                        else {
                            var diagnostic = context.postError(this.unitPath, funcDeclAST.minChar, funcDeclAST.getLength(), DiagnosticCode.get_and_set_accessor_must_have_the_same_type, null, this.getEnclosingDecl(funcDecl));
                            accessorSymbol.type = this.getNewErrorTypeSymbol(diagnostic);
                        }
                    }
                }
                else {
                    accessorSymbol.type = accessorType;
                }
            }
            else {
                accessorSymbol.type = accessorType;
            }

            return accessorSymbol;
        }

        private resolveList(list: ASTList, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (context.typeCheck()) {
                // Visit members   
                for (var i = 0; i < list.members.length; i++) {
                    this.resolveAST(list.members[i], /*inContextuallyTypedAssignment*/ false, enclosingDecl, context);

                }
            }

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveVoidExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<UnaryExpression>ast).operand, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveLogicalOperation(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                var binex = <BinaryExpression>ast;

                var leftType = this.resolveAST(binex.operand1, false, enclosingDecl, context).type;
                var rightType = this.resolveAST(binex.operand2, false, enclosingDecl, context).type;

                var comparisonInfo = new TypeComparisonInfo();
                if (!this.sourceIsAssignableToTarget(leftType, rightType, context, comparisonInfo) &&
                    !this.sourceIsAssignableToTarget(rightType, leftType,context, comparisonInfo)) {
                    context.postError(this.unitPath, binex.minChar, binex.getLength(),
                        DiagnosticCode.Operator_0_cannot_be_applied_to_types_1_and_2, [BinaryExpression.getTextForBinaryToken(binex.nodeType()), leftType.toString(), rightType.toString()], enclosingDecl);
                }
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.booleanTypeSymbol, context);
            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private resolveUnaryLogicalOperation(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<UnaryExpression>ast).operand, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.booleanTypeSymbol, context);
            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private resolveUnaryArithmeticOperation(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<UnaryExpression>ast).operand, false, enclosingDecl, context); 
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.numberTypeSymbol, context);
            return this.semanticInfoChain.numberTypeSymbol;
        }

        private resolveBinaryArithmeticExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                var binaryExpression = <BinaryExpression>ast;

                var lhsType = this.resolveAST(binaryExpression.operand1, false, enclosingDecl, context).type;
                var rhsType = this.resolveAST(binaryExpression.operand2, false, enclosingDecl, context).type;

                var lhsIsFit = this.isAnyOrEquivalent(lhsType) || lhsType === this.semanticInfoChain.numberTypeSymbol || PullHelpers.symbolIsEnum(lhsType);
                var rhsIsFit = this.isAnyOrEquivalent(rhsType) || rhsType === this.semanticInfoChain.numberTypeSymbol || PullHelpers.symbolIsEnum(rhsType);

                if (!rhsIsFit) {
                    context.postError(this.unitPath, binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), DiagnosticCode.The_right_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_or_an_enum_type, null, enclosingDecl);
                }

                if (!lhsIsFit) {
                    context.postError(this.unitPath, binaryExpression.operand2.minChar, binaryExpression.operand2.getLength(), DiagnosticCode.The_left_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_or_an_enum_type, null, enclosingDecl);
                }

                // If we havne't already reported an error, then check for assignment compatibility.
                if (rhsIsFit && lhsIsFit) {
                    switch (binaryExpression.nodeType()) {
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
                            if (!this.isValidLHS(binaryExpression.operand1, lhsType)) {
                                context.postError(this.unitPath, binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), DiagnosticCode.Invalid_left_hand_side_of_assignment_expression, null, enclosingDecl);
                            }

                            this.checkAssignability(binaryExpression.operand1, rhsType, lhsType, enclosingDecl, context);
                            break;
                    }
                }
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.numberTypeSymbol, context);
            return this.semanticInfoChain.numberTypeSymbol;
        }

        private resolveTypeOfExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<UnaryExpression>ast).operand, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.stringTypeSymbol, context);
            return this.semanticInfoChain.stringTypeSymbol;
        }

        private resolveThrowStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<ThrowStatement>ast).expression, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveDeleteStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<UnaryExpression>ast).operand, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.booleanTypeSymbol, context);
            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private resolveInstanceOfExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                var binaryExpression = <BinaryExpression>ast;
                
                var lhsType = this.widenType(this.resolveAST(binaryExpression.operand1, false, enclosingDecl, context).type);
                var rhsType = this.widenType(this.resolveAST(binaryExpression.operand2, false, enclosingDecl, context).type);

                var isValidLHS = lhsType && (this.isAnyOrEquivalent(lhsType) || !lhsType.isPrimitive());
                var isValidRHS = rhsType && (this.isAnyOrEquivalent(rhsType) || rhsType.isClass() || this.typeIsSubtypeOfFunction(rhsType, context));

                if (!isValidLHS) {
                    context.postError(this.unitPath, binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), DiagnosticCode.The_left_hand_side_of_an_instanceOf_expression_must_be_of_type_any_an_object_type_or_a_type_parameter, null, enclosingDecl);
                }

                if (!isValidRHS) {
                    context.postError(this.unitPath, binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), DiagnosticCode.The_right_hand_side_of_an_instanceOf_expression_must_be_of_type_any_or_a_subtype_of_the_Function_interface_type, null, enclosingDecl);
                }
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.booleanTypeSymbol, context);
            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private resolveCommaExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
               
                this.resolveAST((<BinaryExpression>ast).operand1, false, enclosingDecl, context);
                return this.resolveAST((<BinaryExpression>ast).operand2, false, enclosingDecl, context);

            }

            // PERFREVIEW: Is this correct?  A comma expression cannot be an LHS, so it seems to mean that a comma exression should be void
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveInExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                var binaryExpression = <BinaryExpression>ast;
                var lhsType = this.widenType(this.resolveAST(binaryExpression.operand1, false, enclosingDecl, context).type);
                var rhsType = this.widenType(this.resolveAST(binaryExpression.operand2, false, enclosingDecl, context).type);

                var isStringAnyOrNumber = lhsType.type === this.semanticInfoChain.stringTypeSymbol ||
                    this.isAnyOrEquivalent(lhsType.type) ||
                    this.isNumberOrEquivalent(lhsType.type);
                var isValidRHS = rhsType && (this.isAnyOrEquivalent(rhsType) || !rhsType.isPrimitive());

                if (!isStringAnyOrNumber) {
                    context.postError(this.unitPath, binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(),DiagnosticCode.The_left_hand_side_of_an_in_expression_must_be_of_types_string_or_any, null, enclosingDecl);
                }

                if (!isValidRHS) {

                    context.postError(this.unitPath, binaryExpression.operand1.minChar, binaryExpression.operand1.getLength(), DiagnosticCode.The_right_hand_side_of_an_in_expression_must_be_of_type_any_an_object_type_or_a_type_parameter, null, enclosingDecl);
                }
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.booleanTypeSymbol, context);
            return this.semanticInfoChain.booleanTypeSymbol;
        }

        private resolveForStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<ForStatement>ast).init, false, enclosingDecl, context);
                this.resolveAST((<ForStatement>ast).cond, false, enclosingDecl, context);
                this.resolveAST((<ForStatement>ast).body, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveForInStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                var forInStatement = <ForInStatement>ast;

                var rhsType = this.widenType(this.resolveAST(forInStatement.obj, false, enclosingDecl, context).type);
                var lval = forInStatement.lval;

                if (lval.nodeType() === NodeType.VariableDeclaration) {
                    var declaration = <VariableDeclaration>forInStatement.lval;
                    var varDecl = <VariableDeclarator>declaration.declarators.members[0];

                    if (varDecl.typeExpr) {
                        context.postError(this.unitPath, lval.minChar, lval.getLength(), DiagnosticCode.Variable_declarations_of_a_for_statement_cannot_contain_a_type_annotation, null, enclosingDecl);
                    }
                }

                var varSym = this.resolveAST(forInStatement.lval, false, enclosingDecl, context);

                var isStringOrNumber = varSym.type === this.semanticInfoChain.stringTypeSymbol || this.isAnyOrEquivalent(varSym.type);

                var isValidRHS = rhsType && (this.isAnyOrEquivalent(rhsType) || !rhsType.isPrimitive());

                if (!isStringOrNumber) {
                    context.postError(this.unitPath, lval.minChar, lval.getLength(), DiagnosticCode.Variable_declarations_of_a_for_statement_must_be_of_types_string_or_any, null, enclosingDecl);
                }

                if (!isValidRHS) {
                    context.postError(this.unitPath, forInStatement.obj.minChar, forInStatement.obj.getLength(), DiagnosticCode.The_right_operand_of_a_for_statement_must_be_of_type_any_an_object_type_or_a_type_parameter, null, enclosingDecl);
                }

                this.resolveAST(forInStatement.body, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveWhileStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<WhileStatement>ast).cond, false, enclosingDecl, context);
                this.resolveAST((<WhileStatement>ast).body, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveDoStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            
            if (context.typeCheck()) {
                this.resolveAST((<DoStatement>ast).cond, false, enclosingDecl, context);
                this.resolveAST((<DoStatement>ast).body, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveIfStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (context.typeCheck()) {
                this.resolveAST((<IfStatement>ast).cond, false, enclosingDecl, context);
                this.resolveAST((<IfStatement>ast).thenBod, false, enclosingDecl, context);
                this.resolveAST((<IfStatement>ast).elseBod, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveBlock(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<Block>ast).statements, false, enclosingDecl, context);
            }

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveVariableStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<VariableStatement>ast).declaration, false, enclosingDecl, context);
            }

            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveVariableDeclarationList(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                this.resolveAST((<VariableDeclaration>ast).declarators, false, enclosingDecl, context);
            }

            return this.semanticInfoChain.voidTypeSymbol;
        }
        
        private resolveWithStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (context.typeCheck) {
                var withStatement = <WithStatement>ast;
                context.postError(this.unitPath, withStatement.expr.minChar, withStatement.expr.getLength(), DiagnosticCode.All_symbols_within_a_with_block_will_be_resolved_to_any, null, enclosingDecl);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveTryStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {
                var tryStatement = <TryStatement>ast;

                this.resolveAST(tryStatement.tryBody, false, enclosingDecl, context);
                this.resolveAST(tryStatement.catchClause, false, enclosingDecl, context);
                this.resolveAST(tryStatement.finallyBody, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveCatchClause(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            if (context.typeCheck()) {;

                this.resolveAST((<CatchClause>ast).body, false, this.getDeclForAST(ast), context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveReturnStatement(ast: AST, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var returnAST = <ReturnStatement>ast;
            var returnExpr = returnAST.returnExpression;
            var returnType = returnExpr ? this.resolveAST(returnExpr, inContextuallyTypedAssignment, enclosingDecl, context).type : this.semanticInfoChain.voidTypeSymbol;

            if (context.typeCheck() && returnExpr) {

                var parentDecl = enclosingDecl;

                while (parentDecl) {
                    if (parentDecl.kind & PullElementKind.SomeFunction) {
                        parentDecl.setFlag(PullElementFlags.HasReturnStatement);
                        break;
                    }

                    parentDecl = parentDecl.getParentDecl();
                }

                // push contextual type
                var inContextuallyTypedAssignment = false;
                var enclosingDeclAST: FunctionDeclaration;

                if (enclosingDecl.kind & PullElementKind.SomeFunction) {
                    enclosingDeclAST = <FunctionDeclaration>this.getASTForDecl(enclosingDecl);
                    if (enclosingDeclAST.returnTypeAnnotation) {
                        // The containing function has a type annotation, propagate it as the contextual type
                        var returnTypeAnnotationSymbol = this.resolveTypeReference(<TypeReference>enclosingDeclAST.returnTypeAnnotation, enclosingDecl, context);
                        if (returnTypeAnnotationSymbol) {
                            inContextuallyTypedAssignment = true;
                            context.pushContextualType(returnTypeAnnotationSymbol, context.inProvisionalResolution(), null);
                        }
                    }
                    else {
                        // No type annotation, check if there is a contextual type enforced on the function, and propagate that
                        var currentContextualType = context.getContextualType();
                        if (currentContextualType && currentContextualType.isFunction()) {
                            var currentContextualTypeSignatureSymbol = currentContextualType.getDeclarations()[0].getSignatureSymbol();
                            var currentContextualTypeReturnTypeSymbol = currentContextualTypeSignatureSymbol.returnType;
                            if (currentContextualTypeReturnTypeSymbol) {
                                inContextuallyTypedAssignment = true;
                                context.pushContextualType(currentContextualTypeReturnTypeSymbol, context.inProvisionalResolution(), null);
                            }
                        }
                    }
                }

                if (inContextuallyTypedAssignment) {
                    context.popContextualType();
                }

                if (enclosingDecl.kind === PullElementKind.SetAccessor && returnExpr) {
                    context.postError(this.unitPath, returnExpr.minChar, returnExpr.getLength(), DiagnosticCode.Setters_cannot_return_a_value, null, enclosingDecl);
                }

                if (enclosingDecl.kind & PullElementKind.SomeFunction) {

                    enclosingDeclAST = <FunctionDeclaration>this.getASTForDecl(enclosingDecl);

                    if (enclosingDeclAST.returnTypeAnnotation) {
                        var signatureSymbol = enclosingDecl.getSignatureSymbol();
                        var sigReturnType = signatureSymbol.returnType;

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

                            if (!returnType.isResolved) {
                                this.resolveDeclaredSymbol(returnType, enclosingDecl, context);
                            }

                            if (!sigReturnType.isResolved) {
                                this.resolveDeclaredSymbol(sigReturnType, enclosingDecl, context);
                            }

                            var isAssignable = this.sourceIsAssignableToTarget(returnType, sigReturnType, context, comparisonInfo);

                            if (!isAssignable) {
                                if (comparisonInfo.message) {
                                    context.postError(this.unitPath, returnExpr.minChar, returnExpr.getLength(), DiagnosticCode.Cannot_convert_0_to_1_NL_2, [returnType.toString(), sigReturnType.toString(), comparisonInfo.message], enclosingDecl);
                                } else {
                                    context.postError(this.unitPath, returnExpr.minChar, returnExpr.getLength(), DiagnosticCode.Cannot_convert_0_to_1, [returnType.toString(), sigReturnType.toString()], enclosingDecl);
                                }
                            }
                        }
                    }
                }
            }

            this.setSymbolForAST(ast, returnType, context);

            return returnType;
        }

        private resolveSwitchStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (context.typeCheck()) {
                var switchStatement = <SwitchStatement>ast;

                var expressionType = this.resolveAST(switchStatement.val, false, enclosingDecl, context).type;

                this.resolveAST(switchStatement.caseList, false, enclosingDecl, context);
                this.resolveAST(switchStatement.defaultCase, false, enclosingDecl, context);

                if (switchStatement.caseList && switchStatement.caseList.members) {
                    for (var i = 0, n = switchStatement.caseList.members.length; i < n; i++) {
                        var caseClause = <CaseClause>switchStatement.caseList.members[i];
                        if (caseClause !== switchStatement.defaultCase) {
                            var caseClauseExpressionType = this.resolveAST(caseClause.expr, /*inContextuallyTypedAssignment:*/ false, enclosingDecl, context).type;

                            var comparisonInfo = new TypeComparisonInfo();
                            if (!this.sourceIsAssignableToTarget(expressionType, caseClauseExpressionType, context, comparisonInfo) &&
                                !this.sourceIsAssignableToTarget(caseClauseExpressionType, expressionType, context, comparisonInfo)) {
                                if (comparisonInfo.message) {
                                    context.postError(this.unitPath, caseClause.expr.minChar, caseClause.expr.getLength(),
                                        DiagnosticCode.Cannot_convert_0_to_1_NL_2, [caseClauseExpressionType.toString(), expressionType.toString(), comparisonInfo.message], enclosingDecl);
                                }
                                else {
                                    context.postError(this.unitPath, caseClause.expr.minChar, caseClause.expr.getLength(),
                                        DiagnosticCode.Cannot_convert_0_to_1, [caseClauseExpressionType.toString(), expressionType.toString()], enclosingDecl);
                                }
                            }
                        }
                    }
                }                
            }
            
            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveCaseClause(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (context.typeCheck()) {
                this.resolveAST((<CaseClause>ast).expr, false, enclosingDecl, context);
                this.resolveAST((<CaseClause>ast).body, false, enclosingDecl, context);
            }

            this.setSymbolForAST(ast, this.semanticInfoChain.voidTypeSymbol, context);
            return this.semanticInfoChain.voidTypeSymbol;
        }

        private resolveLabeledStatement(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol
        {
            return this.resolveAST((<LabeledStatement>ast).statement, false, enclosingDecl, context);
        }
        // Expression resolution

        public resolveAST(ast: AST, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            globalSemanticInfoChain = this.semanticInfoChain;

            if (globalBinder) {
                globalBinder.semanticInfoChain = this.semanticInfoChain;
            }

            if (!ast) {
                return;
            }

            var symbol = this.semanticInfoChain.getSymbolForAST(ast, this.unitPath);

            if (symbol && (symbol.isPrimitive() || ast.typeCheckPhase >= PullTypeResolver.globalTypeCheckPhase)) {
                // WScript.Echo("Resolved again: name: " + symbol.getName() + ", symbol id: " + symbol.getSymbolID() + ", ast ID: " + ast.getID());
                return symbol;
            }
            else {
                ast.typeCheckPhase = PullTypeResolver.globalTypeCheckPhase;
            }                

            if (symbol && symbol.isResolved) {
                return symbol;
            }

            switch (ast.nodeType()) {

                case NodeType.List:
                    return this.resolveList(<ASTList>ast, enclosingDecl, context);

                case NodeType.Script:
                    return null;

                case NodeType.ModuleDeclaration:
                    return this.resolveModuleDeclaration(<ModuleDeclaration>ast, context);

                case NodeType.InterfaceDeclaration:
                    return this.resolveInterfaceDeclaration(<TypeDeclaration>ast, context);

                case NodeType.ClassDeclaration:
                    return this.resolveClassDeclaration(<ClassDeclaration>ast, context);

                case NodeType.VariableDeclaration:
                    return this.resolveVariableDeclarationList(ast, enclosingDecl, context);

                case NodeType.VariableDeclarator:
                case NodeType.Parameter:
                    return this.resolveVariableDeclaration(<BoundDecl>ast, context, enclosingDecl);

                case NodeType.TypeParameter:
                    return this.resolveTypeParameterDeclaration(<TypeParameter>ast, context);

                case NodeType.ImportDeclaration:
                    return this.resolveImportDeclaration(<ImportDeclaration>ast, context);

                case NodeType.ObjectLiteralExpression:
                    return this.resolveObjectLiteralExpression(ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.GenericType:
                    return this.resolveGenericTypeReference(<GenericType>ast, enclosingDecl, context);

                case NodeType.Name:
                    if (context.resolvingTypeReference) {
                        return this.resolveTypeNameExpression(<Identifier>ast, enclosingDecl, context);
                    }
                    else {
                        return this.resolveNameExpression(<Identifier>ast, enclosingDecl, context);
                    }

                case NodeType.MemberAccessExpression:
                    if (context.resolvingTypeReference) {
                        return this.resolveDottedTypeNameExpression(<BinaryExpression>ast, enclosingDecl, context);
                    }
                    else {
                        return this.resolveDottedNameExpression(<BinaryExpression>ast, enclosingDecl, context);
                    }

                case NodeType.GenericType:
                    return this.resolveGenericTypeReference(<GenericType>ast, enclosingDecl, context);

                case NodeType.FunctionDeclaration:
                    {
                        var funcDecl = <FunctionDeclaration>ast;

                        if (funcDecl.isGetAccessor()) {
                            return this.resolveGetAccessorDeclaration(funcDecl, context);
                        }
                        else if (funcDecl.isSetAccessor()) {
                            return this.resolveSetAccessorDeclaration(funcDecl, context);
                        }
                        else if (inContextuallyTypedAssignment ||
                            (funcDecl.getFunctionFlags() & FunctionFlags.IsFunctionExpression) ||
                            (funcDecl.getFunctionFlags() & FunctionFlags.IsFatArrowFunction) ||
                            (funcDecl.getFunctionFlags() & FunctionFlags.IsFunctionProperty)) {
                            return this.resolveFunctionExpression(funcDecl, inContextuallyTypedAssignment, enclosingDecl, context);
                        }
                        else {
                            return this.resolveFunctionDeclaration(funcDecl, context);
                        }
                    }

                case NodeType.ArrayLiteralExpression:
                    return this.resolveArrayLiteralExpression(<UnaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.ThisExpression:
                    return this.resolveThisExpression(ast, enclosingDecl, context);

                case NodeType.SuperExpression:
                    return this.resolveSuperExpression(ast, enclosingDecl, context);

                case NodeType.InvocationExpression:
                    return this.resolveInvocationExpression(<InvocationExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.ObjectCreationExpression:
                    return this.resolveObjectCreationExpression(<ObjectCreationExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.CastExpression:
                    return this.resolveTypeAssertionExpression(<UnaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.TypeRef:
                    return this.resolveTypeReference(<TypeReference>ast, enclosingDecl, context);

                case NodeType.ExportAssignment:
                    return this.resolveExportAssignmentStatement(<ExportAssignment>ast, enclosingDecl, context);

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
                case NodeType.VoidExpression:
                    // PERFREVIEW: resolveVoidExpression
                    return this.resolveVoidExpression(ast, enclosingDecl, context);
                    //return this.semanticInfoChain.voidTypeSymbol;

                // assignment
                case NodeType.AssignmentExpression:
                    return this.resolveAssignmentStatement(<BinaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                // boolean operations
                case NodeType.LogicalNotExpression:
                    return this.resolveUnaryLogicalOperation(ast, enclosingDecl, context);
                    
                case NodeType.NotEqualsWithTypeConversionExpression:
                case NodeType.EqualsWithTypeConversionExpression:
                case NodeType.EqualsExpression:
                case NodeType.NotEqualsExpression:
                case NodeType.LessThanExpression:
                case NodeType.LessThanOrEqualExpression:
                case NodeType.GreaterThanOrEqualExpression:
                case NodeType.GreaterThanExpression:
                    // PERFREVIEW
                    return this.resolveLogicalOperation(ast, enclosingDecl, context);
                    //return this.semanticInfoChain.booleanTypeSymbol;

                case NodeType.AddExpression:
                case NodeType.AddAssignmentExpression:
                    return this.resolveBinaryAdditionOperation(<BinaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);


                case NodeType.PlusExpression:
                case NodeType.NegateExpression:
                case NodeType.BitwiseNotExpression:
                case NodeType.PostIncrementExpression:
                case NodeType.PreIncrementExpression:
                case NodeType.PostDecrementExpression:
                case NodeType.PreDecrementExpression:
                    return this.resolveUnaryArithmeticOperation(ast, enclosingDecl, context);

                case NodeType.SubtractAssignmentExpression:
                case NodeType.MultiplyAssignmentExpression:
                case NodeType.DivideAssignmentExpression:
                case NodeType.ModuloAssignmentExpression:
                case NodeType.OrAssignmentExpression:
                case NodeType.AndAssignmentExpression:

                case NodeType.SubtractExpression:
                case NodeType.MultiplyExpression:
                case NodeType.DivideExpression:
                case NodeType.ModuloExpression:
                case NodeType.BitwiseOrExpression:
                case NodeType.BitwiseAndExpression:

                case NodeType.LeftShiftExpression:
                case NodeType.SignedRightShiftExpression:
                case NodeType.UnsignedRightShiftExpression:
                case NodeType.LeftShiftAssignmentExpression:
                case NodeType.SignedRightShiftAssignmentExpression:
                case NodeType.UnsignedRightShiftAssignmentExpression:
                    // PERFREVIEW
                    return this.resolveBinaryArithmeticExpression(ast, enclosingDecl, context);
                    //return this.semanticInfoChain.numberTypeSymbol;

                case NodeType.ElementAccessExpression:
                    return this.resolveIndexExpression(<BinaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.LogicalOrExpression:
                    return this.resolveLogicalOrExpression(<BinaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.LogicalAndExpression:
                    return this.resolveLogicalAndExpression(<BinaryExpression>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.TypeOfExpression:
                    return this.resolveTypeOfExpression(ast, enclosingDecl, context);
                    //return this.semanticInfoChain.stringTypeSymbol;

                case NodeType.ThrowStatement:
                    return this.resolveThrowStatement(ast, enclosingDecl, context);
                    //return this.semanticInfoChain.voidTypeSymbol;

                case NodeType.DeleteExpression:
                    return this.resolveDeleteStatement(ast, enclosingDecl, context); 

                case NodeType.ConditionalExpression:
                    return this.resolveConditionalExpression(<ConditionalExpression>ast, enclosingDecl, context);

                case NodeType.RegularExpressionLiteral:
                    return this.resolveRegularExpressionLiteral();

                case NodeType.ParenthesizedExpression:
                    return this.resolveParenthesizedExpression(<ParenthesizedExpression>ast, enclosingDecl, context);

                case NodeType.ExpressionStatement:
                    return this.resolveExpressionStatement(<ExpressionStatement>ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.InstanceOfExpression:
                    return this.resolveInstanceOfExpression(ast, enclosingDecl, context);

                case NodeType.CommaExpression:
                    return this.resolveCommaExpression(ast, enclosingDecl, context);

                case NodeType.InExpression:
                    return this.resolveInExpression(ast, enclosingDecl, context);

                case NodeType.ForStatement:
                    return this.resolveForStatement(ast, enclosingDecl, context);

                case NodeType.ForInStatement:
                    return this.resolveForInStatement(ast, enclosingDecl, context);

                case NodeType.WhileStatement:
                    return this.resolveWhileStatement(ast, enclosingDecl, context);

                case NodeType.DoStatement:
                    return this.resolveDoStatement(ast, enclosingDecl, context);

                case NodeType.IfStatement:
                    return this.resolveIfStatement(ast, enclosingDecl, context);

                case NodeType.Block:
                    return this.resolveBlock(ast, enclosingDecl, context);

                case NodeType.VariableStatement:
                    return this.resolveVariableStatement(ast, enclosingDecl, context);

                case NodeType.WithStatement:
                    return this.resolveWithStatement(ast, enclosingDecl, context);

                case NodeType.TryStatement:
                    return this.resolveTryStatement(ast, enclosingDecl, context);

                case NodeType.CatchClause:
                    return this.resolveCatchClause(ast, enclosingDecl, context);

                case NodeType.ReturnStatement:
                    return this.resolveReturnStatement(ast, inContextuallyTypedAssignment, enclosingDecl, context);

                case NodeType.SwitchStatement:
                    return this.resolveSwitchStatement(ast, enclosingDecl, context);

                case NodeType.CaseClause:
                    return this.resolveCaseClause(ast, enclosingDecl, context);

                case NodeType.LabeledStatement:
                    return this.resolveLabeledStatement(ast, enclosingDecl, context);
            }

            return this.semanticInfoChain.anyTypeSymbol;
        }

        private resolveRegularExpressionLiteral(): PullTypeSymbol {
            if (this.cachedRegExpInterfaceType()) {
                return this.cachedRegExpInterfaceType();
            }
            else {
                return this.semanticInfoChain.anyTypeSymbol;
            }
        }

        private isNameOrMemberAccessExpression(ast: AST): boolean {

            var checkAST = ast;

            while (checkAST) {
                if (checkAST.nodeType() === NodeType.ExpressionStatement) {
                    checkAST = (<ExpressionStatement>checkAST).expression;
                }
                else if (checkAST.nodeType() === NodeType.ParenthesizedExpression) {
                    checkAST = (<ParenthesizedExpression>checkAST).expression;
                }
                else if (checkAST.nodeType() === NodeType.Name) {
                    return true;
                }
                else if (checkAST.nodeType() === NodeType.MemberAccessExpression) {
                    return true;
                }
                else {
                    return false;
                }
            }
        }

        private resolveNameSymbol(nameSymbol: PullSymbol, context: PullTypeResolutionContext) {
            if (nameSymbol &&
                !context.canUseTypeSymbol &&
                nameSymbol != this.semanticInfoChain.undefinedTypeSymbol &&
                nameSymbol != this.semanticInfoChain.nullTypeSymbol &&
                (nameSymbol.isPrimitive() || !(nameSymbol.kind & TypeScript.PullElementKind.SomeValue))) {
                nameSymbol = null;
            }

            return nameSymbol;
        }

        public resolveNameExpression(nameAST: Identifier, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var nameSymbol = this.getSymbolForAST(nameAST);
            var foundCached = nameSymbol != null;

            if (!foundCached) {
                nameSymbol = this.computeNameExpression(nameAST, enclosingDecl, context);
            }

            if (!nameSymbol.isResolved) {
                this.resolveDeclaredSymbol(nameSymbol, enclosingDecl, context);
            }

            this.setSymbolForAST(nameAST, nameSymbol, context);

            return nameSymbol;
        }

        private computeNameExpression(nameAST: Identifier, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (nameAST.isMissing()) {
                return this.semanticInfoChain.anyTypeSymbol;
            }

            var id = nameAST.text();

            var declPath: PullDecl[] = enclosingDecl !== null ? getPathToDecl(enclosingDecl) : [];

            if (enclosingDecl && !declPath.length) {
                declPath = [enclosingDecl];
            }

            var aliasSymbol: PullSymbol = null;
            var nameSymbol = this.getSymbolFromDeclPath(id, declPath, PullElementKind.SomeValue);

            if (!nameSymbol && id === "arguments" && enclosingDecl && (enclosingDecl.kind & PullElementKind.SomeFunction)) {
                nameSymbol = this.cachedFunctionArgumentsSymbol;

                if (this.cachedIArgumentsInterfaceType() && !this.cachedIArgumentsInterfaceType().isResolved) {
                    this.resolveDeclaredSymbol(this.cachedIArgumentsInterfaceType(), enclosingDecl, context);
                }
            }

            if (!nameSymbol) {
                context.postError(this.unitPath, nameAST.minChar, nameAST.getLength(), DiagnosticCode.Could_not_find_symbol_0, [nameAST.actualText]);
                return this.getNewErrorTypeSymbol(null, id);
            }

            if (nameSymbol.isType() && nameSymbol.isAlias()) {
                aliasSymbol = nameSymbol;

                (<PullTypeAliasSymbol>aliasSymbol).setIsUsedAsValue();

                if (!nameSymbol.isResolved) {
                    this.resolveDeclaredSymbol(nameSymbol, enclosingDecl, context);
                }

                var exportAssignmentSymbol = (<PullTypeAliasSymbol>nameSymbol).getExportAssignedValueSymbol();

                if (exportAssignmentSymbol) {
                    nameSymbol = exportAssignmentSymbol;
                }
                else {
                    aliasSymbol = null;
                }
            }

            if (aliasSymbol) {
                this.currentUnit.setAliasSymbolForAST(nameAST, aliasSymbol);
            }

            return nameSymbol;
        }

        public resolveDottedNameExpression(dottedNameAST: BinaryExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(dottedNameAST);
            var foundCached = symbol != null;

            if (!foundCached) {
                symbol = this.computeDottedNameExpressionSymbol(dottedNameAST, enclosingDecl, context);
            }

            if (symbol && !symbol.isResolved) {
                this.resolveDeclaredSymbol(symbol, enclosingDecl, context);
            }

            this.setSymbolForAST(dottedNameAST, symbol, context);
            this.setSymbolForAST(dottedNameAST.operand2, symbol, context);

            return symbol;
        }

        public isPrototypeMember(dottedNameAST: BinaryExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): boolean {
            var rhsName = (<Identifier>dottedNameAST.operand2).text();
            if (rhsName === "prototype") {
                var prevCanUseTypeSymbol = context.canUseTypeSymbol;
                context.canUseTypeSymbol = true;
                var lhsType = this.resolveAST(dottedNameAST.operand1, /*inContextuallyTypedAssignment*/false, enclosingDecl, context).type;
                context.canUseTypeSymbol = prevCanUseTypeSymbol;

                if (lhsType) {
                    if (lhsType.isClass() || lhsType.isConstructor()) {
                        return true;
                    }
                    else {
                        var classInstanceType = lhsType.getAssociatedContainerType();

                        if (classInstanceType && classInstanceType.isClass()) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        private computeDottedNameExpressionSymbol(dottedNameAST: BinaryExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if ((<Identifier>dottedNameAST.operand2).isMissing()) {
                return this.semanticInfoChain.anyTypeSymbol;
            }

            // assemble the dotted name path
            var rhsName = (<Identifier>dottedNameAST.operand2).text();
            var prevCanUseTypeSymbol = context.canUseTypeSymbol;
            context.canUseTypeSymbol = true;
            var lhs = this.resolveAST(dottedNameAST.operand1, /*inContextuallyTypedAssignment*/false, enclosingDecl, context);
            context.canUseTypeSymbol = prevCanUseTypeSymbol;
            var lhsType = lhs.type;

            if (lhs.isAlias()) {
                (<PullTypeAliasSymbol>lhs).setIsUsedAsValue();
            }

            if (this.isAnyOrEquivalent(lhsType)) {
                return lhsType;
            }

            if (!lhsType) {
                context.postError(this.unitPath, dottedNameAST.operand2.minChar, dottedNameAST.operand2.getLength(), DiagnosticCode.Could_not_find_enclosing_symbol_for_dotted_name_0, [(<Identifier>dottedNameAST.operand2).actualText]);
                return this.getNewErrorTypeSymbol(null);
            }

            if ((lhsType === this.semanticInfoChain.numberTypeSymbol || (lhs.kind == PullElementKind.EnumMember)) && this.cachedNumberInterfaceType()) {
                lhsType = this.cachedNumberInterfaceType();
            }
            else if (lhsType === this.semanticInfoChain.stringTypeSymbol && this.cachedStringInterfaceType()) {
                lhsType = this.cachedStringInterfaceType();
            }
            else if (lhsType === this.semanticInfoChain.booleanTypeSymbol && this.cachedBooleanInterfaceType()) {
                lhsType = this.cachedBooleanInterfaceType();
            }

            if (!lhsType.isResolved) {
                var potentiallySpecializedType = <PullTypeSymbol>this.resolveDeclaredSymbol(lhsType, enclosingDecl, context);

                if (potentiallySpecializedType != lhsType) {
                    if (!lhs.isType()) {
                        context.setTypeInContext(lhs, potentiallySpecializedType);
                    }

                    lhsType = potentiallySpecializedType;
                }
            }

            if (lhsType.isContainer() && !lhsType.isAlias()) {
                // we're searching in the value space, so we should try to use the
                // instance value type
                var instanceSymbol = (<PullContainerTypeSymbol>lhsType).getInstanceSymbol();

                if (instanceSymbol) {
                    lhsType = instanceSymbol.type;
                }
            }

            if (this.isPrototypeMember(dottedNameAST, enclosingDecl, context)) {
                if (lhsType.isClass()) {
                    return lhsType;
                }
                else {
                    var classInstanceType = lhsType.getAssociatedContainerType();

                    if (classInstanceType && classInstanceType.isClass()) {
                        return classInstanceType;
                    }
                }
            }

            // If the type parameter has a constraint, we'll need to sub it in
            if (lhsType.isTypeParameter()) {
                lhsType = this.substituteUpperBoundForType(lhsType);
            }

            // now for the name...
            // For classes, check the statics first below
            var nameSymbol: PullSymbol = null;
            if (!(lhs.isType() && (<PullTypeSymbol>lhs).isClass() && this.isNameOrMemberAccessExpression(dottedNameAST.operand1)) && !nameSymbol) {
                nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, lhsType);
                nameSymbol = this.resolveNameSymbol(nameSymbol, context);
            }

            if (!nameSymbol) {
                // could be a static
                if (lhsType.isClass()) {
                    var staticType = lhsType.getConstructorMethod().type;

                    nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, staticType);

                    if (!nameSymbol) {
                        nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, lhsType);
                    }
                }
                // could be a function symbol
                else if ((lhsType.getCallSignatures().length || lhsType.getConstructSignatures().length) && this.cachedFunctionInterfaceType()) {
                    nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, this.cachedFunctionInterfaceType());
                }
                else if (lhsType.isContainer()) {
                    var containerType = <PullContainerTypeSymbol>(lhsType.isAlias() ? (<PullTypeAliasSymbol>lhsType).type : lhsType);
                    var associatedInstance = containerType.getInstanceSymbol();

                    if (associatedInstance) {
                        var instanceType = associatedInstance.type;

                        nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, instanceType);
                    }
                }
                // could be a module instance
                else {
                    var associatedType = lhsType.getAssociatedContainerType();

                    if (associatedType && !associatedType.isClass()) {
                        nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, associatedType);
                    }
                }

                nameSymbol = this.resolveNameSymbol(nameSymbol, context);

                // could be an object member
                if (!nameSymbol && !lhsType.isPrimitive() && this.cachedObjectInterfaceType()) {
                    nameSymbol = this.getMemberSymbol(rhsName, PullElementKind.SomeValue, this.cachedObjectInterfaceType());
                }

                if (!nameSymbol) {
                    context.postError(this.unitPath, dottedNameAST.operand2.minChar, dottedNameAST.operand2.getLength(), DiagnosticCode.The_property_0_does_not_exist_on_value_of_type_1, [(<Identifier>dottedNameAST.operand2).actualText, lhsType.toString(lhs)])
                    return this.getNewErrorTypeSymbol(null, rhsName);
                }
            }

            return nameSymbol;
        }

        public resolveTypeNameExpression(nameAST: Identifier, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            var typeNameSymbol = <PullTypeSymbol>this.getSymbolForAST(nameAST);

            // TODO(cyrusn): We really shouldn't be checking "isType" here.  However, we currently
            // have a bug where some part of the system calls resolveNameExpression on this node
            // and we cache the wrong thing.  We need to add appropriate checks to ensure that
            // resolveNameExpression is never called on a node that we should be calling 
            // resolveTypeNameExpression (and vice versa).
            if (!typeNameSymbol || !typeNameSymbol.isType()) {
                typeNameSymbol = this.computeTypeNameExpression(nameAST, enclosingDecl, context);
                this.setSymbolForAST(nameAST, typeNameSymbol, context);
            }

            if (!typeNameSymbol.isResolved) {
                var savedResolvingNamespaceMemberAccess = context.resolvingNamespaceMemberAccess;
                context.resolvingNamespaceMemberAccess = false;
                this.resolveDeclaredSymbol(typeNameSymbol, enclosingDecl, context);
                context.resolvingNamespaceMemberAccess = savedResolvingNamespaceMemberAccess;
            }

            if (typeNameSymbol && !(typeNameSymbol.isTypeParameter() && (<PullTypeParameterSymbol>typeNameSymbol).isFunctionTypeParameter() && context.isSpecializingSignatureAtCallSite && !context.isSpecializingConstructorMethod)) {
                var substitution = context.findSpecializationForType(typeNameSymbol);

                if (typeNameSymbol.isTypeParameter() && (substitution != typeNameSymbol)) {
                    if (shouldSpecializeTypeParameterForTypeParameter(<PullTypeParameterSymbol>substitution, <PullTypeParameterSymbol>typeNameSymbol)) {
                        typeNameSymbol = substitution;
                    }
                }
            }

            return typeNameSymbol;
        }

        private computeTypeNameExpression(nameAST: Identifier, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            if (nameAST.isMissing()) {
                return this.semanticInfoChain.anyTypeSymbol;
            }

            var id = nameAST.text();

            // if it's a known primitive name, cheat
            if (id === "any") {
                return this.semanticInfoChain.anyTypeSymbol;
            }
            else if (id === "string") {
                return this.semanticInfoChain.stringTypeSymbol;
            }
            else if (id === "number") {
                return this.semanticInfoChain.numberTypeSymbol;
            }
            else if (id === "bool") {
                // Warn for using bool
                if (!this.compilationSettings.allowBool && !this.currentUnit.getProperties().unitContainsBool) {
                    this.currentUnit.getProperties().unitContainsBool = true;
                    context.postError(this.unitPath, nameAST.minChar, nameAST.getLength(), DiagnosticCode.Use_of_deprecated_type_bool_Use_boolean_instead);
                    return this.semanticInfoChain.booleanTypeSymbol;
                }
                else {
                    return this.semanticInfoChain.booleanTypeSymbol;
                }
            }
            else if (id === "boolean") {
                return this.semanticInfoChain.booleanTypeSymbol;
            }
            else if (id === "void") {
                return this.semanticInfoChain.voidTypeSymbol;
            }
            else {
                var declPath: PullDecl[] = enclosingDecl !== null ? getPathToDecl(enclosingDecl) : [];

                if (enclosingDecl && !declPath.length) {
                    declPath = [enclosingDecl];
                }

                // If we're resolving a dotted type name, every dotted name but the last will be a container type, so we'll search those
                // first if need be, and then fall back to type names.  Otherwise, look for a type first, since we are probably looking for
                // a type reference (the exception being an alias or export assignment)
                var kindToCheckFirst = context.resolvingNamespaceMemberAccess ? PullElementKind.SomeContainer : PullElementKind.SomeType;
                var kindToCheckSecond = context.resolvingNamespaceMemberAccess ? PullElementKind.SomeType : PullElementKind.SomeContainer;

                var typeNameSymbol = <PullTypeSymbol>this.getSymbolFromDeclPath(id, declPath, kindToCheckFirst);

                if (!typeNameSymbol) {
                    typeNameSymbol = <PullTypeSymbol>this.getSymbolFromDeclPath(id, declPath, kindToCheckSecond);
                }

                if (!typeNameSymbol) {
                    context.postError(this.unitPath, nameAST.minChar, nameAST.getLength(), DiagnosticCode.Could_not_find_symbol_0, [nameAST.actualText]);
                    return this.getNewErrorTypeSymbol(null, id);
                }

                if (typeNameSymbol.isAlias()) {

                    if (!typeNameSymbol.isResolved) {
                        var savedResolvingNamespaceMemberAccess = context.resolvingNamespaceMemberAccess;
                        context.resolvingNamespaceMemberAccess = false;
                        this.resolveDeclaredSymbol(typeNameSymbol, enclosingDecl, context);
                        context.resolvingNamespaceMemberAccess = savedResolvingNamespaceMemberAccess;
                    }

                    var aliasedType = (<PullTypeAliasSymbol>typeNameSymbol).type;

                    if (aliasedType && !aliasedType.isResolved) {
                        this.resolveDeclaredSymbol(aliasedType, enclosingDecl, context);
                    }

                    var exportAssignmentSymbol = (<PullTypeAliasSymbol>typeNameSymbol).getExportAssignedTypeSymbol();

                    if (exportAssignmentSymbol) {
                        typeNameSymbol = exportAssignmentSymbol;
                    }
                }

                if (typeNameSymbol.isTypeParameter()) {
                    if (enclosingDecl && (enclosingDecl.kind & PullElementKind.SomeFunction) && (enclosingDecl.flags & PullElementFlags.Static)) {
                        var parentDecl = typeNameSymbol.getDeclarations()[0].getParentDecl();

                        if (parentDecl.kind == PullElementKind.Class) {
                            context.postError(this.unitPath, nameAST.minChar, nameAST.getLength(), DiagnosticCode.Static_methods_cannot_reference_class_type_parameters);
                            return this.getNewErrorTypeSymbol(null);
                        }
                    }
                }
            }

            return typeNameSymbol;
        }

        private addDiagnostic(diagnostics: Diagnostic[], diagnostic: Diagnostic): Diagnostic[] {
            if (!diagnostics) {
                diagnostics = [];
            }

            diagnostics.push(diagnostic);
            return diagnostics;
        }

        private resolveGenericTypeReference(genericTypeAST: GenericType, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            var savedResolvingTypeReference = context.resolvingTypeReference;
            context.resolvingTypeReference = true;
            var genericTypeSymbol = this.resolveAST(genericTypeAST.name, false, enclosingDecl, context).type;
            context.resolvingTypeReference = savedResolvingTypeReference;

            if (genericTypeSymbol.isError()) {
                return genericTypeSymbol;
            }

            if (!genericTypeSymbol.inResolution && !genericTypeSymbol.isResolved) {
                this.resolveDeclaredSymbol(genericTypeSymbol, enclosingDecl, context);
            }

            // specialize the type arguments
            var typeArgs: PullTypeSymbol[] = [];

            if (!context.isResolvingTypeArguments(genericTypeAST)) {
                context.startResolvingTypeArguments(genericTypeAST);
                var savedIsResolvingClassExtendedType = context.isResolvingClassExtendedType;
                context.isResolvingClassExtendedType = false;

                if (genericTypeAST.typeArguments && genericTypeAST.typeArguments.members.length) {
                    for (var i = 0; i < genericTypeAST.typeArguments.members.length; i++) {
                        var typeArg = this.resolveTypeReference(<TypeReference>genericTypeAST.typeArguments.members[i], enclosingDecl, context);

                        if (typeArg.isNamedTypeSymbol() &&
                            typeArg.isGeneric() &&
                            !typeArg.isTypeParameter() &&
                            typeArg.isResolved &&
                            !typeArg.getIsSpecialized() &&
                            typeArg.getTypeParameters().length &&
                            (typeArg.getTypeArguments() == null && !this.isArrayOrEquivalent(typeArg)) &&
                            this.isTypeRefWithoutTypeArgs(<TypeReference>genericTypeAST.typeArguments.members[i])) {

                            context.postError(this.unitPath, genericTypeAST.typeArguments.members[i].minChar, genericTypeAST.typeArguments.members[i].getLength(), DiagnosticCode.Generic_type_references_must_include_all_type_arguments, null, enclosingDecl, true);
                            typeArg = this.specializeTypeToAny(typeArg, enclosingDecl, context);
                        }

                        typeArgs[i] = context.findSpecializationForType(typeArg);
                    }
                }
                context.isResolvingClassExtendedType = savedIsResolvingClassExtendedType;
                context.doneResolvingTypeArguments();
            }

            var typeParameters = genericTypeSymbol.getTypeParameters();

            if (typeArgs.length && typeArgs.length != typeParameters.length) {
                context.postError(this.unitPath, genericTypeAST.minChar, genericTypeAST.getLength(), DiagnosticCode.Generic_type_0_requires_1_type_argument_s, [genericTypeSymbol.toString(), genericTypeSymbol.getTypeParameters().length]);
                return this.getNewErrorTypeSymbol(null);
            }

            var specializedSymbol = specializeType(genericTypeSymbol, typeArgs, this, enclosingDecl, context, genericTypeAST);

            // check constraints, if appropriate
            var typeConstraint: PullTypeSymbol = null;
            var upperBound: PullTypeSymbol = null;
            var diagnostics: Diagnostic[] = null;

            for (var iArg = 0; (iArg < typeArgs.length) && (iArg < typeParameters.length); iArg++) {
                typeArg = typeArgs[iArg];
                typeConstraint = typeParameters[iArg].getConstraint();

                // test specialization type for assignment compatibility with the constraint
                if (typeConstraint) {

                    if (typeConstraint.isTypeParameter()) {
                        for (var j = 0; j < typeParameters.length && j < typeArgs.length; j++) {
                            if (typeParameters[j] == typeConstraint) {
                                typeConstraint = typeArgs[j];
                            }
                        }
                    }

                    if (typeArg.isTypeParameter()) {
                        upperBound = (<PullTypeParameterSymbol>typeArg).getConstraint();

                        if (upperBound) {
                            typeArg = upperBound;
                        }
                    }

                    if (typeArg.inResolution) {
                        return specializedSymbol;
                    }
                    if (!this.sourceIsAssignableToTarget(typeArg, typeConstraint, context)) {
                        // POST
                        diagnostics = this.addDiagnostic(diagnostics,
                            context.postError(this.unitPath, genericTypeAST.minChar, genericTypeAST.getLength(), DiagnosticCode.Type_0_does_not_satisfy_the_constraint_1_for_type_parameter_2, [typeArg.toString(null, true), typeConstraint.toString(null, true), typeParameters[iArg].toString(null, true)]));
                    }
                }
            }

            return specializedSymbol;
        }

        private resolveDottedTypeNameExpression(dottedNameAST: BinaryExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            var symbol = <PullTypeSymbol>this.getSymbolForAST(dottedNameAST);
            if (!symbol) {
                symbol = this.computeDottedTypeNameExpression(dottedNameAST, enclosingDecl, context);
                this.setSymbolForAST(dottedNameAST, symbol, context);
            }

            if (!symbol.isResolved) {
                this.resolveDeclaredSymbol(symbol, enclosingDecl, context);
            }

            return symbol;
        }

        private computeDottedTypeNameExpression(dottedNameAST: BinaryExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            if ((<Identifier>dottedNameAST.operand2).isMissing()) {
                return this.semanticInfoChain.anyTypeSymbol;
            }

            // assemble the dotted name path
            var rhsName = (<Identifier>dottedNameAST.operand2).text();

            // TODO(cyrusn): Setting this context value should not be necessary.  We could have only
            // gotten into this code path if it was already set.
            var savedResolvingTypeReference = context.resolvingTypeReference;
            var savedResolvingNamespaceMemberAccess = context.resolvingNamespaceMemberAccess;
            context.resolvingNamespaceMemberAccess = true;
            context.resolvingTypeReference = true;
            var lhs = this.resolveAST(dottedNameAST.operand1, false, enclosingDecl, context);
            context.resolvingTypeReference = savedResolvingTypeReference;
            context.resolvingNamespaceMemberAccess = savedResolvingNamespaceMemberAccess;

            var lhsType = lhs.type;

            if (context.isResolvingClassExtendedType) {
                if (lhs.isAlias()) {
                    (<PullTypeAliasSymbol>lhs).setIsUsedAsValue();
                }
            }

            if (this.isAnyOrEquivalent(lhsType)) {
                return lhsType;
            }

            if (!lhsType) {
                context.postError(this.unitPath, dottedNameAST.operand2.minChar, dottedNameAST.operand2.getLength(), DiagnosticCode.Could_not_find_enclosing_symbol_for_dotted_name_0, [(<Identifier>dottedNameAST.operand2).actualText]);
                return this.getNewErrorTypeSymbol(null);
            }

            // now for the name...
            var childTypeSymbol = <PullTypeSymbol>this.getMemberSymbol(rhsName, PullElementKind.SomeType, lhsType);

            // if the lhs exports a container type, but not a type, we should check the container type
            if (!childTypeSymbol && lhsType.isContainer()) {
                var exportedContainer = (<PullContainerTypeSymbol>lhsType).getExportAssignedContainerSymbol();

                if (exportedContainer) {
                    childTypeSymbol = <PullTypeSymbol>this.getMemberSymbol(rhsName, PullElementKind.SomeType, exportedContainer);
                }
            }

            // If the name is expressed as a dotted name within the parent type,
            // then it will be considered a contained member, so back up to the nearest
            // enclosing symbol and look there
            if (!childTypeSymbol && enclosingDecl) {
                var parentDecl = enclosingDecl;

                while (parentDecl) {
                    if (parentDecl.kind & PullElementKind.SomeContainer) {
                        break;
                    }

                    parentDecl = parentDecl.getParentDecl();
                }

                if (parentDecl) {
                    var enclosingSymbolType = parentDecl.getSymbol().type;

                    if (enclosingSymbolType === lhsType) {
                        childTypeSymbol = <PullTypeSymbol>this.getMemberSymbol(rhsName, PullElementKind.SomeType, lhsType);//lhsType.findContainedMember(rhsName);
                    }
                }
            }

            if (!childTypeSymbol) {
                context.postError(this.unitPath, dottedNameAST.operand2.minChar, dottedNameAST.operand2.getLength(), DiagnosticCode.The_property_0_does_not_exist_on_value_of_type_1, [(<Identifier>dottedNameAST.operand2).actualText, lhsType.toString(lhs)]);
                return this.getNewErrorTypeSymbol(null, rhsName);
            }

            return childTypeSymbol;
        }

        private resolveFunctionExpression(funcDeclAST: FunctionDeclaration, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            var funcDeclSymbol: PullSymbol = null;
            var functionDecl: PullDecl = this.getDeclForAST(funcDeclAST);

            if (functionDecl && functionDecl.hasSymbol()) {
                funcDeclSymbol = functionDecl.getSymbol();
                if (funcDeclSymbol.isResolved) {
                    return funcDeclSymbol;
                }
            }

            // if we have an assigning AST with a type, and the funcDecl has no parameter types or return type annotation
            // we'll contextually type it
            // otherwise, just process it as a normal function declaration

            var shouldContextuallyType = inContextuallyTypedAssignment;

            var assigningFunctionTypeSymbol: PullTypeSymbol = null;
            var assigningFunctionSignature: PullSignatureSymbol = null;

            if (funcDeclAST.returnTypeAnnotation) {
                shouldContextuallyType = false;
            }

            if (shouldContextuallyType && funcDeclAST.arguments) {

                for (var i = 0; i < funcDeclAST.arguments.members.length; i++) {
                    if ((<Parameter>funcDeclAST.arguments.members[i]).typeExpr) {
                        shouldContextuallyType = false;
                        break;
                    }
                }
            }

            if (shouldContextuallyType) {

                assigningFunctionTypeSymbol = context.getContextualType();

                if (assigningFunctionTypeSymbol) {
                    this.resolveDeclaredSymbol(assigningFunctionTypeSymbol, enclosingDecl, context);

                    if (assigningFunctionTypeSymbol) {
                        assigningFunctionSignature = assigningFunctionTypeSymbol.getCallSignatures()[0];
                    }
                }
            }

            // create a new function decl and symbol
            var semanticInfo = this.semanticInfoChain.getUnit(this.unitPath);
            var declCollectionContext = new DeclCollectionContext(semanticInfo);

            declCollectionContext.scriptName = this.unitPath;

            if (enclosingDecl) {
                declCollectionContext.pushParent(enclosingDecl);
            }

            getAstWalkerFactory().walk(funcDeclAST, preCollectDecls, postCollectDecls, null, declCollectionContext);

            var functionDecl = this.getDeclForAST(funcDeclAST);
            this.currentUnit.addSynthesizedDecl(functionDecl);

            var binder = new PullSymbolBinder(this.semanticInfoChain);
            binder.setUnit(this.unitPath);
            binder.bindFunctionExpressionToPullSymbol(functionDecl);

            funcDeclSymbol = <PullTypeSymbol>functionDecl.getSymbol();

            var signature = funcDeclSymbol.type.getCallSignatures()[0];

            // link parameters and resolve their annotations
            if (funcDeclAST.arguments) {

                var contextParams: PullSymbol[] = [];
                var contextParam: PullSymbol = null;

                if (assigningFunctionSignature) {
                    contextParams = assigningFunctionSignature.parameters;
                }

                for (var i = 0; i < funcDeclAST.arguments.members.length; i++) {

                    if ((i < contextParams.length) && !contextParams[i].isVarArg) {
                        contextParam = contextParams[i];
                    }
                    else if (contextParams.length && contextParams[contextParams.length - 1].isVarArg) {
                        contextParam = contextParams[contextParams.length - 1].type.getElementType();
                    }

                    // use the function decl as the enclosing decl, so as to properly resolve type parameters
                    this.resolveFunctionExpressionParameter(<Parameter>funcDeclAST.arguments.members[i], contextParam, functionDecl, context);
                }
            }

            // resolve the return type annotation
            if (funcDeclAST.returnTypeAnnotation) {
                var returnTypeSymbol = this.resolveTypeReference(<TypeReference>funcDeclAST.returnTypeAnnotation, functionDecl, context);

                signature.returnType = returnTypeSymbol;

            }
            else {
                if (assigningFunctionSignature) {
                    var returnType = assigningFunctionSignature.returnType;

                    if (returnType) {
                        context.pushContextualType(returnType, context.inProvisionalResolution(), null);
                        //signature.setReturnType(returnType);
                        this.resolveFunctionBodyReturnTypes(funcDeclAST, signature, true, functionDecl, context);
                        context.popContextualType();
                    }
                    else {
                        signature.returnType = this.semanticInfoChain.anyTypeSymbol;
                    }
                }
                else {
                    this.resolveFunctionBodyReturnTypes(funcDeclAST, signature, false, functionDecl, context);
                }
            }

            funcDeclSymbol.setResolved();

            if (context.typeCheck()) {
                this.seenSuperConstructorCall = false;

                this.resolveAST(funcDeclAST.block, false, functionDecl, context);

                this.validateVariableDeclarationGroups(functionDecl, context);

                var hasReturn = (functionDecl.flags & (PullElementFlags.Signature | PullElementFlags.HasReturnStatement)) != 0;
            
                if (funcDeclAST.block && funcDeclAST.returnTypeAnnotation != null && !hasReturn) {
                    var isVoidOrAny = this.isAnyOrEquivalent(returnTypeSymbol) || returnTypeSymbol === this.semanticInfoChain.voidTypeSymbol;

                    if (!isVoidOrAny && !(funcDeclAST.block.statements.members.length > 0 && funcDeclAST.block.statements.members[0].nodeType() === NodeType.ThrowStatement)) {
                        var funcName = functionDecl.getDisplayName();
                        funcName = funcName ? "'" + funcName + "'" : "expression";

                        context.postError(this.unitPath, funcDeclAST.returnTypeAnnotation.minChar, funcDeclAST.returnTypeAnnotation.getLength(), DiagnosticCode.Function_0_declared_a_non_void_return_type_but_has_no_return_expression, [funcName], enclosingDecl);
                    }
                }                

                //this.typeCheckFunctionOverloads(funcDeclAST, context);
                //this.checkFunctionTypePrivacy(funcDeclAST, false, context);
            }

            return funcDeclSymbol;
        }

        private resolveThisExpression(ast: AST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(ast);

            if (!symbol) {
                symbol = this.computeThisExpressionSymbol(ast, enclosingDecl, context);
                this.setSymbolForAST(ast, symbol, context);
            }

            return symbol;
        }

        private computeThisExpressionSymbol(ast: IAST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (enclosingDecl) {
                var enclosingDeclKind = enclosingDecl.kind;
                var diagnostics: Diagnostic[];

                if (enclosingDeclKind === PullElementKind.Container) { // Dynamic modules are ok, though
                    context.postError(this.currentUnit.getPath(), ast.minChar, ast.getLength(), DiagnosticCode.this_cannot_be_referenced_within_module_bodies);
                    return this.getNewErrorTypeSymbol(null);
                }
                else if (!(enclosingDeclKind & (PullElementKind.SomeFunction | PullElementKind.Script | PullElementKind.SomeBlock))) {
                    context.postError(this.currentUnit.getPath(), ast.minChar, ast.getLength(), DiagnosticCode.this_must_only_be_used_inside_a_function_or_script_context);
                    return this.getNewErrorTypeSymbol(null);
                }
                else {
                    var declPath: PullDecl[] = getPathToDecl(enclosingDecl);

                    // work back up the decl path, until you can find a class
                    // PULLTODO: Obviously not completely correct, but this sufficiently unblocks testing of the pull model.
                    // PULLTODO: Why is this 'obviously not completely correct'.  
                    if (declPath.length) {
                        for (var i = declPath.length - 1; i >= 0; i--) {
                            var decl = declPath[i];
                            var declKind = decl.kind;
                            var declFlags = decl.flags;

                            if (declFlags & PullElementFlags.Static) {
                                break;
                            }
                            else if (declKind === PullElementKind.FunctionExpression && !hasFlag(declFlags, PullElementFlags.FatArrow)) {
                                break;
                            }
                            else if (declKind === PullElementKind.Function) {
                                break;
                            }
                            else if (declKind === PullElementKind.Class) {
                                var classSymbol = <PullTypeSymbol>decl.getSymbol();
                                return classSymbol;
                            }
                        }
                    }
                }
            }

            return this.semanticInfoChain.anyTypeSymbol;
        }

        // PULLTODO: Optimization: cache this for a given decl path
        private resolveSuperExpression(ast: IAST, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            if (!enclosingDecl) {
                return this.semanticInfoChain.anyTypeSymbol;
            }

            var declPath: PullDecl[] = enclosingDecl !== null ? getPathToDecl(enclosingDecl) : [];
            var classSymbol: PullTypeSymbol = null;

            // work back up the decl path, until you can find a class
            if (declPath.length) {
                for (var i = declPath.length - 1; i >= 0; i--) {
                    var decl = declPath[i];
                    var declFlags = decl.flags;

                    if (decl.kind === PullElementKind.FunctionExpression &&
                        !(declFlags & PullElementFlags.FatArrow)) {

                        break;
                    }
                    else if (declFlags & PullElementFlags.Static) {
                        break;
                    }
                    else if (decl.kind === PullElementKind.Class) {
                        classSymbol = <PullTypeSymbol>decl.getSymbol();

                        break;
                    }
                }
            }

            if (classSymbol) {

                if (!classSymbol.isResolved) {
                    this.resolveDeclaredSymbol(classSymbol, enclosingDecl, context);
                }

                var parents = classSymbol.getExtendedTypes();

                if (parents.length) {
                    return parents[0];
                }
            }

            return this.semanticInfoChain.anyTypeSymbol;
        }

        public resolveObjectLiteralExpression(expressionAST: AST, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext, additionalResults?: PullAdditionalObjectLiteralResolutionData): PullSymbol {
            var symbol = this.getSymbolForAST(expressionAST);

            if (!symbol || additionalResults) {
                symbol = this.computeObjectLiteralExpression(expressionAST, inContextuallyTypedAssignment, enclosingDecl, context, additionalResults);
                this.setSymbolForAST(expressionAST, symbol, context);
            }

            return symbol;
        }

        // if there's no type annotation on the assigning AST, we need to create a type from each binary expression
        // in the object literal
        private computeObjectLiteralExpression(expressionAST: IAST, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext, additionalResults?: PullAdditionalObjectLiteralResolutionData): PullSymbol {
            // PULLTODO: Create a decl for the object literal

            // walk the members of the object literal,
            // create fields for each based on the value assigned in
            var objectLitAST = <UnaryExpression>expressionAST;
            var span = TextSpan.fromBounds(objectLitAST.minChar, objectLitAST.limChar);

            var objectLitDecl = new PullDecl("", "", PullElementKind.ObjectLiteral, PullElementFlags.None, span, this.unitPath);
            this.currentUnit.addSynthesizedDecl(objectLitDecl);

            if (enclosingDecl) {
                objectLitDecl.setParentDecl(enclosingDecl);
            }

            this.currentUnit.setDeclForAST(objectLitAST, objectLitDecl);
            this.currentUnit.setASTForDecl(objectLitDecl, objectLitAST);

            var typeSymbol = new PullTypeSymbol("", PullElementKind.Interface);
            typeSymbol.addDeclaration(objectLitDecl);
            objectLitDecl.setSymbol(typeSymbol);

            var memberDecls = <ASTList>objectLitAST.operand;

            var contextualType: PullTypeSymbol = null;

            if (inContextuallyTypedAssignment) {
                contextualType = context.getContextualType();

                this.resolveDeclaredSymbol(contextualType, enclosingDecl, context);
            }

            if (memberDecls) {
                var binex: BinaryExpression;
                var memberSymbol: PullSymbol;
                var assigningSymbol: PullSymbol = null;
                var acceptedContextualType = false;

                if (additionalResults) {
                    additionalResults.membersContextTypeSymbols = [];
                }

                for (var i = 0, len = memberDecls.members.length; i < len; i++) {
                    binex = <BinaryExpression>memberDecls.members[i];

                    var id = binex.operand1;
                    var text: string;
                    var actualText: string;

                    if (id.nodeType() === NodeType.Name) {
                        actualText = (<Identifier>id).actualText;
                        text = (<Identifier>id).text();
                    }
                    else if (id.nodeType() === NodeType.StringLiteral) {
                        actualText = (<StringLiteral>id).actualText;
                        text = (<StringLiteral>id).text();
                    }
                    else {
                        // TODO: no error for this?  What if it's a numeric literal?
                        return this.semanticInfoChain.anyTypeSymbol;
                    }

                    // PULLTODO: Collect these at decl collection time, add them to the var decl
                    span = TextSpan.fromBounds(binex.minChar, binex.limChar);

                    var decl = new PullDecl(text, actualText, PullElementKind.Property, PullElementFlags.Public, span, this.unitPath);
                    this.currentUnit.addSynthesizedDecl(decl);

                    var isAccessor = binex.operand2.nodeType() === NodeType.FunctionDeclaration && (<FunctionDeclaration>binex.operand2).isAccessor();

                    if (!isAccessor) {
                        decl = new PullDecl(text, actualText, PullElementKind.Property, PullElementFlags.Public, span, this.unitPath);

                        objectLitDecl.addChildDecl(decl);
                        decl.setParentDecl(objectLitDecl);

                        this.semanticInfoChain.getUnit(this.unitPath).setDeclForAST(binex, decl);
                        this.semanticInfoChain.getUnit(this.unitPath).setASTForDecl(decl, binex);

                        memberSymbol = new PullSymbol(text, PullElementKind.Property);

                        memberSymbol.addDeclaration(decl);
                        decl.setSymbol(memberSymbol);
                    }

                    if (contextualType) {
                        assigningSymbol = this.getMemberSymbol(text, PullElementKind.SomeValue, contextualType);

                        if (assigningSymbol) {

                            this.resolveDeclaredSymbol(assigningSymbol, enclosingDecl, context);

                            context.pushContextualType(assigningSymbol.type, context.inProvisionalResolution(), null);

                            acceptedContextualType = true;

                            if (additionalResults) {
                                additionalResults.membersContextTypeSymbols[i] = assigningSymbol.type;
                            }
                        }
                    }

                    // if operand 2 is a getter or a setter, we need to resolve it properly
                    if (isAccessor) {
                        var funcDeclAST = <FunctionDeclaration>binex.operand2;
                        var semanticInfo = this.semanticInfoChain.getUnit(this.unitPath);
                        var declCollectionContext = new DeclCollectionContext(semanticInfo);

                        declCollectionContext.scriptName = this.unitPath;

                        declCollectionContext.pushParent(objectLitDecl);

                        getAstWalkerFactory().walk(funcDeclAST, preCollectDecls, postCollectDecls, null, declCollectionContext);

                        var functionDecl = this.getDeclForAST(funcDeclAST);
                        this.currentUnit.addSynthesizedDecl(functionDecl);

                        var binder = new PullSymbolBinder(this.semanticInfoChain);
                        binder.setUnit(this.unitPath);

                        if (funcDeclAST.isGetAccessor()) {
                            binder.bindGetAccessorDeclarationToPullSymbol(functionDecl);
                        }
                        else {
                            binder.bindSetAccessorDeclarationToPullSymbol(functionDecl);
                        }
                    }

                    var memberExprType = this.resolveAST(binex.operand2, assigningSymbol != null, enclosingDecl, context);

                    if (acceptedContextualType) {
                        context.popContextualType();
                        acceptedContextualType = false;
                    }

                    if (isAccessor) {
                        this.setSymbolForAST(binex.operand1, memberExprType, context);
                    } else {
                        context.setTypeInContext(memberSymbol, memberExprType.type);
                        memberSymbol.setResolved();

                        this.setSymbolForAST(binex.operand1, memberSymbol, context);
                        typeSymbol.addMember(memberSymbol);
                    }

                }
            }

            typeSymbol.setResolved();
            return typeSymbol;
        }

        private resolveArrayLiteralExpression(arrayLit: UnaryExpression, inContextuallyTypedAssignment, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(arrayLit);
            if (!symbol) {
                symbol = this.computeArrayLiteralExpressionSymbol(arrayLit, inContextuallyTypedAssignment, enclosingDecl, context);
                this.setSymbolForAST(arrayLit, symbol, context);
            }

            return symbol;
        }

        private computeArrayLiteralExpressionSymbol(arrayLit: UnaryExpression, inContextuallyTypedAssignment, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var elements = <ASTList>arrayLit.operand;
            var elementType = this.semanticInfoChain.anyTypeSymbol;
            var elementTypes: PullTypeSymbol[] = [];
            var comparisonInfo = new TypeComparisonInfo();
            var contextualElementType: PullTypeSymbol = null;
            comparisonInfo.onlyCaptureFirstError = true;

            // if the target type is an array type, extract the element type
            if (inContextuallyTypedAssignment) {
                var contextualType = context.getContextualType();

                this.resolveDeclaredSymbol(contextualType, enclosingDecl, context);

                if (contextualType && contextualType.isArray()) {
                    contextualElementType = contextualType.getElementType();
                }
            }

            // Resolve element types
            if (elements) {
                if (inContextuallyTypedAssignment) {
                    context.pushContextualType(contextualElementType, context.inProvisionalResolution(), null);
                }

                for (var i = 0; i < elements.members.length; i++) {
                    elementTypes[elementTypes.length] = this.resolveAST(elements.members[i], inContextuallyTypedAssignment, enclosingDecl, context).type;
                }

                if (inContextuallyTypedAssignment) {
                    context.popContextualType();
                }
            }

            // Find the elment type
            if (contextualElementType && !contextualElementType.isTypeParameter()) {
                // If there is a contextual type, assume the elemet type is the contextual type, this also applies for zero-length array litrals
                elementType = contextualElementType;

                // verify that this assumption is correct
                for (var i = 0; i < elementTypes.length; i++) {
                    var comparisonInfo = new TypeComparisonInfo();
                    var currentElementType = elementTypes[i];
                    var currentElementAST = elements.members[i];
                    if (!this.sourceIsAssignableToTarget(currentElementType, contextualElementType, context, comparisonInfo)) {
                        var message: Diagnostic;
                        if (comparisonInfo.message) {
                            message = context.postError(this.getUnitPath(), currentElementAST.minChar, currentElementAST.getLength(), DiagnosticCode.Cannot_convert_0_to_1_NL_2, [currentElementType.toString(), contextualElementType.toString(), comparisonInfo.message]);
                        } else {
                            message = context.postError(this.getUnitPath(), currentElementAST.minChar, currentElementAST.getLength(), DiagnosticCode.Cannot_convert_0_to_1, [currentElementType.toString(), contextualElementType.toString()]);
                        }

                        // POST message
                        return this.getNewErrorTypeSymbol(null);
                    }
                }
            }
            else {
                // If there is no contextual type to apply attempt to find the best common type
                if (elementTypes.length) {
                    elementType = elementTypes[0];
                }
                else if (contextualElementType) {
                    elementType = contextualElementType;
                }

                var collection: IPullTypeCollection = {
                    getLength: () => { return elements.members.length; },
                    setTypeAtIndex: (index: number, type: PullTypeSymbol) => { elementTypes[index] = type; },
                    getTypeAtIndex: (index: number) => { return elementTypes[index]; }
                };

                elementType = this.findBestCommonType(elementType, null, collection, context, comparisonInfo);

                // if the array type is the undefined type, we should widen it to any
                // if it's of the null type, only widen it if it's not in a nested array element, so as not to 
                // short-circuit any checks for the best common type
                if (elementType === this.semanticInfoChain.undefinedTypeSymbol || elementType === this.semanticInfoChain.nullTypeSymbol) {
                    elementType = this.semanticInfoChain.anyTypeSymbol;
                }

                if (!elementType) {
                    elementType = this.semanticInfoChain.anyTypeSymbol;
                }
                else if (contextualType && !contextualType.isTypeParameter()) {
                    // for the case of zero-length 'any' arrays, we still want to set the contextual type, if   
                    // need be   
                    if (this.sourceIsAssignableToTarget(elementType, contextualType, context)) {
                        elementType = contextualType;
                    }
                }

            }

            var arraySymbol = elementType.getArrayType();

            // ...But in case we haven't...
            if (!arraySymbol) {

                if (!this.cachedArrayInterfaceType().isResolved) {
                    this.resolveDeclaredSymbol(this.cachedArrayInterfaceType(), enclosingDecl, context);
                }

                arraySymbol = specializeType(this.cachedArrayInterfaceType(), [elementType], this, this.cachedArrayInterfaceType().getDeclarations()[0], context, arrayLit);

                if (!arraySymbol) {
                    arraySymbol = this.semanticInfoChain.anyTypeSymbol;
                }
            }

            return arraySymbol;
        }

        private resolveIndexExpression(callEx: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(callEx);
            if (!symbol) {
                symbol = this.computeIndexExpressionSymbol(callEx, inContextuallyTypedAssignment, enclosingDecl, context);
                this.setSymbolForAST(callEx, symbol, context);
            }

            return symbol;
        }

        private computeIndexExpressionSymbol(callEx: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            // resolve the target
            var targetSymbol = this.resolveAST(callEx.operand1, inContextuallyTypedAssignment, enclosingDecl, context);

            var targetTypeSymbol = targetSymbol.type;

            if (this.isAnyOrEquivalent(targetTypeSymbol)) {
                return targetTypeSymbol;
            }

            var elementType = targetTypeSymbol.getElementType();

            var indexType = this.resolveAST(callEx.operand2, inContextuallyTypedAssignment, enclosingDecl, context).type;

            var isNumberIndex = indexType === this.semanticInfoChain.numberTypeSymbol || PullHelpers.symbolIsEnum(indexType);

            if (elementType && isNumberIndex) {
                return elementType;
            }

            // if the index expression is a string literal or a numberic literal and the object expression has
            // a property with that name,  the property access is the type of that property
            //if (callEx.operand2.nodeType() === NodeType.StringLiteral || callEx.operand2.nodeType() === NodeType.NumericLiteral) {
            //    var memberName = callEx.operand2.nodeType() === NodeType.StringLiteral ? (<StringLiteral>callEx.operand2).actualText :
            //        quoteStr((<NumberLiteral>callEx.operand2).value.toString());
            if (callEx.operand2.nodeType() === NodeType.StringLiteral || callEx.operand2.nodeType() === NodeType.NumericLiteral) {
                var memberName = callEx.operand2.nodeType() === NodeType.StringLiteral
                    ? stripQuotes((<StringLiteral>callEx.operand2).actualText)
                    : quoteStr((<NumberLiteral>callEx.operand2).value.toString()); // numeric literals are still quoted

                var member = this.getMemberSymbol(memberName, PullElementKind.SomeValue, targetTypeSymbol);

                if (member) {
                    return member.type;
                }
            }

            var signatures = targetTypeSymbol.getIndexSignatures();

            var stringSignature: PullSignatureSymbol = null;
            var numberSignature: PullSignatureSymbol = null;
            var signature: PullSignatureSymbol = null;
            var paramSymbols: PullSymbol[];
            var paramType: PullTypeSymbol;

            for (var i = 0; i < signatures.length; i++) {
                if (stringSignature && numberSignature) {
                    break;
                }

                signature = signatures[i];

                paramSymbols = signature.parameters;

                if (paramSymbols.length) {
                    paramType = paramSymbols[0].type;

                    if (paramType === this.semanticInfoChain.stringTypeSymbol) {
                        stringSignature = signatures[i];
                        continue;
                    }
                    else if (paramType === this.semanticInfoChain.numberTypeSymbol || paramType.kind === PullElementKind.Enum) {
                        numberSignature = signatures[i];
                        continue;
                    }
                }
            }

            // otherwise, if the object expression has a numeric index signature and the index expression is
            // of type Any, the Number primitive type or an enum type, the property access is of the type of that index
            // signature
            if (numberSignature && (isNumberIndex || indexType === this.semanticInfoChain.anyTypeSymbol)) {
                var returnType = numberSignature.returnType;

                if (!returnType) {
                    returnType = this.semanticInfoChain.anyTypeSymbol;
                }

                return returnType;
            }
            // otherwise, if the object expression has a string index signature and the index expression is
            // of type Any, the String or Number primitive type or an enum type, the property access of the type of
            // that index signature
            else if (stringSignature && (isNumberIndex || indexType === this.semanticInfoChain.anyTypeSymbol || indexType === this.semanticInfoChain.stringTypeSymbol)) {
                var returnType = stringSignature.returnType;

                if (!returnType) {
                    returnType = this.semanticInfoChain.anyTypeSymbol;
                }

                return returnType;
            }
            // otherwise, if indexExpr is of type Any, the String or Number primitive type or an enum type,
            // the property access is of type Any
            else if (isNumberIndex || indexType === this.semanticInfoChain.anyTypeSymbol || indexType === this.semanticInfoChain.stringTypeSymbol) {
                var returnType = this.semanticInfoChain.anyTypeSymbol;
                return returnType;
            }
            // otherwise, the property acess is invalid and a compile-time error occurs
            else {
                context.postError(this.getUnitPath(), callEx.minChar, callEx.getLength(), DiagnosticCode.Value_of_type_0_is_not_indexable_by_type_1, [targetTypeSymbol.toString(), indexType.toString()]);
                return this.getNewErrorTypeSymbol(null);
            }
        }

        private resolveBitwiseOperator(expressionAST: AST, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {

            var binex = <BinaryExpression>expressionAST;

            var leftType = <PullTypeSymbol>this.resolveAST(binex.operand1, inContextuallyTypedAssignment, enclosingDecl, context).type;
            var rightType = <PullTypeSymbol>this.resolveAST(binex.operand2, inContextuallyTypedAssignment, enclosingDecl, context).type;

            if (this.sourceIsSubtypeOfTarget(leftType, this.semanticInfoChain.numberTypeSymbol, context) &&
                this.sourceIsSubtypeOfTarget(rightType, this.semanticInfoChain.numberTypeSymbol, context)) {

                return this.semanticInfoChain.numberTypeSymbol;
            }
            else if ((leftType === this.semanticInfoChain.booleanTypeSymbol) &&
                (rightType === this.semanticInfoChain.booleanTypeSymbol)) {

                return this.semanticInfoChain.booleanTypeSymbol;
            }
            else if (this.isAnyOrEquivalent(leftType)) {
                if ((this.isAnyOrEquivalent(rightType) ||
                    (rightType === this.semanticInfoChain.numberTypeSymbol) ||
                    (rightType === this.semanticInfoChain.booleanTypeSymbol))) {

                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }
            else if (this.isAnyOrEquivalent(rightType)) {
                if ((leftType === this.semanticInfoChain.numberTypeSymbol) ||
                    (leftType === this.semanticInfoChain.booleanTypeSymbol)) {

                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }

            return this.semanticInfoChain.anyTypeSymbol;
        }

        private resolveBinaryAdditionOperation(binex: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var leftType = <PullTypeSymbol>this.resolveAST(binex.operand1, inContextuallyTypedAssignment, enclosingDecl, context).type;
            var rightType = <PullTypeSymbol>this.resolveAST(binex.operand2, inContextuallyTypedAssignment, enclosingDecl, context).type;

            // PULLREVIEW: Eh?  I've preserved the logic from the current implementation, but it could use cleaning up
            if (this.isNullOrUndefinedType(leftType)) {
                leftType = rightType;
            }
            if (this.isNullOrUndefinedType(rightType)) {
                rightType = leftType;
            }

            leftType = this.widenType(leftType);
            rightType = this.widenType(rightType);

            if (binex.nodeType() === NodeType.AddExpression || binex.nodeType() === NodeType.AddAssignmentExpression) {
                if (leftType === this.semanticInfoChain.stringTypeSymbol || rightType === this.semanticInfoChain.stringTypeSymbol) {
                    return this.semanticInfoChain.stringTypeSymbol;
                }
                else if (leftType === this.semanticInfoChain.numberTypeSymbol && rightType === this.semanticInfoChain.numberTypeSymbol) {
                    return this.semanticInfoChain.numberTypeSymbol;
                }
                else if (this.sourceIsSubtypeOfTarget(leftType, this.semanticInfoChain.numberTypeSymbol, context) && this.sourceIsSubtypeOfTarget(rightType, this.semanticInfoChain.numberTypeSymbol, context)) {
                    return this.semanticInfoChain.numberTypeSymbol;
                }
                else {
                    // could be an error
                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }
            else {
                if (leftType === this.semanticInfoChain.numberTypeSymbol && rightType === this.semanticInfoChain.numberTypeSymbol) {
                    return this.semanticInfoChain.numberTypeSymbol;
                }
                else if (this.sourceIsSubtypeOfTarget(leftType, this.semanticInfoChain.numberTypeSymbol, context) && this.sourceIsSubtypeOfTarget(rightType, this.semanticInfoChain.numberTypeSymbol, context)) {
                    return this.semanticInfoChain.numberTypeSymbol;
                }
                else if (this.isAnyOrEquivalent(leftType) || this.isAnyOrEquivalent(rightType)) {
                    return this.semanticInfoChain.numberTypeSymbol;
                }
                else {
                    // error
                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }
        }

        private resolveLogicalOrExpression(binex: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(binex);
            if (!symbol) {
                symbol = this.computeLogicalOrExpressionSymbol(binex, inContextuallyTypedAssignment, enclosingDecl, context);
                this.setSymbolForAST(binex, symbol, context);
            }

            return symbol;
        }

        private computeLogicalOrExpressionSymbol(binex: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var leftType = <PullTypeSymbol>this.resolveAST(binex.operand1, inContextuallyTypedAssignment, enclosingDecl, context).type;
            var rightType = <PullTypeSymbol>this.resolveAST(binex.operand2, inContextuallyTypedAssignment, enclosingDecl, context).type;

            if (this.isAnyOrEquivalent(leftType) || this.isAnyOrEquivalent(rightType)) {
                return this.semanticInfoChain.anyTypeSymbol;
            }
            else if (leftType === this.semanticInfoChain.booleanTypeSymbol) {
                if (rightType === this.semanticInfoChain.booleanTypeSymbol) {
                    return this.semanticInfoChain.booleanTypeSymbol;
                }
                else {
                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }
            else if (leftType === this.semanticInfoChain.numberTypeSymbol) {
                if (rightType === this.semanticInfoChain.numberTypeSymbol) {
                    return this.semanticInfoChain.numberTypeSymbol;
                }
                else {
                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }
            else if (leftType === this.semanticInfoChain.stringTypeSymbol) {
                if (rightType === this.semanticInfoChain.stringTypeSymbol) {
                    return this.semanticInfoChain.stringTypeSymbol;
                }
                else {
                    return this.semanticInfoChain.anyTypeSymbol;
                }
            }
            else if (this.sourceIsSubtypeOfTarget(leftType, rightType, context)) {
                return rightType;
            }
            else if (this.sourceIsSubtypeOfTarget(rightType, leftType, context)) {
                return leftType;
            }

            return this.semanticInfoChain.anyTypeSymbol;
        }

        private resolveLogicalAndExpression(binex: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            return this.resolveAST(binex.operand2, inContextuallyTypedAssignment, enclosingDecl, context).type;
        }

        private resolveConditionalExpression(trinex: ConditionalExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(trinex);
            if (!symbol) {
                symbol = this.computeConditionalExpressionSymbol(trinex, enclosingDecl, context);
                this.setSymbolForAST(trinex, symbol, context);
            }

            return symbol;
        }

        private computeConditionalExpressionSymbol(trinex: ConditionalExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var leftType = this.resolveAST(trinex.operand2, false, enclosingDecl, context).type;
            var rightType = this.resolveAST(trinex.operand3, false, enclosingDecl, context).type;

            var symbol: PullSymbol = null;
            if (this.typesAreIdentical(leftType, rightType)) {
                symbol = leftType;
            }
            else if (this.sourceIsSubtypeOfTarget(leftType, rightType, context) || this.sourceIsSubtypeOfTarget(rightType, leftType, context)) {
                var collection: IPullTypeCollection = {
                    getLength: () => { return 2; },
                    setTypeAtIndex: (index: number, type: PullTypeSymbol) => { }, // no contextual typing here, so no need to do anything
                    getTypeAtIndex: (index: number) => { return rightType; } // we only want the "second" type - the "first" is skipped
                };

                var bestCommonType = this.findBestCommonType(leftType, null, collection, context);

                if (bestCommonType) {
                    symbol = bestCommonType;
                }
            }

            if (!symbol) {
                context.postError(this.getUnitPath(), trinex.minChar, trinex.getLength(), DiagnosticCode.Type_of_conditional_expression_cannot_be_determined_Best_common_type_could_not_be_found_between_0_and_1, [leftType.toString(), rightType.toString()]);
                return this.getNewErrorTypeSymbol(null);
            }

            return symbol;
        }

        private resolveParenthesizedExpression(ast: ParenthesizedExpression, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            // Note: we don't want to consider errors at a lower node to also be happening at this
            // node.  If we did that, then we'd end up reporting an error multiple times in type check.
            // First as we hit this node, then as we hit the lower node that actually produced the
            // error.
            return this.resolveAST(ast.expression, false, enclosingDecl, context);
        }

        private resolveExpressionStatement(ast: ExpressionStatement, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            // Note: we don't want to consider errors at a lower node to also be happening at this
            // node.  If we did that, then we'd end up reporting an error multiple times in type check.
            // First as we hit this node, then as we hit the lower node that actually produced the
            // error.
            return this.resolveAST(ast.expression, inContextuallyTypedAssignment, enclosingDecl, context);
        }

        public resolveInvocationExpression(callEx: InvocationExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext, additionalResults?: PullAdditionalCallResolutionData): PullSymbol {
            var symbol = this.getSymbolForAST(callEx);
            var callResolutionData = this.currentUnit.getCallResolutionDataForAST(callEx);

            if (!symbol || !symbol.isResolved) {
                symbol = this.computeInvocationExpressionSymbol(callEx, inContextuallyTypedAssignment, enclosingDecl, context, additionalResults);
                this.setSymbolForAST(callEx, symbol, context);
                this.currentUnit.setCallResolutionDataForAST(callEx, additionalResults);
            }
            else {
                if (additionalResults && callResolutionData && (callResolutionData != additionalResults)) {
                    additionalResults.actualParametersContextTypeSymbols = callResolutionData.actualParametersContextTypeSymbols;
                    additionalResults.candidateSignature = callResolutionData.candidateSignature;
                    additionalResults.resolvedSignatures = callResolutionData.resolvedSignatures;
                    additionalResults.targetSymbol = callResolutionData.targetSymbol;
                    additionalResults.targetTypeSymbol = callResolutionData.targetTypeSymbol;
                }
            }

            return symbol;
        }

        public computeInvocationExpressionSymbol(callEx: InvocationExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext, additionalResults?: PullAdditionalCallResolutionData): PullSymbol {
            // resolve the target
            var targetSymbol = this.resolveAST(callEx.target, inContextuallyTypedAssignment, enclosingDecl, context);
            var targetAST = this.getLastIdentifierInTarget(callEx);

            // don't be fooled
            //if (target === this.semanticInfoChain.anyTypeSymbol) {
            //    diagnostic = context.postError(callEx.minChar, callEx.getLength(), this.unitPath, "Invalid call expression", enclosingDecl);
            //    return this.getNewErrorTypeSymbol(diagnostic); 
            //}

            var targetTypeSymbol = targetSymbol.type;
            if (this.isAnyOrEquivalent(targetTypeSymbol)) {

                // resolve any arguments
                this.resolveAST(callEx.arguments, inContextuallyTypedAssignment, enclosingDecl, context);

                if (callEx.typeArguments) {
                    context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Untyped_function_calls_may_not_accept_type_arguments)
                    return this.getNewErrorTypeSymbol(null);
                }

                return this.semanticInfoChain.anyTypeSymbol;
            }

            var diagnostics: Diagnostic[] = [];
            var isSuperCall = false;

            if (callEx.target.nodeType() === NodeType.SuperExpression) {
                isSuperCall = true;

                if (targetTypeSymbol.isClass()) {
                    this.seenSuperConstructorCall = true;
                    targetSymbol = targetTypeSymbol.getConstructorMethod();
                    targetTypeSymbol = targetSymbol.type;
                }
                else {
                    context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Calls_to_super_are_only_valid_inside_a_class);
                    // POST diagnostics
                    return this.getNewErrorTypeSymbol(null);
                }
            }

            var signatures = isSuperCall ? targetTypeSymbol.getConstructSignatures() : targetTypeSymbol.getCallSignatures();

            if (!signatures.length && (targetTypeSymbol.kind == PullElementKind.ConstructorType)) {
                diagnostics = this.addDiagnostic(diagnostics,
                    context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Value_of_type_0_is_not_callable_Did_you_mean_to_include_new, [targetTypeSymbol.toString()]));
            }

            var typeArgs: PullTypeSymbol[] = null;
            var typeReplacementMap: any = null;
            var couldNotFindGenericOverload = false;
            var couldNotAssignToConstraint: boolean;

            // resolve the type arguments, specializing if necessary
            if (callEx.typeArguments) {

                // specialize the type arguments
                typeArgs = [];

                if (callEx.typeArguments && callEx.typeArguments.members.length) {
                    for (var i = 0; i < callEx.typeArguments.members.length; i++) {
                        var typeArg = this.resolveTypeReference(<TypeReference>callEx.typeArguments.members[i], enclosingDecl, context);
                        typeArgs[i] = context.findSpecializationForType(typeArg);
                    }
                }
            }
            else if (isSuperCall && targetTypeSymbol.isGeneric()) {
                typeArgs = targetTypeSymbol.getTypeArguments();
            }

            // next, walk the available signatures
            // if any are generic, and we don't have type arguments, try to infer
            // otherwise, try to specialize to the type arguments above
            if (targetTypeSymbol.isGeneric()) {

                var resolvedSignatures: PullSignatureSymbol[] = [];
                var inferredTypeArgs: PullTypeSymbol[];
                var specializedSignature: PullSignatureSymbol;
                var typeParameters: PullTypeParameterSymbol[];
                var typeConstraint: PullTypeSymbol = null;
                var prevSpecializingToAny = context.specializingToAny;
                var prevSpecializing: boolean = context.isSpecializingSignatureAtCallSite;
                var beforeResolutionSignatures = signatures;
                var triedToInferTypeArgs: boolean;

                for (var i = 0; i < signatures.length; i++) {
                    typeParameters = signatures[i].getTypeParameters();
                    couldNotAssignToConstraint = false;
                    triedToInferTypeArgs = false;

                    if (signatures[i].isGeneric() && typeParameters.length && !signatures[i].isFixed()) {
                        if (typeArgs) {
                            inferredTypeArgs = typeArgs;
                        }
                        else if (callEx.arguments) {
                            inferredTypeArgs = this.inferArgumentTypesForSignature(signatures[i], callEx.arguments, new TypeComparisonInfo(), enclosingDecl, context);
                            triedToInferTypeArgs = true;
                        }

                        // if we could infer Args, or we have type arguments, then attempt to specialize the signature
                        if (inferredTypeArgs) {

                            typeReplacementMap = {};

                            if (inferredTypeArgs.length) {

                                if (inferredTypeArgs.length != typeParameters.length) {
                                    continue;
                                }

                                for (var j = 0; j < typeParameters.length; j++) {
                                    typeReplacementMap[typeParameters[j].pullSymbolIDString] = inferredTypeArgs[j];
                                }
                                for (var j = 0; j < typeParameters.length; j++) {
                                    typeConstraint = typeParameters[j].getConstraint();

                                    // test specialization type for assignment compatibility with the constraint
                                    if (typeConstraint) {
                                        if (typeConstraint.isTypeParameter()) {
                                            for (var k = 0; k < typeParameters.length && k < inferredTypeArgs.length; k++) {
                                                if (typeParameters[k] == typeConstraint) {
                                                    typeConstraint = inferredTypeArgs[k];
                                                }
                                            }
                                        }
                                        if (typeConstraint.isTypeParameter()) {
                                            context.pushTypeSpecializationCache(typeReplacementMap);
                                            typeConstraint = specializeType(typeConstraint, null, this, enclosingDecl, context);  //<PullTypeSymbol>this.resolveDeclaredSymbol(typeConstraint, enclosingDecl, context);
                                            context.popTypeSpecializationCache();
                                        }
                                        context.isComparingSpecializedSignatures = true;
                                        if (!this.sourceIsAssignableToTarget(inferredTypeArgs[j], typeConstraint, context)) {
                                            diagnostics = this.addDiagnostic(diagnostics,
                                                context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Type_0_does_not_satisfy_the_constraint_1_for_type_parameter_2, [inferredTypeArgs[j].toString(null, true), typeConstraint.toString(null, true), typeParameters[j].toString(null, true)]));
                                            couldNotAssignToConstraint = true;
                                        }
                                        context.isComparingSpecializedSignatures = false;

                                        if (couldNotAssignToConstraint) {
                                            break;
                                        }
                                    }
                                }
                            }
                            else {

                                // if we tried to infer type arguments but could not, this overload should not be considered to be a candidate
                                if (triedToInferTypeArgs) {

                                    if (signatures[i].isFixed()) {
                                        if (signatures[i].hasAGenericParameter) {
                                            context.specializingToAny = true;
                                        }
                                        else {
                                            resolvedSignatures[resolvedSignatures.length] = signatures[i];
                                        }
                                    }
                                    else {
                                        continue;
                                    }
                                }

                                context.specializingToAny = true;
                            }

                            if (couldNotAssignToConstraint) {
                                continue;
                            }

                            context.isSpecializingSignatureAtCallSite = true;
                            specializedSignature = specializeSignature(signatures[i], false, typeReplacementMap, inferredTypeArgs, this, enclosingDecl, context);

                            context.isSpecializingSignatureAtCallSite = prevSpecializing;
                            context.specializingToAny = prevSpecializingToAny;

                            if (specializedSignature) {
                                resolvedSignatures[resolvedSignatures.length] = specializedSignature;
                            }
                        }
                    }
                    else {
                        if (!(callEx.typeArguments && callEx.typeArguments.members.length)) {
                            resolvedSignatures[resolvedSignatures.length] = signatures[i];
                        }
                    }
                }
                // PULLTODO: Try to avoid copying here...

                if (signatures.length && !resolvedSignatures.length) {
                    couldNotFindGenericOverload = true;
                }

                signatures = resolvedSignatures;
            }

            // the target should be a function
            //if (!targetTypeSymbol.isType()) {
            //    this.log("Attempting to call a non-function symbol");
            //    return this.semanticInfoChain.anyTypeSymbol;
            //}
            var errorCondition: PullSymbol = null;

            if (!signatures.length) {
                if (additionalResults) {
                    additionalResults.targetSymbol = targetSymbol;
                    additionalResults.targetTypeSymbol = targetTypeSymbol;
                    additionalResults.resolvedSignatures = beforeResolutionSignatures;
                    additionalResults.candidateSignature = beforeResolutionSignatures && beforeResolutionSignatures.length ? beforeResolutionSignatures[0] : null;

                    additionalResults.actualParametersContextTypeSymbols = actualParametersContextTypeSymbols;
                }

                if (!couldNotFindGenericOverload) {

                    // if there are no call signatures, but the target is a subtype of 'Function', return 'any'
                    if (this.cachedFunctionInterfaceType() && this.sourceIsSubtypeOfTarget(targetTypeSymbol, this.cachedFunctionInterfaceType(), context)) {
                        return this.semanticInfoChain.anyTypeSymbol;
                    }

                    diagnostics = this.addDiagnostic(diagnostics, context.postError(this.unitPath, callEx.minChar, callEx.getLength(), DiagnosticCode.Unable_to_invoke_type_with_no_call_signatures));
                    errorCondition = this.getNewErrorTypeSymbol(null);
                }
                else {
                    diagnostics = this.addDiagnostic(diagnostics, context.postError(this.unitPath, callEx.minChar, callEx.getLength(), DiagnosticCode.Could_not_select_overload_for_call_expression));
                    errorCondition = this.getNewErrorTypeSymbol(null);
                }

                return errorCondition;
            }

            var signature = this.resolveOverloads(callEx, signatures, enclosingDecl, callEx.typeArguments != null, context, diagnostics);
            var useBeforeResolutionSignatures = signature == null;

            if (!signature) {
                diagnostics = this.addDiagnostic(diagnostics,
                    context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Could_not_select_overload_for_call_expression));

                // Remember the error state
                // POST diagnostics
                errorCondition = this.getNewErrorTypeSymbol(null);

                if (!signatures.length) {
                    return errorCondition;
                }

                // Attempt to recover from the error condition
                // First, pick the first signature as the candidate signature
                signature = signatures[0];

                // Second, clear any state left from overload resolution in preparation of contextual typing
                if (callEx.arguments) {
                    for (var k = 0, n = callEx.arguments.members.length; k < n; k++) {
                        var arg = callEx.arguments.members[k];
                        var argSymbol = this.getSymbolForAST(arg);

                        if (argSymbol) {
                            var argType = argSymbol.type;
                            if (arg.nodeType() === NodeType.FunctionDeclaration) {
                                if (!this.canApplyContextualTypeToFunction(argType, <FunctionDeclaration>arg, true)) {
                                    continue;
                                }
                            }

                            argSymbol.invalidate();
                        }
                    }
                }
            }

            if (!signature.isGeneric() && callEx.typeArguments) {
                diagnostics = this.addDiagnostic(diagnostics,
                    context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Non_generic_functions_may_not_accept_type_arguments));
            }

            var returnType = signature.returnType;

            // contextually type arguments
            var actualParametersContextTypeSymbols: PullTypeSymbol[] = [];
            if (callEx.arguments) {
                var len = callEx.arguments.members.length;
                var params = signature.parameters;
                var contextualType: PullTypeSymbol = null;
                var signatureDecl = signature.getDeclarations()[0];

                for (var i = 0; i < len; i++) {
                    // account for varargs
                    if (params.length) {
                        if (i < params.length - 1 || (i < params.length && !signature.hasVarArgs)) {
                            if (typeReplacementMap) {
                                context.pushTypeSpecializationCache(typeReplacementMap);
                            }
                            this.resolveDeclaredSymbol(params[i], signatureDecl, context);
                            if (typeReplacementMap) {
                                context.popTypeSpecializationCache();
                            }
                            contextualType = params[i].type;
                        }
                        else if (signature.hasVarArgs) {
                            contextualType = params[params.length - 1].type;
                            if (contextualType.isArray()) {
                                contextualType = contextualType.getElementType();
                            }
                        }
                    }

                    if (contextualType) {
                        context.pushContextualType(contextualType, context.inProvisionalResolution(), null);
                        actualParametersContextTypeSymbols[i] = contextualType;
                    }

                    this.resolveAST(callEx.arguments.members[i], contextualType != null, enclosingDecl, context);

                    if (contextualType) {
                        context.popContextualType();
                        contextualType = null;
                    }
                }
            }

            // Store any additional resolution results if needed before we return
            if (additionalResults) {
                additionalResults.targetSymbol = targetSymbol;
                additionalResults.targetTypeSymbol = targetTypeSymbol;
                if (useBeforeResolutionSignatures && beforeResolutionSignatures) {
                    additionalResults.resolvedSignatures = beforeResolutionSignatures;
                    additionalResults.candidateSignature = beforeResolutionSignatures[0];

                } else {
                    additionalResults.resolvedSignatures = signatures;
                    additionalResults.candidateSignature = signature;
                }
                additionalResults.actualParametersContextTypeSymbols = actualParametersContextTypeSymbols;
            }

            if (errorCondition) {
                return errorCondition;
            }

            if (!returnType) {
                returnType = this.semanticInfoChain.anyTypeSymbol;
            }

            return returnType;
        }

        public resolveObjectCreationExpression(callEx: ObjectCreationExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext, additionalResults?: PullAdditionalCallResolutionData): PullSymbol {
            var symbol = this.getSymbolForAST(callEx);
            var callResolutionData = this.currentUnit.getCallResolutionDataForAST(callEx);

            if (!symbol || !symbol.isResolved) {
                symbol = this.computeObjectCreationExpressionSymbol(callEx, inContextuallyTypedAssignment, enclosingDecl, context, additionalResults);
                this.setSymbolForAST(callEx, symbol, context);
                this.currentUnit.setCallResolutionDataForAST(callEx, additionalResults);
            }
            else {
                if (additionalResults && callResolutionData && (callResolutionData != additionalResults)) {
                    additionalResults.actualParametersContextTypeSymbols = callResolutionData.actualParametersContextTypeSymbols;
                    additionalResults.candidateSignature = callResolutionData.candidateSignature;
                    additionalResults.resolvedSignatures = callResolutionData.resolvedSignatures;
                    additionalResults.targetSymbol = callResolutionData.targetSymbol;
                    additionalResults.targetTypeSymbol = callResolutionData.targetTypeSymbol;
                }
            }

            return symbol;
        }

        public computeObjectCreationExpressionSymbol(callEx: ObjectCreationExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext, additionalResults?: PullAdditionalCallResolutionData): PullSymbol {
            var returnType: PullTypeSymbol = null;

            // resolve the target
            var targetSymbol = this.resolveAST(callEx.target, inContextuallyTypedAssignment, enclosingDecl, context);
            var targetTypeSymbol = targetSymbol.isType() ? <PullTypeSymbol>targetSymbol : targetSymbol.type;

            var targetAST = this.getLastIdentifierInTarget(callEx);

            // PULLREVIEW: In the case of a generic instantiation of a class type,
            // we'll have gotten a 'GenericType' node, which will be resolved as the class type and not
            // the constructor type.  In this case, set the targetTypeSymbol to the constructor type
            if (targetTypeSymbol.isClass()) {
                targetTypeSymbol = targetTypeSymbol.getConstructorMethod().type;
            }

            var constructSignatures = targetTypeSymbol.getConstructSignatures();

            var typeArgs: PullTypeSymbol[] = null;
            var typeReplacementMap: any = null;
            var usedCallSignaturesInstead = false;
            var couldNotAssignToConstraint: boolean;

            if (this.isAnyOrEquivalent(targetTypeSymbol)) {
                // resolve any arguments
                this.resolveAST(callEx.arguments, inContextuallyTypedAssignment, enclosingDecl, context);
                return targetTypeSymbol;
            }

            if (!constructSignatures.length) {
                constructSignatures = targetTypeSymbol.getCallSignatures();
                usedCallSignaturesInstead = true;
            }

            var diagnostics: Diagnostic[] = [];
            if (constructSignatures.length) {
                // resolve the type arguments, specializing if necessary
                if (callEx.typeArguments) {
                    // specialize the type arguments
                    typeArgs = [];

                    if (callEx.typeArguments && callEx.typeArguments.members.length) {
                        for (var i = 0; i < callEx.typeArguments.members.length; i++) {
                            var typeArg = this.resolveTypeReference(<TypeReference>callEx.typeArguments.members[i], enclosingDecl, context);
                            typeArgs[i] = context.findSpecializationForType(typeArg);
                        }
                    }
                }

                // next, walk the available signatures
                // if any are generic, and we don't have type arguments, try to infer
                // otherwise, try to specialize to the type arguments above
                if (targetTypeSymbol.isGeneric()) {
                    var resolvedSignatures: PullSignatureSymbol[] = [];
                    var inferredTypeArgs: PullTypeSymbol[];
                    var specializedSignature: PullSignatureSymbol;
                    var typeParameters: PullTypeParameterSymbol[];
                    var typeConstraint: PullTypeSymbol = null;
                    var prevSpecializingToAny = context.specializingToAny;
                    var prevIsSpecializing = context.isSpecializingSignatureAtCallSite = true;
                    var triedToInferTypeArgs: boolean;

                    for (var i = 0; i < constructSignatures.length; i++) {
                        couldNotAssignToConstraint = false;

                        if (constructSignatures[i].isGeneric() && !constructSignatures[i].isFixed()) {
                            if (typeArgs) {
                                inferredTypeArgs = typeArgs;
                            }
                            else if (callEx.arguments) {
                                inferredTypeArgs = this.inferArgumentTypesForSignature(constructSignatures[i], callEx.arguments, new TypeComparisonInfo(), enclosingDecl, context);
                                triedToInferTypeArgs = true;
                            }

                            // if we could infer Args, or we have type arguments, then attempt to specialize the signature
                            if (inferredTypeArgs) {
                                typeParameters = constructSignatures[i].getTypeParameters();

                                typeReplacementMap = {};

                                if (inferredTypeArgs.length) {

                                    if (inferredTypeArgs.length < typeParameters.length) {
                                        continue;
                                    }

                                    for (var j = 0; j < typeParameters.length; j++) {
                                        typeReplacementMap[typeParameters[j].pullSymbolIDString] = inferredTypeArgs[j];
                                    }
                                    for (var j = 0; j < typeParameters.length; j++) {
                                        typeConstraint = typeParameters[j].getConstraint();

                                        // test specialization type for assignment compatibility with the constraint
                                        if (typeConstraint) {
                                            if (typeConstraint.isTypeParameter()) {
                                                for (var k = 0; k < typeParameters.length && k < inferredTypeArgs.length; k++) {
                                                    if (typeParameters[k] == typeConstraint) {
                                                        typeConstraint = inferredTypeArgs[k];
                                                    }
                                                }
                                            }
                                            if (typeConstraint.isTypeParameter()) {
                                                context.pushTypeSpecializationCache(typeReplacementMap);
                                                typeConstraint = specializeType(typeConstraint, null, this, enclosingDecl, context);
                                                context.popTypeSpecializationCache();
                                            }

                                            context.isComparingSpecializedSignatures = true;
                                            if (!this.sourceIsAssignableToTarget(inferredTypeArgs[j], typeConstraint, context)) {
                                                diagnostics = this.addDiagnostic(diagnostics,
                                                    context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Type_0_does_not_satisfy_the_constraint_1_for_type_parameter_2, [inferredTypeArgs[j].toString(null, true), typeConstraint.toString(null, true), typeParameters[j].toString(null, true)]));
                                                couldNotAssignToConstraint = true;
                                            }
                                            context.isComparingSpecializedSignatures = false;

                                            if (couldNotAssignToConstraint) {
                                                break;
                                            }

                                        }
                                    }
                                }
                                else {

                                    if (triedToInferTypeArgs) {

                                        if (constructSignatures[i].isFixed()) {
                                            if (!constructSignatures[i].hasAGenericParameter) {
                                                resolvedSignatures[resolvedSignatures.length] = constructSignatures[i];
                                            }
                                        }
                                        else {
                                            continue;
                                        }
                                    } else {
                                        context.specializingToAny = true;
                                    }
                                }

                                if (couldNotAssignToConstraint) {
                                    continue;
                                }

                                context.isSpecializingSignatureAtCallSite = true;
                                specializedSignature = specializeSignature(constructSignatures[i], false, typeReplacementMap, inferredTypeArgs, this, enclosingDecl, context);

                                context.specializingToAny = prevSpecializingToAny;
                                context.isSpecializingSignatureAtCallSite = prevIsSpecializing;

                                if (specializedSignature) {
                                    resolvedSignatures[resolvedSignatures.length] = specializedSignature;
                                }
                            }
                        }
                        else {
                            if (!(callEx.typeArguments && callEx.typeArguments.members.length)) {
                                resolvedSignatures[resolvedSignatures.length] = constructSignatures[i];
                            }
                        }
                    }

                    // PULLTODO: Try to avoid copying here...
                    constructSignatures = resolvedSignatures;
                }

                // the target should be a function
                //if (!targetSymbol.isType()) {
                //    this.log("Attempting to call a non-function symbol");
                //    return this.semanticInfoChain.anyTypeSymbol;
                //}

                var signature = this.resolveOverloads(callEx, constructSignatures, enclosingDecl, callEx.typeArguments != null, context, diagnostics);

                // Store any additional resolution results if needed before we return
                if (additionalResults) {
                    additionalResults.targetSymbol = targetSymbol;
                    additionalResults.targetTypeSymbol = targetTypeSymbol;
                    additionalResults.resolvedSignatures = constructSignatures;
                    additionalResults.candidateSignature = signature;
                    additionalResults.actualParametersContextTypeSymbols = [];
                }

                if (!constructSignatures.length && diagnostics) {
                    // POST diagnostics
                    return this.getNewErrorTypeSymbol(null);
                }

                var errorCondition: PullSymbol = null;

                // if we haven't been able to choose an overload, default to the first one
                if (!signature) {
                    diagnostics = this.addDiagnostic(diagnostics,
                        context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Could_not_select_overload_for_new_expression));

                    // Remember the error
                    errorCondition = this.getNewErrorTypeSymbol(null);

                    if (!constructSignatures.length) {
                        // POST diagnostics
                        return errorCondition;
                    }

                    // First, pick the first signature as the candidate signature
                    signature = constructSignatures[0];

                    // Second, clear any state left from overload resolution in preparation of contextual typing
                    if (callEx.arguments) {
                        for (var k = 0, n = callEx.arguments.members.length; k < n; k++) {
                            var arg = callEx.arguments.members[k];
                            var argSymbol = this.getSymbolForAST(arg);

                            if (argSymbol) {
                                var argType = argSymbol.type;
                                if (arg.nodeType() === NodeType.FunctionDeclaration) {
                                    if (!this.canApplyContextualTypeToFunction(argType, <FunctionDeclaration>arg, true)) {
                                        continue;
                                    }
                                }

                                argSymbol.invalidate();
                            }
                        }
                    }
                }

                returnType = signature.returnType;

                // if it's a default constructor, and we have a type argument, we need to specialize
                if (returnType && !signature.isGeneric() && returnType.isGeneric() && !returnType.getIsSpecialized()) {
                    if (typeArgs && typeArgs.length) {
                        returnType = specializeType(returnType, typeArgs, this, enclosingDecl, context, callEx);
                    }
                    else {
                        returnType = this.specializeTypeToAny(returnType, enclosingDecl, context);
                    }
                }

                if (usedCallSignaturesInstead) {
                    if (returnType != this.semanticInfoChain.voidTypeSymbol) {
                        diagnostics = this.addDiagnostic(diagnostics,
                            context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Call_signatures_used_in_a_new_expression_must_have_a_void_return_type));
                        // POST diagnostics
                        return this.getNewErrorTypeSymbol(null);
                    }
                    else {
                        returnType = this.semanticInfoChain.anyTypeSymbol;
                    }
                }

                if (!returnType) {
                    returnType = signature.returnType;

                    if (!returnType) {
                        returnType = targetTypeSymbol;
                    }
                }

                // contextually type arguments
                var actualParametersContextTypeSymbols: PullTypeSymbol[] = [];
                if (callEx.arguments) {
                    var len = callEx.arguments.members.length;
                    var params = signature.parameters;
                    var contextualType: PullTypeSymbol = null;
                    var signatureDecl = signature.getDeclarations()[0];

                    for (var i = 0; i < len; i++) {

                        if (params.length) {
                            if (i < params.length - 1 || (i < params.length && !signature.hasVarArgs)) {
                                if (typeReplacementMap) {
                                    context.pushTypeSpecializationCache(typeReplacementMap);
                                }
                                this.resolveDeclaredSymbol(params[i], signatureDecl, context);
                                if (typeReplacementMap) {
                                    context.popTypeSpecializationCache();
                                }
                                contextualType = params[i].type;
                            }
                            else if (signature.hasVarArgs) {
                                contextualType = params[params.length - 1].type;
                                if (contextualType.isArray()) {
                                    contextualType = contextualType.getElementType();
                                }
                            }
                        }

                        if (contextualType) {
                            context.pushContextualType(contextualType, context.inProvisionalResolution(), null);
                            actualParametersContextTypeSymbols[i] = contextualType;
                        }

                        this.resolveAST(callEx.arguments.members[i], contextualType != null, enclosingDecl, context);

                        if (contextualType) {
                            context.popContextualType();
                            contextualType = null;
                        }
                    }
                }

                // Store any additional resolution results if needed before we return
                if (additionalResults) {
                    additionalResults.targetSymbol = targetSymbol;
                    additionalResults.targetTypeSymbol = targetTypeSymbol;
                    additionalResults.resolvedSignatures = constructSignatures;
                    additionalResults.candidateSignature = signature;
                    additionalResults.actualParametersContextTypeSymbols = actualParametersContextTypeSymbols;
                }

                if (errorCondition) {
                    // POST diagnostics
                    return errorCondition;
                }

                if (!returnType) {
                    returnType = this.semanticInfoChain.anyTypeSymbol;
                }

                return returnType
            }
            else if (targetTypeSymbol.isClass()) {
                // implicit constructor
                return returnType;
            }

            diagnostics = this.addDiagnostic(diagnostics,
                context.postError(this.unitPath, targetAST.minChar, targetAST.getLength(), DiagnosticCode.Invalid_new_expression));

            // POST diagnostics
            return this.getNewErrorTypeSymbol(null);
        }

        public resolveTypeAssertionExpression(assertionExpression: UnaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            return this.resolveTypeReference(assertionExpression.castTerm, enclosingDecl, context);
        }

        private resolveAssignmentStatement(binex: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var symbol = this.getSymbolForAST(binex);

            if (!symbol) {
                symbol = this.computeAssignmentStatementSymbol(binex, inContextuallyTypedAssignment, enclosingDecl, context);
                this.setSymbolForAST(binex, symbol, context);
            }

            return symbol;
        }

        private computeAssignmentStatementSymbol(binex: BinaryExpression, inContextuallyTypedAssignment: boolean, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSymbol {
            var leftType = this.resolveAST(binex.operand1, inContextuallyTypedAssignment, enclosingDecl, context).type;

            context.pushContextualType(leftType, context.inProvisionalResolution(), null);
            this.resolveAST(binex.operand2, true, enclosingDecl, context);
            context.popContextualType();

            return leftType;
        }

        public resolveBoundDecls(decl: PullDecl, context: PullTypeResolutionContext): void {

            if (!decl) {
                return;
            }

            switch (decl.kind) {
                case PullElementKind.Script:
                    var childDecls = decl.getChildDecls();
                    for (var i = 0; i < childDecls.length; i++) {
                        this.resolveBoundDecls(childDecls[i], context);
                    }
                    break;
                case PullElementKind.DynamicModule:
                case PullElementKind.Container:
                case PullElementKind.Enum:
                    var moduleDecl = <ModuleDeclaration>this.semanticInfoChain.getASTForDecl(decl);
                    this.resolveModuleDeclaration(moduleDecl, context);
                    break;
                case PullElementKind.Interface:
                    // case PullElementKind.ObjectType:
                    var interfaceDecl = <TypeDeclaration>this.semanticInfoChain.getASTForDecl(decl);
                    this.resolveInterfaceDeclaration(interfaceDecl, context);
                    break;
                case PullElementKind.Class:
                    var classDecl = <ClassDeclaration>this.semanticInfoChain.getASTForDecl(decl);
                    this.resolveClassDeclaration(classDecl, context);
                    break;
                case PullElementKind.Method:
                case PullElementKind.Function:
                    var funcDecl = <FunctionDeclaration>this.semanticInfoChain.getASTForDecl(decl);
                    this.resolveFunctionDeclaration(funcDecl, context);
                    break;
                case PullElementKind.GetAccessor:
                    funcDecl = <FunctionDeclaration>this.semanticInfoChain.getASTForDecl(decl);
                    this.resolveGetAccessorDeclaration(funcDecl, context);
                    break;
                case PullElementKind.SetAccessor:
                    funcDecl = <FunctionDeclaration>this.semanticInfoChain.getASTForDecl(decl);
                    this.resolveSetAccessorDeclaration(funcDecl, context);
                    break;
                case PullElementKind.Property:
                case PullElementKind.Variable:
                case PullElementKind.Parameter:
                    var varDecl = <BoundDecl>this.semanticInfoChain.getASTForDecl(decl);

                    // varDecl may be null if we're dealing with an implicit variable created for a class,
                    // module or enum
                    if (varDecl) {
                        this.resolveVariableDeclaration(varDecl, context);
                    }
                    break;
            }
        }

        // type relationships

        private mergeOrdered(a: PullTypeSymbol, b: PullTypeSymbol, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo): PullTypeSymbol {
            if (this.isAnyOrEquivalent(a) || this.isAnyOrEquivalent(b)) {
                return this.semanticInfoChain.anyTypeSymbol;
            }
            else if (a === b) {
                return a;
            }
            else if ((b === this.semanticInfoChain.nullTypeSymbol) && a != this.semanticInfoChain.nullTypeSymbol) {
                return a;
            }
            else if ((a === this.semanticInfoChain.nullTypeSymbol) && (b != this.semanticInfoChain.nullTypeSymbol)) {
                return b;
            }
            else if ((a === this.semanticInfoChain.voidTypeSymbol) && (b === this.semanticInfoChain.voidTypeSymbol || b === this.semanticInfoChain.undefinedTypeSymbol || b === this.semanticInfoChain.nullTypeSymbol)) {
                return a;
            }
            else if ((a === this.semanticInfoChain.voidTypeSymbol) && (b === this.semanticInfoChain.anyTypeSymbol)) {
                return b;
            }
            else if ((b === this.semanticInfoChain.undefinedTypeSymbol) && a != this.semanticInfoChain.voidTypeSymbol) {
                return a;
            }
            else if ((a === this.semanticInfoChain.undefinedTypeSymbol) && (b != this.semanticInfoChain.undefinedTypeSymbol)) {
                return b;
            }
            else if (a.isTypeParameter() && !b.isTypeParameter()) {
                return b;
            }
            else if (!a.isTypeParameter() && b.isTypeParameter()) {
                return a;
            }
            else if (a.isArray() && b.isArray()) {
                if (a.getElementType() === b.getElementType()) {
                    return a;
                }
                else {
                    var mergedET = this.mergeOrdered(a.getElementType(), b.getElementType(), context, comparisonInfo);
                    if (mergedET) {
                        var mergedArrayType = mergedET.getArrayType();

                        if (!mergedArrayType) {
                            mergedArrayType = specializeType(this.cachedArrayInterfaceType(), [mergedET], this, this.cachedArrayInterfaceType().getDeclarations()[0], context);
                        }

                        return mergedArrayType;
                    }
                }
            }
            else if (this.sourceIsSubtypeOfTarget(a, b, context, comparisonInfo)) {
                return b;
            }
            else if (this.sourceIsSubtypeOfTarget(b, a, context, comparisonInfo)) {
                return a;
            }

            return null;
        }

        public widenType(type: PullTypeSymbol): PullTypeSymbol {
            if (type === this.semanticInfoChain.undefinedTypeSymbol ||
                type === this.semanticInfoChain.nullTypeSymbol ||
                type.isError()) {

                return this.semanticInfoChain.anyTypeSymbol;
            }

            return type;
        }

        private isNullOrUndefinedType(type: PullTypeSymbol) {
            return type === this.semanticInfoChain.nullTypeSymbol ||
                type === this.semanticInfoChain.undefinedTypeSymbol;
        }

        private canApplyContextualType(type: PullTypeSymbol) {

            if (!type) {
                return true;
            }

            var kind = type.kind;

            if ((kind & PullElementKind.ObjectType) != 0) {
                return true;
            }
            if ((kind & PullElementKind.Interface) != 0) {
                return true;
            }
            else if ((kind & PullElementKind.SomeFunction) != 0) {
                return this.canApplyContextualTypeToFunction(type, <FunctionDeclaration>this.semanticInfoChain.getASTForDecl(type.getDeclarations[0]), true);
            }
            else if ((kind & PullElementKind.Array) != 0) {
                return true;
            }
            else if (type == this.semanticInfoChain.anyTypeSymbol || kind != PullElementKind.Primitive) {
                return true;
            }

            return false;
        }

        public findBestCommonType(initialType: PullTypeSymbol, targetType: PullTypeSymbol, collection: IPullTypeCollection, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            var len = collection.getLength();
            var nlastChecked = 0;
            var bestCommonType = initialType;

            if (targetType && this.canApplyContextualType(bestCommonType)) {
                if (bestCommonType) {
                    bestCommonType = this.mergeOrdered(bestCommonType, targetType, context);
                }
                else {
                    bestCommonType = targetType;
                }
            }

            // it's important that we set the convergence type here, and not in the loop,
            // since the first element considered may be the contextual type
            var convergenceType: PullTypeSymbol = bestCommonType;

            while (nlastChecked < len) {

                for (var i = 0; i < len; i++) {

                    // no use in comparing a type against itself
                    if (i === nlastChecked) {
                        continue;
                    }

                    if (convergenceType && (bestCommonType = this.mergeOrdered(convergenceType, collection.getTypeAtIndex(i), context, comparisonInfo))) {
                        convergenceType = bestCommonType;
                    }

                    if (bestCommonType === null || this.isAnyOrEquivalent(bestCommonType)) {
                        break;
                    }
                    // set the element type to the target type
                    // If the contextual type is a type parameter, but the BCT is not, we won't set the BCT
                    // to the contextual type, so as not to short-circuit type argument inference calculations
                    else if (targetType && !(bestCommonType.isTypeParameter() || targetType.isTypeParameter())) {
                        collection.setTypeAtIndex(i, targetType);
                    }
                }

                // use the type if we've agreed upon it
                if (convergenceType && bestCommonType) {
                    break;
                }

                nlastChecked++;
                if (nlastChecked < len) {
                    convergenceType = collection.getTypeAtIndex(nlastChecked);
                }
            }

            if (!bestCommonType) {
                // if no best common type can be determined, use "{}"
                var emptyTypeDecl = new PullDecl("{}", "{}", PullElementKind.ObjectType, PullElementFlags.None, new TextSpan(0, 0), this.currentUnit.getPath());
                var emptyType = new PullTypeSymbol("{}", PullElementKind.ObjectType);

                emptyTypeDecl.setSymbol(emptyType);
                emptyType.addDeclaration(emptyTypeDecl);

                bestCommonType = emptyType;
            }

            return bestCommonType;
        }

        // Type Identity

        public typesAreIdentical(t1: PullTypeSymbol, t2: PullTypeSymbol, val?: AST) {

            // This clause will cover both primitive types (since the type objects are shared),
            // as well as shared brands
            if (t1 === t2) {
                return true;
            }

            if (!t1 || !t2) {
                return false;
            }

            if (val && t1.isPrimitive() && (<PullPrimitiveTypeSymbol>t1).isStringConstant() && t2 === this.semanticInfoChain.stringTypeSymbol) {
                return (val.nodeType() === NodeType.StringLiteral) && (stripQuotes((<StringLiteral>val).actualText) === stripQuotes(t1.name));
            }

            if (val && t2.isPrimitive() && (<PullPrimitiveTypeSymbol>t2).isStringConstant() && t2 === this.semanticInfoChain.stringTypeSymbol) {
                return (val.nodeType() === NodeType.StringLiteral) && (stripQuotes((<StringLiteral>val).actualText) === stripQuotes(t2.name));
            }

            if (t1.isPrimitive() && (<PullPrimitiveTypeSymbol>t1).isStringConstant() && t2.isPrimitive() && (<PullPrimitiveTypeSymbol>t2).isStringConstant()) {
                // Both are string constants
                return TypeScript.stripQuotes(t1.name) === TypeScript.stripQuotes(t2.name);
            }

            if (t1.isPrimitive() || t2.isPrimitive()) {
                return false;
            }

            if (t1.isClass()) {
                return false;
            }

            if (t1.isError() && t2.isError()) {
                return true;
            }

            if (t1.isTypeParameter()) {

                if (!t2.isTypeParameter()) {
                    return false;
                }

                // We compare parent declarations instead of container symbols because type parameter symbols are shared
                // accross overload groups
                var t1ParentDeclaration = t1.getDeclarations()[0].getParentDecl();
                var t2ParentDeclaration = t2.getDeclarations()[0].getParentDecl();

                if (t1ParentDeclaration === t2ParentDeclaration) {
                    return this.symbolsShareDeclaration(t1, t2);
                }
                else {
                    return true;
                }
            }

            var comboId = t2.pullSymbolIDString + "#" + t1.pullSymbolIDString;

            if (this.identicalCache[comboId] != undefined) {
                return true;
            }

            // If one is an enum, and they're not the same type, they're not identical
            if ((t1.kind & PullElementKind.Enum) || (t2.kind & PullElementKind.Enum)) {
                return t1.getAssociatedContainerType() === t2 || t2.getAssociatedContainerType() === t1;
            }

            if (t1.isArray() || t2.isArray()) {
                if (!(t1.isArray() && t2.isArray())) {
                    return false;
                }
                this.identicalCache[comboId] = false;
                var ret = this.typesAreIdentical(t1.getElementType(), t2.getElementType());
                if (ret) {
                    this.identicalCache[comboId] = true;
                }
                else {
                    this.identicalCache[comboId] = undefined;
                }

                return ret;
            }

            if (t1.isPrimitive() != t2.isPrimitive()) {
                return false;
            }

            this.identicalCache[comboId] = false;

            // properties are identical in name, optionality, and type
            if (t1.hasMembers() && t2.hasMembers()) {
                var t1Members = t1.getMembers();
                var t2Members = t2.getMembers();

                if (t1Members.length != t2Members.length) {
                    this.identicalCache[comboId] = undefined;
                    return false;
                }

                var t1MemberSymbol: PullSymbol = null;
                var t2MemberSymbol: PullSymbol = null;

                var t1MemberType: PullTypeSymbol = null;
                var t2MemberType: PullTypeSymbol = null;

                for (var iMember = 0; iMember < t1Members.length; iMember++) {

                    t1MemberSymbol = t1Members[iMember];
                    t2MemberSymbol = this.getMemberSymbol(t1MemberSymbol.name, PullElementKind.SomeValue, t2);

                    if (!t2MemberSymbol || (t1MemberSymbol.isOptional != t2MemberSymbol.isOptional)) {
                        this.identicalCache[comboId] = undefined;
                        return false;
                    }

                    t1MemberType = t1MemberSymbol.type;
                    t2MemberType = t2MemberSymbol.type;

                    // catch the mutually recursive or cached cases
                    if (t1MemberType && t2MemberType && (this.identicalCache[t2MemberType.pullSymbolIDString + "#" + t1MemberType.pullSymbolIDString] != undefined)) {
                        continue;
                    }

                    if (!this.typesAreIdentical(t1MemberType, t2MemberType)) {
                        this.identicalCache[comboId] = undefined;
                        return false;
                    }
                }
            }
            else if (t1.hasMembers() || t2.hasMembers()) {
                this.identicalCache[comboId] = undefined;
                return false;
            }

            var t1CallSigs = t1.getCallSignatures();
            var t2CallSigs = t2.getCallSignatures();

            var t1ConstructSigs = t1.getConstructSignatures();
            var t2ConstructSigs = t2.getConstructSignatures();

            var t1IndexSigs = t1.getIndexSignatures();
            var t2IndexSigs = t2.getIndexSignatures();

            if (!this.signatureGroupsAreIdentical(t1CallSigs, t2CallSigs)) {
                this.identicalCache[comboId] = undefined;
                return false;
            }

            if (!this.signatureGroupsAreIdentical(t1ConstructSigs, t2ConstructSigs)) {
                this.identicalCache[comboId] = undefined;
                return false;
            }

            if (!this.signatureGroupsAreIdentical(t1IndexSigs, t2IndexSigs)) {
                this.identicalCache[comboId] = undefined;
                return false;
            }

            this.identicalCache[comboId] = true;
            return true;
        }

        private signatureGroupsAreIdentical(sg1: PullSignatureSymbol[], sg2: PullSignatureSymbol[]) {

            // covers the null case
            if (sg1 === sg2) {
                return true;
            }

            // covers the mixed-null case
            if (!sg1 || !sg2) {
                return false;
            }

            if (sg1.length != sg2.length) {
                return false;
            }

            var sig1: PullSignatureSymbol = null;
            var sig2: PullSignatureSymbol = null;
            var sigsMatch = false;

            // The signatures in the signature group may not be ordered...
            // REVIEW: Should definition signatures be required to be identical as well?
            for (var iSig1 = 0; iSig1 < sg1.length; iSig1++) {
                sig1 = sg1[iSig1];

                for (var iSig2 = 0; iSig2 < sg2.length; iSig2++) {
                    sig2 = sg2[iSig2];

                    if (this.signaturesAreIdentical(sig1, sig2)) {
                        sigsMatch = true;
                        break;
                    }
                }

                if (sigsMatch) {
                    sigsMatch = false;
                    continue;
                }

                // no match found for a specific signature
                return false;
            }

            return true;
        }

        public signaturesAreIdentical(s1: PullSignatureSymbol, s2: PullSignatureSymbol, includingReturnType = true) {

            if (s1.hasVarArgs != s2.hasVarArgs) {
                return false;
            }

            if (s1.nonOptionalParamCount != s2.nonOptionalParamCount) {
                return false;
            }

            var s1Params = s1.parameters;
            var s2Params = s2.parameters;

            if (s1Params.length != s2Params.length) {
                return false;
            }

            if (includingReturnType && !this.typesAreIdentical(s1.returnType, s2.returnType)) {
                return false;
            }

            for (var iParam = 0; iParam < s1Params.length; iParam++) {
                if (!this.typesAreIdentical(s1Params[iParam].type, s2Params[iParam].type)) {
                    return false;
                }
            }

            return true;
        }

        // Assignment Compatibility and Subtyping

        public substituteUpperBoundForType(type: PullTypeSymbol) {
            if (!type || !type.isTypeParameter()) {
                return type;
            }

            var constraint = (<PullTypeParameterSymbol>type).getConstraint();

            if (constraint) {
                return this.substituteUpperBoundForType(constraint);
            }

            if (this.cachedObjectInterfaceType()) {
                return this.cachedObjectInterfaceType();
            }

            return type;
        }

        private symbolsShareDeclaration(symbol1: PullSymbol, symbol2: PullSymbol) {
            var decls1 = symbol1.getDeclarations();
            var decls2 = symbol2.getDeclarations();

            if (decls1.length && decls2.length) {
                return decls1[0].isEqual(decls2[0]);
            }

            return false;
        }

        public sourceIsSubtypeOfTarget(source: PullTypeSymbol, target: PullTypeSymbol, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.sourceIsRelatableToTarget(source, target, false, this.subtypeCache, context, comparisonInfo);
        }

        public sourceMembersAreSubtypeOfTargetMembers(source: PullTypeSymbol, target: PullTypeSymbol, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.sourceMembersAreRelatableToTargetMembers(source, target, false, this.subtypeCache, context, comparisonInfo);
        }

        public sourcePropertyIsSubtypeOfTargetProperty(source: PullTypeSymbol, target: PullTypeSymbol,
            sourceProp: PullSymbol, targetProp: PullSymbol, context: PullTypeResolutionContext,
            comparisonInfo?: TypeComparisonInfo) {
            return this.sourcePropertyIsRelatableToTargetProperty(source, target, sourceProp, targetProp,
                false, this.subtypeCache, context, comparisonInfo);
        }

        public sourceCallSignaturesAreSubtypeOfTargetCallSignatures(source: PullTypeSymbol, target: PullTypeSymbol,
            context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.sourceCallSignaturesAreRelatableToTargetCallSignatures(source, target, false, this.subtypeCache, context, comparisonInfo);
        }

        public sourceConstructSignaturesAreSubtypeOfTargetConstructSignatures(source: PullTypeSymbol, target: PullTypeSymbol,
            context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.sourceConstructSignaturesAreRelatableToTargetConstructSignatures(source, target, false, this.subtypeCache, context, comparisonInfo);
        }

        public sourceIndexSignaturesAreSubtypeOfTargetIndexSignatures(source: PullTypeSymbol, target: PullTypeSymbol,
            context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.sourceIndexSignaturesAreRelatableToTargetIndexSignatures(source, target, false, this.subtypeCache, context, comparisonInfo);
        }

        public typeIsSubtypeOfFunction(source: PullTypeSymbol, context): boolean {

            var callSignatures = source.getCallSignatures();

            if (callSignatures.length) {
                return true;
            }

            var constructSignatures = source.getConstructSignatures();

            if (constructSignatures.length) {
                return true;
            }

            if (this.cachedFunctionInterfaceType()) {
                return this.sourceIsSubtypeOfTarget(source, this.cachedFunctionInterfaceType(), context);
            }

            return false;
        }

        private signatureGroupIsSubtypeOfTarget(sg1: PullSignatureSymbol[], sg2: PullSignatureSymbol[], context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.signatureGroupIsRelatableToTarget(sg1, sg2, false, this.subtypeCache, context, comparisonInfo);
        }

        public signatureIsSubtypeOfTarget(s1: PullSignatureSymbol, s2: PullSignatureSymbol, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            return this.signatureIsRelatableToTarget(s1, s2, false, this.subtypeCache, context, comparisonInfo);
        }

        public sourceIsAssignableToTarget(source: PullTypeSymbol, target: PullTypeSymbol, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo, isInProvisionalResolution: boolean = false): boolean {
            var cache = isInProvisionalResolution ? {} : this.assignableCache;
            return this.sourceIsRelatableToTarget(source, target, true, cache, context, comparisonInfo);
        }

        private signatureGroupIsAssignableToTarget(sg1: PullSignatureSymbol[], sg2: PullSignatureSymbol[], context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo): boolean {
            return this.signatureGroupIsRelatableToTarget(sg1, sg2, true, this.assignableCache, context, comparisonInfo);
        }

        public signatureIsAssignableToTarget(s1: PullSignatureSymbol, s2: PullSignatureSymbol, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo): boolean {
            return this.signatureIsRelatableToTarget(s1, s2, true, this.assignableCache, context, comparisonInfo);
        }

        private sourceIsRelatableToTarget(source: PullTypeSymbol, target: PullTypeSymbol, assignableTo: boolean, comparisonCache: any, context: PullTypeResolutionContext, comparisonInfo: TypeComparisonInfo): boolean {

            // REVIEW: Does this check even matter?
            //if (this.typesAreIdentical(source, target)) {
            //    return true;
            //}
            if (source === target) {
                return true;
            }

            // An error has already been reported in this case
            if (!(source && target)) {
                return true;
            }

            if (context.specializingToAny && (target.isTypeParameter() || source.isTypeParameter())) {
                return true;
            }

            if (context.specializingToObject) {
                if (target.isTypeParameter()) {
                    target = this.cachedObjectInterfaceType();
                }
                if (source.isTypeParameter()) {
                    target = this.cachedObjectInterfaceType();
                }
            }

            //source = this.substituteUpperBoundForType(source);
            //target = this.substituteUpperBoundForType(target);

            var sourceSubstitution: PullTypeSymbol = source;

            // We substitute for the source in the following ways:
            //  - When source is the primitive type Number, Boolean, or String, sourceSubstitution is the global interface type
            //      'Number', 'Boolean', or 'String'
            //  - When source is an enum type, sourceSubstitution is the global interface type 'Number'
            //  - When source is a type parameter, sourceSubstituion is the constraint of that type parameter
            if (source == this.semanticInfoChain.stringTypeSymbol && this.cachedStringInterfaceType()) {
                if (!this.cachedStringInterfaceType().isResolved) {
                    this.resolveDeclaredSymbol(this.cachedStringInterfaceType(), null, context);
                }
                sourceSubstitution = this.cachedStringInterfaceType();
            }
            else if (source == this.semanticInfoChain.numberTypeSymbol && this.cachedNumberInterfaceType()) {
                if (!this.cachedNumberInterfaceType().isResolved) {
                    this.resolveDeclaredSymbol(this.cachedNumberInterfaceType(), null, context);
                }
                sourceSubstitution = this.cachedNumberInterfaceType();
            }
            else if (source == this.semanticInfoChain.booleanTypeSymbol && this.cachedBooleanInterfaceType()) {
                if (!this.cachedBooleanInterfaceType().isResolved) {
                    this.resolveDeclaredSymbol(this.cachedBooleanInterfaceType(), null, context);
                }
                sourceSubstitution = this.cachedBooleanInterfaceType();
            }
            else if (PullHelpers.symbolIsEnum(source) && this.cachedNumberInterfaceType()) {
                sourceSubstitution = this.cachedNumberInterfaceType();
            }
            else if (source.isTypeParameter()) {
                sourceSubstitution = this.substituteUpperBoundForType(source);
            }

            var comboId = source.pullSymbolIDString + "#" + target.pullSymbolIDString;

            // In the case of a 'false', we want to short-circuit a recursive typecheck
            if (comparisonCache[comboId] != undefined) {
                return true;
            }

            // this is one difference between subtyping and assignment compatibility
            if (assignableTo) {
                if (this.isAnyOrEquivalent(source) || this.isAnyOrEquivalent(target)) {
                    return true;
                }

                if (source === this.semanticInfoChain.stringTypeSymbol && target.isPrimitive() && (<PullPrimitiveTypeSymbol>target).isStringConstant()) {
                    return comparisonInfo &&
                        comparisonInfo.stringConstantVal &&
                        (comparisonInfo.stringConstantVal.nodeType() === NodeType.StringLiteral) &&
                        (stripQuotes((<StringLiteral>comparisonInfo.stringConstantVal).actualText) === stripQuotes(target.name));
                }
            }
            else {
                // This is one difference between assignment compatibility and subtyping
                if (this.isAnyOrEquivalent(target)) {
                    return true;
                }

                if (target === this.semanticInfoChain.stringTypeSymbol && source.isPrimitive() && (<PullPrimitiveTypeSymbol>source).isStringConstant()) {
                    return true;
                }
            }

            if (source.isPrimitive() && (<PullPrimitiveTypeSymbol>source).isStringConstant() && target.isPrimitive() && (<PullPrimitiveTypeSymbol>target).isStringConstant()) {
                // Both are string constants
                return TypeScript.stripQuotes(source.name) === TypeScript.stripQuotes(target.name);
            }

            if (source === this.semanticInfoChain.undefinedTypeSymbol) {
                return true;
            }

            if ((source === this.semanticInfoChain.nullTypeSymbol) && (target != this.semanticInfoChain.undefinedTypeSymbol && target != this.semanticInfoChain.voidTypeSymbol)) {
                return true;
            }

            if (target == this.semanticInfoChain.voidTypeSymbol) {
                if (source == this.semanticInfoChain.anyTypeSymbol || source == this.semanticInfoChain.undefinedTypeSymbol || source == this.semanticInfoChain.nullTypeSymbol) {
                    return true;
                }

                return false;
            }
            else if (source == this.semanticInfoChain.voidTypeSymbol) {
                if (target == this.semanticInfoChain.anyTypeSymbol) {
                    return true;
                }

                return false;
            }

            if (target === this.semanticInfoChain.numberTypeSymbol && PullHelpers.symbolIsEnum(source)) {
                return true;
            }

            // REVIEW: We allow this only for enum initialization purposes
            if (source === this.semanticInfoChain.numberTypeSymbol && PullHelpers.symbolIsEnum(target)) {
                return true;
            }

            if (PullHelpers.symbolIsEnum(target) && PullHelpers.symbolIsEnum(source)) {
                return this.symbolsShareDeclaration(target, source);
            }

            if ((source.kind & PullElementKind.Enum) || (target.kind & PullElementKind.Enum)) {
                return false;
            }

            if (source.isArray() && target.isArray()) {
                comparisonCache[comboId] = false;
                var ret = this.sourceIsRelatableToTarget(source.getElementType(), target.getElementType(), assignableTo, comparisonCache, context, comparisonInfo);
                if (ret) {
                    comparisonCache[comboId] = true;
                }
                else {
                    comparisonCache[comboId] = undefined;
                }

                return ret;
            }
            else if (source.isArray() && target == this.cachedArrayInterfaceType()) {
                return true;
            }
            else if (target.isArray() && source == this.cachedArrayInterfaceType()) {
                return true;
            }

            // this check ensures that we only operate on object types from this point forward,
            // since the checks involving primitives occurred above
            if (source.isPrimitive() && target.isPrimitive()) {

                // we already know that they're not the same, and that neither is 'any'
                return false;
            }
            else if (source.isPrimitive() != target.isPrimitive()) {
                if (target.isPrimitive()) {
                    return false;
                }
            }

            if (target.isTypeParameter()) {

                // if the source is another type parameter (with no constraints), they can only be assignable if they share
                // a declaration
                if (source.isTypeParameter() && (source == sourceSubstitution)) {
                    // We compare parent declarations instead of container symbols because type parameter symbols are shared
                    // accross overload groups
                    var targetParentDeclaration = target.getDeclarations()[0].getParentDecl();
                    var sourceParentDeclaration = source.getDeclarations()[0].getParentDecl();

                    if (targetParentDeclaration !== sourceParentDeclaration) {
                        return this.symbolsShareDeclaration(target, source);
                    }
                    else {
                        return true;
                    }
                }
                else {
                    // if the source is not another type parameter, and we're specializing at a constraint site, we consider the
                    // target to be a subtype of its constraint
                    if (context.isComparingSpecializedSignatures) {
                        target = this.substituteUpperBoundForType(target);
                    }
                    else {
                        return false;
                    }
                }
            }

            comparisonCache[comboId] = false;

            if (sourceSubstitution.hasBase(target)) {
                comparisonCache[comboId] = true;
                return true;
            }

            if (this.cachedObjectInterfaceType() && target === this.cachedObjectInterfaceType()) {
                return true;
            }

            if (this.cachedFunctionInterfaceType() && (sourceSubstitution.getCallSignatures().length || sourceSubstitution.getConstructSignatures().length) && target === this.cachedFunctionInterfaceType()) {
                return true;
            }

            if (target.hasMembers() && !this.sourceMembersAreRelatableToTargetMembers(sourceSubstitution, target, assignableTo, comparisonCache, context, comparisonInfo)) {
                comparisonCache[comboId] = undefined;
                return false;
            }

            if (!this.sourceCallSignaturesAreRelatableToTargetCallSignatures(sourceSubstitution, target, assignableTo, comparisonCache, context, comparisonInfo)) {
                comparisonCache[comboId] = undefined;
                return false;
            }

            if (!this.sourceConstructSignaturesAreRelatableToTargetConstructSignatures(sourceSubstitution, target, assignableTo, comparisonCache, context, comparisonInfo)) {
                comparisonCache[comboId] = undefined;
                return false;
            }

            if (!this.sourceIndexSignaturesAreRelatableToTargetIndexSignatures(sourceSubstitution, target, assignableTo, comparisonCache, context, comparisonInfo)) {
                comparisonCache[comboId] = undefined;
                return false;
            }

            comparisonCache[comboId] = true;
            return true;
        }

        private sourceMembersAreRelatableToTargetMembers(source: PullTypeSymbol, target: PullTypeSymbol, assignableTo: boolean,
            comparisonCache: any, context: PullTypeResolutionContext, comparisonInfo: TypeComparisonInfo): boolean {
            var targetProps = target.getAllMembers(PullElementKind.SomeValue, true);

            for (var itargetProp = 0; itargetProp < targetProps.length; itargetProp++) {

                var targetProp = targetProps[itargetProp];
                var sourceProp = this.getMemberSymbol(targetProp.name, PullElementKind.SomeValue, source);

                if (!targetProp.isResolved) {
                    this.resolveDeclaredSymbol(targetProp, null, context);
                }

                var targetPropType = targetProp.type;

                if (!sourceProp) {
                    // If it's not present on the type in question, look for the property on 'Object'
                    if (this.cachedObjectInterfaceType()) {
                        sourceProp = this.getMemberSymbol(targetProp.name, PullElementKind.SomeValue, this.cachedObjectInterfaceType());
                    }

                    if (!sourceProp) {
                        // Now, the property was not found on Object, but the type in question is a function, look
                        // for it on function
                        if (this.cachedFunctionInterfaceType() && (targetPropType.getCallSignatures().length || targetPropType.getConstructSignatures().length)) {
                            sourceProp = this.getMemberSymbol(targetProp.name, PullElementKind.SomeValue, this.cachedFunctionInterfaceType());
                        }

                        // finally, check to see if the property is optional
                        if (!sourceProp) {
                            if (!(targetProp.isOptional)) {
                                if (comparisonInfo) { // only surface the first error
                                    comparisonInfo.flags |= TypeRelationshipFlags.RequiredPropertyIsMissing;
                                    comparisonInfo.addMessage(getDiagnosticMessage(DiagnosticCode.Type_0_is_missing_property_1_from_type_2,
                                        [source.toString(), targetProp.getScopedNameEx().toString(), target.toString()]));
                                }
                                return false;
                            }
                            continue;
                        }
                    }
                }

                if (!this.sourcePropertyIsRelatableToTargetProperty(source, target, sourceProp, targetProp, assignableTo,
                    comparisonCache, context, comparisonInfo)) {
                    return false;
                }
            }

            return true;
        }

        private sourcePropertyIsRelatableToTargetProperty(source: PullTypeSymbol, target: PullTypeSymbol,
            sourceProp: PullSymbol, targetProp: PullSymbol, assignableTo: boolean, comparisonCache: any,
            context: PullTypeResolutionContext, comparisonInfo: TypeComparisonInfo): boolean {
            var targetPropIsPrivate = targetProp.hasFlag(PullElementFlags.Private);
            var sourcePropIsPrivate = sourceProp.hasFlag(PullElementFlags.Private);

            // if visibility doesn't match, the types don't match
            if (targetPropIsPrivate != sourcePropIsPrivate) {
                if (comparisonInfo) { // only surface the first error
                    if (targetPropIsPrivate) {
                        // Overshadowing property in source that is already defined as private in target
                        comparisonInfo.addMessage(getDiagnosticMessage(DiagnosticCode.Property_0_defined_as_public_in_type_1_is_defined_as_private_in_type_2,
                            [targetProp.getScopedNameEx().toString(), sourceProp.getContainer().toString(), targetProp.getContainer().toString()]));
                    } else {
                        // Public property of target is private in source
                        comparisonInfo.addMessage(getDiagnosticMessage(DiagnosticCode.Property_0_defined_as_private_in_type_1_is_defined_as_public_in_type_2,
                            [targetProp.getScopedNameEx().toString(), sourceProp.getContainer().toString(), targetProp.getContainer().toString()]));
                    }
                    comparisonInfo.flags |= TypeRelationshipFlags.InconsistantPropertyAccesibility;
                }
                return false;
            }
            // if both are private members, test to ensure that they share a declaration
            else if (sourcePropIsPrivate && targetPropIsPrivate) {
                var targetDecl = targetProp.getDeclarations()[0];
                var sourceDecl = sourceProp.getDeclarations()[0];

                if (!targetDecl.isEqual(sourceDecl)) {
                    if (comparisonInfo) {
                        // Both types define property with same name as private
                        comparisonInfo.flags |= TypeRelationshipFlags.InconsistantPropertyAccesibility;
                        comparisonInfo.addMessage(getDiagnosticMessage(DiagnosticCode.Types_0_and_1_define_property_2_as_private,
                            [sourceProp.getContainer().toString(), targetProp.getContainer().toString(), targetProp.getScopedNameEx().toString()]));
                    }

                    return false;
                }
            }

            if (!sourceProp.isResolved) {
                this.resolveDeclaredSymbol(sourceProp, null, context);
            }

            var sourcePropType = sourceProp.type;
            var targetPropType = targetProp.type;

            // catch the mutually recursive or cached cases
                if (targetPropType && sourcePropType && (comparisonCache[sourcePropType.pullSymbolIDString + "#" + targetPropType.pullSymbolIDString] != undefined)) {
                return true;
            }

            var comparisonInfoPropertyTypeCheck: TypeComparisonInfo = null;
            if (comparisonInfo && !comparisonInfo.onlyCaptureFirstError) {
                comparisonInfoPropertyTypeCheck = new TypeComparisonInfo(comparisonInfo);
            }
            if (!this.sourceIsRelatableToTarget(sourcePropType, targetPropType, assignableTo, comparisonCache, context, comparisonInfoPropertyTypeCheck)) {
                if (comparisonInfo) {
                    comparisonInfo.flags |= TypeRelationshipFlags.IncompatiblePropertyTypes;
                    var message: string;
                    if (comparisonInfoPropertyTypeCheck && comparisonInfoPropertyTypeCheck.message) {
                        message = getDiagnosticMessage(DiagnosticCode.Types_of_property_0_of_types_1_and_2_are_incompatible_NL_3,
                            [targetProp.getScopedNameEx().toString(), source.toString(), target.toString(), comparisonInfoPropertyTypeCheck.message]);
                    } else {
                        message = getDiagnosticMessage(DiagnosticCode.Types_of_property_0_of_types_1_and_2_are_incompatible,
                            [targetProp.getScopedNameEx().toString(), source.toString(), target.toString()]);
                    }
                    comparisonInfo.addMessage(message);
                }

                return false;
            }

            return true;
        }

        private sourceCallSignaturesAreRelatableToTargetCallSignatures(source: PullTypeSymbol, target: PullTypeSymbol,
            assignableTo: boolean, comparisonCache: any, context: PullTypeResolutionContext,
            comparisonInfo: TypeComparisonInfo): boolean {

            var targetCallSigs = target.getCallSignatures();

            // check signature groups
            if (targetCallSigs.length) {
                var comparisonInfoSignatuesTypeCheck: TypeComparisonInfo = null;
                if (comparisonInfo && !comparisonInfo.onlyCaptureFirstError) {
                    comparisonInfoSignatuesTypeCheck = new TypeComparisonInfo(comparisonInfo);
                }

                var sourceCallSigs = source.getCallSignatures();
                if (!this.signatureGroupIsRelatableToTarget(sourceCallSigs, targetCallSigs, assignableTo, comparisonCache, context, comparisonInfoSignatuesTypeCheck)) {
                    if (comparisonInfo) {
                        var message: string;
                        if (sourceCallSigs.length && targetCallSigs.length) {
                            if (comparisonInfoSignatuesTypeCheck && comparisonInfoSignatuesTypeCheck.message) {
                                message = getDiagnosticMessage(DiagnosticCode.Call_signatures_of_types_0_and_1_are_incompatible_NL_2,
                                    [source.toString(), target.toString(), comparisonInfoSignatuesTypeCheck.message]);
                            } else {
                                message = getDiagnosticMessage(DiagnosticCode.Call_signatures_of_types_0_and_1_are_incompatible,
                                    [source.toString(), target.toString()]);
                            }
                        } else {
                            var hasSig = targetCallSigs.length ? target.toString() : source.toString();
                            var lacksSig = !targetCallSigs.length ? target.toString() : source.toString();
                            message = getDiagnosticMessage(DiagnosticCode.Type_0_requires_a_call_signature_but_type_1_lacks_one, [hasSig, lacksSig]);
                        }
                        comparisonInfo.flags |= TypeRelationshipFlags.IncompatibleSignatures;
                        comparisonInfo.addMessage(message);
                    }
                    return false;
                }
            }

            return true;
        }

        private sourceConstructSignaturesAreRelatableToTargetConstructSignatures(source: PullTypeSymbol, target: PullTypeSymbol,
            assignableTo: boolean, comparisonCache: any, context: PullTypeResolutionContext,
            comparisonInfo: TypeComparisonInfo): boolean {

            // check signature groups
            var targetConstructSigs = target.getConstructSignatures();
            if (targetConstructSigs.length) {
                var comparisonInfoSignatuesTypeCheck: TypeComparisonInfo = null;
                if (comparisonInfo && !comparisonInfo.onlyCaptureFirstError) {
                    comparisonInfoSignatuesTypeCheck = new TypeComparisonInfo(comparisonInfo);
                }

                var sourceConstructSigs = source.getConstructSignatures();
                if (!this.signatureGroupIsRelatableToTarget(sourceConstructSigs, targetConstructSigs, assignableTo, comparisonCache, context, comparisonInfoSignatuesTypeCheck)) {
                    if (comparisonInfo) {
                        var message: string;
                        if (sourceConstructSigs.length && targetConstructSigs.length) {
                            if (comparisonInfoSignatuesTypeCheck && comparisonInfoSignatuesTypeCheck.message) {
                                message = getDiagnosticMessage(DiagnosticCode.Construct_signatures_of_types_0_and_1_are_incompatible_NL_2,
                                    [source.toString(), target.toString(), comparisonInfoSignatuesTypeCheck.message]);
                            } else {
                                message = getDiagnosticMessage(DiagnosticCode.Construct_signatures_of_types_0_and_1_are_incompatible,
                                    [source.toString(), target.toString()]);
                            }
                        } else {
                            var hasSig = targetConstructSigs.length ? target.toString() : source.toString();
                            var lacksSig = !targetConstructSigs.length ? target.toString() : source.toString();
                            message = getDiagnosticMessage(DiagnosticCode.Type_0_requires_a_construct_signature_but_type_1_lacks_one, [hasSig, lacksSig]);
                        }
                        comparisonInfo.flags |= TypeRelationshipFlags.IncompatibleSignatures;
                        comparisonInfo.addMessage(message);
                    }
                    return false;
                }
            }

            return true;
        }

        private sourceIndexSignaturesAreRelatableToTargetIndexSignatures(source: PullTypeSymbol, target: PullTypeSymbol,
            assignableTo: boolean, comparisonCache: any, context: PullTypeResolutionContext,
            comparisonInfo: TypeComparisonInfo): boolean {

            var targetIndexSigs = target.getIndexSignatures();

            if (targetIndexSigs.length) {
                var sourceIndexSigs = source.getIndexSignatures();

                var targetIndex = !targetIndexSigs.length && this.cachedObjectInterfaceType() ? this.cachedObjectInterfaceType().getIndexSignatures() : targetIndexSigs;
                var sourceIndex = !sourceIndexSigs.length && this.cachedObjectInterfaceType() ? this.cachedObjectInterfaceType().getIndexSignatures() : sourceIndexSigs;

                var sourceStringSig: PullSignatureSymbol = null;
                var sourceNumberSig: PullSignatureSymbol = null;

                var targetStringSig: PullSignatureSymbol = null;
                var targetNumberSig: PullSignatureSymbol = null;

                var params: PullSymbol[];

                for (var i = 0; i < targetIndex.length; i++) {
                    if (targetStringSig && targetNumberSig) {
                        break;
                    }

                    params = targetIndex[i].parameters;

                    if (params.length) {
                        if (!targetStringSig && params[0].type === this.semanticInfoChain.stringTypeSymbol) {
                            targetStringSig = targetIndex[i];
                            continue;
                        }
                        else if (!targetNumberSig && params[0].type === this.semanticInfoChain.numberTypeSymbol) {
                            targetNumberSig = targetIndex[i];
                            continue;
                        }
                    }
                }

                for (var i = 0; i < sourceIndex.length; i++) {
                    if (sourceStringSig && sourceNumberSig) {
                        break;
                    }

                    params = sourceIndex[i].parameters;

                    if (params.length) {
                        if (!sourceStringSig && params[0].type === this.semanticInfoChain.stringTypeSymbol) {
                            sourceStringSig = sourceIndex[i];
                            continue;
                        }
                        else if (!sourceNumberSig && params[0].type === this.semanticInfoChain.numberTypeSymbol) {
                            sourceNumberSig = sourceIndex[i];
                            continue;
                        }
                    }
                }

                var comparable = true;
                var comparisonInfoSignatuesTypeCheck: TypeComparisonInfo = null;
                if (comparisonInfo && !comparisonInfo.onlyCaptureFirstError) {
                    comparisonInfoSignatuesTypeCheck = new TypeComparisonInfo(comparisonInfo);
                }

                if (targetStringSig) {
                    if (sourceStringSig) {
                        comparable = this.signatureIsAssignableToTarget(sourceStringSig, targetStringSig, context, comparisonInfoSignatuesTypeCheck);
                    }
                    else {
                        comparable = false;
                    }
                }

                if (comparable && targetNumberSig) {
                    if (sourceNumberSig) {
                        comparable = this.signatureIsAssignableToTarget(sourceNumberSig, targetNumberSig, context, comparisonInfoSignatuesTypeCheck);
                    }
                    else if (sourceStringSig) {
                        comparable = this.sourceIsAssignableToTarget(sourceStringSig.returnType, targetNumberSig.returnType, context, comparisonInfoSignatuesTypeCheck);
                    }
                    else {
                        comparable = false;
                    }
                }

                if (!comparable) {
                    if (comparisonInfo) {
                        var message: string;
                        if (comparisonInfoSignatuesTypeCheck && comparisonInfoSignatuesTypeCheck.message) {
                            message = getDiagnosticMessage(DiagnosticCode.Index_signatures_of_types_0_and_1_are_incompatible_NL_2,
                                [source.toString(), target.toString(), comparisonInfoSignatuesTypeCheck.message]);
                        } else {
                            message = getDiagnosticMessage(DiagnosticCode.Index_signatures_of_types_0_and_1_are_incompatible,
                                [source.toString(), target.toString()]);
                        }
                        comparisonInfo.flags |= TypeRelationshipFlags.IncompatibleSignatures;
                        comparisonInfo.addMessage(message);
                    }
                    return false;
                }
            }

            // if the target has a string signature, the source is object literal's type, the source's members must be comparable with it's return type
            if (targetStringSig && !source.isNamedTypeSymbol() && source.hasMembers()) {
                var targetReturnType = targetStringSig.returnType;
                var sourceMembers = source.getMembers();

                for (var i = 0; i < sourceMembers.length; i++) {
                    if (!this.sourceIsRelatableToTarget(sourceMembers[i].type, targetReturnType, assignableTo, comparisonCache, context, comparisonInfo)) {
                        return false;
                    }
                }
            }

            return true;
        }

        // REVIEW: TypeChanges: Return an error context object so the user can get better diagnostic info
        private signatureGroupIsRelatableToTarget(sourceSG: PullSignatureSymbol[], targetSG: PullSignatureSymbol[], assignableTo: boolean, comparisonCache: any, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {
            if (sourceSG === targetSG) {
                return true;
            }

            if (!(sourceSG.length && targetSG.length)) {
                return false;
            }

            var mSig: PullSignatureSymbol = null;
            var nSig: PullSignatureSymbol = null;
            var foundMatch = false;

            for (var iMSig = 0; iMSig < targetSG.length; iMSig++) {
                mSig = targetSG[iMSig];

                if (mSig.isStringConstantOverloadSignature()) {
                    continue;
                }

                for (var iNSig = 0; iNSig < sourceSG.length; iNSig++) {
                    nSig = sourceSG[iNSig];

                    if (nSig.isStringConstantOverloadSignature()) {
                        continue;
                    }

                    if (this.signatureIsRelatableToTarget(nSig, mSig, assignableTo, comparisonCache, context, comparisonInfo)) {
                        foundMatch = true;
                        break;
                    }
                }

                if (foundMatch) {
                    foundMatch = false;
                    continue;
                }
                return false;
            }

            return true;
        }

        private signatureIsRelatableToTarget(sourceSig: PullSignatureSymbol, targetSig: PullSignatureSymbol, assignableTo: boolean, comparisonCache: any, context: PullTypeResolutionContext, comparisonInfo?: TypeComparisonInfo) {

            var sourceParameters = sourceSig.parameters;
            var targetParameters = targetSig.parameters;

            if (!sourceParameters || !targetParameters) {
                return false;
            }

            var targetVarArgCount = /*targetSig.hasVarArgs ? targetSig.getNonOptionalParameterCount() - 1 :*/ targetSig.nonOptionalParamCount;
            var sourceVarArgCount = /*sourceSig.hasVarArgs ? sourceSig.getNonOptionalParameterCount() - 1 :*/ sourceSig.nonOptionalParamCount;

            if (sourceVarArgCount > targetVarArgCount && !targetSig.hasVarArgs) {
                if (comparisonInfo) {
                    comparisonInfo.flags |= TypeRelationshipFlags.SourceSignatureHasTooManyParameters;
                    comparisonInfo.addMessage(getDiagnosticMessage(DiagnosticCode.Call_signature_expects_0_or_fewer_parameters, [targetVarArgCount]));
                }
                return false;
            }

            var sourceReturnType = sourceSig.returnType;
            var targetReturnType = targetSig.returnType;

            var prevSpecializingToObject = context.specializingToObject;
            context.specializingToObject = true;

            if (targetReturnType != this.semanticInfoChain.voidTypeSymbol) {
                if (!this.sourceIsRelatableToTarget(sourceReturnType, targetReturnType, assignableTo, comparisonCache, context, comparisonInfo)) {
                    if (comparisonInfo) {
                        comparisonInfo.flags |= TypeRelationshipFlags.IncompatibleReturnTypes;
                        // No need to print this one here - it's printed as part of the signature error in sourceIsRelatableToTarget
                        //comparisonInfo.addMessage("Incompatible return types: '" + sourceReturnType.getTypeName() + "' and '" + targetReturnType.getTypeName() + "'");
                    }
                    context.specializingToObject = prevSpecializingToObject;
                    return false;
                }
            }

            // the clause 'sourceParameters.length > sourceVarArgCount' covers optional parameters, since even though the parameters are optional
            // they need to agree with the target params
            var len = (sourceVarArgCount < targetVarArgCount && (sourceSig.hasVarArgs || (sourceParameters.length > sourceVarArgCount))) ? targetVarArgCount : sourceVarArgCount;
            var sourceParamType: PullTypeSymbol = null;
            var targetParamType: PullTypeSymbol = null;
            var sourceParamName = "";
            var targetParamName = "";

            for (var iSource = 0, iTarget = 0; iSource < len; iSource++, iTarget++) {

                if (iSource < sourceParameters.length && (!sourceSig.hasVarArgs || iSource < sourceVarArgCount)) {
                    sourceParamType = sourceParameters[iSource].type;
                    sourceParamName = sourceParameters[iSource].name;
                }
                else if (iSource === sourceVarArgCount) {
                    sourceParamType = sourceParameters[iSource].type;
                    if (sourceParamType.isArray()) {
                        sourceParamType = sourceParamType.getElementType();
                    }
                    sourceParamName = sourceParameters[iSource].name;
                }

                if (iTarget < targetParameters.length && iTarget < targetVarArgCount) {
                    targetParamType = targetParameters[iTarget].type;
                    targetParamName = targetParameters[iTarget].name;
                }
                else if (targetSig.hasVarArgs && iTarget === targetVarArgCount) {
                    targetParamType = targetParameters[iTarget].type;

                    if (targetParamType.isArray()) {
                        targetParamType = targetParamType.getElementType();
                    }
                    targetParamName = targetParameters[iTarget].name;
                }

                if (sourceParamType && sourceParamType.isTypeParameter() && this.cachedObjectInterfaceType()) {
                    sourceParamType = this.cachedObjectInterfaceType();
                }
                if (targetParamType && targetParamType.isTypeParameter() && this.cachedObjectInterfaceType()) {
                    targetParamType = this.cachedObjectInterfaceType();
                }

                if (!(this.sourceIsRelatableToTarget(sourceParamType, targetParamType, assignableTo, comparisonCache, context, comparisonInfo) ||
                    this.sourceIsRelatableToTarget(targetParamType, sourceParamType, assignableTo, comparisonCache, context, comparisonInfo))) {

                    if (comparisonInfo) {
                        comparisonInfo.flags |= TypeRelationshipFlags.IncompatibleParameterTypes;
                    }
                    context.specializingToObject = prevSpecializingToObject;
                    return false;
                }
            }
            context.specializingToObject = prevSpecializingToObject;
            return true;
        }

        // Overload resolution

        private resolveOverloads(
            application: AST, group: PullSignatureSymbol[],
            enclosingDecl: PullDecl,
            haveTypeArgumentsAtCallSite: boolean,
            context: PullTypeResolutionContext,
            diagnostics: Diagnostic[]): PullSignatureSymbol {
            var rd = this.resolutionDataCache.getResolutionData();
            var actuals = rd.actuals;
            var exactCandidates = rd.exactCandidates;
            var conversionCandidates = rd.conversionCandidates;
            var candidate: PullSignatureSymbol = null;
            var hasOverloads = group.length > 1;
            var comparisonInfo = new TypeComparisonInfo();
            var args: ASTList = null;
            var target: AST = null;

            if (application.nodeType() === NodeType.InvocationExpression || application.nodeType() === NodeType.ObjectCreationExpression) {
                var callEx = <InvocationExpression>application;

                args = callEx.arguments;
                target = this.getLastIdentifierInTarget(callEx);

                if (callEx.arguments) {
                    var len = callEx.arguments.members.length;

                    for (var i = 0; i < len; i++) {
                        var argSym = this.resolveAST(callEx.arguments.members[i], false, enclosingDecl, context);
                        actuals[i] = argSym.type;
                    }
                }
            }
            else if (application.nodeType() === NodeType.ElementAccessExpression) {
                var binExp = <BinaryExpression>application;
                target = binExp.operand1;
                args = new ASTList([binExp.operand2]);

                var argSym = this.resolveAST(args.members[0], false, enclosingDecl, context);
                actuals[0] = argSym.type;
            }

            var signature: PullSignatureSymbol;
            var returnType: PullTypeSymbol;
            var candidateInfo: { sig: PullSignatureSymbol; ambiguous: boolean; };

            for (var j = 0, groupLen = group.length; j < groupLen; j++) {
                signature = group[j];
                if ((hasOverloads && signature.isDefinition()) || (haveTypeArgumentsAtCallSite && !signature.isGeneric())) {
                    continue;
                }

                returnType = signature.returnType;

                this.getCandidateSignatures(signature, actuals, args, exactCandidates, conversionCandidates, enclosingDecl, context, comparisonInfo);
            }
            if (exactCandidates.length === 0) {
                var applicableCandidates = this.getApplicableSignaturesFromCandidates(conversionCandidates, args, comparisonInfo, enclosingDecl, context);
                if (applicableCandidates.length > 0) {
                    candidateInfo = this.findMostApplicableSignature(applicableCandidates, args, enclosingDecl, context);
                    //if (candidateInfo.ambiguous) {
                    //    //this.errorReporter.simpleError(target, "Ambiguous call expression - could not choose overload");
                    //    context.postError(application.minChar, application.getLength(), this.unitPath, "Ambiguous call expression - could not choose overload", enclosingDecl, true);
                    //}
                    candidate = candidateInfo.sig;
                }
                else {
                    if (comparisonInfo.message) {
                        diagnostics.push(context.postError(this.unitPath, target.minChar, target.getLength(),
                            DiagnosticCode.Supplied_parameters_do_not_match_any_signature_of_call_target_NL_0, [comparisonInfo.message]));
                    }
                    else {
                        diagnostics.push(context.postError(this.unitPath, target.minChar, target.getLength(),
                            DiagnosticCode.Supplied_parameters_do_not_match_any_signature_of_call_target, null));
                    }
                }
            }
            else {
                if (exactCandidates.length > 1) {
                    var applicableSigs: PullApplicableSignature[] = [];
                    for (var i = 0; i < exactCandidates.length; i++) {
                        applicableSigs[i] = { signature: exactCandidates[i], hadProvisionalErrors: false };
                    }
                    candidateInfo = this.findMostApplicableSignature(applicableSigs, args, enclosingDecl, context);
                    //if (candidateInfo.ambiguous) {
                    //    //this.checker.errorReporter.simpleError(target, "Ambiguous call expression - could not choose overload");
                    //    context.postError(application.minChar, application.getLength(), this.unitPath, "Ambiguous call expression - could not choose overload", enclosingDecl, true);
                    //}
                    candidate = candidateInfo.sig;
                }
                else {
                    candidate = exactCandidates[0];
                }
            }

            this.resolutionDataCache.returnResolutionData(rd);
            return candidate;
        }

        private getLastIdentifierInTarget(callEx: ICallExpression): AST {
            return (callEx.target.nodeType() === NodeType.MemberAccessExpression) ? (<BinaryExpression>callEx.target).operand2 : callEx.target;
        }

        private getCandidateSignatures(signature: PullSignatureSymbol, actuals: PullTypeSymbol[], args: ASTList, exactCandidates: PullSignatureSymbol[], conversionCandidates: PullSignatureSymbol[], enclosingDecl: PullDecl, context: PullTypeResolutionContext, comparisonInfo: TypeComparisonInfo): void {
            var parameters = signature.parameters;
            var lowerBound = signature.nonOptionalParamCount; // required parameters
            var upperBound = parameters.length; // required and optional parameters
            var formalLen = lowerBound;
            var acceptable = false;

            if ((actuals.length >= lowerBound) && (signature.hasVarArgs || actuals.length <= upperBound)) {
                formalLen = (signature.hasVarArgs ? parameters.length : actuals.length);
                acceptable = true;
            }

            var repeatType: PullTypeSymbol = null;

            if (acceptable) {
                // assumed structure here is checked when signature is formed
                if (signature.hasVarArgs) {
                    formalLen -= 1;
                    repeatType = parameters[formalLen].type;
                    repeatType = repeatType.getElementType();
                    acceptable = actuals.length >= (formalLen < lowerBound ? formalLen : lowerBound);
                }
                var len = actuals.length;

                var exact = acceptable;
                var convert = acceptable;

                var typeA: PullTypeSymbol;
                var typeB: PullTypeSymbol;

                for (var i = 0; i < len; i++) {

                    if (i < formalLen) {
                        typeA = parameters[i].type;
                    }
                    else {
                        typeA = repeatType;
                    }

                    typeB = actuals[i];

                    if (typeA && !typeA.isResolved) {
                        this.resolveDeclaredSymbol(typeA, enclosingDecl, context);
                    }

                    if (typeB && !typeB.isResolved) {
                        this.resolveDeclaredSymbol(typeB, enclosingDecl, context);
                    }

                    if (!typeA || !typeB || !(this.typesAreIdentical(typeA, typeB, args.members[i]))) {
                        exact = false;
                    }

                    comparisonInfo.stringConstantVal = args.members[i];

                    // is the argument assignable to the parameter?
                    if (!this.sourceIsAssignableToTarget(typeB, typeA, context, comparisonInfo)) {
                        convert = false;
                    }

                    comparisonInfo.stringConstantVal = null;

                    if (!(exact || convert)) {
                        break;
                    }
                }
                if (exact) {
                    exactCandidates[exactCandidates.length] = signature;
                }
                else if (convert && (exactCandidates.length === 0)) {
                    conversionCandidates[conversionCandidates.length] = signature;
                }
            }
        }

        private getApplicableSignaturesFromCandidates(candidateSignatures: PullSignatureSymbol[],
            args: ASTList,
            comparisonInfo: TypeComparisonInfo,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext): PullApplicableSignature[] {

            var applicableSigs: PullApplicableSignature[] = [];
            var memberType: PullTypeSymbol = null;
            var miss = false;
            var cxt: PullContextualTypeContext = null;
            var hadProvisionalErrors = false;

            var parameters: PullSymbol[];
            var signature: PullSignatureSymbol;
            var argSym: PullSymbol;

            for (var i = 0; i < candidateSignatures.length; i++) {
                miss = false;

                signature = candidateSignatures[i];
                parameters = signature.parameters;

                for (var j = 0; j < args.members.length; j++) {

                    if (j >= parameters.length) {
                        continue;
                    }

                    if (!parameters[j].isResolved) {
                        this.resolveDeclaredSymbol(parameters[j], enclosingDecl, context);
                    }

                    memberType = parameters[j].type;

                    // account for varargs
                    if (signature.hasVarArgs && (j >= signature.nonOptionalParamCount) && memberType.isArray()) {
                        memberType = memberType.getElementType();
                    }

                    if (this.isAnyOrEquivalent(memberType)) {
                        continue;
                    }
                    else if (args.members[j].nodeType() === NodeType.FunctionDeclaration) {

                        if (this.cachedFunctionInterfaceType() && memberType === this.cachedFunctionInterfaceType()) {
                            continue;
                        }

                        argSym = this.resolveFunctionExpression(<FunctionDeclaration>args.members[j], false, enclosingDecl, context);

                        if (!this.canApplyContextualTypeToFunction(memberType, <FunctionDeclaration>args.members[j], true)) {
                            // if it's just annotations that are blocking us, typecheck the function and add it to the list
                            if (this.canApplyContextualTypeToFunction(memberType, <FunctionDeclaration>args.members[j], false)) {
                                if (!this.sourceIsAssignableToTarget(argSym.type, memberType, context, comparisonInfo, /*isInProvisionalResolution*/ true)) {
                                    break;
                                }
                            }
                            else {
                                break;
                            }
                        }
                        else { // if it can be contextually typed, try it out...
                            argSym.invalidate();
                            context.pushContextualType(memberType, true, null);

                            argSym = this.resolveFunctionExpression(<FunctionDeclaration>args.members[j], true, enclosingDecl, context);

                            if (!this.sourceIsAssignableToTarget(argSym.type, memberType, context, comparisonInfo, /*isInProvisionalResolution*/ true)) {
                                if (comparisonInfo) {
                                    comparisonInfo.setMessage(getDiagnosticMessage(DiagnosticCode.Could_not_apply_type_0_to_argument_1_which_is_of_type_2,
                                        [memberType.toString(), (j + 1), argSym.getTypeName()]));
                                }
                                miss = true;
                            }
                            argSym.invalidate();
                            cxt = context.popContextualType();
                            hadProvisionalErrors = cxt.hadProvisionalErrors();

                            //this.resetProvisionalErrors();
                            if (miss) {
                                break;
                            }
                        }
                    }
                    else if (args.members[j].nodeType() === NodeType.ObjectLiteralExpression) {
                        // now actually attempt to typecheck as the contextual type
                        if (this.cachedObjectInterfaceType() && memberType === this.cachedObjectInterfaceType()) {
                            continue;
                        }

                        context.pushContextualType(memberType, true, null);
                        argSym = this.resolveObjectLiteralExpression(args.members[j], true, enclosingDecl, context);

                        if (!this.sourceIsAssignableToTarget(argSym.type, memberType, context, comparisonInfo, /*isInProvisionalResolution*/ true)) {
                            if (comparisonInfo) {
                                comparisonInfo.setMessage(getDiagnosticMessage(DiagnosticCode.Could_not_apply_type_0_to_argument_1_which_is_of_type_2,
                                    [memberType.toString(), (j + 1), argSym.getTypeName()]));
                            }

                            miss = true;
                        }

                        argSym.invalidate();
                        cxt = context.popContextualType();
                        hadProvisionalErrors = cxt.hadProvisionalErrors();

                        //this.resetProvisionalErrors();
                        if (miss) {
                            break;
                        }
                    }
                    else if (args.members[j].nodeType() === NodeType.ArrayLiteralExpression) {
                        // attempt to contextually type the array literal
                        if (memberType === this.cachedArrayInterfaceType()) {
                            continue;
                        }

                        context.pushContextualType(memberType, true, null);
                        var argSym = this.resolveArrayLiteralExpression(<UnaryExpression>args.members[j], true, enclosingDecl, context);

                        if (!this.sourceIsAssignableToTarget(argSym.type, memberType, context, comparisonInfo, /*isInProvisionalResolution*/ true)) {
                            if (comparisonInfo) {
                                comparisonInfo.setMessage(getDiagnosticMessage(DiagnosticCode.Could_not_apply_type_0_to_argument_1_which_is_of_type_2,
                                    [memberType.toString(), (j + 1), argSym.getTypeName()]));
                            }
                            break;
                        }

                        argSym.invalidate();
                        cxt = context.popContextualType();

                        hadProvisionalErrors = cxt.hadProvisionalErrors();

                        if (miss) {
                            break;
                        }
                    }
                }

                if (j === args.members.length) {
                    applicableSigs[applicableSigs.length] = { signature: candidateSignatures[i], hadProvisionalErrors: hadProvisionalErrors };
                }

                hadProvisionalErrors = false;
            }

            return applicableSigs;
        }

        private findMostApplicableSignature(signatures: PullApplicableSignature[], args: ASTList, enclosingDecl: PullDecl, context: PullTypeResolutionContext): { sig: PullSignatureSymbol; ambiguous: boolean; } {

            if (signatures.length === 1) {
                return { sig: signatures[0].signature, ambiguous: false };
            }

            var best: PullApplicableSignature = signatures[0];
            var Q: PullApplicableSignature = null;

            var AType: PullTypeSymbol = null;
            var PType: PullTypeSymbol = null;
            var QType: PullTypeSymbol = null;

            var ambiguous = false;

            var bestParams: PullSymbol[];
            var qParams: PullSymbol[];

            for (var qSig = 1; qSig < signatures.length; qSig++) {
                Q = signatures[qSig];

                // find the better conversion
                for (var i = 0; args && i < args.members.length; i++) {

                    var argSym = this.resolveAST(args.members[i], false, enclosingDecl, context);

                    AType = argSym.type;

                    // invalidate the argument so that we may correctly resolve it later as part of the call expression
                    argSym.invalidate();

                    bestParams = best.signature.parameters;
                    qParams = Q.signature.parameters;

                    PType = i < bestParams.length ? bestParams[i].type : bestParams[bestParams.length - 1].type.getElementType();
                    QType = i < qParams.length ? qParams[i].type : qParams[qParams.length - 1].type.getElementType();

                    if (this.typesAreIdentical(PType, QType) && !(QType.isPrimitive() && (<PullPrimitiveTypeSymbol>QType).isStringConstant())) {
                        continue;
                    }
                    else if (PType.isPrimitive() &&
                        (<PullPrimitiveTypeSymbol>PType).isStringConstant() &&
                        args.members[i].nodeType() === NodeType.StringLiteral &&
                        stripQuotes((<StringLiteral>args.members[i]).actualText) === stripQuotes((<PullStringConstantTypeSymbol>PType).name)) {
                        break;
                    }
                    else if (QType.isPrimitive() &&
                        (<PullPrimitiveTypeSymbol>QType).isStringConstant() &&
                        args.members[i].nodeType() === NodeType.StringLiteral &&
                        stripQuotes((<StringLiteral>args.members[i]).actualText) === stripQuotes((<PullStringConstantTypeSymbol>QType).name)) {
                        best = Q;
                    }
                    else if (this.typesAreIdentical(AType, PType)) {
                        break;
                    }
                    else if (this.typesAreIdentical(AType, QType)) {
                        best = Q;
                        break;
                    }
                    else if (this.sourceIsSubtypeOfTarget(PType, QType, context)) {
                        break;
                    }
                    else if (this.sourceIsSubtypeOfTarget(QType, PType, context)) {
                        best = Q;
                        break;
                    }
                    else if (Q.hadProvisionalErrors) {
                        break;
                    }
                    else if (best.hadProvisionalErrors) {
                        best = Q;
                        break;
                    }
                }

                if (!args || i === args.members.length) {
                    var collection: IPullTypeCollection = {
                        getLength: () => { return 2; },
                        setTypeAtIndex: (index: number, type: PullTypeSymbol) => { }, // no contextual typing here, so no need to do anything
                        getTypeAtIndex: (index: number) => { return index ? Q.signature.returnType : best.signature.returnType; } // we only want the "second" type - the "first" is skipped
                    };
                    var bct = this.findBestCommonType(best.signature.returnType, null, collection, context);
                    ambiguous = !bct;
                }
                else {
                    ambiguous = false;
                }
            }

            // double-check if the 

            return { sig: best.signature, ambiguous: ambiguous };
        }

        private canApplyContextualTypeToFunction(candidateType: PullTypeSymbol, funcDecl: FunctionDeclaration, beStringent: boolean): boolean {

            // in these cases, we do not attempt to apply a contextual type
            //  RE: isInlineCallLiteral - if the call target is a function literal, we don't want to apply the target type
            //  to its body - instead, it should be applied to its return type
            if (funcDecl.isMethod() ||
                beStringent && funcDecl.returnTypeAnnotation) {
                return false;
            }

            beStringent = beStringent || (this.cachedFunctionInterfaceType() === candidateType);

            // At this point, if we're not being stringent, there's no need to check for multiple call sigs
            // or count parameters - we just want to unblock typecheck
            if (!beStringent) {
                return true;
            }
            var functionSymbol = this.getDeclForAST(funcDecl).getSymbol();
            var signature = functionSymbol.type.getCallSignatures()[0];
            var parameters = signature.parameters;
            var paramLen = parameters.length;

            // Check that the argument declarations have no type annotations
            for (var i = 0; i < paramLen; i++) {
                var param = parameters[i];
                var argDecl = <Parameter>this.getASTForDecl(param.getDeclarations()[0]);

                // REVIEW: a valid typeExpr is a requirement for varargs,
                // so we may want to revise our invariant
                if (beStringent && argDecl.typeExpr) {
                    return false;
                }
            }

            if (candidateType.getConstructSignatures().length && candidateType.getCallSignatures().length) {
                return false;
            }

            var candidateSigs = candidateType.getConstructSignatures().length ? candidateType.getConstructSignatures() : candidateType.getCallSignatures();

            if (!candidateSigs || candidateSigs.length > 1) {
                return false;
            }

            // if we're here, the contextual type can be applied to the function
            return true;
        }

        private inferArgumentTypesForSignature(signature: PullSignatureSymbol,
            args: ASTList,
            comparisonInfo: TypeComparisonInfo,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext): PullTypeSymbol[] {

            var cxt: PullContextualTypeContext = null;
            var hadProvisionalErrors = false;

            var parameters = signature.parameters;
            var typeParameters = signature.getTypeParameters();
            var argContext = new ArgumentInferenceContext();

            var parameterType: PullTypeSymbol = null;

            // seed each type parameter with the undefined type, so that we can widen it to 'any'
            // if no inferences can be made
            for (var i = 0; i < typeParameters.length; i++) {
                argContext.addInferenceRoot(typeParameters[i]);
            }

            var substitutions: any;
            var inferenceCandidates: PullTypeSymbol[];
            var inferenceCandidate: PullTypeSymbol;

            for (var i = 0; i < args.members.length; i++) {

                if (i >= parameters.length) {
                    break;
                }

                parameterType = parameters[i].type;

                // account for varargs
                if (signature.hasVarArgs && (i >= signature.nonOptionalParamCount - 1) && parameterType.isArray()) {
                    parameterType = parameterType.getElementType();
                }

                inferenceCandidates = argContext.getInferenceCandidates();
                substitutions = {};

                if (inferenceCandidates.length) {
                    for (var j = 0; j < inferenceCandidates.length; j++) {

                        argContext.resetRelationshipCache();

                        inferenceCandidate = inferenceCandidates[j];

                        substitutions = inferenceCandidates[j];

                        context.pushContextualType(parameterType, true, substitutions);

                        var argSym = this.resolveAST(args.members[i], true, enclosingDecl, context);

                        this.relateTypeToTypeParameters(argSym.type, parameterType, false, argContext, enclosingDecl, context);

                        cxt = context.popContextualType();

                        argSym.invalidate();

                        hadProvisionalErrors = cxt.hadProvisionalErrors();
                    }
                }
                else {
                    context.pushContextualType(parameterType, true, {});
                    var argSym = this.resolveAST(args.members[i], true, enclosingDecl, context);

                    this.relateTypeToTypeParameters(argSym.type, parameterType, false, argContext, enclosingDecl, context);

                    cxt = context.popContextualType();

                    argSym.invalidate();

                    hadProvisionalErrors = cxt.hadProvisionalErrors();
                }
            }

            hadProvisionalErrors = false;

            var inferenceResults = argContext.inferArgumentTypes(this, context);

            if (inferenceResults.unfit) {
                return null;
            }

            var resultTypes: PullTypeSymbol[] = [];

            // match inferred types in-order to type parameters
            for (var i = 0; i < typeParameters.length; i++) {
                for (var j = 0; j < inferenceResults.results.length; j++) {
                    if (inferenceResults.results[j].param == typeParameters[i]) {
                        resultTypes[resultTypes.length] = inferenceResults.results[j].type;
                        break;
                    }
                }
            }

            if (!args.members.length && !resultTypes.length && typeParameters.length) {
                for (var i = 0; i < typeParameters.length; i++) {
                    resultTypes[resultTypes.length] = this.semanticInfoChain.anyTypeSymbol;
                }
            }
            else if (resultTypes.length && resultTypes.length < typeParameters.length) {
                for (var i = resultTypes.length; i < typeParameters.length; i++) {
                    resultTypes[i] = this.semanticInfoChain.anyTypeSymbol;
                }
            }

            return resultTypes;
        }

        private relateTypeToTypeParameters(expressionType: PullTypeSymbol,
            parameterType: PullTypeSymbol,
            shouldFix: boolean,
            argContext: ArgumentInferenceContext,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext): void {

            if (!expressionType || !parameterType) {
                return;
            }

            if (expressionType.isError()) {
                expressionType = this.semanticInfoChain.anyTypeSymbol;
            }

            if (parameterType === expressionType) {
                //if (parameterType.isTypeParameter() && shouldFix) {
                //    argContext.addCandidateForInference(<PullTypeParameterSymbol>parameterType, this.semanticInfoChain.anyTypeSymbol, shouldFix);
                //}
                return;
            }

            if (parameterType.isTypeParameter()) {
                if (expressionType.isGeneric() && !expressionType.isFixed()) {
                    expressionType = this.specializeTypeToAny(expressionType, enclosingDecl, context);
                }
                argContext.addCandidateForInference(<PullTypeParameterSymbol>parameterType, expressionType, shouldFix);
                return;
            }
            var parameterDeclarations = parameterType.getDeclarations();
            var expressionDeclarations = expressionType.getDeclarations();
            if (!parameterType.isArray() &&
                parameterDeclarations.length &&
                expressionDeclarations.length &&
                (parameterDeclarations[0].isEqual(expressionDeclarations[0]) ||
                (expressionType.isGeneric() && parameterType.isGeneric() && this.sourceIsSubtypeOfTarget(expressionType, parameterType, context, null))) &&
                expressionType.isGeneric()) {
                var typeParameters: PullTypeSymbol[] = parameterType.getIsSpecialized() ? parameterType.getTypeArguments() : parameterType.getTypeParameters();
                var typeArguments: PullTypeSymbol[] = expressionType.getTypeArguments();

                // If we're relating an out-of-order resolution of a function call within the body
                // of a generic type's method, the relationship will actually be in reverse.
                if (!typeArguments) {
                    typeParameters = parameterType.getTypeArguments();
                    typeArguments = expressionType.getIsSpecialized() ? expressionType.getTypeArguments() : expressionType.getTypeParameters();
                }

                if (typeParameters && typeArguments && typeParameters.length === typeArguments.length) {
                    for (var i = 0; i < typeParameters.length; i++) {
                        if (typeArguments[i] != typeParameters[i]) {
                            // relate and fix
                            this.relateTypeToTypeParameters(typeArguments[i], typeParameters[i], true, argContext, enclosingDecl, context);
                        }
                    }
                }
            }

            // if the expression and parameter type, with type arguments of 'any', are not assignment compatible, ignore
            //var anyExpressionType = this.specializeTypeToAny(expressionType, enclosingDecl, context);
            //var anyParameterType = this.specializeTypeToAny(parameterType, enclosingDecl, context);

            //if (!this.sourceIsAssignableToTarget(anyExpressionType, anyParameterType, context)) {
            //    return;
            //}
            var prevSpecializingToAny = context.specializingToAny;
            context.specializingToAny = true;

            if (!this.sourceIsAssignableToTarget(expressionType, parameterType, context)) {
                context.specializingToAny = prevSpecializingToAny;
                return;
            }
            context.specializingToAny = prevSpecializingToAny;

            if (expressionType.isArray() && parameterType.isArray()) {
                this.relateArrayTypeToTypeParameters(expressionType, parameterType, shouldFix, argContext, enclosingDecl, context);

                return;
            }

            this.relateObjectTypeToTypeParameters(expressionType, parameterType, shouldFix, argContext, enclosingDecl, context);
        }

        private relateFunctionSignatureToTypeParameters(expressionSignature: PullSignatureSymbol,
            parameterSignature: PullSignatureSymbol,
            argContext: ArgumentInferenceContext,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext): void {
            // Sub in 'any' for type parameters

            //var anyExpressionSignature = this.specializeSignatureToAny(expressionSignature, enclosingDecl, context);
            //var anyParamExpressionSignature = this.specializeSignatureToAny(parameterSignature, enclosingDecl, context);

            //if (!this.signatureIsAssignableToTarget(anyExpressionSignature, anyParamExpressionSignature, context)) {
            //    return;
            //}

            var expressionParams = expressionSignature.parameters;
            var expressionReturnType = expressionSignature.returnType;
            
            var parameterParams = parameterSignature.parameters;
            var parameterReturnType = parameterSignature.returnType;

            var len = parameterParams.length < expressionParams.length ? parameterParams.length : expressionParams.length;

            for (var i = 0; i < len; i++) {
                this.relateTypeToTypeParameters(expressionParams[i].type, parameterParams[i].type, true, argContext, enclosingDecl, context);
            }

            this.relateTypeToTypeParameters(expressionReturnType, parameterReturnType, false, argContext, enclosingDecl, context);
        }

        private relateObjectTypeToTypeParameters(objectType: PullTypeSymbol,
            parameterType: PullTypeSymbol,
            shouldFix: boolean,
            argContext: ArgumentInferenceContext,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext): void {

            var parameterTypeMembers = parameterType.getMembers();
            var parameterSignatures: PullSignatureSymbol[];
            var parameterSignature: PullSignatureSymbol;

            var objectMember: PullSymbol;
            var objectSignatures: PullSignatureSymbol[];


            if (argContext.alreadyRelatingTypes(objectType, parameterType)) {
                return;
            }

            var objectTypeArguments = objectType.getTypeArguments();
            var parameterTypeParameters = parameterType.getTypeParameters();

            if (objectTypeArguments && (objectTypeArguments.length === parameterTypeParameters.length)) {
                for (var i = 0; i < objectTypeArguments.length; i++) {
                    // PULLREVIEW: This may lead to duplicate inferences for type argument parameters, if the two are the same
                    // (which could occur via mutually recursive method calls within a generic class declaration)
                    argContext.addCandidateForInference(parameterTypeParameters[i], objectTypeArguments[i], shouldFix);
                }
            }

            for (var i = 0; i < parameterTypeMembers.length; i++) {
                objectMember = this.getMemberSymbol(parameterTypeMembers[i].name, PullElementKind.SomeValue, objectType);

                if (objectMember) {
                    this.relateTypeToTypeParameters(objectMember.type, parameterTypeMembers[i].type, shouldFix, argContext, enclosingDecl, context);
                }
            }

            parameterSignatures = parameterType.getCallSignatures();
            objectSignatures = objectType.getCallSignatures();

            for (var i = 0; i < parameterSignatures.length; i++) {
                parameterSignature = parameterSignatures[i];

                for (var j = 0; j < objectSignatures.length; j++) {
                    this.relateFunctionSignatureToTypeParameters(objectSignatures[j], parameterSignature, argContext, enclosingDecl, context);
                }
            }

            parameterSignatures = parameterType.getConstructSignatures();
            objectSignatures = objectType.getConstructSignatures();

            for (var i = 0; i < parameterSignatures.length; i++) {
                parameterSignature = parameterSignatures[i];

                for (var j = 0; j < objectSignatures.length; j++) {
                    this.relateFunctionSignatureToTypeParameters(objectSignatures[j], parameterSignature, argContext, enclosingDecl, context);
                }
            }

            parameterSignatures = parameterType.getIndexSignatures();
            objectSignatures = objectType.getIndexSignatures();

            for (var i = 0; i < parameterSignatures.length; i++) {
                parameterSignature = parameterSignatures[i];

                for (var j = 0; j < objectSignatures.length; j++) {
                    this.relateFunctionSignatureToTypeParameters(objectSignatures[j], parameterSignature, argContext, enclosingDecl, context);
                }
            }
        }

        private relateArrayTypeToTypeParameters(argArrayType: PullTypeSymbol,
            parameterArrayType: PullTypeSymbol,
            shouldFix: boolean,
            argContext: ArgumentInferenceContext,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext): void {

            var argElement = argArrayType.getElementType();
            var paramElement = parameterArrayType.getElementType();

            this.relateTypeToTypeParameters(argElement, paramElement, shouldFix, argContext, enclosingDecl, context);
        }

        public specializeTypeToAny(typeToSpecialize: PullTypeSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullTypeSymbol {
            var prevSpecialize = context.specializingToAny;

            context.specializingToAny = true;

            // get the "root" unspecialized type, since even generic types may already be partially specialize
            var rootType = getRootType(typeToSpecialize);

            var type = specializeType(rootType, [], this, enclosingDecl, context);

            context.specializingToAny = prevSpecialize;

            return type;
        }

        private specializeSignatureToAny(signatureToSpecialize: PullSignatureSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext): PullSignatureSymbol {
            var typeParameters = signatureToSpecialize.getTypeParameters();
            var typeReplacementMap: any = {};
            var typeArguments: PullTypeSymbol[] = []; // PULLTODO - may be expensive, but easy to cache

            for (var i = 0; i < typeParameters.length; i++) {
                typeArguments[i] = this.semanticInfoChain.anyTypeSymbol;
                typeReplacementMap[typeParameters[i].pullSymbolIDString] = typeArguments[i];
            }
            if (!typeArguments.length) {
                typeArguments[0] = this.semanticInfoChain.anyTypeSymbol;
            }


            var prevSpecialize = context.specializingToAny;

            context.specializingToAny = true;
            // no need to worry about returning 'null', since 'any' satisfies all constraints
            var sig = specializeSignature(signatureToSpecialize, false, typeReplacementMap, typeArguments, this, enclosingDecl, context);
            context.specializingToAny = prevSpecialize;

            return sig;
        }

        public static globalTypeCheckPhase = 0;

        // type check infrastructure
        public static typeCheck(compilationSettings: CompilationSettings, semanticInfoChain: SemanticInfoChain, scriptName: string, script: Script): void {
            var unit = semanticInfoChain.getUnit(scriptName);

            if (unit.getTypeChecked()) {
                return;
            }

            var scriptDecl = unit.getTopLevelDecls()[0];

            var resolver = new PullTypeResolver(compilationSettings, semanticInfoChain, scriptName, /*inTypeCheck*/ true);
            var context = new PullTypeResolutionContext(true);

            resolver.resolveAST(script.moduleElements, false, scriptDecl, context);

            resolver.validateVariableDeclarationGroups(scriptDecl, context);

            PullTypeResolver.globalTypeCheckPhase++;

            unit.setTypeChecked();

        }

        private validateVariableDeclarationGroups(enclosingDecl: PullDecl, context: PullTypeResolutionContext) {
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
                    this.resolveAST(boundDeclAST, /*inContextuallyTypedAssignment:*/false, enclosingDecl, context);
                    if (!j) {
                        firstSymbol = decl.getSymbol();

                        if (this.isAnyOrEquivalent(this.widenType(firstSymbol.type))) {
                            return;
                        }
                        continue;
                    }

                    if (!this.typesAreIdentical(symbol.type, firstSymbol.type)) {
                        context.postError(this.currentUnit.getPath(), boundDeclAST.minChar, boundDeclAST.getLength(), DiagnosticCode.Subsequent_variable_declarations_must_have_the_same_type_Variable_0_must_be_of_type_1_but_here_has_type_2, [symbol.getScopedName(), firstSymbol.type.toString(), symbol.type.toString()], enclosingDecl);
                    }
                }
            }
        }

        private typeCheckFunctionOverloads(funcDecl: FunctionDeclaration, context: PullTypeResolutionContext, signature?: PullSignatureSymbol, allSignatures?: PullSignatureSymbol[]) {
            if (!signature) {
                var functionSignatureInfo = PullHelpers.getSignatureForFuncDecl(funcDecl, this.currentUnit);
                signature = functionSignatureInfo.signature;
                allSignatures = functionSignatureInfo.allSignatures;
            }
            var functionDeclaration = this.currentUnit.getDeclForAST(funcDecl);
            var funcSymbol = functionDeclaration.getSymbol();

            // Find the definition signature for this signature group
            var definitionSignature: PullSignatureSymbol = null;
            for (var i = allSignatures.length - 1; i >= 0; i--) {
                if (allSignatures[i].isDefinition()) {
                    definitionSignature = allSignatures[i];
                    break;
                }
            }

            if (!signature.isDefinition()) {
                // Check for if the signatures are identical, check with the signatures before the current current one
                for (var i = 0; i < allSignatures.length; i++) {
                    if (allSignatures[i] === signature) {
                        break;
                    }

                    if (this.signaturesAreIdentical(allSignatures[i], signature, /*includingReturnType*/ false)) {
                        if (!this.typesAreIdentical(allSignatures[i].returnType, signature.returnType)) {
                            context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Overloads_cannot_differ_only_by_return_type, null, functionDeclaration);
                        } else if (funcDecl.isConstructor) {
                            context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Duplicate_constructor_overload_signature, null, functionDeclaration);
                        } else if (funcDecl.isConstructMember()) {
                            context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Duplicate_overload_construct_signature, null, functionDeclaration);
                        } else if (funcDecl.isCallMember()) {
                            context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Duplicate_overload_call_signature, null, functionDeclaration);
                        } else {
                            context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Duplicate_overload_signature_for_0, [funcSymbol.getScopedNameEx().toString()], functionDeclaration);
                        }

                        break;
                    }
                }
            }

            // Verify assignment compatibility or in case of constantOverload signature, if its subtype of atleast one signature
            var isConstantOverloadSignature = signature.isStringConstantOverloadSignature();
            if (isConstantOverloadSignature) {
                if (signature.isDefinition()) {
                    // Report error - definition signature cannot specify constant type
                    context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(),DiagnosticCode.Overload_signature_implementation_cannot_use_specialized_type, null, functionDeclaration);
                } else {
                    // PERFREVIEW: Why create a new resolution context?
                    //var resolutionContext = new PullTypeResolutionContext(true);
                    var foundSubtypeSignature = false;
                    for (var i = 0; i < allSignatures.length; i++) {
                        if (allSignatures[i].isDefinition() || allSignatures[i] === signature) {
                            continue;
                        }

                        if (!allSignatures[i].isResolved) {
                            this.resolveDeclaredSymbol(allSignatures[i], this.getEnclosingDecl(functionDeclaration), context);
                        }

                        if (allSignatures[i].isStringConstantOverloadSignature()) {
                            continue;
                        }

                        if (this.signatureIsSubtypeOfTarget(signature, allSignatures[i], context)) {
                            foundSubtypeSignature = true;
                            break;
                        }
                    }

                    if (!foundSubtypeSignature) {
                        // Could not find the overload signature subtype
                        context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Specialized_overload_signature_is_not_subtype_of_any_non_specialized_signature, null, this.getEnclosingDecl(functionDeclaration));
                    }
                }
            } else if (definitionSignature && definitionSignature != signature) {
                var comparisonInfo = new TypeComparisonInfo();
                //var resolutionContext = new PullTypeResolutionContext();
                if (!definitionSignature.isResolved) {
                    this.resolveDeclaredSymbol(definitionSignature, this.getEnclosingDecl(functionDeclaration), context);
                }

                if (!this.signatureIsAssignableToTarget(definitionSignature, signature, context, comparisonInfo)) {
                    // definition signature is not assignable to functionSignature then its incorrect overload signature
                    if (comparisonInfo.message) {
                        context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Overload_signature_is_not_compatible_with_function_definition_NL_0, [comparisonInfo.message], this.getEnclosingDecl(functionDeclaration));
                    } else {
                        context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), DiagnosticCode.Overload_signature_is_not_compatible_with_function_definition, null, this.getEnclosingDecl(functionDeclaration));
                    }
                }
            }

            var signatureForVisibilityCheck = definitionSignature;
            if (!definitionSignature) {
                if (allSignatures[0] === signature) {
                    return;
                }
                signatureForVisibilityCheck = allSignatures[0];
            }

            if (!funcDecl.isConstructor && !funcDecl.isConstructMember() && signature != signatureForVisibilityCheck) {
                var errorCode: string;
                // verify it satisfies all the properties of first signature
                if (signatureForVisibilityCheck.hasFlag(PullElementFlags.Private) != signature.hasFlag(PullElementFlags.Private)) {
                    errorCode = DiagnosticCode.Overload_signatures_must_all_be_public_or_private;
                }
                else if (signatureForVisibilityCheck.hasFlag(PullElementFlags.Exported) != signature.hasFlag(PullElementFlags.Exported)) {
                    errorCode = DiagnosticCode.Overload_signatures_must_all_be_exported_or_local;
                }
                else if (signatureForVisibilityCheck.hasFlag(PullElementFlags.Ambient) != signature.hasFlag(PullElementFlags.Ambient)) {
                    errorCode = DiagnosticCode.Overload_signatures_must_all_be_ambient_or_non_ambient;
                }
                else if (signatureForVisibilityCheck.hasFlag(PullElementFlags.Optional) != signature.hasFlag(PullElementFlags.Optional)) {
                    errorCode = DiagnosticCode.Overload_signatures_must_all_be_optional_or_required;
                }

                if (errorCode) {
                    context.postError(this.unitPath, funcDecl.minChar, funcDecl.getLength(), errorCode, null, this.getEnclosingDecl(functionDeclaration));
                }
            }
        }

        // Privacy checking

        private checkTypePrivacy(declSymbol: PullSymbol, typeSymbol: PullTypeSymbol, context: PullTypeResolutionContext, privacyErrorReporter: (typeSymbol: PullTypeSymbol) => void ) {
            if (!typeSymbol || typeSymbol.kind === PullElementKind.Primitive) {
                return;
            }

            if (typeSymbol.isArray()) {
                this.checkTypePrivacy(declSymbol, typeSymbol.getElementType(), context, privacyErrorReporter);
                return;
            }

            if (!typeSymbol.isNamedTypeSymbol()) {
                // Check the privacy of members, constructors, calls, index signatures
                var members = typeSymbol.getMembers();
                for (var i = 0; i < members.length; i++) {
                    this.checkTypePrivacy(declSymbol, members[i].type, context, privacyErrorReporter);
                }

                this.checkTypePrivacyOfSignatures(declSymbol, typeSymbol.getCallSignatures(), context, privacyErrorReporter);
                this.checkTypePrivacyOfSignatures(declSymbol, typeSymbol.getConstructSignatures(), context, privacyErrorReporter);
                this.checkTypePrivacyOfSignatures(declSymbol, typeSymbol.getIndexSignatures(), context, privacyErrorReporter);

                return;
            }

            // Check flags for the symbol itself
            if (declSymbol.isExternallyVisible()) {
                // Check if type symbol is externally visible
                var typeSymbolIsVisible = typeSymbol.isExternallyVisible();
                // If Visible check if the type is part of dynamic module
                if (typeSymbolIsVisible) {
                    var typeSymbolPath = typeSymbol.pathToRoot();
                    if (typeSymbolPath.length && typeSymbolPath[typeSymbolPath.length - 1].kind === PullElementKind.DynamicModule) {
                        // Type from the dynamic module
                        var declSymbolPath = declSymbol.pathToRoot();
                        if (declSymbolPath.length && declSymbolPath[declSymbolPath.length - 1] != typeSymbolPath[typeSymbolPath.length - 1]) {
                            // Declaration symbol is from different unit
                            // Type may not be visible without import statement
                            typeSymbolIsVisible = false;
                            for (var i = typeSymbolPath.length - 1; i >= 0; i--) {
                                var aliasSymbol = typeSymbolPath[i].getAliasedSymbol(declSymbol);
                                if (aliasSymbol) {
                                    // Visible type.
                                    // Also mark this Import declaration as visible
                                    CompilerDiagnostics.assert(aliasSymbol.kind === PullElementKind.TypeAlias, "dynamic module need to be referenced by type alias");
                                    (<PullTypeAliasSymbol>aliasSymbol).setIsTypeUsedExternally();
                                    typeSymbolIsVisible = true;
                                    break;
                                }
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

        private checkTypePrivacyOfSignatures(declSymbol: PullSymbol, signatures: PullSignatureSymbol[], context: PullTypeResolutionContext, privacyErrorReporter: (typeSymbol: PullTypeSymbol) => void ) {
            for (var i = 0; i < signatures.length; i++) {
                var signature = signatures[i];
                if (signatures.length && signature.isDefinition()) {
                    continue;
                }

                var typeParams = signature.getTypeParameters();
                for (var j = 0; j < typeParams.length; j++) {
                    this.checkTypePrivacy(declSymbol, typeParams[j], context, privacyErrorReporter);
                }

                var params = signature.parameters;
                for (var j = 0; j < params.length; j++) {
                    var paramType = params[j].type;
                    this.checkTypePrivacy(declSymbol, paramType, context, privacyErrorReporter);
                }

                var returnType = signature.returnType;
                this.checkTypePrivacy(declSymbol, returnType, context, privacyErrorReporter);
            }
        }

        private baseListPrivacyErrorReporter(declAST: TypeDeclaration, declSymbol: PullTypeSymbol, baseAst: AST, isExtendedType: boolean, typeSymbol: PullTypeSymbol, context: PullTypeResolutionContext) {
            var decl: PullDecl = this.getDeclForAST(declAST);
            var enclosingDecl = this.getEnclosingDecl(decl);
            var messageCode: string;
            var messageArguments: any[];

            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }
                if (declAST.nodeType() === NodeType.ClassDeclaration) {
                    // Class
                    if (isExtendedType) {
                        messageCode = DiagnosticCode.Exported_class_0_extends_class_from_inaccessible_module_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Exported_class_0_implements_interface_from_inaccessible_module_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    }
                } else {
                    // Interface
                    messageCode = DiagnosticCode.Exported_interface_0_extends_interface_from_inaccessible_module_1;
                    messageArguments = [declSymbol.toString(), typeSymbolName];
                }
            } else {
                if (declAST.nodeType() === NodeType.ClassDeclaration) {
                    // Class
                    if (isExtendedType) {
                        messageCode = DiagnosticCode.Exported_class_0_extends_private_class_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Exported_class_0_implements_private_interface_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    }
                } else {
                    // Interface
                    messageCode = DiagnosticCode.Exported_interface_0_extends_private_interface_1;
                    messageArguments = [declSymbol.toString(), typeSymbolName];
                }
            }

            context.postError(this.unitPath, baseAst.minChar, baseAst.getLength(), messageCode, messageArguments, enclosingDecl, true);
        }

        private variablePrivacyErrorReporter(declSymbol: PullSymbol, typeSymbol: PullTypeSymbol, context: PullTypeResolutionContext) {
            var declAST = <VariableDeclarator>this.getASTForSymbol(declSymbol);
            var enclosingDecl = this.getEnclosingDecl(declSymbol.getDeclarations()[0]);

            var isProperty = declSymbol.kind === PullElementKind.Property;
            var isPropertyOfClass = false;
            var declParent = declSymbol.getContainer();
            if (declParent && (declParent.kind === PullElementKind.Class || declParent.kind === PullElementKind.ConstructorMethod)) {
                isPropertyOfClass = true;
            }

            var messageCode: string;
            var messageArguments: any[];
            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }

                if (declSymbol.hasFlag(PullElementFlags.Static)) {
                    messageCode = DiagnosticCode.Public_static_property_0_of_exported_class_is_using_inaccessible_module_1;
                    messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                } else if (isProperty) {
                    if (isPropertyOfClass) {
                        messageCode = DiagnosticCode.Public_property_0_of_exported_class_is_using_inaccessible_module_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Property_0_of_exported_interface_is_using_inaccessible_module_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    }
                } else {
                    messageCode = DiagnosticCode.Exported_variable_0_is_using_inaccessible_module_1;
                    messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                }
            } else {
                if (declSymbol.hasFlag(PullElementFlags.Static)) {
                    messageCode = DiagnosticCode.Public_static_property_0_of_exported_class_has_or_is_using_private_type_1;
                    messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                } else if (isProperty) {
                    if (isPropertyOfClass) {
                        messageCode = DiagnosticCode.Public_property_0_of_exported_class_has_or_is_using_private_type_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Property_0_of_exported_interface_has_or_is_using_private_type_1;
                        messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                    }
                } else {
                    messageCode = DiagnosticCode.Exported_variable_0_has_or_is_using_private_type_1;
                    messageArguments = [declSymbol.getScopedName(), typeSymbolName];
                }
            }

            context.postError(this.unitPath, declAST.minChar, declAST.getLength(), messageCode, messageArguments, enclosingDecl, true);
        }

        private checkFunctionTypePrivacy(funcDeclAST: FunctionDeclaration, inContextuallyTypedAssignment: boolean, context: PullTypeResolutionContext) {
            if (inContextuallyTypedAssignment ||
                (funcDeclAST.getFunctionFlags() & FunctionFlags.IsFunctionExpression) ||
                (funcDeclAST.getFunctionFlags() & FunctionFlags.IsFunctionProperty)) {
                return;
            }

            var functionDecl = this.currentUnit.getDeclForAST(funcDeclAST);
            var functionSymbol = functionDecl.getSymbol();;
            var functionSignature: PullSignatureSymbol;

            var isGetter = funcDeclAST.isGetAccessor();
            var isSetter = funcDeclAST.isSetAccessor();

            if (isGetter || isSetter) {
                var accessorSymbol = <PullAccessorSymbol> functionSymbol;
                functionSignature = (isGetter ? accessorSymbol.getGetter() : accessorSymbol.getSetter()).type.getCallSignatures()[0];
            } else {
                if (!functionSymbol) {
                    var parentDecl = functionDecl.getParentDecl();
                    functionSymbol = parentDecl.getSymbol();
                    if (functionSymbol && functionSymbol.isType() && !(<PullTypeSymbol>functionSymbol).isNamedTypeSymbol()) {
                        // Call Signature from the non named type
                        return;
                    }
                } else if (functionSymbol.kind == PullElementKind.Method && !functionSymbol.getContainer().isNamedTypeSymbol()) {
                    // method of the unnmaed type
                    return;
                }
                functionSignature = functionDecl.getSignatureSymbol();
            }

            // Check function parameters
            if (!isGetter) {
                var funcParams = functionSignature.parameters;
                for (var i = 0; i < funcParams.length; i++) {
                    this.checkTypePrivacy(functionSymbol, funcParams[i].type, context, (typeSymbol: PullTypeSymbol) =>
                        this.functionArgumentTypePrivacyErrorReporter(funcDeclAST, i, funcParams[i], typeSymbol, context));
                }
            }

            // Check return type
            if (!isSetter) {
                this.checkTypePrivacy(functionSymbol, functionSignature.returnType, context, (typeSymbol: PullTypeSymbol) =>
                    this.functionReturnTypePrivacyErrorReporter(funcDeclAST, functionSignature.returnType, typeSymbol, context));
            }
        }

        private functionArgumentTypePrivacyErrorReporter(declAST: FunctionDeclaration, argIndex: number, paramSymbol: PullSymbol, typeSymbol: PullTypeSymbol, context: PullTypeResolutionContext) {
            var decl: PullDecl = this.getDeclForAST(declAST);
            var enclosingDecl = this.getEnclosingDecl(decl);

            var isGetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.GetAccessor);
            var isSetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.SetAccessor);
            var isStatic = (decl.flags & PullElementFlags.Static) === PullElementFlags.Static;
            var isMethod = decl.kind === PullElementKind.Method;
            var isMethodOfClass = false;
            var declParent = decl.getParentDecl();
            if (declParent && (declParent.kind === PullElementKind.Class || declParent.kind === PullElementKind.ConstructorMethod)) {
                isMethodOfClass = true;
            }

            var start = declAST.arguments.members[argIndex].minChar;
            var length = declAST.arguments.members[argIndex].getLength();

            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }

                if (declAST.isConstructor) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_constructor_from_exported_class_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                } else if (isSetter) {
                    if (isStatic) {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_static_property_setter_from_exported_class_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    } else {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_property_setter_from_exported_class_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    }
                } else if (declAST.isConstructMember()) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_constructor_signature_from_exported_interface_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                } else if (declAST.isCallMember()) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_call_signature_from_exported_interface_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                } else if (isMethod) {
                    if (isStatic) {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_static_method_from_exported_class_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    } else if (isMethodOfClass) {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_method_from_exported_class_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    } else {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_method_from_exported_interface_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    }
                } else if (!isGetter) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_exported_function_is_using_inaccessible_module_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                }
            } else {
                if (declAST.isConstructor) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_constructor_from_exported_class_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                } else if (isSetter) {
                    if (isStatic) {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_static_property_setter_from_exported_class_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    } else {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_property_setter_from_exported_class_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    }
                } else if (declAST.isConstructMember()) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                } else if (declAST.isCallMember()) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                } else if (isMethod) {
                    if (isStatic) {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    } else if (isMethodOfClass) {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_public_method_from_exported_class_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    } else {
                        context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_method_from_exported_interface_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                    }
                } else if (!isGetter && !declAST.isIndexerMember()) {
                    context.postError(this.unitPath, start, length, DiagnosticCode.Parameter_0_of_exported_function_has_or_is_using_private_type_1, [paramSymbol.getScopedName(), typeSymbolName], enclosingDecl, true);
                }
            }
        }

        private functionReturnTypePrivacyErrorReporter(declAST: FunctionDeclaration, funcReturnType: PullTypeSymbol, typeSymbol: PullTypeSymbol, context: PullTypeResolutionContext) {
            var decl: PullDecl = this.getDeclForAST(declAST);
            var enclosingDecl = this.getEnclosingDecl(decl);

            var isGetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.GetAccessor);
            var isSetter = declAST.isAccessor() && hasFlag(declAST.getFunctionFlags(), FunctionFlags.SetAccessor);
            var isStatic = (decl.flags & PullElementFlags.Static) === PullElementFlags.Static;
            var isMethod = decl.kind === PullElementKind.Method;
            var isMethodOfClass = false;
            var declParent = decl.getParentDecl();
            if (declParent && (declParent.kind === PullElementKind.Class || declParent.kind === PullElementKind.ConstructorMethod)) {
                isMethodOfClass = true;
            }

            var messageCode: string = null;
            var messageArguments: any[];
            var typeSymbolName = typeSymbol.getScopedName();
            if (typeSymbol.isContainer()) {
                if (!isQuoted(typeSymbolName)) {
                    typeSymbolName = "'" + typeSymbolName + "'";
                }

                if (isGetter) {
                    if (isStatic) {
                        messageCode = DiagnosticCode.Return_type_of_public_static_property_getter_from_exported_class_is_using_inaccessible_module_0;
                        messageArguments = [typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Return_type_of_public_property_getter_from_exported_class_is_using_inaccessible_module_0;
                        messageArguments = [typeSymbolName];
                    }
                } else if (declAST.isConstructMember()) {
                    messageCode = DiagnosticCode.Return_type_of_constructor_signature_from_exported_interface_is_using_inaccessible_module_0;
                    messageArguments = [typeSymbolName];
                } else if (declAST.isCallMember()) {
                    messageCode = DiagnosticCode.Return_type_of_call_signature_from_exported_interface_is_using_inaccessible_module_0;
                    messageArguments = [typeSymbolName];
                } else if (declAST.isIndexerMember()) {
                    messageCode = DiagnosticCode.Return_type_of_index_signature_from_exported_interface_is_using_inaccessible_module_0;
                    messageArguments = [typeSymbolName];
                } else if (isMethod) {
                    if (isStatic) {
                        messageCode = DiagnosticCode.Return_type_of_public_static_method_from_exported_class_is_using_inaccessible_module_0;
                        messageArguments = [typeSymbolName];
                    } else if (isMethodOfClass) {
                        messageCode = DiagnosticCode.Return_type_of_public_method_from_exported_class_is_using_inaccessible_module_0;
                        messageArguments = [typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Return_type_of_method_from_exported_interface_is_using_inaccessible_module_0;
                        messageArguments = [typeSymbolName];
                    }
                } else if (!isSetter && !declAST.isConstructor) {
                    messageCode = DiagnosticCode.Return_type_of_exported_function_is_using_inaccessible_module_0;
                    messageArguments = [typeSymbolName];
                }
            } else {
                if (isGetter) {
                    if (isStatic) {
                        messageCode = DiagnosticCode.Return_type_of_public_static_property_getter_from_exported_class_has_or_is_using_private_type_0;
                        messageArguments = [typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Return_type_of_public_property_getter_from_exported_class_has_or_is_using_private_type_0;
                        messageArguments = [typeSymbolName];
                    }
                } else if (declAST.isConstructMember()) {
                    messageCode = DiagnosticCode.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_private_type_0;
                    messageArguments = [typeSymbolName];
                } else if (declAST.isCallMember()) {
                    messageCode = DiagnosticCode.Return_type_of_call_signature_from_exported_interface_has_or_is_using_private_type_0;
                    messageArguments = [typeSymbolName];
                } else if (declAST.isIndexerMember()) {
                    messageCode = DiagnosticCode.Return_type_of_index_signature_from_exported_interface_has_or_is_using_private_type_0;
                    messageArguments = [typeSymbolName];
                } else if (isMethod) {
                    if (isStatic) {
                        messageCode = DiagnosticCode.Return_type_of_public_static_method_from_exported_class_has_or_is_using_private_type_0;
                        messageArguments = [typeSymbolName];
                    } else if (isMethodOfClass) {
                        messageCode = DiagnosticCode.Return_type_of_public_method_from_exported_class_has_or_is_using_private_type_0;
                        messageArguments = [typeSymbolName];
                    } else {
                        messageCode = DiagnosticCode.Return_type_of_method_from_exported_interface_has_or_is_using_private_type_0;
                        messageArguments = [typeSymbolName];
                    }
                } else if (!isSetter && !declAST.isConstructor) {
                    messageCode = DiagnosticCode.Return_type_of_exported_function_has_or_is_using_private_type_0;
                    messageArguments = [typeSymbolName];
                }
            }

            if (messageCode) {
                var reportOnFuncDecl = false;
                // PERFREVIEW: Why the new context?
                //var contextForReturnTypeResolution = new PullTypeResolutionContext();
                if (declAST.returnTypeAnnotation) {
                    // NOTE: we don't want to report this diagnostics.  They'll already have been 
                    // reported when we first hit the return statement.
                    var returnExpressionSymbol = this.resolveTypeReference(<TypeReference>declAST.returnTypeAnnotation, decl, context);
                    if (returnExpressionSymbol === funcReturnType) {
                        // Error coming from return annotation
                        context.postError(this.unitPath, declAST.returnTypeAnnotation.minChar, declAST.returnTypeAnnotation.getLength(), messageCode, messageArguments, enclosingDecl, true);
                    }
                }

                if (declAST.block) {
                    var reportErrorOnReturnExpressions = (ast: AST, parent: AST, walker: IAstWalker) => {
                        var go = true;
                        switch (ast.nodeType()) {
                            case NodeType.FunctionDeclaration:
                                // don't recurse into a function decl - we don't want to confuse a nested
                                // return type with the top-level function's return type
                                go = false;
                                break;

                            case NodeType.ReturnStatement:
                                var returnStatement: ReturnStatement = <ReturnStatement>ast;
                                var returnExpressionSymbol = this.resolveAST(returnStatement.returnExpression, false, decl, context).type;
                                // Check if return statement's type matches the one that we concluded
                                if (returnExpressionSymbol === funcReturnType) {
                                    context.postError(this.unitPath, returnStatement.minChar, returnStatement.getLength(), messageCode, messageArguments, enclosingDecl, true);
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
                    };

                    getAstWalkerFactory().walk(declAST.block, reportErrorOnReturnExpressions);
                }

                if (reportOnFuncDecl) {
                    // Show on function decl
                    context.postError(this.unitPath, declAST.minChar, declAST.getLength(), messageCode, messageArguments, enclosingDecl, true);
                }
            }
        }

        public enclosingClassIsDerived(decl: PullDecl): boolean {
            if (decl) {
                var parentDecl = decl.getParentDecl();
                var classSymbol: PullTypeSymbol = null;

                while (parentDecl) {
                    if (parentDecl.kind == PullElementKind.Class) {
                        classSymbol = <PullTypeSymbol>parentDecl.getSymbol();
                        if (classSymbol.getExtendedTypes().length > 0) {
                            return true;
                        }

                        break;
                    }
                }
            }

            return false;
        }

        private isSuperCallNode(node: AST): boolean {
            if (node && node.nodeType() === NodeType.ExpressionStatement) {
                var expressionStatement = <ExpressionStatement>node;
                if (expressionStatement.expression && expressionStatement.expression.nodeType() === NodeType.InvocationExpression) {
                    var callExpression = <InvocationExpression>expressionStatement.expression;
                    if (callExpression.target && callExpression.target.nodeType() === NodeType.SuperExpression) {
                        return true;
                    }
                }
            }
            return false;
        }

        private getFirstStatementFromFunctionDeclAST(funcDeclAST: FunctionDeclaration): AST {
            if (funcDeclAST.block && funcDeclAST.block.statements && funcDeclAST.block.statements.members) {
                return funcDeclAST.block.statements.members[0];
            }

            return null;
        }

        private superCallMustBeFirstStatementInConstructor(enclosingConstructor: PullDecl, enclosingClass: PullDecl): boolean {
            /*
            The first statement in the body of a constructor must be a super call if both of the following are true:
                •	The containing class is a derived class.
                •	The constructor declares parameter properties or the containing class declares instance member variables with initializers.
            In such a required super call, it is a compile-time error for argument expressions to reference this.
            */
            if (enclosingConstructor && enclosingClass) {
                var classSymbol = <PullTypeSymbol>enclosingClass.getSymbol();
                if (classSymbol.getExtendedTypes().length === 0) {
                    return false;
                }

                var classMembers = classSymbol.getMembers();
                for (var i = 0, n1 = classMembers.length; i < n1; i++) {
                    var member = classMembers[i];

                    if (member.kind === PullElementKind.Property) {
                        var declarations = member.getDeclarations();
                        for (var j = 0, n2 = declarations.length; j < n2; j++) {
                            var declaration = declarations[j];
                            var ast = this.semanticInfoChain.getASTForDecl(declaration);
                            if (ast.nodeType() === NodeType.Parameter) {
                                return true;
                            }

                            if (ast.nodeType() === NodeType.VariableDeclarator) {
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

        private checkForThisOrSuperCaptureInArrowFunction(expression: AST, typeCheckContext: PullTypeCheckContext): void {
            var enclosingDecl = typeCheckContext.getEnclosingDecl();

            var declPath: PullDecl[] = typeCheckContext.enclosingDeclStack;

            // work back up the decl path, until you can find a class
            // PULLTODO: Obviously not completely correct, but this sufficiently unblocks testing of the pull model
            if (declPath.length) {
                var inFatArrow = false;
                for (var i = declPath.length - 1; i >= 0; i--) {
                    var decl = declPath[i];
                    var declKind = decl.kind;
                    var declFlags = decl.flags;

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

                                decl.setFlags(decl.flags | PullElementFlags.MustCaptureThis);

                            // If we're accessing 'this' in a class, then the class constructor 
                            // needs to be marked as capturing 'this'.
                            if (declKind === PullElementKind.Class) {
                                decl.getChildDecls().filter(d => d.kind === PullElementKind.ConstructorMethod)
                                    .map(d => d.setFlags(d.flags | PullElementFlags.MustCaptureThis));
                            }
                            break;
                        }
                    }
                }
            }
        }

        private typeCheckMembersAgainstIndexer(containerType: PullTypeSymbol, context: PullTypeResolutionContext, enclosingDecl: PullDecl) {
            // Check all the members defined in this symbol's declarations (no base classes)
            var indexSignatures = containerType.getIndexSignatures();

            if (indexSignatures.length > 0) {
                var members = enclosingDecl.getChildDecls();
                for (var i = 0; i < members.length; i++) {
                    // Nothing to check if the member has no name or is a signature
                    var member = members[i];
                    if (!member.name || member.kind & PullElementKind.SomeSignature) {
                        continue;
                    }

                    // Get all index signatures, and check against the first that matters for this field name (string vs number)
                    var isMemberNumeric = isFinite(+member.name);
                    for (var j = 0; j < indexSignatures.length; j++) {
                        if (!indexSignatures[j].isResolved) {
                            this.resolveDeclaredSymbol(indexSignatures[j], indexSignatures[j].getDeclarations()[0].getParentDecl(), context);
                        }
                        if ((indexSignatures[j].parameters[0].type === this.semanticInfoChain.numberTypeSymbol) === isMemberNumeric) {
                            this.checkThatMemberIsSubtypeOfIndexer(member.getSymbol(), indexSignatures[j], this.semanticInfoChain.getASTForDecl(member), context, enclosingDecl, isMemberNumeric);
                            break;
                        }
                    }
                }
            }
        }

        private checkThatMemberIsSubtypeOfIndexer(member: PullSymbol, indexSignature: PullSignatureSymbol, astForError: AST, context: PullTypeResolutionContext, enclosingDecl: PullDecl, isNumeric: boolean) {

            var comparisonInfo = new TypeComparisonInfo();
            var resolutionContext = new PullTypeResolutionContext();

            if (!this.sourceIsSubtypeOfTarget(member.type, indexSignature.returnType, resolutionContext, comparisonInfo)) {
                if (isNumeric) {
                    if (comparisonInfo.message) {
                        context.postError(this.unitPath, astForError.minChar, astForError.getLength(), DiagnosticCode.All_numerically_named_properties_must_be_subtypes_of_numeric_indexer_type_0_NL_1,
                            [indexSignature.returnType.toString(), comparisonInfo.message], enclosingDecl);
                    } else {
                        context.postError(this.unitPath, astForError.minChar, astForError.getLength(), DiagnosticCode.All_numerically_named_properties_must_be_subtypes_of_numeric_indexer_type_0,
                            [indexSignature.returnType.toString()], enclosingDecl);
                    }
                }
                else {
                    if (comparisonInfo.message) {
                        context.postError(this.unitPath, astForError.minChar, astForError.getLength(), DiagnosticCode.All_named_properties_must_be_subtypes_of_string_indexer_type_0_NL_1,
                            [indexSignature.returnType.toString(), comparisonInfo.message], enclosingDecl);
                    } else {
                        context.postError(this.unitPath, astForError.minChar, astForError.getLength(), DiagnosticCode.All_named_properties_must_be_subtypes_of_string_indexer_type_0,
                            [indexSignature.returnType.toString()], enclosingDecl);
                    }
                }
            }
        }

        private typeCheckIfTypeMemberPropertyOkToOverride(typeSymbol: PullTypeSymbol, extendedType: PullTypeSymbol, typeMember: PullSymbol, extendedTypeMember: PullSymbol, enclosingDecl: PullDecl, comparisonInfo: TypeComparisonInfo) {

            if (!typeSymbol.isClass()) {
                return true;
            }

            var typeMemberKind = typeMember.kind;
            var extendedMemberKind = extendedTypeMember.kind;

            if (typeMemberKind === extendedMemberKind) {
                return true;
            }

            var errorCode: string;
            if (typeMemberKind === PullElementKind.Property) {
                if (typeMember.isAccessor()) {
                    errorCode = DiagnosticCode.Class_0_defines_instance_member_accessor_1_but_extended_class_2_defines_it_as_instance_member_function;
                } else {
                    errorCode = DiagnosticCode.Class_0_defines_instance_member_property_1_but_extended_class_2_defines_it_as_instance_member_function;
                }
            } else if (typeMemberKind === PullElementKind.Method) {
                if (extendedTypeMember.isAccessor()) {
                    errorCode = DiagnosticCode.Class_0_defines_instance_member_function_1_but_extended_class_2_defines_it_as_instance_member_accessor;
                } else {
                    errorCode = DiagnosticCode.Class_0_defines_instance_member_function_1_but_extended_class_2_defines_it_as_instance_member_property;
                }
            }

            var message = getDiagnosticMessage(errorCode, [typeSymbol.toString(), typeMember.getScopedNameEx().toString(), extendedType.toString()]);
            comparisonInfo.addMessage(message);
            return false;
        }

        private typeCheckIfTypeExtendsType(typeDecl: TypeDeclaration, typeSymbol: PullTypeSymbol, extendedType: PullTypeSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext) {
            var typeMembers = typeSymbol.getMembers();

            var resolutionContext = new PullTypeResolutionContext();
            var comparisonInfo = new TypeComparisonInfo();
            var foundError = false;

            // Check members
            for (var i = 0; i < typeMembers.length; i++) {
                var propName = typeMembers[i].name;
                var extendedTypeProp = extendedType.findMember(propName);
                if (extendedTypeProp) {
                    foundError = !this.typeCheckIfTypeMemberPropertyOkToOverride(typeSymbol, extendedType, typeMembers[i], extendedTypeProp, enclosingDecl, comparisonInfo);

                    if (!foundError) {
                        foundError = !this.sourcePropertyIsSubtypeOfTargetProperty(typeSymbol, extendedType, typeMembers[i], extendedTypeProp, resolutionContext, comparisonInfo);
                    }

                    if (foundError) {
                        break;
                    }
                }
            }

            // Check call signatures
            if (!foundError && typeSymbol.hasOwnCallSignatures()) {
                foundError = !this.sourceCallSignaturesAreSubtypeOfTargetCallSignatures(typeSymbol, extendedType, resolutionContext, comparisonInfo);
            }

            // Check construct signatures
            if (!foundError && typeSymbol.hasOwnConstructSignatures()) {
                foundError = !this.sourceConstructSignaturesAreSubtypeOfTargetConstructSignatures(typeSymbol, extendedType, resolutionContext, comparisonInfo);
            }

            // Check index signatures
            if (!foundError && typeSymbol.hasOwnIndexSignatures()) {
                foundError = !this.sourceIndexSignaturesAreSubtypeOfTargetIndexSignatures(typeSymbol, extendedType, resolutionContext, comparisonInfo);
            }

            if (!foundError && typeSymbol.isClass()) {
                // If there is base class verify the constructor type is subtype of base class
                var typeConstructorType = typeSymbol.getConstructorMethod().type;
                var typeConstructorTypeMembers = typeConstructorType.getMembers();
                if (typeConstructorTypeMembers.length) {
                    var extendedConstructorType = extendedType.getConstructorMethod().type;
                    var comparisonInfoForPropTypeCheck = new TypeComparisonInfo(comparisonInfo);

                    // Verify that all the overriden members of the constructor type are compatible
                    for (var i = 0; i < typeConstructorTypeMembers.length; i++) {
                        var propName = typeConstructorTypeMembers[i].name;
                        var extendedConstructorTypeProp = extendedConstructorType.findMember(propName);
                        if (extendedConstructorTypeProp) {
                            if (!extendedConstructorTypeProp.isResolved) {
                                var extendedClassAst = this.currentUnit.getASTForSymbol(extendedType);
                                var extendedClassDecl = this.currentUnit.getDeclForAST(extendedClassAst);
                                this.resolveDeclaredSymbol(extendedConstructorTypeProp, extendedClassDecl, resolutionContext);
                            }

                            // check if type of property is subtype of extended type's property type
                            var typeConstructorTypePropType = typeConstructorTypeMembers[i].type;
                            var extendedConstructorTypePropType = extendedConstructorTypeProp.type;
                            if (!this.sourceIsSubtypeOfTarget(typeConstructorTypePropType, extendedConstructorTypePropType, resolutionContext, comparisonInfoForPropTypeCheck)) {
                                var propMessage: string;
                                if (comparisonInfoForPropTypeCheck.message) {
                                    propMessage = getDiagnosticMessage(DiagnosticCode.Types_of_static_property_0_of_class_1_and_class_2_are_incompatible_NL_3,
                                        [extendedConstructorTypeProp.getScopedNameEx().toString(), typeSymbol.toString(), extendedType.toString(), comparisonInfoForPropTypeCheck.message]);
                                } else {
                                    propMessage = getDiagnosticMessage(DiagnosticCode.Types_of_static_property_0_of_class_1_and_class_2_are_incompatible,
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
                var errorCode: string;
                if (typeSymbol.isClass()) {
                    errorCode = DiagnosticCode.Class_0_cannot_extend_class_1_NL_2;
                } else {
                    if (extendedType.isClass()) {
                        errorCode = DiagnosticCode.Interface_0_cannot_extend_class_1_NL_2;
                    } else {
                        errorCode = DiagnosticCode.Interface_0_cannot_extend_interface_1_NL_2;
                    }
                }

                context.postError(this.unitPath, typeDecl.name.minChar, typeDecl.name.getLength(), errorCode, [typeSymbol.getScopedName(), extendedType.getScopedName(), comparisonInfo.message], enclosingDecl);
            }
        }

        private typeCheckIfClassImplementsType(classDecl: TypeDeclaration, classSymbol: PullTypeSymbol, implementedType: PullTypeSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext) {

            var resolutionContext = new PullTypeResolutionContext();
            var comparisonInfo = new TypeComparisonInfo();
            var foundError = !this.sourceMembersAreSubtypeOfTargetMembers(classSymbol, implementedType, resolutionContext, comparisonInfo);
            if (!foundError) {
                foundError = !this.sourceCallSignaturesAreSubtypeOfTargetCallSignatures(classSymbol, implementedType, resolutionContext, comparisonInfo);
                if (!foundError) {
                    foundError = !this.sourceConstructSignaturesAreSubtypeOfTargetConstructSignatures(classSymbol, implementedType, resolutionContext, comparisonInfo);
                    if (!foundError) {
                        foundError = !this.sourceIndexSignaturesAreSubtypeOfTargetIndexSignatures(classSymbol, implementedType, resolutionContext, comparisonInfo);
                    }
                }
            }

            // Report error
            if (foundError) {
                var errorCode = implementedType.isClass() ?
                    DiagnosticCode.Class_0_declares_class_1_as_an_implemented_interface_but_does_not_implement_it_NL_2 :
                    DiagnosticCode.Class_0_declares_interface_1_but_does_not_implement_it_NL_2;

                context.postError(this.unitPath, classDecl.name.minChar, classDecl.name.getLength(), errorCode, [classSymbol.getScopedName(), implementedType.getScopedName(), comparisonInfo.message], enclosingDecl);
            }
        }

        private typeCheckBase(typeDeclAst: TypeDeclaration,
            typeSymbol: PullTypeSymbol, baseDeclAST: AST,
            isExtendedType: boolean,
            enclosingDecl: PullDecl,
            context: PullTypeResolutionContext) {

            var typeDecl = this.getDeclForAST(typeDeclAst);
            var contextForBaseTypeResolution = new PullTypeResolutionContext();
            contextForBaseTypeResolution.isResolvingClassExtendedType = true;

            var baseType = <PullTypeSymbol>this.resolveAST(baseDeclAST, false, enclosingDecl, context);
            contextForBaseTypeResolution.isResolvingClassExtendedType = false;

            var typeDeclIsClass = typeSymbol.isClass();

            if (!typeSymbol.isValidBaseKind(baseType, isExtendedType)) {
                // Report error about invalid base kind
                if (baseType.isError()) {
                    var error = (<PullErrorTypeSymbol>baseType).getDiagnostic();
                    if (error) {
                        context.postError(this.unitPath, baseDeclAST.minChar, baseDeclAST.getLength(), error.diagnosticKey(), error.arguments(), enclosingDecl);
                    }
                } else if (isExtendedType) {
                    if (typeDeclIsClass) {
                        context.postError(this.unitPath, baseDeclAST.minChar, baseDeclAST.getLength(), DiagnosticCode.A_class_may_only_extend_another_class, null, enclosingDecl);
                    } else {
                        context.postError(this.unitPath, baseDeclAST.minChar, baseDeclAST.getLength(), DiagnosticCode.An_interface_may_only_extend_another_class_or_interface, null, enclosingDecl);
                    }
                } else {
                    context.postError(this.unitPath, baseDeclAST.minChar, baseDeclAST.getLength(), DiagnosticCode.A_class_may_only_implement_another_class_or_interface, null, enclosingDecl);
                }
                return;
            }

            // Check if its a recursive extend/implement type
            if ((<PullTypeSymbol>baseType.getRootSymbol()).hasBase(<PullTypeSymbol>typeSymbol.getRootSymbol())) {
                typeSymbol.setHasBaseTypeConflict();
                baseType.setHasBaseTypeConflict();
                // Report error
                context.postError(this.unitPath,
                    typeDeclAst.name.minChar,
                    typeDeclAst.name.getLength(),
                    typeDeclIsClass ? DiagnosticCode.Class_0_is_recursively_referenced_as_a_base_type_of_itself : DiagnosticCode.Interface_0_is_recursively_referenced_as_a_base_type_of_itself, [typeSymbol.getScopedName()],
                    enclosingDecl);
                return;
            }

            if (isExtendedType) {
                // Verify all own overriding members are subtype
                this.typeCheckIfTypeExtendsType(typeDeclAst, typeSymbol, baseType, enclosingDecl, context);
            } else {
                // If class implementes interface or class, verify all the public members are implemented
                this.typeCheckIfClassImplementsType(typeDeclAst, typeSymbol, baseType, enclosingDecl, context);
            }

            // Privacy error:
            this.checkTypePrivacy(typeSymbol, baseType, context, (errorTypeSymbol: PullTypeSymbol) =>
                this.baseListPrivacyErrorReporter(typeDeclAst, typeSymbol, baseDeclAST, isExtendedType, errorTypeSymbol, context));
        }

        private typeCheckBases(typeDeclAst: TypeDeclaration, typeSymbol: PullTypeSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext) {
            if (!typeDeclAst.extendsList && !typeDeclAst.implementsList) {
                return;
            }

            if (typeDeclAst.extendsList) {
                for (var i = 0; i < typeDeclAst.extendsList.members.length; i++) {
                    this.typeCheckBase(typeDeclAst, typeSymbol, typeDeclAst.extendsList.members[i], true, enclosingDecl, context);
                }
            }

            if (typeSymbol.isClass()) {
                if (typeDeclAst.implementsList) {
                    for (var i = 0; i < typeDeclAst.implementsList.members.length; i++) {
                        this.typeCheckBase(typeDeclAst, typeSymbol, typeDeclAst.implementsList.members[i], false, enclosingDecl, context);
                    }
                }
            }
            else if (typeDeclAst.implementsList) {
                context.postError(this.unitPath, typeDeclAst.implementsList.minChar, typeDeclAst.implementsList.getLength(), DiagnosticCode.An_interface_cannot_implement_another_type, null, enclosingDecl);
            }
        }

        private checkAssignability(ast: AST, source: PullTypeSymbol, target: PullTypeSymbol, enclosingDecl: PullDecl, context: PullTypeResolutionContext): void {
            var comparisonInfo = new TypeComparisonInfo();

            var isAssignable = this.sourceIsAssignableToTarget(source, target, context, comparisonInfo);

            if (!isAssignable) {
                if (comparisonInfo.message) {
                    context.postError(this.unitPath, ast.minChar, ast.getLength(), DiagnosticCode.Cannot_convert_0_to_1_NL_2, [source.toString(), target.toString(), comparisonInfo.message], enclosingDecl);
                } else {
                    context.postError(this.unitPath, ast.minChar, ast.getLength(), DiagnosticCode.Cannot_convert_0_to_1, [source.toString(), target.toString()], enclosingDecl);
                }
            }
        }

        private isValidLHS(ast: AST, expressionSymbol: PullSymbol): boolean {
            var expressionTypeSymbol = expressionSymbol.type;

            if (ast.nodeType() === NodeType.ElementAccessExpression ||
                this.isAnyOrEquivalent(expressionTypeSymbol)) {
                return true;
            }
            else if (!expressionSymbol.isType() || expressionTypeSymbol.isArray()) {
                return ((expressionSymbol.kind & PullElementKind.SomeLHS) != 0) && !expressionSymbol.hasFlag(TypeScript.PullElementFlags.Enum);
            }

            return false;
        }
    }

    export class TypeComparisonInfo {
        public onlyCaptureFirstError = false;
        public flags: TypeRelationshipFlags = TypeRelationshipFlags.SuccessfulComparison;
        public message = "";
        public stringConstantVal: AST = null;
        private indent = 1;

        constructor(sourceComparisonInfo?: TypeComparisonInfo) {
            if (sourceComparisonInfo) {
                this.flags = sourceComparisonInfo.flags;
                this.onlyCaptureFirstError = sourceComparisonInfo.onlyCaptureFirstError;
                this.stringConstantVal = sourceComparisonInfo.stringConstantVal;
                this.indent = sourceComparisonInfo.indent + 1;
            }
        }

        private indentString(): string {
            var result = "";

            for (var i = 0; i < this.indent; i++) {
                result += "\t";
            }

            return result;
        }

        public addMessage(message) {
            if (!this.onlyCaptureFirstError && this.message) {
                this.message = this.message + TypeScript.newLine() + this.indentString() + message;
            }
            else {
                this.message = this.indentString() + message;
            }
        }

        public setMessage(message) {
            this.message = this.indentString() + message;
        }
    }
}