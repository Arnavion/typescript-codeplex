///<reference path='ISyntaxElement.ts' />
///<reference path='SyntaxNode.ts' />

interface ISyntaxList extends ISyntaxElement {
    count(): number;
    itemAt(index: number): ISyntaxNodeOrToken;
    toArray(): ISyntaxNodeOrToken[];

    firstToken(): ISyntaxToken;
    lastToken(): ISyntaxToken;

    isTypeScriptSpecific(): bool;

    hasSkippedText(): bool;
    hasZeroWidthToken(): bool;
    hasRegularExpressionToken(): bool;

    insertChildrenInto(array: ISyntaxElement[], index: number): void;
}