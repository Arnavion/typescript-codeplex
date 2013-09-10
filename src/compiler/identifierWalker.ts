module TypeScript {    
    export class IdentifierWalker extends SyntaxWalker {

        constructor(public list: BlockIntrinsics<boolean>) {
            super();
        }

        public visitToken(token: ISyntaxToken): void {
            this.list[token.text()] = true;
        }
    }
}