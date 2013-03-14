///<reference path='SyntaxWalker.generated.ts' />

///<reference path='..\Core\HashTable.ts' />
///<reference path='SyntaxToken.ts' />

module TypeScript {
    export interface ITokenInformation {
        previousToken: ISyntaxToken;
        nextToken: ISyntaxToken;
    }

    export class SyntaxInformationMap extends SyntaxWalker {
        private tokenToInformation = Collections.createHashTable(Collections.DefaultHashTableCapacity, Collections.identityHashCode);
        private elementToPosition = Collections.createHashTable(Collections.DefaultHashTableCapacity, Collections.identityHashCode);

        private _previousToken = null;
        private _previousTokenInformation: ITokenInformation = null;
        private _currentPosition = 0;
        private _elementToParent = Collections.createHashTable(Collections.DefaultHashTableCapacity, Collections.identityHashCode);

        private _parentStack: SyntaxNode[] = [];

        constructor(private trackParents: bool, private trackPreviousToken: bool) {
            super();
            this._parentStack.push(null);
        }

        public static create(node: SyntaxNode, trackParents: bool, trackPreviousToken: bool): SyntaxInformationMap {
            var map = new SyntaxInformationMap(trackParents, trackPreviousToken);
            map.visitNode(node);
            return map;
        }

        private visitNode(node: SyntaxNode): void {
            this.trackParents && this._elementToParent.add(node, ArrayUtilities.last(this._parentStack));
            this.elementToPosition.add(node, this._currentPosition);

            this.trackParents && this._parentStack.push(node);
            super.visitNode(node);
            this.trackParents && this._parentStack.pop();
        }

        private visitToken(token: ISyntaxToken): void {
            this.trackParents && this._elementToParent.add(token, ArrayUtilities.last(this._parentStack));

            if (this.trackPreviousToken) {
                var tokenInformation: ITokenInformation = {
                    previousToken: this._previousToken,
                    nextToken: null
                };

                if (this._previousTokenInformation !== null) {
                    this._previousTokenInformation.nextToken = token;
                }

                this._previousToken = token;
                this._previousTokenInformation = tokenInformation;

                this.tokenToInformation.add(token, tokenInformation);
            }

            this.elementToPosition.add(token, this._currentPosition);
            this._currentPosition += token.fullWidth();
        }

        public parent(element: ISyntaxElement): SyntaxNode {
            return this._elementToParent.get(element);
        }

        public fullStart(element: ISyntaxElement): number {
            return this.elementToPosition.get(element);
        }

        public start(element: ISyntaxElement): number {
            return this.fullStart(element) + element.leadingTriviaWidth();
        }

        public end(element: ISyntaxElement): number {
            return this.start(element) + element.width();
        }

        public previousToken(token: ISyntaxToken): ISyntaxToken {
            return this.tokenInformation(token).previousToken;
        }

        public tokenInformation(token: ISyntaxToken): ITokenInformation {
            return this.tokenToInformation.get(token);
        }

        public firstTokenInLineContainingToken(token: ISyntaxToken): ISyntaxToken {
            var current = token;
            while (true) {
                var information = this.tokenInformation(current);
                if (this.isFirstTokenInLineWorker(information)) {
                    break;
                }

                current = information.previousToken;
            }

            return current;
        }

        public isFirstTokenInLine(token: ISyntaxToken): bool {
            var information = this.tokenInformation(token);
            return this.isFirstTokenInLineWorker(information);

        }

        private isFirstTokenInLineWorker(information: ITokenInformation): bool {
            return information.previousToken === null || information.previousToken.hasTrailingNewLine();
        }
    }
}