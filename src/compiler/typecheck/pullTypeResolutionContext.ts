// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\typescript.ts' />

module TypeScript {
    export class CandidateInferenceInfo {
        public typeParameter: PullTypeParameterSymbol = null;
        public isFixed = false;
        public inferenceCandidates: PullTypeSymbol[] = [];

        public addCandidate(candidate: PullTypeSymbol) {
            if (!this.isFixed) {
                this.inferenceCandidates[this.inferenceCandidates.length] = candidate;
            }
        }
    }

    export class ArgumentInferenceContext {
        public candidateCache: any = {};

        public getInferenceInfo(param: PullTypeParameterSymbol) {
            var info = <CandidateInferenceInfo>this.candidateCache[param.getSymbolID().toString()];

            if (!info) {
                info = new CandidateInferenceInfo();
                info.typeParameter = param;
                this.candidateCache[param.getSymbolID().toString()] = info;
            }

            return info;
        }

        public addCandidateForInference(param: PullTypeParameterSymbol, candidate: PullTypeSymbol, fix: bool) {
            var info = this.getInferenceInfo(param);

            if (candidate) {
                info.addCandidate(candidate);
            }

            if (!info.isFixed) {
                info.isFixed = fix;
            }
        }

        public getInferenceCandidates(): any[] {
            var inferenceCandidates: any[] = [];
            var info: CandidateInferenceInfo;
            var val;

            for (var infoKey in this.candidateCache) {
                info = <CandidateInferenceInfo>this.candidateCache[infoKey];

                for (var i = 0; i < info.inferenceCandidates.length; i++) {
                    val = {};
                    val[info.typeParameter.getSymbolID().toString()] = info.inferenceCandidates[i];
                    inferenceCandidates[inferenceCandidates.length] = val;
                }
            }

            return inferenceCandidates;
        }

        public inferArgumentTypes(resolver: PullTypeResolver, context: PullTypeResolutionContext): { results: { param: PullTypeParameterSymbol; type: PullTypeSymbol; }[]; unfit: bool; } {
            var info: CandidateInferenceInfo = null;

            var collection: IPullTypeCollection;

            var bestCommonType: PullTypeSymbol;

            var results: { param: PullTypeParameterSymbol; type: PullTypeSymbol; }[] = [];

            var unfit = false;

            for (var infoKey in this.candidateCache) {
                info = <CandidateInferenceInfo>this.candidateCache[infoKey];

                collection = {
                    getLength: () => { return info.inferenceCandidates.length; },
                    setTypeAtIndex: (index: number, type: PullTypeSymbol) => { },
                    getTypeAtIndex: (index: number) => {
                        return info.inferenceCandidates[index].getType();
                    }
                }

                bestCommonType = resolver.findBestCommonType(info.inferenceCandidates[0], null, collection, true, context, new TypeComparisonInfo());

                if (!bestCommonType) {
                    bestCommonType = resolver.semanticInfoChain.undefinedTypeSymbol;
                }

                if (bestCommonType == resolver.semanticInfoChain.undefinedTypeSymbol) {
                    unfit = true;
                }

                results[results.length] = { param: info.typeParameter, type: bestCommonType };
            }

            return { results: results, unfit: unfit };
        }
    }

    export class PullContextualTypeContext {

        public provisionallyTypedSymbols: PullSymbol[] = [];
        public provisionalErrors: PullError[] = [];

        constructor(public contextualType: PullTypeSymbol,
                     public provisional: bool,
                     public substitutions: any) { }

        public recordProvisionallyTypedSymbol(symbol: PullSymbol) {
            this.provisionallyTypedSymbols[this.provisionallyTypedSymbols.length] = symbol;
        }

        public invalidateProvisionallyTypedSymbols() {
            for (var i = 0; i < this.provisionallyTypedSymbols.length; i++) {
                this.provisionallyTypedSymbols[i].invalidate();
            }
        }

        public postError(error: PullError) {
            this.provisionalErrors[this.provisionalErrors.length] = error;
        }

        public hadProvisionalErrors() {
            return this.provisionalErrors.length > 0;
        }
    }

    export class PullTypeResolutionContext {
        private contextStack: PullContextualTypeContext[] = [];
        private typeSpecializationStack: any[] = [];

        public resolvingTypeReference = false;

        public resolveAggressively = false;

        public searchTypeSpace = false;

        public specializingToAny = false;

        public pushContextualType(type: PullTypeSymbol, provisional: bool, substitutions: any) {
            this.contextStack.push(new PullContextualTypeContext(type, provisional, substitutions));
        }

        public popContextualType(): PullContextualTypeContext {
            var tc = this.contextStack.pop();

            tc.invalidateProvisionallyTypedSymbols();

            return tc;
        }

        public findSubstitution(type: PullTypeSymbol) {
            var substitution: PullTypeSymbol = null;

            if (this.contextStack.length) {
                for (var i = this.contextStack.length - 1; i >= 0; i--) {
                    if (this.contextStack[i].substitutions) {
                        substitution = this.contextStack[i].substitutions[type.getSymbolID().toString()];

                        if (substitution) {
                            break;
                        }
                    }
                }
            }

            return substitution;
        }

        public getContextualType(): PullTypeSymbol {
            var context = !this.contextStack.length ? null : this.contextStack[this.contextStack.length - 1];

            if (context) {
                var type = context.contextualType;

                // if it's a type parameter, return the upper bound
                if (type.isTypeParameter() && (<PullTypeParameterSymbol>type).getConstraint()) {
                    type = (<PullTypeParameterSymbol>type).getConstraint();
                }

                var substitution = this.findSubstitution(type);

                return substitution ? substitution : type;
            }

            return null;
        }

        public inProvisionalResolution() {
            return (!this.contextStack.length ? false : this.contextStack[this.contextStack.length - 1].provisional);
        }

        public setTypeInContext(symbol: PullSymbol, type: PullTypeSymbol) {
            var substitution: PullTypeSymbol = this.findSubstitution(type);

            symbol.setType(substitution ? substitution : type);

            if (this.contextStack.length && this.inProvisionalResolution()) {
                this.contextStack[this.contextStack.length - 1].recordProvisionallyTypedSymbol(symbol);
            }
        }

        public pushTypeSpecializationCache(cache) {
            this.typeSpecializationStack[this.typeSpecializationStack.length] = cache;
        }

        public popTypeSpecializationCache() {
            if (this.typeSpecializationStack.length) {
                this.typeSpecializationStack.length--;
            }
        }

        public findSpecializationForType(type: PullTypeSymbol) {
            var specialization: PullTypeSymbol = null;

            for (var i = this.typeSpecializationStack.length - 1; i >= 0; i--) {
                specialization = (this.typeSpecializationStack[i])[type.getSymbolID().toString()];

                if (specialization) {
                    return specialization;
                }
            }

            return type;
        }

        public postError(offset: number, length: number, fileName: string, message: string, enclosingDecl: PullDecl) {
            var error = new PullError(offset, length, fileName, message);

            if (this.inProvisionalResolution()) {
                (this.contextStack[this.contextStack.length - 1]).postError(error);
            }
            else if (enclosingDecl) {
                enclosingDecl.addError(error);
            }
        }
    }
}