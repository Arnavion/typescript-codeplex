﻿///<reference path='SlidingWindow.ts' />

///<reference path='CharacterCodes.ts' />
///<reference path='CharacterInfo.ts' />
///<reference path='Constants.ts' />
///<reference path='LanguageVersion.ts' />
///<reference path='ISyntaxToken.ts' />
///<reference path='IText.ts' />
///<reference path='..\harness\external\json2.ts' />
///<reference path='ScannerUtilities.generated.ts' />
///<reference path='StringTable.ts' />
///<reference path='SyntaxDiagnostic.ts' />
///<reference path='SyntaxFacts.ts' />
///<reference path='SyntaxKind.ts' />
///<reference path='SyntaxToken.ts' />
///<reference path='SyntaxToken.generated.ts' />
///<reference path='SyntaxTriviaList.ts' />
///<reference path='Unicode.ts' />

class Scanner implements ISlidingWindowSource {
    private slidingWindow: SlidingWindow;

    private text: IText;
    private stringTable: Collections.StringTable;
    private languageVersion: LanguageVersion;

    private static isKeywordStartCharacter: bool[] = [];
    private static isIdentifierStartCharacter: bool[] = [];
    public static isIdentifierPartCharacter: bool[] = [];
    private static isNumericLiteralStart: bool[] = [];

    private static initializeStaticData() {
        if (Scanner.isKeywordStartCharacter.length === 0) {
            Scanner.isKeywordStartCharacter = ArrayUtilities.createArray(CharacterCodes.maxAsciiCharacter, false);
            Scanner.isIdentifierStartCharacter = ArrayUtilities.createArray(CharacterCodes.maxAsciiCharacter, false);
            Scanner.isIdentifierPartCharacter = ArrayUtilities.createArray(CharacterCodes.maxAsciiCharacter, false);
            Scanner.isNumericLiteralStart = ArrayUtilities.createArray(CharacterCodes.maxAsciiCharacter, false);

            for (var character = 0; character < CharacterCodes.maxAsciiCharacter; character++) {
                if (character >= CharacterCodes.a && character <= CharacterCodes.z) {
                    Scanner.isIdentifierStartCharacter[character] = true;
                    Scanner.isIdentifierPartCharacter[character] = true;
                }
                else if ((character >= CharacterCodes.A && character <= CharacterCodes.Z) ||
                         character === CharacterCodes._ ||
                         character === CharacterCodes.$) {
                    Scanner.isIdentifierStartCharacter[character] = true;
                    Scanner.isIdentifierPartCharacter[character] = true;
                }
                else if (character >= CharacterCodes._0 && character <= CharacterCodes._9) {
                    Scanner.isIdentifierPartCharacter[character] = true;
                    Scanner.isNumericLiteralStart[character] = true;
                }
            }

            Scanner.isNumericLiteralStart[CharacterCodes.dot] = true;

            for (var keywordKind = SyntaxKind.FirstKeyword; keywordKind <= SyntaxKind.LastKeyword; keywordKind++) {
                var keyword = SyntaxFacts.getText(keywordKind);
                Scanner.isKeywordStartCharacter[keyword.charCodeAt(0)] = true;
            }
        }
    }

    //public static create(text: IText, languageVersion: LanguageVersion): Scanner {
    //    return new Scanner(text, languageVersion, new StringTable());
    //}

    constructor(text: IText, languageVersion: LanguageVersion, stringTable: Collections.StringTable) {
        Scanner.initializeStaticData();

        this.slidingWindow = new SlidingWindow(this, 2048, 0, text.length());
        this.text = text;
        this.stringTable = stringTable;
        this.languageVersion = languageVersion;
    }

    private fetchMoreItems(argument: any, sourceIndex: number, window: number[], destinationIndex: number, spaceAvailable: number): number {
        var charactersRemaining = this.text.length() - sourceIndex;
        var amountToRead = MathPrototype.min(charactersRemaining, spaceAvailable);
        this.text.copyTo(sourceIndex, window, destinationIndex, amountToRead);
        return amountToRead;
    }

    private currentCharCode(): number {
        return this.slidingWindow.currentItem(/*argument:*/ null);
    }

    // Set's the scanner to a specific position in the text.
    public setAbsoluteIndex(index: number): void {
        this.slidingWindow.setAbsoluteIndex(index);
    }

    // Scans a token starting at the current position.  Any errors encountered will be added to 
    // 'diagnostics'.
    public scan(diagnostics: SyntaxDiagnostic[], allowRegularExpression: bool): ISyntaxToken {
        var fullStart = this.slidingWindow.absoluteIndex();
        var leadingTriviaInfo = this.scanTriviaInfo(diagnostics, /*isTrailing: */ false);

        var start = this.slidingWindow.absoluteIndex();
        var kind = this.scanSyntaxToken(diagnostics, allowRegularExpression);
        var end = this.slidingWindow.absoluteIndex();

        var trailingTriviaInfo = this.scanTriviaInfo(diagnostics,/*isTrailing: */true);
        return Syntax.tokenFromText(
            this.text, fullStart, kind, leadingTriviaInfo, 
            end - start, trailingTriviaInfo);
    }

