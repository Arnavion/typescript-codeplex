///<reference path='References.ts' />

class Emitter extends SyntaxRewriter {
    private static spacesPerNestingLevel = 4;

    private syntaxOnly: bool;

    // The original nesting level we were at when processing our iput.
    private inputNestingLevel: number = 0;

    // The current nesting level we're out when generating the output.  If this differs from 
    // inputNestingLevel, then we'll have to indent or dedent the output based on the difference
    // between the two. 
    private outputNestingLevel: number = 0;

    constructor(syntaxOnly: bool) {
        super();

        this.syntaxOnly = syntaxOnly;
    }

    public emit(input: SourceUnitSyntax): SourceUnitSyntax {
        var sourceUnit = input.accept1(this);
        return sourceUnit;
    }

    private visitSourceUnit(node: SourceUnitSyntax): SourceUnitSyntax {
        var moduleElements: ModuleElementSyntax[] = [];

        // Note: our input and output offsets are both 0 here.  That's why we don't need to
        // explicitly adjust any of the children we get back.

        for (var i = 0, n = node.moduleElements().count(); i < n; i++) {
            var moduleElement = node.moduleElements().syntaxNodeAt(i);

            var converted = moduleElement.accept1(this);
            if (ArrayUtilities.isArray(converted)) {
                moduleElements.push.apply(moduleElements, converted);
            }
            else {
                moduleElements.push(converted);
            }
        }

        return new SourceUnitSyntax(SyntaxList.create(moduleElements), node.endOfFileToken());
    }

    private static leftmostName(name: NameSyntax): IdentifierNameSyntax {
        if (name.kind() === SyntaxKind.IdentifierName) {
            return <IdentifierNameSyntax>name;
        }
        else if (name.kind() === SyntaxKind.QualifiedName) {
            return Emitter.leftmostName((<QualifiedNameSyntax>name).left());
        }
        else {
            throw Errors.invalidOperation();
        }
    }

    private static splitModuleName(name: NameSyntax): IdentifierNameSyntax[] {
        var result: IdentifierNameSyntax[] = [];
        while (true) {
            if (name.kind() === SyntaxKind.IdentifierName) {
                result.unshift(<IdentifierNameSyntax>name);
                return result;
            }
            else if (name.kind() === SyntaxKind.QualifiedName) {
                var qualifiedName = <QualifiedNameSyntax>name;
                result.unshift(qualifiedName.right());
                name = qualifiedName.left();
            }
            else {
                throw Errors.invalidOperation();
            }
        }
    }

    //private adjustNodeIndentation(node: SyntaxNode) {
    //    var nestingOffset = this.outputNestingLevel - this.inputNestingLevel;
    //    if (nestingOffset <= 0) {
    //        return node;
    //    }

    //    var indentation = this.createIndentationTrivia();
    //    return node.accept1(new AdjustIndentationRewriter(indentation));
    //}

    private adjustListIndentation(nodes: SyntaxNode[]): SyntaxNode[] {
        var nestingOffset = this.outputNestingLevel - this.inputNestingLevel;
        if (nestingOffset <= 0) {
            return nodes;
        }

        var indentation = this.createIndentationTrivia();
        return SyntaxIndenter.indentNodes(nodes, /*indentFirstToken:*/ true, indentation);
    }

    private visitModuleDeclaration(node: ModuleDeclarationSyntax): ModuleElementSyntax[] {
        // Break up the dotted name into pieces.
        var names = Emitter.splitModuleName(node.moduleName());

        // Start with the rightmost piece.  This will be hte one that actually containers the 
        // members declared in the module.

        // Note: our output will be nested N deep based on the number of names in the module.
        // However, from our input's perspective, we're only going one deeper.
        this.outputNestingLevel += names.length;
        this.inputNestingLevel += 1;

        var moduleElements: ModuleElementSyntax[] = <ModuleElementSyntax[]>node.moduleElements().toArray();
        moduleElements = ArrayUtilities.select(moduleElements, m => m.accept1(this));

        // We recursed and processed our child elements.  Now we need to adjust them based on any
        // indentation offset we've accumulated.
        moduleElements = <ModuleElementSyntax[]>this.adjustListIndentation(moduleElements);

        // Then, for all the names left of that name, wrap what we've created in a larger module.
        // Each time we do this, we'll pop the output nesting level one
        for (var nameIndex = names.length - 1; nameIndex >= 0; nameIndex--) {
            moduleElements = this.convertModuleDeclaration(names[nameIndex], moduleElements);
            this.outputNestingLevel--;
        }

        // We're done with the children of this module.  Pop back out.
        this.inputNestingLevel -= 1;

        return moduleElements;
    }

