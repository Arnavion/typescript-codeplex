﻿//﻿
// Copyright (c) Microsoft Corporation.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='formatting.ts' />

module TypeScript.Formatting {
    export class Formatter extends MultipleTokenIndenter {
        private previousTokenSpan: TokenSpan = null;
        private previousTokenParent: IndentationNodeContext = null;

        // TODO: implement it with skipped tokens in Fidelity
        private scriptHasErrors: bool = false;

        private rulesProvider: RulesProvider;
        private formattingRequestKind: FormattingRequestKind;
        private formattingContext: FormattingContext;

        constructor(textSpan: TextSpan,
            sourceUnit: SourceUnitSyntax,
            indentFirstToken: bool,
            options: FormattingOptions,
            snapshot: ITextSnapshot,
            rulesProvider: RulesProvider,
            formattingRequestKind: FormattingRequestKind) {

            super(textSpan, sourceUnit, snapshot, indentFirstToken, options);

            this.previousTokenParent = this.parent().clone(this.indentationNodeContextPool());

            this.rulesProvider = rulesProvider;
            this.formattingRequestKind = formattingRequestKind;
            this.formattingContext = new FormattingContext(this.snapshot(), this.formattingRequestKind);
        }

        public static getEdits(textSpan: TextSpan,
            sourceUnit: SourceUnitSyntax,
            options: FormattingOptions,
            indentFirstToken: bool,
            snapshot: ITextSnapshot,
            rulesProvider: RulesProvider,
            formattingRequestKind: FormattingRequestKind): TextEditInfo[] {
            var walker = new Formatter(textSpan, sourceUnit, indentFirstToken, options, snapshot, rulesProvider, formattingRequestKind);
            sourceUnit.accept(walker);
            return walker.edits();
        }

        private visitTokenInSpan(token: ISyntaxToken): void {
            if (token.fullWidth() !== 0) {
                var tokenSpan = new TextSpan(this.position() + token.leadingTriviaWidth(), token.width());
                if (this.textSpan().containsTextSpan(tokenSpan)) {
                    this.processToken(token);
                }
            }

            // Call the base class to process the token and indent it if needed
            super.visitTokenInSpan(token);
        }

        private processToken(token: ISyntaxToken): void {
            var position = this.position();

            // Extract any leading comments
            if (token.leadingTriviaWidth() !== 0) {
                this.processTrivia(token.leadingTrivia(), position);
                position += token.leadingTriviaWidth();
            }

            // Push the token
            if (token.kind() !== SyntaxKind.EndOfFileToken) {
                var currentTokenSpan = new TokenSpan(token.kind(), position, token.width());
                if (this.previousTokenSpan) {
                    this.formatPair(this.previousTokenSpan, this.previousTokenParent, currentTokenSpan, this.parent());
                }
                this.previousTokenSpan = currentTokenSpan;
                if (this.previousTokenParent) {
                    // Make sure to clear the previous parent before assigning a new value to it
                    this.indentationNodeContextPool().releaseNode(this.previousTokenParent, /* recursive */true);
                }
                this.previousTokenParent = this.parent().clone(this.indentationNodeContextPool());
                position += token.width();

                // Extract any trailing comments
                if (token.trailingTriviaWidth() !== 0) {
                    this.processTrivia(token.trailingTrivia(), position);
                }
            }
        }

        private processTrivia(triviaList: ISyntaxTriviaList, fullStart: number) {
            var position = fullStart;

            for (var i = 0, n = triviaList.count(); i < n ; i++) {
                var trivia = triviaList.syntaxTriviaAt(i);
                if (trivia.isComment()) {
                    var currentTokenSpan = new TokenSpan(trivia.kind(), position, trivia.fullWidth());
                    if (this.previousTokenSpan) {
                        this.formatPair(this.previousTokenSpan, this.previousTokenParent, currentTokenSpan, this.parent());
                    }
                    this.previousTokenSpan = currentTokenSpan;
                    if (this.previousTokenParent) {
                        // Make sure to clear the previous parent before assigning a new value to it
                        this.indentationNodeContextPool().releaseNode(this.previousTokenParent, /* recursive */true);
                    }
                    this.previousTokenParent = this.parent().clone(this.indentationNodeContextPool());
                }

                position += trivia.fullWidth();
            }
        }

