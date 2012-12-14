///<reference path='References.ts' />

interface ISyntaxToken extends ISyntaxElement {
    // Same as syntaxKind, just exposed through a property for perf.
    tokenKind: SyntaxKind;
    keywordKind(): SyntaxKind;

    width(): number;
    text(): string;

    value(): any;
    // valueText(): string;

    hasLeadingTrivia(): bool;
    hasLeadingCommentTrivia(): bool;
    hasLeadingNewLineTrivia(): bool;
    leadingTriviaWidth(): number;

    hasTrailingTrivia(): bool;
    hasTrailingCommentTrivia(): bool;
    hasTrailingNewLineTrivia(): bool;
    trailingTriviaWidth(): number;

    leadingTrivia(): ISyntaxTriviaList;
    trailingTrivia(): ISyntaxTriviaList;

    realize(): ISyntaxToken;

    withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken;
    withTrailingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxToken;

    clone(): ISyntaxToken;
}

interface IElasticToken {
    kind: SyntaxKind;
    leadingTrivia?: ISyntaxTrivia[];
    text?: string;
    trailingTrivia?: ISyntaxTrivia[];
}