///<reference path='References.ts' />

module SyntaxTriviaList {
    function collectTextElements(text: IText, elements: string[], list: ISyntaxTriviaList): void {
        for (var i = 0, n = list.count(); i < n; i++) {
            list.syntaxTriviaAt(i).collectTextElements(text, elements);
        }
    }

    class EmptySyntaxTriviaList implements ISyntaxTriviaList {
        public kind(): SyntaxKind { return SyntaxKind.TriviaList; }
        public isToken(): bool { return false; }
        public isNode(): bool { return false; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }
        public isTriviaList(): bool { return true; }
        public isTrivia(): bool { return false; }
        public isMissing(): bool { return true; }

        public count(): number {
            return 0;
        }

        public syntaxTriviaAt(index: number): ISyntaxTrivia {
            throw Errors.argumentOutOfRange("index");
        }

        public fullWidth(): number {
            return 0;
        }

        public fullText(text: IText): string {
            return "";
        }

        public hasComment(): bool {
            return false;
        }

        public hasNewLine(): bool {
            return false;
        }

        public toJSON(key) {
            return [];
        }

        public collectTextElements(text: IText, elements: string[]): void { collectTextElements(text, elements, this); }
    }

    export var empty: ISyntaxTriviaList = new EmptySyntaxTriviaList();

    function isComment(trivia: ISyntaxTrivia): bool {
        return trivia.kind() === SyntaxKind.MultiLineCommentTrivia || trivia.kind() === SyntaxKind.SingleLineCommentTrivia;
    }

    class SingletonSyntaxTriviaList implements ISyntaxTriviaList {
        private item: ISyntaxTrivia;
        public isToken(): bool { return false; }
        public isNode(): bool { return false; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }
        public isTriviaList(): bool { return true; }
        public isTrivia(): bool { return false; }
        public isMissing(): bool { return this.item.isMissing(); }
        
        constructor(item: ISyntaxTrivia) {
            this.item = item;
        }

        public kind(): SyntaxKind { return SyntaxKind.TriviaList; }

        public count(): number {
            return 1;
        }

        public syntaxTriviaAt(index: number): ISyntaxTrivia {
            if (index !== 0) {
                throw Errors.argumentOutOfRange("index");
            }

            return this.item;
        }

        public fullWidth(): number {
            return this.item.fullWidth();
        }

        public fullText(text: IText): string {
            return this.item.fullText(text);
        }

        public hasComment(): bool {
            return isComment(this.item);
        }

        public hasNewLine(): bool {
            return this.item.kind() === SyntaxKind.NewLineTrivia;
        }

        public toJSON(key) {
            return [this.item];
        }

        public collectTextElements(text: IText, elements: string[]): void { collectTextElements(text, elements, this); }
    }

    class NormalSyntaxTriviaList implements ISyntaxTriviaList {
        private trivia: ISyntaxTrivia[];

        constructor(trivia: ISyntaxTrivia[]) {
            this.trivia = trivia;
        }

        public kind(): SyntaxKind { return SyntaxKind.TriviaList; }
        public isToken(): bool { return false; }
        public isNode(): bool { return false; }
        public isList(): bool { return false; }
        public isSeparatedList(): bool { return false; }
        public isTriviaList(): bool { return true; }
        public isTrivia(): bool { return false; }

        public isMissing(): bool {
            for (var i = 0, n = this.trivia.length; i < n; i++) {
                if (!this.trivia[i].isMissing()) {
                    return false;
                }
            }

            return true;
        }

        public count() {
            return this.trivia.length;
        }

        public syntaxTriviaAt(index: number): ISyntaxTrivia {
            if (index < 0 || index >= this.trivia.length) {
                throw Errors.argumentOutOfRange("index");
            }

            return this.trivia[index];
        }

        public fullWidth(): number {
            return ArrayUtilities.sum(this.trivia, t => t.fullWidth());
        }

        public fullText(text: IText): string {
            var result = "";

            for (var i = 0, n = this.trivia.length; i < n; i++) {
                result += this.trivia[i].fullText(text);
            }

            return result;
        }

        public hasComment(): bool {
            return ArrayUtilities.any(this.trivia, isComment);
        }

        public hasNewLine(): bool {
            return ArrayUtilities.any(this.trivia, t => t.kind() === SyntaxKind.NewLineTrivia);
        }

        public toJSON(key) {
            return this.trivia;
        }

        public collectTextElements(text: IText, elements: string[]): void { collectTextElements(text, elements, this); }
    }

    export function create(trivia: ISyntaxTrivia[]): ISyntaxTriviaList {
        if (trivia === undefined || trivia === null || trivia.length === 0) {
            return SyntaxTriviaList.empty;
        }

        if (trivia.length === 1) {
            return new SingletonSyntaxTriviaList(trivia[0]);
        }

        return new NormalSyntaxTriviaList(trivia);
    }
}