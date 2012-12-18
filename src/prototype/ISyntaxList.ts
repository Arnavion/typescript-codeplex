///<reference path='ISyntaxElement.ts' />
///<reference path='SyntaxNode.ts' />

interface ISyntaxList extends ISyntaxElement {
    count(): number;
    syntaxNodeAt(index: number): SyntaxNode;
    toArray(): SyntaxNode[];

    firstToken(): ISyntaxToken;
    lastToken(): ISyntaxToken;

    isTypeScriptSpecific(): bool;

    hasSkippedText(): bool;
    hasZeroWidthToken(): bool;

    syntaxNodeThatContainsPosition(position: number): SyntaxNode;
}