    // Scans a subsection of 'text' as trivia.
    public static scanTrivia(text: IText, start: number, length: number, isTrailing: bool): ISyntaxTriviaList {
        Debug.assert(length > 0);
        var scanner = new Scanner(text.subText(new TextSpan(start, length)), LanguageVersion.EcmaScript5, null);
        return scanner.scanTrivia(isTrailing);
    }
    
    private scanTrivia(isTrailing: bool): ISyntaxTriviaList {
        // Keep this exactly in sync with scanTriviaInfo
        var trivia: ISyntaxTrivia[] = [];

        while (true) {
            if (!this.slidingWindow.isAtEndOfSource()) {
                var ch = this.currentCharCode();

                switch (ch) {
                    case CharacterCodes.space:
                    case CharacterCodes.tab:
                    case CharacterCodes.verticalTab:
                    case CharacterCodes.formFeed:
                    case CharacterCodes.nonBreakingSpace:
                    case CharacterCodes.byteOrderMark:
                        // Normal whitespace.  Consume and continue.
                        trivia.push(this.scanWhitespaceTrivia());
                        continue;

                    case CharacterCodes.slash:
                        // Potential comment.  Consume if so.  Otherwise, break out and return.
                        var ch2 = this.slidingWindow.peekItemN(1);
                        if (ch2 === CharacterCodes.slash) {
                            trivia.push(this.scanSingleLineCommentTrivia());
                            continue;
                        }

                        if (ch2 === CharacterCodes.asterisk) {
                            trivia.push(this.scanMultiLineCommentTrivia());
                            continue;
                        }

                        // Not a comment.  Don't consume.
                        throw Errors.invalidOperation();

                    case CharacterCodes.carriageReturn:
                    case CharacterCodes.lineFeed:
                    case CharacterCodes.paragraphSeparator:
                    case CharacterCodes.lineSeparator:
                        trivia.push(this.scanLineTerminatorSequenceTrivia(ch));

                        // If we're consuming leading trivia, then we will continue consuming more 
                        // trivia (including newlines) up to the first token we see.  If we're 
                        // consuming trailing trivia, then we break after the first newline we see.
                        if (!isTrailing) {
                            continue;
                        }

                        break;

                    default:
                        throw Errors.invalidOperation();
                }
            }

            Debug.assert(trivia.length > 0);
            return Syntax.triviaList(trivia);
        }
    }

    private scanTriviaInfo(diagnostics: SyntaxDiagnostic[], isTrailing: bool): number {
        // Keep this exactly in sync with scanTrivia
        var width = 0;
        var hasComment = false;
        var hasNewLine = false;

        while (true) {
            var ch = this.currentCharCode();

            switch (ch) {
                case CharacterCodes.space:
                case CharacterCodes.tab:
                case CharacterCodes.verticalTab:
                case CharacterCodes.formFeed:
                case CharacterCodes.nonBreakingSpace:
                case CharacterCodes.byteOrderMark:
                    // Normal whitespace.  Consume and continue.
                    this.slidingWindow.moveToNextItem();
                    width++;
                    continue;

                case CharacterCodes.slash:
                    // Potential comment.  Consume if so.  Otherwise, break out and return.
                    var ch2 = this.slidingWindow.peekItemN(1);
                    if (ch2 === CharacterCodes.slash) {
                        hasComment = true;
                        width += this.scanSingleLineCommentTriviaLength();
                        continue;
                    }

                    if (ch2 === CharacterCodes.asterisk) {
                        hasComment = true;
                        width += this.scanMultiLineCommentTriviaLength(diagnostics);
                        continue;
                    }

                    // Not a comment.  Don't consume.
                    break;

                case CharacterCodes.carriageReturn:
                case CharacterCodes.lineFeed:
                case CharacterCodes.paragraphSeparator:
                case CharacterCodes.lineSeparator:
                    hasNewLine = true;
                    width += this.scanLineTerminatorSequenceLength(ch);

                    // If we're consuming leading trivia, then we will continue consuming more 
                    // trivia (including newlines) up to the first token we see.  If we're 
                    // consuming trailing trivia, then we break after the first newline we see.
                    if (!isTrailing) {
                        continue;
                    }

                    break;
            }

            return (width << Constants.TriviaFullWidthShift)
                 | (hasComment ? Constants.TriviaCommentMask : 0)
                 | (hasNewLine ? Constants.TriviaNewLineMask : 0);
        }
    }

    private isNewLineCharacter(ch: number): bool {
        switch (ch) {
            case CharacterCodes.carriageReturn:
            case CharacterCodes.lineFeed:
            case CharacterCodes.paragraphSeparator:
            case CharacterCodes.lineSeparator:
                return true;
            default:
                return false;
        }
    }

