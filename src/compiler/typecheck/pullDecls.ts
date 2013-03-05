// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='..\typescript.ts' />

module TypeScript { 

    export var pullDeclID = 0;
    export var lastBoundPullDeclId = 0;

    export class DeclSpan {
        public minChar = 0;
        public limChar = 0;
    }

    export class PullDecl {
        private declType: PullElementKind;
        
        private declName: string;

        private symbol: PullSymbol = null;

        // use this to store the signature symbol for a function declaration
        private signatureSymbol: PullSignatureSymbol = null;
        
        private childDecls: PullDecl[] = [];
        private typeParameters: PullDecl[] = [];

        private childDeclTypeCache: any = new BlockIntrinsics();
        private childDeclValueCache: any = new BlockIntrinsics();
        private childDeclTypeParameterCache: any = new BlockIntrinsics();
        
        private declID = pullDeclID++;
        
        private declFlags: PullElementFlags = PullElementFlags.None;
        
        private span: DeclSpan;
        
        private scriptName: string;

        private errors: PullError[] = null;

        private parentDecl: PullDecl = null;

        // In the case of classes, initialized modules and enums, we need to track the implicit
        // value set to the constructor or instance type.  We can use this field to make sure that on
        // edits and updates we don't leak the val decl or symbol
        private synthesizedValDecl: PullDecl = null;

        constructor (declName: string, declType: PullElementKind, declFlags: PullElementFlags, span: DeclSpan, scriptName: string) {
            this.declName = declName;
            this.declType = declType;
            this.declFlags = declFlags;
            this.span = span;
            this.scriptName = scriptName;
        }

        public getDeclID() { return this.declID; }

        public getName() { return this.declName; }
        public getKind() { return this.declType}

        public setSymbol(symbol: PullSymbol) { this.symbol = symbol; }
        public getSymbol() { return this.symbol; }

        public setSignatureSymbol(signature: PullSignatureSymbol) { this.signatureSymbol = signature; }
        public getSignatureSymbol():PullSignatureSymbol { return this.signatureSymbol; }

        public getFlags() { return this.declFlags; }
        public setFlags(flags: PullElementFlags) { this.declFlags = flags; }
        
        public getSpan() { return this.span; }
        public setSpan(span: DeclSpan) { this.span = span; }
        
        public getScriptName() { return this.scriptName; }

        public setValueDecl(valDecl: PullDecl) { this.synthesizedValDecl = valDecl; }
        public getValueDecl() { return this.synthesizedValDecl; }

        public getParentDecl() {
            return this.parentDecl;
        }

        public addError(error: PullError) {
            if (!this.errors) {
                this.errors = [];
            }

            error.adjustOffset(this.span.minChar);

            this.errors[this.errors.length] = error;
        }

        public getErrors(): PullError[]{
            return this.errors;
        }

        public setErrors(errors: PullError[]) {
            if (errors) {
                this.errors = [];
                
                // adjust the spans as we parent the errors to the new decl
                for (var i = 0; i < errors.length; i++) {
                    errors[i].adjustOffset(this.span.minChar);
                    this.errors[this.errors.length] = errors[i];
                }
            }
        }

        public resetErrors() {
            this.errors = [];
        }

        // returns 'true' if the child decl was successfully added
        // ('false' is returned if addIfDuplicate is false and there is a collision)
        public addChildDecl(childDecl: PullDecl, addIfDuplicate?=true) {
            // check if decl exists
            // merge if necessary
            var declName = childDecl.getName();

            if (!addIfDuplicate) { // PULLTODO: Check decl type?
                for (var i = 0; i < this.childDecls.length; i++) {
                    if (this.childDecls[i].getName() == declName) {
                        return false;
                    }
                }
            }

            if (childDecl.getKind() & PullElementKind.TypeParameter) {
                this.typeParameters[this.typeParameters.length] = childDecl;
            }
            else {
                this.childDecls[this.childDecls.length] = childDecl;
            }

            // add to the appropriate cache
            var cache = (childDecl.getKind() & PullElementKind.SomeType) ? (childDecl.getKind() & PullElementKind.TypeParameter) ? this.childDeclTypeParameterCache : this.childDeclTypeCache : this.childDeclValueCache;
            var cacheVal = <PullDecl[]>cache[declName];
            if (!cacheVal) {
                cacheVal = [];
            }
            cacheVal[cacheVal.length] = childDecl;

            cache[declName] = cacheVal;


            return true;
        }

        public findChildDecls(declName: string, declKind: PullElementKind): PullDecl[] {
            // find the decl with the optional type
            // if necessary, cache the decl
            // may be wise to return a chain of decls, or take a parent decl as a parameter
            var cache = (declKind & PullElementKind.SomeType) ? this.childDeclTypeCache : this.childDeclValueCache;
            var cacheVal = <PullDecl[]>cache[declName];

            if (cacheVal) {
                return cacheVal;
            }
            else {
                if (declKind & PullElementKind.SomeType) {
                    cacheVal = this.childDeclTypeParameterCache[declName];
                    
                    if (cacheVal) {
                        return cacheVal;
                    }                    
                }

                return [];
            }
        }

        public getChildDecls() { return this.childDecls; }
        public getTypeParameters() { return this.typeParameters; }
    }
}