    private createIndentationTrivia(): ISyntaxTrivia {
        var nestingOffset = this.outputNestingLevel - this.inputNestingLevel;
        Debug.assert(nestingOffset > 0);

        var spaces = Array(nestingOffset * Emitter.spacesPerNestingLevel).join(" ");
        return SyntaxTrivia.create(SyntaxKind.WhitespaceTrivia, spaces);
    }

    private createIndentationTriviaList(): ISyntaxTrivia[] {
        var nestingOffset = this.outputNestingLevel - this.inputNestingLevel;
        if (nestingOffset <= 0) {
            return [];
        }

        return [this.createIndentationTrivia()];
    }
    
    private convertModuleDeclaration(name: IdentifierNameSyntax, moduleElements: ModuleElementSyntax[]): ModuleElementSyntax[] {
        name = name.withIdentifier(
            name.identifier().withLeadingTrivia(SyntaxTriviaList.empty).withTrailingTrivia(SyntaxTriviaList.empty));

        var indentationTrivia = this.createIndentationTriviaList();
        var variableStatement = VariableStatementSyntax.create(
            new VariableDeclarationSyntax(
                SyntaxToken.createElasticKeyword({ leadingTrivia:indentationTrivia, kind: SyntaxKind.VarKeyword, trailingTrivia: [SyntaxTrivia.space] }),
                SeparatedSyntaxList.create(
                    [VariableDeclaratorSyntax.create(name.identifier())])),
            SyntaxToken.createElastic({ kind: SyntaxKind.SemicolonToken, trailingTrivia: [SyntaxTrivia.carriageReturnLineFeed] }));

        var functionExpression = FunctionExpressionSyntax.create(
            SyntaxToken.createElasticKeyword({ kind: SyntaxKind.FunctionKeyword }),
            CallSignatureSyntax.create(
                new ParameterListSyntax(
                    SyntaxToken.createElastic({ kind: SyntaxKind.OpenParenToken }),
                    SeparatedSyntaxList.create([
                        ParameterSyntax.create(name.identifier())]),
                    SyntaxToken.createElastic({ kind: SyntaxKind.CloseParenToken, trailingTrivia: [SyntaxTrivia.space]  }))),
            new BlockSyntax(
                SyntaxToken.createElastic({ kind: SyntaxKind.OpenBraceToken, trailingTrivia: [SyntaxTrivia.carriageReturnLineFeed]  }),
                SyntaxList.create(moduleElements),
                SyntaxToken.createElastic({ leadingTrivia:indentationTrivia, kind: SyntaxKind.CloseBraceToken })));

        var parenthesizedFunctionExpression = new ParenthesizedExpressionSyntax(
            SyntaxToken.createElastic({ leadingTrivia:indentationTrivia, kind: SyntaxKind.OpenParenToken }),
            functionExpression,
            SyntaxToken.createElastic({ kind: SyntaxKind.CloseParenToken }));
        
        var logicalOrExpression = new BinaryExpressionSyntax(
            SyntaxKind.LogicalOrExpression,
            name,
            SyntaxToken.createElastic({ kind: SyntaxKind.BarBarToken }),
            new ParenthesizedExpressionSyntax(
                SyntaxToken.createElastic({ kind: SyntaxKind.OpenParenToken }),
                new BinaryExpressionSyntax(
                    SyntaxKind.AssignmentExpression,
                    name,
                    SyntaxToken.createElastic({ kind: SyntaxKind.EqualsToken }),
                    new ObjectLiteralExpressionSyntax(
                        SyntaxToken.createElastic({ kind: SyntaxKind.OpenBraceToken }),
                        SeparatedSyntaxList.empty,
                        SyntaxToken.createElastic({ kind: SyntaxKind.CloseBraceToken })
                    )),
                SyntaxToken.createElastic({ kind: SyntaxKind.CloseParenToken })));

        var invocationExpression = new InvocationExpressionSyntax(
            parenthesizedFunctionExpression,
            new ArgumentListSyntax(
                SyntaxToken.createElastic({ kind: SyntaxKind.OpenParenToken }),
                SeparatedSyntaxList.create([logicalOrExpression]),
                SyntaxToken.createElastic({ kind: SyntaxKind.CloseParenToken })));

        var expressionStatement = new ExpressionStatementSyntax(
            invocationExpression,
            SyntaxToken.createElastic({ kind: SyntaxKind.SemicolonToken, trailingTrivia: [SyntaxTrivia.carriageReturnLineFeed] }));

        return [variableStatement, expressionStatement];
    }
}