    private scanWhitespaceTrivia(): ISyntaxTrivia {
        // We're going to be extracting text out of sliding window.  Make sure it can't move past
        // this point.
        var absoluteStartIndex = this.slidingWindow.getAndPinAbsoluteIndex();

        var width = 0;
        while (true) {
            var ch = this.currentCharCode();

            switch (ch) {
                case CharacterCodes.space:
                case CharacterCodes.tab:
                case CharacterCodes.verticalTab:
                case CharacterCodes.formFeed:
                case CharacterCodes.nonBreakingSpace:
                case CharacterCodes.byteOrderMark:
                    // Normal whitespace.  Consume and continue.
                    this.slidingWindow.moveToNextItem();
                    width++;
                    continue;
            }

            break;
        }
        
        // TODO: we probably should intern whitespace.
        var text = this.substring(absoluteStartIndex, absoluteStartIndex + width, /*intern:*/ false);
        this.slidingWindow.releaseAndUnpinAbsoluteIndex(absoluteStartIndex);

        return Syntax.whitespace(text);
    }
    
    private scanSingleLineCommentTrivia(): ISyntaxTrivia {
        var absoluteStartIndex = this.slidingWindow.getAndPinAbsoluteIndex();
        var width = this.scanSingleLineCommentTriviaLength();
        
        var text = this.substring(absoluteStartIndex, absoluteStartIndex + width, /*intern:*/ false);
        this.slidingWindow.releaseAndUnpinAbsoluteIndex(absoluteStartIndex);

        return Syntax.singleLineComment(text);
    }

    private scanSingleLineCommentTriviaLength(): number {
        this.slidingWindow.moveToNextItem();
        this.slidingWindow.moveToNextItem();
        
        // The '2' is for the "//" we consumed.
        var width = 2;
        while (true) {
            if (this.slidingWindow.isAtEndOfSource() || this.isNewLineCharacter(this.currentCharCode())) {
                return width;
            }

            this.slidingWindow.moveToNextItem();
            width++;
        }
    }

    private scanMultiLineCommentTrivia(): ISyntaxTrivia {
        var absoluteStartIndex = this.slidingWindow.getAndPinAbsoluteIndex();
        var width = this.scanMultiLineCommentTriviaLength(null);
        
        var text = this.substring(absoluteStartIndex, absoluteStartIndex + width, /*intern:*/ false);
        this.slidingWindow.releaseAndUnpinAbsoluteIndex(absoluteStartIndex);

        return Syntax.multiLineComment(text);
    }

    private scanMultiLineCommentTriviaLength(diagnostics: SyntaxDiagnostic[]): number {
        this.slidingWindow.moveToNextItem();
        this.slidingWindow.moveToNextItem();

        // The '2' is for the "/*" we consumed.
        var width = 2;
        while (true) {
            if (this.slidingWindow.isAtEndOfSource()) {
                if (diagnostics !== null) {
                    diagnostics.push(new SyntaxDiagnostic(
                        this.slidingWindow.absoluteIndex(), 0, DiagnosticCode._StarSlash__expected, null));
                }

                return width;
            }

            var ch = this.currentCharCode();
            if (ch === CharacterCodes.asterisk && this.slidingWindow.peekItemN(1) === CharacterCodes.slash) {
                this.slidingWindow.moveToNextItem();
                this.slidingWindow.moveToNextItem();
                width += 2;
                return width;
            }

            this.slidingWindow.moveToNextItem();
            width++;
        }
    }

    private scanLineTerminatorSequenceTrivia(ch: number): ISyntaxTrivia {
        var absoluteStartIndex = this.slidingWindow.getAndPinAbsoluteIndex();
        var width = this.scanLineTerminatorSequenceLength(ch);
        
        var text = this.substring(absoluteStartIndex, absoluteStartIndex + width, /*intern:*/ false);
        this.slidingWindow.releaseAndUnpinAbsoluteIndex(absoluteStartIndex);

        return Syntax.trivia(SyntaxKind.NewLineTrivia, text);
    }

    private scanLineTerminatorSequenceLength(ch: number): number {
        // Consume the first of the line terminator we saw.
        this.slidingWindow.moveToNextItem();

        // If it happened to be a \r and there's a following \n, then consume both.
        if (ch === CharacterCodes.carriageReturn && this.currentCharCode() === CharacterCodes.lineFeed) {
            this.slidingWindow.moveToNextItem();
            return 2;
        }
        else {
            return 1;
        }
    }