        private findCommonParents(parent1: IndentationNodeContext, parent2: IndentationNodeContext): IndentationNodeContext {
            // TODO: disable debug assert message

            var shallowParent: IndentationNodeContext;
            var shallowParentDepth: number;
            var deepParent: IndentationNodeContext;
            var deepParentDepth: number;

            if (parent1.depth() < parent2.depth()) {
                shallowParent = parent1;
                shallowParentDepth = parent1.depth();
                deepParent = parent2;
                deepParentDepth = parent2.depth();
            }
            else {
                shallowParent = parent2;
                shallowParentDepth = parent2.depth();
                deepParent = parent1;
                deepParentDepth = parent1.depth();
            }

            Debug.assert(shallowParentDepth >= 0, "Expected shallowParentDepth >= 0");
            Debug.assert(deepParentDepth >= 0, "Expected deepParentDepth >= 0");
            Debug.assert(deepParentDepth >= shallowParentDepth, "Expected deepParentDepth >= shallowParentDepth");

            while (deepParentDepth > shallowParentDepth) {
                deepParent = <IndentationNodeContext>deepParent.parent();
                deepParentDepth--;
            }

            Debug.assert(deepParentDepth === shallowParentDepth, "Expected deepParentDepth === shallowParentDepth");

            while (deepParent.node() && shallowParent.node()) {
                if (deepParent.node() === shallowParent.node()) {
                    return deepParent;
                }
                deepParent = <IndentationNodeContext>deepParent.parent();
                shallowParent = <IndentationNodeContext>shallowParent.parent();
            }

            // The root should be the first element in the parent chain, we can not be here unless something wrong 
            // happened along the way
            throw Errors.invalidOperation();
        }

        private formatPair(t1: TokenSpan, t1Parent: IndentationNodeContext, t2: TokenSpan, t2Parent: IndentationNodeContext): void {
            var token1Line = this.getLineNumber(t1);
            var token2Line = this.getLineNumber(t2);

            // Find common parent
            var commonParent= this.findCommonParents(t1Parent, t2Parent);

            // Update the context
            this.formattingContext.updateContext(t1, t1Parent, t2, t2Parent, commonParent);

            // Find rules matching the current context
            var rule = this.rulesProvider.getRulesMap().GetRule(this.formattingContext);

            if (rule != null) {
                // Record edits from the rule
                this.RecordRuleEdits(rule, t1, t2);

                // Handle the case where the next line is moved to be the end of this line. 
                // In this case we don't indent the next line in the next pass.
                if ((rule.Operation.Action == RuleAction.Space || rule.Operation.Action == RuleAction.Delete) &&
	token1Line != token2Line) {
                    this.forceSkipIndentingNextToken();
                }

                // Handle the case where token2 is moved to the new line. 
                // In this case we indent token2 in the next pass but we set
                // sameLineIndent flag to notify the indenter that the indentation is within the line.
                if (rule.Operation.Action == RuleAction.NewLine && token1Line == token2Line) {
                    this.forceIndentNextToken();
                }
            }

            if (token1Line != token2Line) {
                this.TrimWhitespaceInLineRange(t1, token1Line, token2Line - 1);
            }
        }

        private getLineNumber(token: TokenSpan): number {
            return this.snapshot().getLineNumberFromPosition(token.start());
        }

        private TrimWhitespaceInLineRange(token: TokenSpan, startLine: number, endLine: number): void {
            for (var lineNumber = startLine; lineNumber <= endLine; ++lineNumber) {
                var line = this.snapshot().getLineFromLineNumber(lineNumber);

                this.TrimWhitespace2(token, line);
            }
        }

