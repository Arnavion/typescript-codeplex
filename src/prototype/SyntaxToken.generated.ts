﻿///<reference path='ISyntaxToken.ts' />
///<reference path='IText.ts' />
///<reference path='SyntaxToken.ts' />

module Syntax {
    export class VariableWidthTokenWithNoTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _textOrWidth: any;
        private _value: any = null;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, textOrWidth: any) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._textOrWidth = textOrWidth;
        }

        public clone(): ISyntaxToken {
            return new VariableWidthTokenWithNoTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._textOrWidth);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return this.width(); }
        private start(): number { return this._fullStart; }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return typeof this._textOrWidth === 'number' ? this._textOrWidth : this._textOrWidth.length; }

        public text(): string {
            if (typeof this._textOrWidth === 'number') {
                this._textOrWidth = this._sourceText.substr(
                    this.start(), this._textOrWidth, /*intern:*/ this.tokenKind === SyntaxKind.IdentifierName);
            }

            return this._textOrWidth;
        }

        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return this._value || (this._value = value(this)); }
        public hasLeadingTrivia(): bool { return false; }
        public hasLeadingComment(): bool { return false; }
        public hasLeadingNewLine(): bool { return false; }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return 0; }
        public leadingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasTrailingTrivia(): bool { return false; }
        public hasTrailingComment(): bool { return false; }
        public hasTrailingNewLine(): bool { return false; }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return 0; }
        public trailingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class VariableWidthTokenWithLeadingTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _leadingTriviaInfo: number;
        private _textOrWidth: any;
        private _value: any = null;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, leadingTriviaInfo: number, textOrWidth: any) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._leadingTriviaInfo = leadingTriviaInfo;
            this._textOrWidth = textOrWidth;
        }

        public clone(): ISyntaxToken {
            return new VariableWidthTokenWithLeadingTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._leadingTriviaInfo,
                this._textOrWidth);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return getTriviaWidth(this._leadingTriviaInfo) + this.width(); }
        private start(): number { return this._fullStart + getTriviaWidth(this._leadingTriviaInfo); }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return typeof this._textOrWidth === 'number' ? this._textOrWidth : this._textOrWidth.length; }

        public text(): string {
            if (typeof this._textOrWidth === 'number') {
                this._textOrWidth = this._sourceText.substr(
                    this.start(), this._textOrWidth, /*intern:*/ this.tokenKind === SyntaxKind.IdentifierName);
            }

            return this._textOrWidth;
        }

        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return this._value || (this._value = value(this)); }
        public hasLeadingTrivia(): bool { return true; }
        public hasLeadingComment(): bool { return hasTriviaComment(this._leadingTriviaInfo); }
        public hasLeadingNewLine(): bool { return hasTriviaNewLine(this._leadingTriviaInfo); }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return getTriviaWidth(this._leadingTriviaInfo); }
        public leadingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this._fullStart, getTriviaWidth(this._leadingTriviaInfo), /*isTrailing:*/ false); }

        public hasTrailingTrivia(): bool { return false; }
        public hasTrailingComment(): bool { return false; }
        public hasTrailingNewLine(): bool { return false; }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return 0; }
        public trailingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class VariableWidthTokenWithTrailingTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _textOrWidth: any;
        private _value: any = null;
        private _trailingTriviaInfo: number;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, textOrWidth: any, trailingTriviaInfo: number) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._textOrWidth = textOrWidth;
            this._trailingTriviaInfo = trailingTriviaInfo;
        }

        public clone(): ISyntaxToken {
            return new VariableWidthTokenWithTrailingTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._textOrWidth,
                this._trailingTriviaInfo);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return this.width() + getTriviaWidth(this._trailingTriviaInfo); }
        private start(): number { return this._fullStart; }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return typeof this._textOrWidth === 'number' ? this._textOrWidth : this._textOrWidth.length; }

        public text(): string {
            if (typeof this._textOrWidth === 'number') {
                this._textOrWidth = this._sourceText.substr(
                    this.start(), this._textOrWidth, /*intern:*/ this.tokenKind === SyntaxKind.IdentifierName);
            }

            return this._textOrWidth;
        }

        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return this._value || (this._value = value(this)); }
        public hasLeadingTrivia(): bool { return false; }
        public hasLeadingComment(): bool { return false; }
        public hasLeadingNewLine(): bool { return false; }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return 0; }
        public leadingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasTrailingTrivia(): bool { return true; }
        public hasTrailingComment(): bool { return hasTriviaComment(this._trailingTriviaInfo); }
        public hasTrailingNewLine(): bool { return hasTriviaNewLine(this._trailingTriviaInfo); }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return getTriviaWidth(this._trailingTriviaInfo); }
        public trailingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this.end(), getTriviaWidth(this._trailingTriviaInfo), /*isTrailing:*/ true); }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class VariableWidthTokenWithLeadingAndTrailingTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _leadingTriviaInfo: number;
        private _textOrWidth: any;
        private _value: any = null;
        private _trailingTriviaInfo: number;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, leadingTriviaInfo: number, textOrWidth: any, trailingTriviaInfo: number) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._leadingTriviaInfo = leadingTriviaInfo;
            this._textOrWidth = textOrWidth;
            this._trailingTriviaInfo = trailingTriviaInfo;
        }

        public clone(): ISyntaxToken {
            return new VariableWidthTokenWithLeadingAndTrailingTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._leadingTriviaInfo,
                this._textOrWidth,
                this._trailingTriviaInfo);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return getTriviaWidth(this._leadingTriviaInfo) + this.width() + getTriviaWidth(this._trailingTriviaInfo); }
        private start(): number { return this._fullStart + getTriviaWidth(this._leadingTriviaInfo); }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return typeof this._textOrWidth === 'number' ? this._textOrWidth : this._textOrWidth.length; }

        public text(): string {
            if (typeof this._textOrWidth === 'number') {
                this._textOrWidth = this._sourceText.substr(
                    this.start(), this._textOrWidth, /*intern:*/ this.tokenKind === SyntaxKind.IdentifierName);
            }

            return this._textOrWidth;
        }

        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return this._value || (this._value = value(this)); }
        public hasLeadingTrivia(): bool { return true; }
        public hasLeadingComment(): bool { return hasTriviaComment(this._leadingTriviaInfo); }
        public hasLeadingNewLine(): bool { return hasTriviaNewLine(this._leadingTriviaInfo); }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return getTriviaWidth(this._leadingTriviaInfo); }
        public leadingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this._fullStart, getTriviaWidth(this._leadingTriviaInfo), /*isTrailing:*/ false); }

        public hasTrailingTrivia(): bool { return true; }
        public hasTrailingComment(): bool { return hasTriviaComment(this._trailingTriviaInfo); }
        public hasTrailingNewLine(): bool { return hasTriviaNewLine(this._trailingTriviaInfo); }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return getTriviaWidth(this._trailingTriviaInfo); }
        public trailingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this.end(), getTriviaWidth(this._trailingTriviaInfo), /*isTrailing:*/ true); }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class FixedWidthTokenWithNoTrivia implements ISyntaxToken {
        public tokenKind: SyntaxKind;

        constructor(kind: SyntaxKind) {
            this.tokenKind = kind;
        }

        public clone(): ISyntaxToken {
            return new FixedWidthTokenWithNoTrivia(
                this.tokenKind);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return this.width(); }
        public width(): number { return this.text().length; }
        public text(): string { return SyntaxFacts.getText(this.tokenKind); }
        public fullText(): string { return this.text(); }

        public value(): any { return null; }
        public hasLeadingTrivia(): bool { return false; }
        public hasLeadingComment(): bool { return false; }
        public hasLeadingNewLine(): bool { return false; }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return 0; }
        public leadingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasTrailingTrivia(): bool { return false; }
        public hasTrailingComment(): bool { return false; }
        public hasTrailingNewLine(): bool { return false; }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return 0; }
        public trailingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class FixedWidthTokenWithLeadingTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _leadingTriviaInfo: number;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, leadingTriviaInfo: number) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._leadingTriviaInfo = leadingTriviaInfo;
        }

        public clone(): ISyntaxToken {
            return new FixedWidthTokenWithLeadingTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._leadingTriviaInfo);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return getTriviaWidth(this._leadingTriviaInfo) + this.width(); }
        private start(): number { return this._fullStart + getTriviaWidth(this._leadingTriviaInfo); }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return this.text().length; }
        public text(): string { return SyntaxFacts.getText(this.tokenKind); }
        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return null; }
        public hasLeadingTrivia(): bool { return true; }
        public hasLeadingComment(): bool { return hasTriviaComment(this._leadingTriviaInfo); }
        public hasLeadingNewLine(): bool { return hasTriviaNewLine(this._leadingTriviaInfo); }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return getTriviaWidth(this._leadingTriviaInfo); }
        public leadingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this._fullStart, getTriviaWidth(this._leadingTriviaInfo), /*isTrailing:*/ false); }

        public hasTrailingTrivia(): bool { return false; }
        public hasTrailingComment(): bool { return false; }
        public hasTrailingNewLine(): bool { return false; }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return 0; }
        public trailingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class FixedWidthTokenWithTrailingTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _trailingTriviaInfo: number;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, trailingTriviaInfo: number) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._trailingTriviaInfo = trailingTriviaInfo;
        }

        public clone(): ISyntaxToken {
            return new FixedWidthTokenWithTrailingTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._trailingTriviaInfo);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return this.width() + getTriviaWidth(this._trailingTriviaInfo); }
        private start(): number { return this._fullStart; }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return this.text().length; }
        public text(): string { return SyntaxFacts.getText(this.tokenKind); }
        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return null; }
        public hasLeadingTrivia(): bool { return false; }
        public hasLeadingComment(): bool { return false; }
        public hasLeadingNewLine(): bool { return false; }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return 0; }
        public leadingTrivia(): ISyntaxTriviaList { return Syntax.emptyTriviaList; }

        public hasTrailingTrivia(): bool { return true; }
        public hasTrailingComment(): bool { return hasTriviaComment(this._trailingTriviaInfo); }
        public hasTrailingNewLine(): bool { return hasTriviaNewLine(this._trailingTriviaInfo); }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return getTriviaWidth(this._trailingTriviaInfo); }
        public trailingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this.end(), getTriviaWidth(this._trailingTriviaInfo), /*isTrailing:*/ true); }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    export class FixedWidthTokenWithLeadingAndTrailingTrivia implements ISyntaxToken {
        private _sourceText: ISimpleText;
        private _fullStart: number;
        public tokenKind: SyntaxKind;
        private _leadingTriviaInfo: number;
        private _trailingTriviaInfo: number;

        constructor(sourceText: ISimpleText, fullStart: number,kind: SyntaxKind, leadingTriviaInfo: number, trailingTriviaInfo: number) {
            this._sourceText = sourceText;
            this._fullStart = fullStart;
            this.tokenKind = kind;
            this._leadingTriviaInfo = leadingTriviaInfo;
            this._trailingTriviaInfo = trailingTriviaInfo;
        }

        public clone(): ISyntaxToken {
            return new FixedWidthTokenWithLeadingAndTrailingTrivia(
                this._sourceText,
                this._fullStart,
                this.tokenKind,
                this._leadingTriviaInfo,
                this._trailingTriviaInfo);
        }

        public isNode(): bool { return false; }
        public isToken(): bool { return true; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }

        public kind(): SyntaxKind { return this.tokenKind; }
        public fullWidth(): number { return getTriviaWidth(this._leadingTriviaInfo) + this.width() + getTriviaWidth(this._trailingTriviaInfo); }
        private start(): number { return this._fullStart + getTriviaWidth(this._leadingTriviaInfo); }
        private end(): number { return this.start() + this.width(); }

        public width(): number { return this.text().length; }
        public text(): string { return SyntaxFacts.getText(this.tokenKind); }
        public fullText(): string { return this._sourceText.substr(this._fullStart, this.fullWidth(), /*intern:*/ false); }

        public value(): any { return null; }
        public hasLeadingTrivia(): bool { return true; }
        public hasLeadingComment(): bool { return hasTriviaComment(this._leadingTriviaInfo); }
        public hasLeadingNewLine(): bool { return hasTriviaNewLine(this._leadingTriviaInfo); }
        public hasLeadingSkippedText(): bool { return false; }
        public leadingTriviaWidth(): number { return getTriviaWidth(this._leadingTriviaInfo); }
        public leadingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this._fullStart, getTriviaWidth(this._leadingTriviaInfo), /*isTrailing:*/ false); }

        public hasTrailingTrivia(): bool { return true; }
        public hasTrailingComment(): bool { return hasTriviaComment(this._trailingTriviaInfo); }
        public hasTrailingNewLine(): bool { return hasTriviaNewLine(this._trailingTriviaInfo); }
        public hasTrailingSkippedText(): bool { return false; }
        public trailingTriviaWidth(): number { return getTriviaWidth(this._trailingTriviaInfo); }
        public trailingTrivia(): ISyntaxTriviaList { return Scanner.scanTrivia(this._sourceText, this.end(), getTriviaWidth(this._trailingTriviaInfo), /*isTrailing:*/ true); }

        public hasSkippedText(): bool { return false; }
        public toJSON(key) { return tokenToJSON(this); }
        private firstToken() { return this; }
        private lastToken() { return this; }
        private isTypeScriptSpecific() { return false; }
        private hasZeroWidthToken() { return this.fullWidth() === 0; }
        private accept(visitor: ISyntaxVisitor): any { return visitor.visitToken(this); }
        private hasRegularExpressionToken() { return SyntaxFacts.isAnyDivideOrRegularExpressionToken(this.tokenKind); }
        private realize(): ISyntaxToken { return realize(this); }
        private collectTextElements(elements: string[]): void { collectTokenTextElements(this, elements); }

        private findTokenInternal(parent: PositionedElement, position: number, fullStart: number): PositionedToken {
            return new PositionedToken(parent, this, fullStart);
        }

        public withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withLeadingTrivia(leadingTrivia);
        }

        public withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxToken {
            return this.realize().withTrailingTrivia(trailingTrivia);
        }
    }

    function collectTokenTextElements(token: ISyntaxToken, elements: string[]): void {
        (<any>token.leadingTrivia()).collectTextElements(elements);
        elements.push(token.text());
        (<any>token.trailingTrivia()).collectTextElements(elements);
    }

    export function fixedWidthToken(sourceText: ISimpleText, fullStart: number,
        kind: SyntaxKind,
        leadingTriviaInfo: number,
        trailingTriviaInfo: number): ISyntaxToken {

        if (leadingTriviaInfo === 0) {
            if (trailingTriviaInfo === 0) {
                return new FixedWidthTokenWithNoTrivia(kind);
            }
            else {
                return new FixedWidthTokenWithTrailingTrivia(sourceText, fullStart, kind, trailingTriviaInfo);
            }
        }
        else if (trailingTriviaInfo === 0) {
            return new FixedWidthTokenWithLeadingTrivia(sourceText, fullStart, kind, leadingTriviaInfo);
        }
        else {
            return new FixedWidthTokenWithLeadingAndTrailingTrivia(sourceText, fullStart, kind, leadingTriviaInfo, trailingTriviaInfo);
        }
    }

    export function variableWidthToken(sourceText: ISimpleText, fullStart: number,
        kind: SyntaxKind,
        leadingTriviaInfo: number,
        width: number,
        trailingTriviaInfo: number): ISyntaxToken {

        if (leadingTriviaInfo === 0) {
            if (trailingTriviaInfo === 0) {
                return new VariableWidthTokenWithNoTrivia(sourceText, fullStart, kind, width);
            }
            else {
                return new VariableWidthTokenWithTrailingTrivia(sourceText, fullStart, kind, width, trailingTriviaInfo);
            }
        }
        else if (trailingTriviaInfo === 0) {
            return new VariableWidthTokenWithLeadingTrivia(sourceText, fullStart, kind, leadingTriviaInfo, width);
        }
        else {
            return new VariableWidthTokenWithLeadingAndTrailingTrivia(sourceText, fullStart, kind, leadingTriviaInfo, width, trailingTriviaInfo);
        }
    }

    function getTriviaWidth(value: number): number {
        return value >>> Constants.TriviaFullWidthShift;
    }

    function hasTriviaComment(value: number): bool {
        return (value & Constants.TriviaCommentMask) !== 0;
    }

    function hasTriviaNewLine(value: number): bool {
        return (value & Constants.TriviaNewLineMask) !== 0;
    }
}