    private scanSyntaxToken(diagnostics: SyntaxDiagnostic[], allowRegularExpression: bool): SyntaxKind {
        if (this.slidingWindow.isAtEndOfSource()) {
            return SyntaxKind.EndOfFileToken;
        }

        var character = this.currentCharCode();

        switch (character) {
            case CharacterCodes.doubleQuote:
            case CharacterCodes.singleQuote:
                return this.scanStringLiteral(diagnostics);

            // These are the set of variable width punctuation tokens.
            case CharacterCodes.slash:
                return this.scanSlashToken(allowRegularExpression);

            case CharacterCodes.dot:
                return this.scanDotToken();

            case CharacterCodes.minus:
                return this.scanMinusToken();

            case CharacterCodes.exclamation:
                return this.scanExclamationToken();

            case CharacterCodes.equals:
                return this.scanEqualsToken();

            case CharacterCodes.bar:
                return this.scanBarToken();

            case CharacterCodes.asterisk:
                return this.scanAsteriskToken();

            case CharacterCodes.plus:
                return this.scanPlusToken();

            case CharacterCodes.percent:
                return this.scanPercentToken();

            case CharacterCodes.ampersand:
                return this.scanAmpersandToken();

            case CharacterCodes.caret:
                return this.scanCaretToken();

            case CharacterCodes.lessThan:
                return this.scanLessThanToken();

            case CharacterCodes.greaterThan:
                return this.scanGreaterThanToken();

            // These are the set of fixed, single character length punctuation tokens.
            // The token kind does not depend on what follows.
            case CharacterCodes.comma:
                return this.advanceAndSetTokenKind(SyntaxKind.CommaToken);

            case CharacterCodes.colon:
                return this.advanceAndSetTokenKind(SyntaxKind.ColonToken);

            case CharacterCodes.semicolon:
                return this.advanceAndSetTokenKind(SyntaxKind.SemicolonToken);

            case CharacterCodes.tilde:
                return this.advanceAndSetTokenKind(SyntaxKind.TildeToken);

            case CharacterCodes.openParen:
                return this.advanceAndSetTokenKind(SyntaxKind.OpenParenToken);

            case CharacterCodes.closeParen:
                return this.advanceAndSetTokenKind(SyntaxKind.CloseParenToken);

            case CharacterCodes.openBrace:
                return this.advanceAndSetTokenKind(SyntaxKind.OpenBraceToken);

            case CharacterCodes.closeBrace:
                return this.advanceAndSetTokenKind(SyntaxKind.CloseBraceToken);

            case CharacterCodes.openBracket:
                return this.advanceAndSetTokenKind(SyntaxKind.OpenBracketToken);

            case CharacterCodes.closeBracket:
                return this.advanceAndSetTokenKind(SyntaxKind.CloseBracketToken);

            case CharacterCodes.question:
                return this.advanceAndSetTokenKind(SyntaxKind.QuestionToken);
        }

        if (Scanner.isNumericLiteralStart[character]) {
            return this.scanNumericLiteral();
        }

        // We run into so many identifiers (and keywords) when scanning, that we want the code to
        // be as fast as possible.  To that end, we have an extremely fast path for scanning that
        // handles the 99.9% case of no-unicode characters and no unicode escapes.
        if (Scanner.isIdentifierStartCharacter[character]) {
            var result = this.tryFastScanIdentifierOrKeyword(character);
            if (result !== SyntaxKind.None) {
                return result;
            }
        }

        if (this.isIdentifierStart(this.peekCharOrUnicodeEscape())) {
            return this.slowScanIdentifier(diagnostics);
        }

        return this.scanDefaultCharacter(character, diagnostics);
    }

    private isIdentifierStart(interpretedChar: number): bool {
        if (Scanner.isIdentifierStartCharacter[interpretedChar]) {
            return true;
        }

        return interpretedChar > CharacterCodes.maxAsciiCharacter && Unicode.isIdentifierStart(interpretedChar, this.languageVersion);
    }

    private isIdentifierPart(interpretedChar: number): bool {
        if (Scanner.isIdentifierPartCharacter[interpretedChar]) {
            return true;
        }

        return interpretedChar > CharacterCodes.maxAsciiCharacter && Unicode.isIdentifierPart(interpretedChar, this.languageVersion);
    }

    private tryFastScanIdentifierOrKeyword(firstCharacter: number): SyntaxKind {
        var startIndex = this.slidingWindow.getAndPinAbsoluteIndex();

        while (true) {
            var character = this.currentCharCode();
            if (Scanner.isIdentifierPartCharacter[character]) {
                // Still part of an identifier.  Move to the next caracter.
                this.slidingWindow.moveToNextItem();
            }
            else if (character === CharacterCodes.backslash || character > CharacterCodes.maxAsciiCharacter) {
                // We saw a \ (which could start a unicode escape), or we saw a unicode character.
                // This can't be scanned quickly.  Reset to the beginning and bail out.  We'll 
                // go and try the slow path instead.
                this.slidingWindow.rewindToPinnedIndex(startIndex);
                this.slidingWindow.releaseAndUnpinAbsoluteIndex(startIndex);
                return SyntaxKind.None;
            }
            else {
                // Saw an ascii character that wasn't a backslash and wasn't an identifier 
                // character.  This identifier is done.
                var endIndex = this.slidingWindow.absoluteIndex();

                // Also check if it a keyword if it started with a lowercase letter.
                var kind;
                if (Scanner.isKeywordStartCharacter[firstCharacter]) {
                    var offset = startIndex - this.slidingWindow.windowAbsoluteStartIndex;
                    kind = ScannerUtilities.identifierKind(this.slidingWindow.window, offset, endIndex - startIndex);
                }
                else {
                    kind = SyntaxKind.IdentifierNameToken;
                }

                this.slidingWindow.releaseAndUnpinAbsoluteIndex(startIndex);
                return kind;
            }
        }
    }

    // A slow path for scanning identifiers.  Called when we run into a unicode character or 
    // escape sequence while processing the fast path.
    private slowScanIdentifier(diagnostics: SyntaxDiagnostic[]): SyntaxKind {
        var startIndex = this.slidingWindow.absoluteIndex();

        do {
            this.scanCharOrUnicodeEscape(diagnostics);
        }
        while (this.isIdentifierPart(this.peekCharOrUnicodeEscape()));

        return SyntaxKind.IdentifierNameToken;
    }

