///<reference path='References.ts' />

module TypeScript.SyntaxFacts {
    export function isDirectivePrologueElement(node: ISyntaxNodeOrToken): boolean {
        if (node.kind() === SyntaxKind.ExpressionStatement) {
            var expressionStatement = <ExpressionStatementSyntax>node;
            var expression = expressionStatement.expression;

            if (expression.kind() === SyntaxKind.StringLiteral) {
                return true;
            }
        }

        return false
    }

    export function isUseStrictDirective(node: ISyntaxNodeOrToken): boolean {
        var expressionStatement = <ExpressionStatementSyntax>node;
        var stringLiteral = <ISyntaxToken>expressionStatement.expression;

        var text = stringLiteral.text();
        return text === '"use strict"' || text === "'use strict'";
    }

    export function isIdentifierNameOrAnyKeyword(token: ISyntaxToken): boolean {
        var tokenKind = token.tokenKind;
        return tokenKind === SyntaxKind.IdentifierName || SyntaxFacts.isAnyKeyword(tokenKind);
    }
}