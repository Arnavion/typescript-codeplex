///<reference path='SyntaxKind.ts' />

interface ISyntaxElement {
    kind(): SyntaxKind;

    isToken(): bool;
    isNode(): bool;
    isList(): bool;
    isSeparatedList(): bool;
    isTriviaList(): bool;
    isTrivia(): bool;

    fullWidth(): number;
    fullText(): string;
}