        private TrimWhitespace(token: TokenSpan): void {
            var line = this.snapshot().getLineFromPosition(token.start());
            this.TrimWhitespace2(token, line);
        }

        private TrimWhitespace2(token: TokenSpan, line: ITextSnapshotLine): void {
            // Don't remove the trailing spaces inside comments (this includes line comments and block comments)
            if ((token.kind() == SyntaxKind.MultiLineCommentTrivia || token.kind() == SyntaxKind.SingleLineCommentTrivia) && token.start() <= line.endPosition() && token.end() >= line.endPosition())
                return;

            var text = line.getText();
            var index = 0;

            for (index = text.length - 1; index >= 0; --index) {
                if (!CharacterInfo.isWhitespace(text.charCodeAt(index))) {
                    break;
                }
            }

            ++index;

            if (index < text.length) {
                this.recordEdit(line.startPosition() + index, line.length() - index, "");
            }
        }

        private RecordRuleEdits(rule: Rule, t1: TokenSpan, t2: TokenSpan): void {
            if (rule.Operation.Action == RuleAction.Ignore) {
                return;
            }

            var betweenSpan: TextSpan;

            switch (rule.Operation.Action) {
                case RuleAction.Delete:
                    {
                        betweenSpan = new TextSpan(t1.end(), t2.start() - t1.end());

                        if (betweenSpan.length() > 0) {
                            this.recordEdit(betweenSpan.start(), betweenSpan.length(), "");
                            return;
                        }
                    }
                    break;

                case RuleAction.NewLine:
                    {
                        if (rule.Flag == RuleFlags.CanDeleteNewLines) {
                            betweenSpan = new TextSpan(t1.end(), t1.start() - t1.end());
                        }
                        else {
                            var lengthBetween: number;
                            if (this.getLineNumber(t1) == this.getLineNumber(t2)) {
                                lengthBetween = t2.start() - t1.end();
                            }
                            else {
                                lengthBetween = this.snapshot().getLineFromPosition(t1.end()).endIncludingLineBreakPosition() - t1.end();
                            }

                            betweenSpan = new TextSpan(t1.end(), Math.max(0, lengthBetween));
                        }

                        var doEdit = false;
                        var betweenText = this.snapshot().getText(betweenSpan);

                        var lineFeedLoc = betweenText.indexOf(this.options.newLineCharacter);
                        if (lineFeedLoc < 0) {
                            // no linefeeds, do the edit
                            doEdit = true;
                        }
                        else {
                            // We only require one line feed. If there is another one, do the edit
                            lineFeedLoc = betweenText.indexOf(this.options.newLineCharacter, lineFeedLoc + 1);
                            if (lineFeedLoc >= 0) {
                                doEdit = true;
                            }
                        }

                        if (doEdit) {
                            this.recordEdit(betweenSpan.start(), betweenSpan.length(), this.options.newLineCharacter);
                            return;
                        }
                    }
                    break;

                case RuleAction.Space:
                    {
                        if (rule.Flag == RuleFlags.CanDeleteNewLines) {
                            betweenSpan = new TextSpan(t1.end(), t2.start() - t1.end());
                        }
                        else {
                            if (this.getLineNumber(t1) == this.getLineNumber(t2)) {
                                lengthBetween = t2.start() - t1.end();
                            }
                            else {
                                lengthBetween = this.snapshot().getLineFromPosition(t1.end()).endPosition() - t1.end();
                            }

                            betweenSpan = new TextSpan(t1.end(), Math.max(0, lengthBetween));
                        }

                        if (betweenSpan.length() > 1 || this.snapshot().getText(betweenSpan) != " ") {
                            this.recordEdit(betweenSpan.start(), betweenSpan.length(), " ");
                            return;
                        }
                    }
                    break;
            }
        }
    }
}
