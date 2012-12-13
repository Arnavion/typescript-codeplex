﻿///<reference path='References.ts' />

class SyntaxRewriter implements ISyntaxVisitor1 {
    public visitToken(token: ISyntaxToken): ISyntaxToken {
        return token;
    }

    public visitNode(node: SyntaxNode): SyntaxNode {
        return node === null ? null : node.accept1(this);
    }

    public visitList(list: ISyntaxList): ISyntaxList {
        var newItems: SyntaxNode[] = null;

        for (var i = 0, n = list.count(); i < n; i++) {
            var item = list.syntaxNodeAt(i);
            var newItem = <SyntaxNode>item.accept1(this);

            if (item !== newItem && newItems === null) {
                newItems = [];
                for (var j = 0; j < i; j++) {
                    newItems.push(list.syntaxNodeAt(j));
                }
            }

            // TODO: if we're removing the node, figure out what we can do with the trivia on it.
            if (newItems && newItem !== null) {
                newItems.push(newItem);
            }
        }

        Debug.assert(newItems === null || newItems.length === list.count());
        return newItems === null ? list : SyntaxList.create(newItems);
    }

    private static subSeparatedList(list: ISeparatedSyntaxList, length: number): ISyntaxElement[] {
        var newItems: ISyntaxElement[] = [];
        for (var j = 0; j < length; j++) {
            newItems.push(list.itemAt(j));
        }

        return newItems;
    }

    public visitSeparatedList(list: ISeparatedSyntaxList): ISeparatedSyntaxList {
        var newItems: ISyntaxElement[] = null;
        var removeNextSeparator = false;
        var validateInvariants = false;

        for (var i = 0, n = list.count(); i < n; i++) {
            var item = list.itemAt(i);
            var newItem: ISyntaxElement = null;

            if (item.isToken()) {
                if (removeNextSeparator) {
                    removeNextSeparator = false;
                    // TODO: deal with the trivia on this token in the future.
                }
                else {
                    newItem = this.visitToken(<ISyntaxToken>item);
                }
            }
            else {
                newItem = this.visitNode(<SyntaxNode>item);
                if (newItem === null) {
                    validateInvariants = true;

                    if (newItems === null) {
                        newItems = SyntaxRewriter.subSeparatedList(list, i);
                    }
                    
                    // try to remove preceding separator if any
                    if (newItems.length > 0 && newItems[newItems.length - 1].isToken()) {
                        newItems.pop();
                        // TODO: deal with the trivia on this token we're removing.
                    }
                    else {
                        // otherwise remove the next separator
                        removeNextSeparator = true;
                    }

                    // Deal with the trivia on the node we removed.
                }
            }

            if (item !== newItem && newItems === null) {
                newItems = SyntaxRewriter.subSeparatedList(list, i);
            }

            if (newItems && newItem !== null) {
                newItems.push(newItem);
            }
        }

        Debug.assert(newItems === null || newItems.length === list.count());
        return newItems === null ? list : SeparatedSyntaxList.createAndValidate(newItems, validateInvariants);
    }

    public visitSourceUnit(node: SourceUnitSyntax): any {
        return node.update(
            this.visitList(node.moduleElements()),
            this.visitToken(node.endOfFileToken()));
    }

    public visitExternalModuleReference(node: ExternalModuleReferenceSyntax): any {
        return node.update(
            this.visitToken(node.moduleKeyword()),
            this.visitToken(node.openParenToken()),
            this.visitToken(node.stringLiteral()),
            this.visitToken(node.closeParenToken()));
    }

    public visitModuleNameModuleReference(node: ModuleNameModuleReferenceSyntax): any {
        return node.withModuleName(
            <NameSyntax>this.visitNode(node.moduleName()));
    }

    public visitImportDeclaration(node: ImportDeclarationSyntax): any {
        return node.update(
            this.visitToken(node.importKeyword()),
            this.visitToken(node.identifier()),
            this.visitToken(node.equalsToken()),
            <ModuleReferenceSyntax>this.visitNode(node.moduleReference()),
            this.visitToken(node.semicolonToken()));
    }