    private scanNumericLiteral(): SyntaxKind {
        if (this.isHexNumericLiteral()) {
            return this.scanHexNumericLiteral();
        }
        else {
            return this.scanDecimalNumericLiteral();
        }
    }

    private scanDecimalNumericLiteral(): SyntaxKind {
        while (CharacterInfo.isDecimalDigit(this.currentCharCode())) {
            this.slidingWindow.moveToNextItem();
        }

        if (this.currentCharCode() === CharacterCodes.dot) {
            this.slidingWindow.moveToNextItem();
        }

        while (CharacterInfo.isDecimalDigit(this.currentCharCode())) {
            this.slidingWindow.moveToNextItem();
        }

        var ch = this.currentCharCode();
        if (ch === CharacterCodes.e || ch === CharacterCodes.E) {
            this.slidingWindow.moveToNextItem();

            ch = this.currentCharCode();
            if (ch === CharacterCodes.minus || ch === CharacterCodes.plus) {
                if (CharacterInfo.isDecimalDigit(this.slidingWindow.peekItemN(1))) {
                    this.slidingWindow.moveToNextItem();
                }
            }
        }

        while (CharacterInfo.isDecimalDigit(this.currentCharCode())) {
            this.slidingWindow.moveToNextItem();
        }

        return SyntaxKind.NumericLiteral;
    }
    
    private scanHexNumericLiteral(): SyntaxKind {
        Debug.assert(this.isHexNumericLiteral());

        // Move past the 0x.
        this.slidingWindow.moveToNextItem();
        this.slidingWindow.moveToNextItem();

        while (CharacterInfo.isHexDigit(this.currentCharCode())) {
            this.slidingWindow.moveToNextItem();
        }

        return SyntaxKind.NumericLiteral;
    }

    private isHexNumericLiteral(): bool {
        if (this.currentCharCode() === CharacterCodes._0) {
            var ch = this.slidingWindow.peekItemN(1);

            if (ch === CharacterCodes.x || ch === CharacterCodes.X) {
                ch = this.slidingWindow.peekItemN(2);

                return CharacterInfo.isHexDigit(ch);
            }
        }

        return false;
    }

