///<reference path='References.ts' />

class SyntaxNode implements ISyntaxElement {
    public isToken(): bool { return false; }
    public isNode(): bool{ return true; }
    public isList(): bool{ return false; }
    public isSeparatedList(): bool{ return false; }
    public isTrivia(): bool { return false; }
    public isTriviaList(): bool { return false; }

    public kind(): SyntaxKind {
        throw Errors.abstract();
    }

    public isMissing(): bool {
        throw Errors.abstract();
    }

    public toJSON(key) {
        var result: any = { kind: (<any>SyntaxKind)._map[this.kind()] };

        for (var name in this) {
            var value = this[name];
            if (value && typeof value === 'object') {
                result[name] = value;
            }
        }

        return result;
    }

    public accept(visitor: ISyntaxVisitor): void {
        throw Errors.abstract();
    }

    public accept1(visitor: ISyntaxVisitor1): any {
        throw Errors.abstract();
    }

    public realize(): SyntaxNode {
        return this.accept1(new SyntaxRealizer());
    }

    public collectTextElements(elements: string[]): void {
        throw Errors.abstract();
    }

    public fullText(): string {
        var elements: string[] = [];
        this.collectTextElements(elements);
        return elements.join("");
    }
}