    public visitClassDeclaration(node: ClassDeclarationSyntax): any {
        return node.update(
            node.exportKeyword() === null ? null : this.visitToken(node.exportKeyword()),
            node.declareKeyword() === null ? null : this.visitToken(node.declareKeyword()),
            this.visitToken(node.classKeyword()),
            this.visitToken(node.identifier()),
            <ExtendsClauseSyntax>this.visitNode(node.extendsClause()),
            <ImplementsClauseSyntax>this.visitNode(node.implementsClause()),
            this.visitToken(node.openBraceToken()),
            this.visitList(node.classElements()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitInterfaceDeclaration(node: InterfaceDeclarationSyntax): any {
        return node.update(
            node.exportKeyword() === null ? null : this.visitToken(node.exportKeyword()),
            this.visitToken(node.interfaceKeyword()),
            this.visitToken(node.identifier()),
            <ExtendsClauseSyntax>this.visitNode(node.extendsClause()),
            <ObjectTypeSyntax>this.visitNode(node.body()));
    }

    public visitExtendsClause(node: ExtendsClauseSyntax): any {
        return node.update(
            this.visitToken(node.extendsKeyword()),
            this.visitSeparatedList(node.typeNames()));
    }

    public visitImplementsClause(node: ImplementsClauseSyntax): any {
        return node.update(
            this.visitToken(node.implementsKeyword()),
            this.visitSeparatedList(node.typeNames()));
    }

    public visitModuleDeclaration(node: ModuleDeclarationSyntax): any {
        return node.update(
            node.exportKeyword() === null ? null : this.visitToken(node.exportKeyword()),
            node.declareKeyword() === null ? null : this.visitToken(node.declareKeyword()),
            this.visitToken(node.moduleKeyword()),
            <NameSyntax>this.visitNode(node.moduleName()),
            node.stringLiteral() === null ? null : this.visitToken(node.stringLiteral()),
            this.visitToken(node.openBraceToken()),
            this.visitList(node.moduleElements()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitFunctionDeclaration(node: FunctionDeclarationSyntax): any {
        return node.update(
            node.exportKeyword() === null ? null : this.visitToken(node.exportKeyword()),
            node.declareKeyword() === null ? null : this.visitToken(node.declareKeyword()),
            this.visitToken(node.functionKeyword()),
            <FunctionSignatureSyntax>this.visitNode(node.functionSignature()),
            <BlockSyntax>this.visitNode(node.block()),
            node.semicolonToken() === null ? null : this.visitToken(node.semicolonToken()));
    }

    public visitVariableStatement(node: VariableStatementSyntax): any {
        return node.update(
            node.exportKeyword() === null ? null : this.visitToken(node.exportKeyword()),
            node.declareKeyword() === null ? null : this.visitToken(node.declareKeyword()),
            <VariableDeclarationSyntax>this.visitNode(node.variableDeclaration()),
            this.visitToken(node.semicolonToken()));
    }

    public visitVariableDeclaration(node: VariableDeclarationSyntax): any {
        return node.update(
            this.visitToken(node.varKeyword()),
            this.visitSeparatedList(node.variableDeclarators()));
    }

    public visitVariableDeclarator(node: VariableDeclaratorSyntax): any {
        return node.update(
            this.visitToken(node.identifier()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()),
            <EqualsValueClauseSyntax>this.visitNode(node.equalsValueClause()));
    }

    public visitEqualsValueClause(node: EqualsValueClauseSyntax): any {
        return node.update(
            this.visitToken(node.equalsToken()),
            <ExpressionSyntax>this.visitNode(node.value()));
    }

    public visitPrefixUnaryExpression(node: PrefixUnaryExpressionSyntax): any {
        return node.update(
            node.kind(),
            this.visitToken(node.operatorToken()),
            <UnaryExpressionSyntax>this.visitNode(node.operand()));
    }

    public visitThisExpression(node: ThisExpressionSyntax): any {
        return node.withThisKeyword(
            this.visitToken(node.thisKeyword()));
    }

    public visitLiteralExpression(node: LiteralExpressionSyntax): any {
        return node.update(
            node.kind(),
            this.visitToken(node.literalToken()));
    }

    public visitArrayLiteralExpression(node: ArrayLiteralExpressionSyntax): any {
        return node.update(
            this.visitToken(node.openBracketToken()),
            this.visitSeparatedList(node.expressions()),
            this.visitToken(node.closeBracketToken()));
    }

    public visitOmittedExpression(node: OmittedExpressionSyntax): any {
        return node;
    }

    public visitParenthesizedExpression(node: ParenthesizedExpressionSyntax): any {
        return node.update(
            this.visitToken(node.openParenToken()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.closeParenToken()));
    }

    public visitSimpleArrowFunctionExpression(node: SimpleArrowFunctionExpressionSyntax): any {
        return node.update(
            this.visitToken(node.identifier()),
            this.visitToken(node.equalsGreaterThanToken()),
            <SyntaxNode>this.visitNode(node.body()));
    }

    public visitParenthesizedArrowFunctionExpression(node: ParenthesizedArrowFunctionExpressionSyntax): any {
        return node.update(
            <CallSignatureSyntax>this.visitNode(node.callSignature()),
            this.visitToken(node.equalsGreaterThanToken()),
            <SyntaxNode>this.visitNode(node.body()));
    }

    public visitIdentifierName(node: IdentifierNameSyntax): any {
        return node.withIdentifier(
            this.visitToken(node.identifier()));
    }

    public visitQualifiedName(node: QualifiedNameSyntax): any {
        return node.update(
            <NameSyntax>this.visitNode(node.left()),
            this.visitToken(node.dotToken()),
            <IdentifierNameSyntax>this.visitNode(node.right()));
    }

    public visitConstructorType(node: ConstructorTypeSyntax): any {
        return node.update(
            this.visitToken(node.newKeyword()),
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            this.visitToken(node.equalsGreaterThanToken()),
            <TypeSyntax>this.visitNode(node.type()));
    }

    public visitFunctionType(node: FunctionTypeSyntax): any {
        return node.update(
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            this.visitToken(node.equalsGreaterThanToken()),
            <TypeSyntax>this.visitNode(node.type()));
    }

    public visitObjectType(node: ObjectTypeSyntax): any {
        return node.update(
            this.visitToken(node.openBraceToken()),
            this.visitSeparatedList(node.typeMembers()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitArrayType(node: ArrayTypeSyntax): any {
        return node.update(
            <TypeSyntax>this.visitNode(node.type()),
            this.visitToken(node.openBracketToken()),
            this.visitToken(node.closeBracketToken()));
    }

    public visitPredefinedType(node: PredefinedTypeSyntax): any {
        return node.withKeyword(
            this.visitToken(node.keyword()));
    }

    public visitTypeAnnotation(node: TypeAnnotationSyntax): any {
        return node.update(
            this.visitToken(node.colonToken()),
            <TypeSyntax>this.visitNode(node.type()));
    }

    public visitBlock(node: BlockSyntax): any {
        return node.update(
            this.visitToken(node.openBraceToken()),
            this.visitList(node.statements()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitParameter(node: ParameterSyntax): any {
        return node.update(
            node.dotDotDotToken() === null ? null : this.visitToken(node.dotDotDotToken()),
            node.publicOrPrivateKeyword() === null ? null : this.visitToken(node.publicOrPrivateKeyword()),
            this.visitToken(node.identifier()),
            node.questionToken() === null ? null : this.visitToken(node.questionToken()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()),
            <EqualsValueClauseSyntax>this.visitNode(node.equalsValueClause()));
    }

    public visitMemberAccessExpression(node: MemberAccessExpressionSyntax): any {
        return node.update(
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.dotToken()),
            <IdentifierNameSyntax>this.visitNode(node.identifierName()));
    }

    public visitPostfixUnaryExpression(node: PostfixUnaryExpressionSyntax): any {
        return node.update(
            node.kind(),
            <ExpressionSyntax>this.visitNode(node.operand()),
            this.visitToken(node.operatorToken()));
    }

    public visitElementAccessExpression(node: ElementAccessExpressionSyntax): any {
        return node.update(
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.openBracketToken()),
            <ExpressionSyntax>this.visitNode(node.argumentExpression()),
            this.visitToken(node.closeBracketToken()));
    }

    public visitInvocationExpression(node: InvocationExpressionSyntax): any {
        return node.update(
            <ExpressionSyntax>this.visitNode(node.expression()),
            <ArgumentListSyntax>this.visitNode(node.argumentList()));
    }

    public visitArgumentList(node: ArgumentListSyntax): any {
        return node.update(
            this.visitToken(node.openParenToken()),
            this.visitSeparatedList(node.arguments()),
            this.visitToken(node.closeParenToken()));
    }

    public visitBinaryExpression(node: BinaryExpressionSyntax): any {
        return node.update(
            node.kind(),
            <ExpressionSyntax>this.visitNode(node.left()),
            this.visitToken(node.operatorToken()),
            <ExpressionSyntax>this.visitNode(node.right()));
    }

    public visitConditionalExpression(node: ConditionalExpressionSyntax): any {
        return node.update(
            <ExpressionSyntax>this.visitNode(node.condition()),
            this.visitToken(node.questionToken()),
            <ExpressionSyntax>this.visitNode(node.whenTrue()),
            this.visitToken(node.colonToken()),
            <ExpressionSyntax>this.visitNode(node.whenFalse()));
    }

    public visitConstructSignature(node: ConstructSignatureSyntax): any {
        return node.update(
            this.visitToken(node.newKeyword()),
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()));
    }

    public visitFunctionSignature(node: FunctionSignatureSyntax): any {
        return node.update(
            this.visitToken(node.identifier()),
            node.questionToken() === null ? null : this.visitToken(node.questionToken()),
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()));
    }

    public visitIndexSignature(node: IndexSignatureSyntax): any {
        return node.update(
            this.visitToken(node.openBracketToken()),
            <ParameterSyntax>this.visitNode(node.parameter()),
            this.visitToken(node.closeBracketToken()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()));
    }

    public visitPropertySignature(node: PropertySignatureSyntax): any {
        return node.update(
            this.visitToken(node.identifier()),
            node.questionToken() === null ? null : this.visitToken(node.questionToken()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()));
    }

    public visitParameterList(node: ParameterListSyntax): any {
        return node.update(
            this.visitToken(node.openParenToken()),
            this.visitSeparatedList(node.parameters()),
            this.visitToken(node.closeParenToken()));
    }

    public visitCallSignature(node: CallSignatureSyntax): any {
        return node.update(
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()));
    }

    public visitElseClause(node: ElseClauseSyntax): any {
        return node.update(
            this.visitToken(node.elseKeyword()),
            <StatementSyntax>this.visitNode(node.statement()));
    }

    public visitIfStatement(node: IfStatementSyntax): any {
        return node.update(
            this.visitToken(node.ifKeyword()),
            this.visitToken(node.openParenToken()),
            <ExpressionSyntax>this.visitNode(node.condition()),
            this.visitToken(node.closeParenToken()),
            <StatementSyntax>this.visitNode(node.statement()),
            <ElseClauseSyntax>this.visitNode(node.elseClause()));
    }

    public visitExpressionStatement(node: ExpressionStatementSyntax): any {
        return node.update(
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.semicolonToken()));
    }

    public visitConstructorDeclaration(node: ConstructorDeclarationSyntax): any {
        return node.update(
            this.visitToken(node.constructorKeyword()),
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            <BlockSyntax>this.visitNode(node.block()),
            node.semicolonToken() === null ? null : this.visitToken(node.semicolonToken()));
    }

    public visitMemberFunctionDeclaration(node: MemberFunctionDeclarationSyntax): any {
        return node.update(
            node.publicOrPrivateKeyword() === null ? null : this.visitToken(node.publicOrPrivateKeyword()),
            node.staticKeyword() === null ? null : this.visitToken(node.staticKeyword()),
            <FunctionSignatureSyntax>this.visitNode(node.functionSignature()),
            <BlockSyntax>this.visitNode(node.block()),
            node.semicolonToken() === null ? null : this.visitToken(node.semicolonToken()));
    }

    public visitGetMemberAccessorDeclaration(node: GetMemberAccessorDeclarationSyntax): any {
        return node.update(
            node.publicOrPrivateKeyword() === null ? null : this.visitToken(node.publicOrPrivateKeyword()),
            node.staticKeyword() === null ? null : this.visitToken(node.staticKeyword()),
            this.visitToken(node.getKeyword()),
            this.visitToken(node.identifier()),
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            <TypeAnnotationSyntax>this.visitNode(node.typeAnnotation()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitSetMemberAccessorDeclaration(node: SetMemberAccessorDeclarationSyntax): any {
        return node.update(
            node.publicOrPrivateKeyword() === null ? null : this.visitToken(node.publicOrPrivateKeyword()),
            node.staticKeyword() === null ? null : this.visitToken(node.staticKeyword()),
            this.visitToken(node.setKeyword()),
            this.visitToken(node.identifier()),
            <ParameterListSyntax>this.visitNode(node.parameterList()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitMemberVariableDeclaration(node: MemberVariableDeclarationSyntax): any {
        return node.update(
            node.publicOrPrivateKeyword() === null ? null : this.visitToken(node.publicOrPrivateKeyword()),
            node.staticKeyword() === null ? null : this.visitToken(node.staticKeyword()),
            <VariableDeclaratorSyntax>this.visitNode(node.variableDeclarator()),
            this.visitToken(node.semicolonToken()));
    }

    public visitThrowStatement(node: ThrowStatementSyntax): any {
        return node.update(
            this.visitToken(node.throwKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.semicolonToken()));
    }

    public visitReturnStatement(node: ReturnStatementSyntax): any {
        return node.update(
            this.visitToken(node.returnKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.semicolonToken()));
    }

    public visitObjectCreationExpression(node: ObjectCreationExpressionSyntax): any {
        return node.update(
            this.visitToken(node.newKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            <ArgumentListSyntax>this.visitNode(node.argumentList()));
    }

    public visitSwitchStatement(node: SwitchStatementSyntax): any {
        return node.update(
            this.visitToken(node.switchKeyword()),
            this.visitToken(node.openParenToken()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.closeParenToken()),
            this.visitToken(node.openBraceToken()),
            this.visitList(node.caseClauses()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitCaseSwitchClause(node: CaseSwitchClauseSyntax): any {
        return node.update(
            this.visitToken(node.caseKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.colonToken()),
            this.visitList(node.statements()));
    }

    public visitDefaultSwitchClause(node: DefaultSwitchClauseSyntax): any {
        return node.update(
            this.visitToken(node.defaultKeyword()),
            this.visitToken(node.colonToken()),
            this.visitList(node.statements()));
    }

    public visitBreakStatement(node: BreakStatementSyntax): any {
        return node.update(
            this.visitToken(node.breakKeyword()),
            node.identifier() === null ? null : this.visitToken(node.identifier()),
            this.visitToken(node.semicolonToken()));
    }

    public visitContinueStatement(node: ContinueStatementSyntax): any {
        return node.update(
            this.visitToken(node.continueKeyword()),
            node.identifier() === null ? null : this.visitToken(node.identifier()),
            this.visitToken(node.semicolonToken()));
    }

    public visitForStatement(node: ForStatementSyntax): any {
        return node.update(
            this.visitToken(node.forKeyword()),
            this.visitToken(node.openParenToken()),
            <VariableDeclarationSyntax>this.visitNode(node.variableDeclaration()),
            <ExpressionSyntax>this.visitNode(node.initializer()),
            this.visitToken(node.firstSemicolonToken()),
            <ExpressionSyntax>this.visitNode(node.condition()),
            this.visitToken(node.secondSemicolonToken()),
            <ExpressionSyntax>this.visitNode(node.incrementor()),
            this.visitToken(node.closeParenToken()),
            <StatementSyntax>this.visitNode(node.statement()));
    }

    public visitForInStatement(node: ForInStatementSyntax): any {
        return node.update(
            this.visitToken(node.forKeyword()),
            this.visitToken(node.openParenToken()),
            <VariableDeclarationSyntax>this.visitNode(node.variableDeclaration()),
            <ExpressionSyntax>this.visitNode(node.left()),
            this.visitToken(node.inKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()),
            this.visitToken(node.closeParenToken()),
            <StatementSyntax>this.visitNode(node.statement()));
    }

    public visitWhileStatement(node: WhileStatementSyntax): any {
        return node.update(
            this.visitToken(node.whileKeyword()),
            this.visitToken(node.openParenToken()),
            <ExpressionSyntax>this.visitNode(node.condition()),
            this.visitToken(node.closeParenToken()),
            <StatementSyntax>this.visitNode(node.statement()));
    }

    public visitWithStatement(node: WithStatementSyntax): any {
        return node.update(
            this.visitToken(node.withKeyword()),
            this.visitToken(node.openParenToken()),
            <ExpressionSyntax>this.visitNode(node.condition()),
            this.visitToken(node.closeParenToken()),
            <StatementSyntax>this.visitNode(node.statement()));
    }

    public visitEnumDeclaration(node: EnumDeclarationSyntax): any {
        return node.update(
            node.exportKeyword() === null ? null : this.visitToken(node.exportKeyword()),
            this.visitToken(node.enumKeyword()),
            this.visitToken(node.identifier()),
            this.visitToken(node.openBraceToken()),
            this.visitSeparatedList(node.variableDeclarators()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitCastExpression(node: CastExpressionSyntax): any {
        return node.update(
            this.visitToken(node.lessThanToken()),
            <TypeSyntax>this.visitNode(node.type()),
            this.visitToken(node.greaterThanToken()),
            <UnaryExpressionSyntax>this.visitNode(node.expression()));
    }

    public visitObjectLiteralExpression(node: ObjectLiteralExpressionSyntax): any {
        return node.update(
            this.visitToken(node.openBraceToken()),
            this.visitSeparatedList(node.propertyAssignments()),
            this.visitToken(node.closeBraceToken()));
    }

    public visitSimplePropertyAssignment(node: SimplePropertyAssignmentSyntax): any {
        return node.update(
            this.visitToken(node.propertyName()),
            this.visitToken(node.colonToken()),
            <ExpressionSyntax>this.visitNode(node.expression()));
    }

    public visitGetAccessorPropertyAssignment(node: GetAccessorPropertyAssignmentSyntax): any {
        return node.update(
            this.visitToken(node.getKeyword()),
            this.visitToken(node.propertyName()),
            this.visitToken(node.openParenToken()),
            this.visitToken(node.closeParenToken()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitSetAccessorPropertyAssignment(node: SetAccessorPropertyAssignmentSyntax): any {
        return node.update(
            this.visitToken(node.setKeyword()),
            this.visitToken(node.propertyName()),
            this.visitToken(node.openParenToken()),
            this.visitToken(node.parameterName()),
            this.visitToken(node.closeParenToken()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitFunctionExpression(node: FunctionExpressionSyntax): any {
        return node.update(
            this.visitToken(node.functionKeyword()),
            node.identifier() === null ? null : this.visitToken(node.identifier()),
            <CallSignatureSyntax>this.visitNode(node.callSignature()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitEmptyStatement(node: EmptyStatementSyntax): any {
        return node.withSemicolonToken(
            this.visitToken(node.semicolonToken()));
    }

    public visitSuperExpression(node: SuperExpressionSyntax): any {
        return node.withSuperKeyword(
            this.visitToken(node.superKeyword()));
    }

    public visitTryStatement(node: TryStatementSyntax): any {
        return node.update(
            this.visitToken(node.tryKeyword()),
            <BlockSyntax>this.visitNode(node.block()),
            <CatchClauseSyntax>this.visitNode(node.catchClause()),
            <FinallyClauseSyntax>this.visitNode(node.finallyClause()));
    }

    public visitCatchClause(node: CatchClauseSyntax): any {
        return node.update(
            this.visitToken(node.catchKeyword()),
            this.visitToken(node.openParenToken()),
            this.visitToken(node.identifier()),
            this.visitToken(node.closeParenToken()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitFinallyClause(node: FinallyClauseSyntax): any {
        return node.update(
            this.visitToken(node.finallyKeyword()),
            <BlockSyntax>this.visitNode(node.block()));
    }

    public visitLabeledStatement(node: LabeledStatement): any {
        return node.update(
            this.visitToken(node.identifier()),
            this.visitToken(node.colonToken()),
            <StatementSyntax>this.visitNode(node.statement()));
    }

    public visitDoStatement(node: DoStatementSyntax): any {
        return node.update(
            this.visitToken(node.doKeyword()),
            <StatementSyntax>this.visitNode(node.statement()),
            this.visitToken(node.whileKeyword()),
            this.visitToken(node.openParenToken()),
            <ExpressionSyntax>this.visitNode(node.condition()),
            this.visitToken(node.closeParenToken()),
            this.visitToken(node.semicolonToken()));
    }

    public visitTypeOfExpression(node: TypeOfExpressionSyntax): any {
        return node.update(
            this.visitToken(node.typeOfKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()));
    }

    public visitDeleteExpression(node: DeleteExpressionSyntax): any {
        return node.update(
            this.visitToken(node.deleteKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()));
    }

    public visitVoidExpression(node: VoidExpressionSyntax): any {
        return node.update(
            this.visitToken(node.voidKeyword()),
            <ExpressionSyntax>this.visitNode(node.expression()));
    }

    public visitDebuggerStatement(node: DebuggerStatementSyntax): any {
        return node.update(
            this.visitToken(node.debuggerKeyword()),
            this.visitToken(node.semicolonToken()));
    }
}