    private advanceAndSetTokenKind(kind: SyntaxKind): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        return kind;
    }

    private scanGreaterThanToken(): SyntaxKind {
        // NOTE(cyrusn): If we want to support generics, we will likely have to stop lexing
        // the >> and >>> constructs here and instead construct those in the parser.
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode();
        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.GreaterThanEqualsToken;
        }
        else if (character === CharacterCodes.greaterThan) {
            return this.scanGreaterThanGreaterThanToken();
        } else {
            return SyntaxKind.GreaterThanToken;
        }
    }

    private scanGreaterThanGreaterThanToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode();

        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.GreaterThanGreaterThanEqualsToken;
        }
        else if (character === CharacterCodes.greaterThan) {
            return this.scanGreaterThanGreaterThanGreaterThanToken();
        }
        else {
            return SyntaxKind.GreaterThanGreaterThanToken;
        }
    }

    private scanGreaterThanGreaterThanGreaterThanToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode();

        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
        }
        else {
            return SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
        }
    }

    private scanLessThanToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.LessThanEqualsToken;
        }
        else if (this.currentCharCode() === CharacterCodes.lessThan) {
            this.slidingWindow.moveToNextItem();
            if (this.currentCharCode() === CharacterCodes.equals) {
                this.slidingWindow.moveToNextItem();
                return SyntaxKind.LessThanLessThanEqualsToken;
            }
            else {
                return SyntaxKind.LessThanLessThanToken;
            }
        }
        else {
            return SyntaxKind.LessThanToken;
        }
    }

    private scanBarToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.BarEqualsToken;
        }
        else if (this.currentCharCode() === CharacterCodes.bar) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.BarBarToken;
        }
        else {
            return SyntaxKind.BarToken;
        }
    }

    private scanCaretToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.CaretEqualsToken;
        }
        else {
            return SyntaxKind.CaretToken;
        }
    }

    private scanAmpersandToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode();
        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.AmpersandEqualsToken;
        }
        else if (this.currentCharCode() === CharacterCodes.ampersand) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.AmpersandAmpersandToken;
        }
        else {
            return SyntaxKind.AmpersandToken;
        }
    }

    private scanPercentToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.PercentEqualsToken;
        }
        else {
            return SyntaxKind.PercentToken;
        }
    }

    private scanMinusToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode();

        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.MinusEqualsToken;
        }
        else if (character === CharacterCodes.minus) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.MinusMinusToken;
        }
        else {
            return SyntaxKind.MinusToken;
        }
    }

    private scanPlusToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode();
        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.PlusEqualsToken;
        }
        else if (character === CharacterCodes.plus) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.PlusPlusToken;
        }
        else {
            return SyntaxKind.PlusToken;
        }
    }

    private scanAsteriskToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.AsteriskEqualsToken;
        }
        else {
            return SyntaxKind.AsteriskToken;
        }
    }

    private scanEqualsToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        var character = this.currentCharCode()
        if (character === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();

            if (this.currentCharCode() === CharacterCodes.equals) {
                this.slidingWindow.moveToNextItem();

                return SyntaxKind.EqualsEqualsEqualsToken;
            }
            else {
                return SyntaxKind.EqualsEqualsToken;
            }
        }
        else if (character === CharacterCodes.greaterThan) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.EqualsGreaterThanToken;
        }
        else {
            return SyntaxKind.EqualsToken;
        }
    }

    private isDotPrefixedNumericLiteral(): bool {
        if (this.currentCharCode() === CharacterCodes.dot) {
            var ch = this.slidingWindow.peekItemN(1);
            return CharacterInfo.isDecimalDigit(ch);
        }

        return false;
    }

    private scanDotToken(): SyntaxKind {
        if (this.isDotPrefixedNumericLiteral()) {
            return this.scanNumericLiteral();
        }

        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.dot &&
            this.slidingWindow.peekItemN(1) === CharacterCodes.dot) {

            this.slidingWindow.moveToNextItem();
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.DotDotDotToken;
        }
        else {
            return SyntaxKind.DotToken;
        }
    }

    private scanSlashToken(allowRegularExpression: bool): SyntaxKind {
        // NOTE: By default, we do not try scanning a / as a regexp here.  We instead consider it a
        // div or div-assign.  Later on, if the parser runs into a situation where it would like a 
        // term, and it sees one of these then it may restart us asking specifically if we could 
        // scan out a regex.
        if (allowRegularExpression) {
            var result = this.tryScanRegularExpressionToken();
            if (result !== SyntaxKind.None) {
                return result;
            }
        }

        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();
            return SyntaxKind.SlashEqualsToken;
        }
        else {
            return SyntaxKind.SlashToken;
        }
    }

    private tryScanRegularExpressionToken(): SyntaxKind {
        Debug.assert(this.currentCharCode() === CharacterCodes.slash);

        var startIndex = this.slidingWindow.getAndPinAbsoluteIndex();
        try {
            this.slidingWindow.moveToNextItem();

            var inEscape = false;
            var inCharacterClass = false;
            while (true) {
                var ch = this.currentCharCode();
                if (this.isNewLineCharacter(ch) || this.slidingWindow.isAtEndOfSource()) {
                    this.slidingWindow.rewindToPinnedIndex(startIndex);
                    return SyntaxKind.None;
                }

                this.slidingWindow.moveToNextItem();
                if (inEscape) {
                    inEscape = false;
                    continue;
                }

                switch (ch) {
                    case CharacterCodes.backslash:
                        // We're now in an escape.  Consume the next character we see (unless it's
                        // a newline or null.
                        inEscape = true;
                        continue;
                
                    case CharacterCodes.openBracket:
                        // If we see a [ then we're starting an character class.  Note: it's ok if 
                        // we then hit another [ inside a character class.  We'll just set the value
                        // to true again and that's ok.
                        inCharacterClass = true;
                        continue;

                    case CharacterCodes.closeBracket:
                        // If we ever hit a cloe bracket then we're now no longer in a character 
                        // class.  If we weren't in a character class to begin with, then this has 
                        // no effect.
                        inCharacterClass = false;
                        continue;

                    case CharacterCodes.slash:
                        // If we see a slash, and we're in a character class, then ignore it.
                        if (inCharacterClass) {
                            continue;
                        }

                        // We're done with the regex.  Break out of the switch (which will break 
                        // out of hte loop.
                        break;

                    default:
                        // Just consume any other characters.
                        continue;
                }

                break;
            }

            // TODO: The grammar says any identifier part is allowed here.  Do we need to support
            // \u identifiers here?  The existing typescript parser does not.  
            while (Scanner.isIdentifierPartCharacter[this.currentCharCode()]) {
                this.slidingWindow.moveToNextItem();
            }

            return SyntaxKind.RegularExpressionLiteral;
        }
        finally {
            this.slidingWindow.releaseAndUnpinAbsoluteIndex(startIndex);
        }
    }

    private scanExclamationToken(): SyntaxKind {
        this.slidingWindow.moveToNextItem();
        if (this.currentCharCode() === CharacterCodes.equals) {
            this.slidingWindow.moveToNextItem();

            if (this.currentCharCode() === CharacterCodes.equals) {
                this.slidingWindow.moveToNextItem();

                return SyntaxKind.ExclamationEqualsEqualsToken;
            }
            else {
                return SyntaxKind.ExclamationEqualsToken;
            }
        }
        else {
            return SyntaxKind.ExclamationToken;
        }
    }

    private scanDefaultCharacter(character: number, diagnostics: SyntaxDiagnostic[]): SyntaxKind {
        var position = this.slidingWindow.absoluteIndex();
        this.slidingWindow.moveToNextItem();

        var text = String.fromCharCode(character);
        var messageText = this.getErrorMessageText(text);
        diagnostics.push(new SyntaxDiagnostic(
            position, 1, DiagnosticCode.Unexpected_character_0, [messageText]));

        return SyntaxKind.ErrorToken;
    }

    // Convert text into a printable form usable for an error message.  This will both quote the 
    // string, and ensure all characters printable (i.e. by using unicode escapes when they're not).
    private getErrorMessageText(text: string): string {
        // For just a simple backslash, we return it as is.  The default behavior of JSON2.stringify
        // is not what we want here.
        if (text === "\\") {
            return '"\\"';
        }

        return JSON2.stringify(text);
    }

    // Code for if we ever want the value of a string literal:
    //    private skipEscapeSequence(diagnostics: SyntaxDiagnostic[]): void {
    //    Debug.assert(this.currentCharCode() === CharacterCodes.backslash);

    //    var rewindPoint = this.slidingWindow.getAndPinAbsoluteIndex();
    //    try {
    //    // Consume the backslash.
    //        this.slidingWindow.moveToNextItem();

    //    // Get the char after the backslash
    //        var ch = this.currentCharCode();
    //        this.slidingWindow.moveToNextItem();
    //        switch (ch) {
    //            case CharacterCodes.singleQuote:
    //            case CharacterCodes.doubleQuote:
    //            case CharacterCodes.backslash:
    //                // value is ch itself;
    //                return;

    //            case CharacterCodes._0:
    //                // TODO: Deal with this part of the spec rule: 0 [lookahead ∉DecimalDigit]
    //                // value is CharacterCodes.nullCharacter;
    //                return;

    //            case CharacterCodes.b:
    //                // value is CharacterCodes.backspace;
    //                return;

    //            case CharacterCodes.f:
    //                // value is CharacterCodes.formFeed;
    //                return;

    //            case CharacterCodes.n:
    //                // value is CharacterCodes.newLine;
    //                return;

    //            case CharacterCodes.r:
    //                // value is CharacterCodes.carriageReturn;
    //                return;

    //            case CharacterCodes.t:
    //                // value is CharacterCodes.tab;
    //                return;

    //            case CharacterCodes.v:
    //                // value is CharacterCodes.verticalTab;
    //                return;

    //            case CharacterCodes.x:
    //            case CharacterCodes.u:
    //                this.rewind(rewindPoint);
    //                var value = this.scanUnicodeOrHexEscape(diagnostics);
    //                return;

    //            case CharacterCodes.carriageReturn:
    //                // If it's \r\n then consume both characters.
    //                if (this.currentCharCode() === CharacterCodes.lineFeed) {
    //                    this.slidingWindow.moveToNextItem();
    //                }
    //                return;
    //            case CharacterCodes.lineFeed:
    //            case CharacterCodes.paragraphSeparator:
    //            case CharacterCodes.lineSeparator:
    //                return;

    //            default:
    //                // Any other character is ok as well.  As per rule:
    //                // EscapeSequence :: CharacterEscapeSequence
    //                // CharacterEscapeSequence :: NonEscapeCharacter
    //                // NonEscapeCharacter :: SourceCharacter but notEscapeCharacter or LineTerminator
    //                return;
    //        }
    //    }
    //    finally {
    //        this.releaseAndUnpinAbsoluteIndex(rewindPoint);
    //    }
    //}

    private skipEscapeSequence(diagnostics: SyntaxDiagnostic[]): void {
        Debug.assert(this.currentCharCode() === CharacterCodes.backslash);

        var rewindPoint = this.slidingWindow.getAndPinAbsoluteIndex();
        try {
            // Consume the backslash.
            this.slidingWindow.moveToNextItem();

            // Get the char after the backslash
            var ch = this.currentCharCode();
            this.slidingWindow.moveToNextItem();
            switch (ch) {
                case CharacterCodes.x:
                case CharacterCodes.u:
                    this.slidingWindow.rewindToPinnedIndex(rewindPoint);
                    var value = this.scanUnicodeOrHexEscape(diagnostics);
                    return;

                case CharacterCodes.carriageReturn:
                    // If it's \r\n then consume both characters.
                    if (this.currentCharCode() === CharacterCodes.lineFeed) {
                        this.slidingWindow.moveToNextItem();
                    }
                    return;

                // We don't have to do anything special about these characters.  I'm including them
                // Just so it's clear that we intentially process them in the exact same way:
                //case CharacterCodes.singleQuote:
                //case CharacterCodes.doubleQuote:
                //case CharacterCodes.backslash:
                //case CharacterCodes._0:
                //case CharacterCodes.b:
                //case CharacterCodes.f:
                //case CharacterCodes.n:
                //case CharacterCodes.r:
                //case CharacterCodes.t:
                //case CharacterCodes.v:
                //case CharacterCodes.lineFeed:
                //case CharacterCodes.paragraphSeparator:
                //case CharacterCodes.lineSeparator:
                default:
                    // Any other character is ok as well.  As per rule:
                    // EscapeSequence :: CharacterEscapeSequence
                    // CharacterEscapeSequence :: NonEscapeCharacter
                    // NonEscapeCharacter :: SourceCharacter but notEscapeCharacter or LineTerminator
                    return;
            }
        }
        finally {
            this.slidingWindow.releaseAndUnpinAbsoluteIndex(rewindPoint);
        }
    }

    private scanStringLiteral(diagnostics: SyntaxDiagnostic[]): SyntaxKind {
        var quoteCharacter = this.currentCharCode();

        Debug.assert(quoteCharacter === CharacterCodes.singleQuote || quoteCharacter === CharacterCodes.doubleQuote);

        this.slidingWindow.moveToNextItem();

        while (true) {
            var ch = this.currentCharCode();
            if (ch === CharacterCodes.backslash) {
                this.skipEscapeSequence(diagnostics);
            }
            else if (ch === quoteCharacter) {
                this.slidingWindow.moveToNextItem();
                break;
            }
            else if (this.isNewLineCharacter(ch) || this.slidingWindow.isAtEndOfSource()) {
                diagnostics.push(new SyntaxDiagnostic(
                    this.slidingWindow.absoluteIndex(), 1, DiagnosticCode.Missing_closing_quote_character, null));
                break;
            }
            else {
                this.slidingWindow.moveToNextItem();
            }
        }

        return SyntaxKind.StringLiteral;
    }

    private isUnicodeOrHexEscape(character: number): bool {
        return this.isUnicodeEscape(character) || this.isHexEscape(character);
    }

    private isUnicodeEscape(character: number): bool {
        if (character === CharacterCodes.backslash) {
            var ch2 = this.slidingWindow.peekItemN(1);
            if (ch2 === CharacterCodes.u) {
                return true;
            }
        }

        return false;
    }

    private isHexEscape(character: number): bool {
        if (character === CharacterCodes.backslash) {
            var ch2 = this.slidingWindow.peekItemN(1);
            if (ch2 === CharacterCodes.x) {
                return true;
            }
        }

        return false;
    }

    private peekCharOrUnicodeOrHexEscape(): number {
        var character = this.currentCharCode();
        if (this.isUnicodeOrHexEscape(character)) {
            return this.peekUnicodeOrHexEscape();
        }
        else {
            return character;
        }
    }

    private peekCharOrUnicodeEscape(): number {
        var character = this.currentCharCode();
        if (this.isUnicodeEscape(character)) {
            return this.peekUnicodeOrHexEscape();
        }
        else {
            return character;
        }
    }

    private peekUnicodeOrHexEscape(): number {
        var startIndex = this.slidingWindow.getAndPinAbsoluteIndex();

        // if we're peeking, then we don't want to change the position
        var ch = this.scanUnicodeOrHexEscape(/*errors:*/ null);

        this.slidingWindow.rewindToPinnedIndex(startIndex);
        this.slidingWindow.releaseAndUnpinAbsoluteIndex(startIndex);

        return ch;
    }

    private scanCharOrUnicodeEscape(errors: SyntaxDiagnostic[]): number {
        var ch = this.currentCharCode();
        if (ch === CharacterCodes.backslash) {
            var ch2 = this.slidingWindow.peekItemN(1);
            if (ch2 === CharacterCodes.u) {
                return this.scanUnicodeOrHexEscape(errors);
            }
        }

        this.slidingWindow.moveToNextItem();
        return ch;
    }

    private scanCharOrUnicodeOrHexEscape(errors: SyntaxDiagnostic[]): number {
        var ch = this.currentCharCode();
        if (ch === CharacterCodes.backslash) {
            var ch2 = this.slidingWindow.peekItemN(1);
            if (ch2 === CharacterCodes.u || ch2 === CharacterCodes.x) {
                return this.scanUnicodeOrHexEscape(errors);
            }
        }

        this.slidingWindow.moveToNextItem();
        return ch;
    }

    private scanUnicodeOrHexEscape(errors: SyntaxDiagnostic[]): number {
        var start = this.slidingWindow.absoluteIndex();
        var character = this.currentCharCode();
        Debug.assert(character === CharacterCodes.backslash);
        this.slidingWindow.moveToNextItem();

        character = this.currentCharCode();
        Debug.assert(character === CharacterCodes.u || character === CharacterCodes.x);

        var intChar = 0;
        this.slidingWindow.moveToNextItem();

        var count = character === CharacterCodes.u ? 4 : 2;

        for (var i = 0; i < count; i++) {
            var ch2 = this.currentCharCode();
            if (!CharacterInfo.isHexDigit(ch2)) {
                if (errors !== null) {
                    var end = this.slidingWindow.absoluteIndex();
                    var info = this.createIllegalEscapeDiagnostic(start, end);
                    errors.push(info);
                }

                break;
            }

            intChar = (intChar << 4) + CharacterInfo.hexValue(ch2);
            this.slidingWindow.moveToNextItem();
        }

        return intChar;
    }

    public substring(start: number, end: number, intern: bool): string {
        var length = end - start;
        var offset = start - this.slidingWindow.windowAbsoluteStartIndex;

        Debug.assert(offset >= 0);
        if (intern) {
            return this.stringTable.addCharArray(this.slidingWindow.window, offset, length);
        }
        else {
            return StringUtilities.fromCharCodeArray(this.slidingWindow.window.slice(offset, offset + length));
        }
    }

    private createIllegalEscapeDiagnostic(start: number, end: number): SyntaxDiagnostic {
        return new SyntaxDiagnostic(start, end - start,
            DiagnosticCode.Unrecognized_escape_sequence, null);
    }
}