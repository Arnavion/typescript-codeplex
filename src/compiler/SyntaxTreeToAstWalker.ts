/// <reference path='Syntax\SyntaxVisitor.generated.ts' />
/// <reference path='Syntax\SyntaxWalker.generated.ts' />
/// <reference path='Syntax\SyntaxInformationMap.ts' />
/// <reference path='ast.ts' />

module TypeScript {
    class SyntaxTreeToAstWalker implements ISyntaxVisitor {
        private position: number = 0;
        private nestingLevel = 0;

        private varLists: ASTList[] = [];
        private scopeLists: ASTList[] = [];
        private staticsLists: ASTList[] = [];

        private syntaxInformationMap: SyntaxInformationMap = null;

        private start(element: ISyntaxElement): number {
            return this.syntaxInformationMap.start(element);
        }

        private end(element: ISyntaxElement): number {
            return this.syntaxInformationMap.end(element);
        }

        private setSpan(span: ASTSpan, element: ISyntaxElement) {
            span.minChar = this.start(element);
            span.limChar = this.end(element);
        }

        private hasEscapeSequence(token: ISyntaxToken): bool {
            // TODO: implement this.
            return false;
        }

        private valueText(token: ISyntaxToken): string {
            // TODO: handle unicode escapes here.
            return token.text();
        }

        private identifierFromToken(token: ISyntaxToken): Identifier {
            var result: Identifier = null;
            if (token.fullWidth() === 0) {
                result = new MissingIdentifier();
                result.flags |= ASTFlags.Error;
            }
            else {
                result = new Identifier(this.valueText(token), this.hasEscapeSequence(token));
            }

            result.minChar = this.start(token);
            result.limChar = this.end(token);

            return result;
        }

        private visitSyntaxList(list: ISyntaxList): ASTList {
            var result = new ASTList();
            this.setSpan(result, list);

            for (var i = 0, n = list.childCount() - 1; i < n; i++) {
                result.append(list.childAt(i).accept(this));
            }

            return result;
        }

        private visitSeparatedSyntaxList(list: ISeparatedSyntaxList): ASTList {
            var result = new ASTList();
            this.setSpan(result, list);

            for (var i = 0, n = list.nonSeparatorCount() - 1; i < n; i++) {
                result.append(list.nonSeparatorAt(i).accept(this));
            }
            
            return result;
        }

        private createRef(text: string, hasEscapeSequence: bool, minChar: number): Identifier {
            var id = new Identifier(text, hasEscapeSequence);
            id.minChar = minChar;
            return id;
        }

        private pushDeclLists() {
            this.staticsLists.push(new ASTList());
            this.varLists.push(new ASTList());
            this.scopeLists.push(new ASTList());
        }

        private popDeclLists() {
            this.staticsLists.pop();
            this.varLists.pop();
            this.scopeLists.pop();
        }

        private topVarList() {
            return this.varLists[this.varLists.length - 1];
        }

        private topScopeList() {
            return this.scopeLists[this.scopeLists.length - 1];
        }

        private topStaticsList() {
            return this.staticsLists[this.staticsLists.length - 1];
        }

        private convertComment(trivia: ISyntaxTrivia): Comment {
            throw Errors.notYetImplemented();
        }

        private convertComments(triviaList: ISyntaxTriviaList): Comment[]{
            var result: Comment[] = [];

            for (var i = 0, n = triviaList.count(); i < n; i++) {
                var trivia = triviaList.syntaxTriviaAt(i);

                if (trivia.isComment()) {
                    result.push(this.convertComment(trivia));
                }
            }
            
            return result;
        }

        private convertLeadingComments(token: ISyntaxToken): Comment[] {
            if (!token.hasLeadingComment()) {
                return null;
            }

            return this.convertComments(token.leadingTrivia());
        }

        private convertTrailingComments(token: ISyntaxToken): Comment[] {
            if (!token.hasTrailingComment()) {
                return null;
            }

            return this.convertComments(token.trailingTrivia());
        }

        private visitToken(token: ISyntaxToken): AST {
            var result: AST = null;

            if (token.kind() === SyntaxKind.ThisKeyword) {
                result = new AST(NodeType.This);
            }
            else if (token.kind() === SyntaxKind.SuperKeyword) {
                result = new AST(NodeType.Super);
            }
            else if (token.kind() === SyntaxKind.TrueKeyword) {
                result = new AST(NodeType.TrueKeyword);
            }
            else if (token.kind() === SyntaxKind.FalseKeyword) {
                result = new AST(NodeType.FalseKeyword);
            }

            this.setSpan(result, token);
            return result;
        }

        private visitEnumDeclaration(enumDeclaration: EnumDeclarationSyntax): ModuleDeclaration {
            var name = this.identifierFromToken(enumDeclaration.identifier());

            var membersMinChar = this.start(enumDeclaration.openBraceToken());
            this.pushDeclLists();

            var members = new ASTList();
            members.minChar = membersMinChar;
            var mapDecl = new VarDecl(new Identifier("_map"), 0);
            mapDecl.varFlags |= VarFlags.Exported;
            mapDecl.varFlags |= VarFlags.Private;

            // REVIEW: Is this still necessary?
            mapDecl.varFlags |= (VarFlags.Property | VarFlags.Public);
            mapDecl.init = new UnaryExpression(NodeType.ArrayLit, null);
            members.append(mapDecl);
            var lastValue: NumberLiteral = null;
            var memberNames: Identifier[] = [];

            for (var i = 0, n = enumDeclaration.variableDeclarators().nonSeparatorCount(); i < n; i++) {
                var variableDeclarator = <VariableDeclaratorSyntax>enumDeclaration.variableDeclarators().nonSeparatorAt(i);

                var minChar = this.start(variableDeclarator);
                var limChar;
                var memberName: Identifier = this.identifierFromToken(variableDeclarator.identifier());
                var memberValue: AST = null;
                var preComments = null;
                var postComments = null;

                limChar = this.start(variableDeclarator.identifier());
                preComments = this.convertComments(variableDeclarator.identifier().trailingTrivia());
                
                if (variableDeclarator.equalsValueClause() !== null) {
                    postComments = this.convertComments(variableDeclarator.equalsValueClause().equalsToken().trailingTrivia());
                    memberValue = variableDeclarator.equalsValueClause().accept(this);
                    lastValue = <NumberLiteral>memberValue;
                    limChar = this.end(variableDeclarator.equalsValueClause());
                }
                else {
                    if (lastValue == null) {
                        memberValue = new NumberLiteral(0);
                        lastValue = <NumberLiteral>memberValue;
                    }
                    else {
                        memberValue = new NumberLiteral(lastValue.value + 1);
                        lastValue = <NumberLiteral>memberValue;
                    }
                    var map: BinaryExpression =
                        new BinaryExpression(NodeType.Asg,
                                             new BinaryExpression(NodeType.Index,
                                                                  new Identifier("_map"),
                                                                  memberValue),
                                             new StringLiteral('"' + memberName.actualText + '"'));
                    members.append(map);
                }
                var member = new VarDecl(memberName, this.nestingLevel);
                member.minChar = minChar;
                member.limChar = limChar;
                member.init = memberValue;
                // Note: Leave minChar, limChar as "-1" on typeExpr as this is a parsing artifact.
                member.typeExpr = new TypeReference(this.createRef(name.actualText, name.hasEscapeSequence, -1), 0);
                member.varFlags |= (VarFlags.Readonly | VarFlags.Property);

                if (memberValue.nodeType == NodeType.NumberLit) {
                    member.varFlags |= VarFlags.Constant;
                }
                else if (memberValue.nodeType === NodeType.Lsh) {
                    // If the initializer is of the form "value << value" then treat it as a constant
                    // as well.
                    var binop = <BinaryExpression>memberValue;
                    if (binop.operand1.nodeType === NodeType.NumberLit && binop.operand2.nodeType === NodeType.NumberLit) {
                        member.varFlags |= VarFlags.Constant;
                    }
                }
                else if (memberValue.nodeType === NodeType.Name) {
                    // If the initializer refers to an earlier enum value, then treat it as a constant
                    // as well.
                    var nameNode = <Identifier>memberValue;
                    for (var i = 0; i < memberNames.length; i++) {
                        var memberName = memberNames[i];
                        if (memberName.text === nameNode.text) {
                            member.varFlags |= VarFlags.Constant;
                            break;
                        }
                    }
                }

                member.preComments = preComments;
                members.append(member);
                member.postComments = postComments;
                // all enum members are exported
                member.varFlags |= VarFlags.Exported;
            }

            var endingToken = new ASTSpan();
            endingToken.minChar = this.start(enumDeclaration.closeBraceToken());
            endingToken.limChar = this.end(enumDeclaration.closeBraceToken());

            members.limChar = endingToken.limChar;
            var modDecl = new ModuleDeclaration(name, members, this.topVarList(), this.topScopeList(), endingToken);
            modDecl.modFlags |= ModuleFlags.IsEnum;
            this.popDeclLists();

            return modDecl;
        }

        private visitImportDeclaration(importDeclaration: ImportDeclarationSyntax): ImportDeclaration {
            var name: Identifier = null;
            var alias: AST = null;
            var importDecl: ImportDeclaration = null;
            var minChar = this.start(importDeclaration);
            var isDynamicImport = false;

            name = this.identifierFromToken(importDeclaration.identifier());

            var aliasPreComments = this.convertTrailingComments(importDeclaration.equalsToken());

            var moduleReference = importDeclaration.moduleReference();
            var limChar = this.start(moduleReference);
            if (moduleReference.kind() === SyntaxKind.ExternalModuleReference) {
                alias = this.identifierFromToken((<ExternalModuleReferenceSyntax>moduleReference).stringLiteral());
                isDynamicImport = true;
                alias.preComments = aliasPreComments;
            }
            else {
                alias = (<ModuleNameModuleReferenceSyntax>moduleReference).moduleName().accept(this);
                limChar = this.end(moduleReference);
            }

            importDecl = new ImportDeclaration(name, alias);
            importDecl.isDynamicImport = isDynamicImport;

            importDecl.minChar = minChar;
            importDecl.limChar = limChar;

            return importDecl;
        }

        private visitFunctionDeclaration(node: FunctionDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitVariableStatement(node: VariableStatementSyntax): any {
            if (node.variableDeclaration().variableDeclarators().count() === 1) {
                return node.variableDeclaration().variableDeclarators()[0].accept(this);
            }
            else {
                var result = new Block(
                    this.visitSeparatedSyntaxList(node.variableDeclaration().variableDeclarators()),
                    /*isStatementBlock:*/ false);
                this.setSpan(result, node);
                
                return result;
            }
        }

        private visitVariableDeclaration(node: VariableDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private indexOfNonSeparator(list: ISeparatedSyntaxList, item: ISyntaxElement): number {
            for (var i = 0, n = list.nonSeparatorCount(); i < n; i++) {
                if (list.nonSeparatorAt(i) === item) {
                    return i;
                }
            }

            throw Errors.invalidOperation();
        }

        private visitVariableDeclarator(node: VariableDeclaratorSyntax): VarDecl {
            var parent = this.syntaxInformationMap.parent(node);
            var index = parent.isSeparatedList() ? this.indexOfNonSeparator(<ISeparatedSyntaxList>parent, node) : 0;

            var result = new VarDecl(this.identifierFromToken(node.identifier()), index);
            this.setSpan(result, node);

            if (node.equalsValueClause()) {
                result.init = node.equalsValueClause().accept(this);
            }

            // TODO: more flags

            return result;
        }

        private visitEqualsValueClause(node: EqualsValueClauseSyntax): AST {
            return node.value().accept(this);
        }

        private visitPrefixUnaryExpression(node: PrefixUnaryExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(
                node.kind() === SyntaxKind.PreIncrementExpression ? NodeType.IncPre : NodeType.DecPre,
                node.operand().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitArrayLiteralExpression(node: ArrayLiteralExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.ArrayLit, this.visitSeparatedSyntaxList(node.expressions()));
            this.setSpan(result, node);

            return result;
        }

        private visitOmittedExpression(node: OmittedExpressionSyntax): any {
            var result = new AST(NodeType.EmptyExpr);
            this.setSpan(result, node);

            return result;
        }

        private visitParenthesizedExpression(node: ParenthesizedExpressionSyntax): AST {
            var result = node.expression().accept(this);
            result.isParenthesized = true;

            return result;
        }

        private visitSimpleArrowFunctionExpression(node: SimpleArrowFunctionExpressionSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitParenthesizedArrowFunctionExpression(node: ParenthesizedArrowFunctionExpressionSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitType(type: ITypeSyntax): AST {
            if (type.isToken()) {
                return this.identifierFromToken(<ISyntaxToken>type);
            }
            else {
                return type.accept(this);
            }
        }

        private visitQualifiedName(node: QualifiedNameSyntax): BinaryExpression {
            var result = new BinaryExpression(NodeType.Dot,
                this.visitType(node.left()),
                this.identifierFromToken(node.right()));
            this.setSpan(result, node);

            return result;
        }

        private visitTypeArgumentList(node: TypeArgumentListSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitConstructorType(node: ConstructorTypeSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitFunctionType(node: FunctionTypeSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitObjectType(node: ObjectTypeSyntax): InterfaceDeclaration {
            var result = new InterfaceDeclaration(
                new Identifier("_anonymous"),
                this.visitSeparatedSyntaxList(node.typeMembers()),
                null, null);
            this.setSpan(result, node);

            return result;
        }

        private visitArrayType(node: ArrayTypeSyntax): TypeReference {
            var count = 0;
            var current: ITypeSyntax = node;
            while (current.kind() === SyntaxKind.ArrayType) {
                count++;
                current = (<ArrayTypeSyntax>current).type();
            }

            var result = new TypeReference(this.visitType(current), count);
            this.setSpan(result, node);

            return result;
        }

        private visitGenericType(node: GenericTypeSyntax): AST {
            throw Errors.notYetImplemented();
        }

        private visitTypeAnnotation(node: TypeAnnotationSyntax): AST {
            return this.visitType(node.type());
        }

        private visitBlock(node: BlockSyntax): Block {
            var result = new Block(this.visitSyntaxList(node.statements()), /*isStatementBlock:*/ true);
            this.setSpan(result, node);

            return result;
        }

        private visitParameter(node: ParameterSyntax): ArgDecl {
            var result = new ArgDecl(this.identifierFromToken(node.identifier()));
            this.setSpan(result, node);

            if (node.publicOrPrivateKeyword()) {
                result.varFlags |= VarFlags.Property;

                if (node.publicOrPrivateKeyword().kind() === SyntaxKind.PublicKeyword) {
                    result.varFlags |= VarFlags.Public;
                }
                else {
                    result.varFlags |= VarFlags.Private;
                }
            }

            if (node.equalsValueClause()) {
                result.init = node.equalsValueClause().accept(this);
            }

            if (node.typeAnnotation()) {
                result.type = node.typeAnnotation().accept(this);
            }
            
            return result;
        }

        private visitMemberAccessExpression(node: MemberAccessExpressionSyntax): BinaryExpression {
            var expression: AST = node.expression().accept(this);
            expression.flags |= ASTFlags.DotLHS;

            var result = new BinaryExpression(NodeType.Dot, expression, this.identifierFromToken(node.identifier()));
            this.setSpan(result, node);

            return result;
        }

        private visitPostfixUnaryExpression(node: PostfixUnaryExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(node.kind() === SyntaxKind.PostIncrementExpression ? NodeType.IncPost : NodeType.DecPost,
                node.operand().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitElementAccessExpression(node: ElementAccessExpressionSyntax): BinaryExpression {
            var result = new BinaryExpression(NodeType.Index,
                node.expression().accept(this),
                node.argumentExpression().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitInvocationExpression(node: InvocationExpressionSyntax): CallExpression {
            var result = new CallExpression(NodeType.Call,
                node.expression().accept(this),
                node.argumentList().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitArgumentList(node: ArgumentListSyntax): ASTList {
            return this.visitSeparatedSyntaxList(node.arguments());
        }

        private getBinaryExpressionNodeType(node: BinaryExpressionSyntax): NodeType {
            switch (node.kind()) {
                case SyntaxKind.CommaExpression: return NodeType.Comma;
                case SyntaxKind.EqualsExpression: return NodeType.Asg;
                case SyntaxKind.AddAssignmentExpression: return NodeType.AsgAdd;
                case SyntaxKind.SubtractAssignmentExpression: return NodeType.AsgSub;
                case SyntaxKind.MultiplyAssignmentExpression: return NodeType.AsgMul;
                case SyntaxKind.DivideAssignmentExpression: return NodeType.AsgDiv;
                case SyntaxKind.ModuloAssignmentExpression: return NodeType.AsgMod;
                case SyntaxKind.AndAssignmentExpression: return NodeType.AsgAnd;
                case SyntaxKind.ExclusiveOrAssignmentExpression: return NodeType.AsgXor;
                case SyntaxKind.OrAssignmentExpression: return NodeType.AsgOr;
                case SyntaxKind.LeftShiftAssignmentExpression: return NodeType.AsgLsh;
                case SyntaxKind.SignedRightShiftAssignmentExpression: return NodeType.AsgRsh;
                case SyntaxKind.UnsignedRightShiftAssignmentExpression: return NodeType.AsgRs2;
                case SyntaxKind.LogicalOrExpression: return NodeType.LogOr;
                case SyntaxKind.LogicalAndExpression: return NodeType.LogAnd;
                case SyntaxKind.BitwiseOrExpression: return NodeType.Or;
                case SyntaxKind.BitwiseExclusiveOrExpression: return NodeType.Xor;
                case SyntaxKind.BitwiseAndExpression: return NodeType.And;
                case SyntaxKind.EqualsWithTypeConversionExpression: return NodeType.Eq;
                case SyntaxKind.NotEqualsWithTypeConversionExpression: return NodeType.Ne;
                case SyntaxKind.EqualsExpression: return NodeType.Eqv;
                case SyntaxKind.NotEqualsExpression: return NodeType.NEqv;
                case SyntaxKind.LessThanExpression: return NodeType.Lt;
                case SyntaxKind.GreaterThanExpression: return NodeType.Gt;
                case SyntaxKind.LessThanOrEqualExpression: return NodeType.Le;
                case SyntaxKind.GreaterThanOrEqualExpression: return NodeType.Ge;
                case SyntaxKind.InstanceOfExpression: return NodeType.InstOf;
                case SyntaxKind.InExpression: return NodeType.In;
                case SyntaxKind.LeftShiftExpression: return NodeType.Lsh;
                case SyntaxKind.SignedRightShiftExpression: return NodeType.Rsh;
                case SyntaxKind.UnsignedRightShiftExpression: return NodeType.Rs2;
                case SyntaxKind.MultiplyExpression: return NodeType.Mul;
                case SyntaxKind.DivideExpression: return NodeType.Div;
                case SyntaxKind.ModuloExpression: return NodeType.Mod;
                case SyntaxKind.AddExpression: return NodeType.Add;
                case SyntaxKind.SubtractExpression: return NodeType.Sub;
            }

            throw Errors.invalidOperation();
        }

        private visitBinaryExpression(node: BinaryExpressionSyntax): BinaryExpression {
            var nodeType = this.getBinaryExpressionNodeType(node);
            var result = new BinaryExpression(
                nodeType,
                node.left().accept(this),
                node.right().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitConditionalExpression(node: ConditionalExpressionSyntax): ConditionalExpression {
            var result = new ConditionalExpression(
                node.condition().accept(this),
                node.whenTrue().accept(this),
                node.whenFalse().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitConstructSignature(node: ConstructSignatureSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitFunctionSignature(node: FunctionSignatureSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitIndexSignature(node: IndexSignatureSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitPropertySignature(node: PropertySignatureSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitParameterList(node: ParameterListSyntax): ASTList {
            return this.visitSeparatedSyntaxList(node.parameters());
        }

        private visitTypeParameterList(node: TypeParameterListSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitTypeParameter(node: TypeParameterSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitConstraint(node: ConstraintSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitIfStatement(node: IfStatementSyntax): any {
            var result = new IfStatement(node.condition().accept(this));
            this.setSpan(result, node);

            result.thenBod = node.statement().accept(this);
            if (node.elseClause() !== null) {
                result.elseBod = node.elseClause().statement().accept(this);
            }

            return result;
        }

        private visitExpressionStatement(node: ExpressionStatementSyntax): AST {
            var result = node.expression().accept(this);
            this.setSpan(result, node);

            result.flags |= ASTFlags.IsStatement;

            return result;
        }

        private visitConstructorDeclaration(node: ConstructorDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitMemberFunctionDeclaration(node: MemberFunctionDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitGetMemberAccessorDeclaration(node: GetMemberAccessorDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitSetMemberAccessorDeclaration(node: SetMemberAccessorDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitMemberVariableDeclaration(node: MemberVariableDeclarationSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitThrowStatement(node: ThrowStatementSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.Throw, node.expression().accept(this));
            this.setSpan(result, node);
            
            return result;
        }

        private visitReturnStatement(node: ReturnStatementSyntax): ReturnStatement {
            var result = new ReturnStatement();
            this.setSpan(result, node);

            if (node.expression() !== null) {
                result.returnExpression = node.expression().accept(this);
            }

            return result;
        }

        private visitObjectCreationExpression(node: ObjectCreationExpressionSyntax): CallExpression {
            var result = new CallExpression(NodeType.New,
                node.expression().accept(this),
                node.argumentList() === null ? null : node.argumentList().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitSwitchStatement(node: SwitchStatementSyntax): SwitchStatement {
            var result = new SwitchStatement(node.condition().accept(this));
            this.setSpan(result, node);

            result.statement.minChar = this.start(node);
            result.statement.limChar = this.end(node.closeParenToken());

            result.caseList = new ASTList()

            for (var i = 0, n = node.switchClauses().childCount(); i < n; i++) {
                var switchClause = node.switchClauses().childAt(i);
                if (switchClause.kind() === SyntaxKind.DefaultSwitchClause) {
                    result.defaultCase = switchClause.accept(this);
                }
                else {
                    result.caseList.append(switchClause.accept(this));
                }
            }

            return result;
        }

        private visitCaseSwitchClause(node: CaseSwitchClauseSyntax): CaseStatement {
            var result = new CaseStatement();
            this.setSpan(result, node);

            result.expr = node.expression().accept(this);
            result.body = this.visitSyntaxList(node.statements());

            return result;
        }

        private visitDefaultSwitchClause(node: DefaultSwitchClauseSyntax): CaseStatement {
            var result = new CaseStatement();
            this.setSpan(result, node);

            result.body = this.visitSyntaxList(node.statements());

            return result;
        }

        private visitBreakStatement(node: BreakStatementSyntax): Jump {
            var result = new Jump(NodeType.Break);
            this.setSpan(result, node);

            if (node.identifier() !== null) {
                result.target = this.valueText(node.identifier());
            }

            return result;
        }

        private visitContinueStatement(node: ContinueStatementSyntax): Jump {
            var result = new Jump(NodeType.Continue);
            this.setSpan(result, node);

            if (node.identifier() !== null) {
                result.target = this.valueText(node.identifier());
            }

            return result;
        }

        private visitForStatement(node: ForStatementSyntax): ForStatement {
            var result = new ForStatement(
                node.variableDeclaration() === null ? node.initializer().accept(this) : node.variableDeclaration().accept(this));
            this.setSpan(result, node);

            result.cond = node.condition() === null ? null : node.condition().accept(this);
            result.incr = node.incrementor() === null ? null : node.incrementor().accept(this);

            return result;
        }

        private visitForInStatement(node: ForInStatementSyntax): ForInStatement {
            var result = new ForInStatement(
                node.variableDeclaration() === null ? node.left().accept(this) : node.variableDeclaration().accept(this),
                node.expression().accept(this));
            this.setSpan(result, node);

            result.statement.minChar = this.start(node);
            result.statement.limChar = this.end(node.closeParenToken());

            result.body = node.statement().accept(this);

            return result;
        }

        private visitWhileStatement(node: WhileStatementSyntax): WhileStatement {
            var result = new WhileStatement(node.condition().accept(this));
            this.setSpan(result, node);

            result.body = node.statement().accept(this);

            return result;
        }

        private visitWithStatement(node: WithStatementSyntax): WithStatement {
            var result = new WithStatement(node.condition().accept(this));
            this.setSpan(result, node);

            result.body = node.statement().accept(this);

            return result;
        }

        private visitCastExpression(node: CastExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.TypeAssertion, node.expression().accept(this));
            this.setSpan(result, node);

            result.castTerm = this.visitType(node.type());

            return result;
        }

        private visitObjectLiteralExpression(node: ObjectLiteralExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.ObjectLit, this.visitSeparatedSyntaxList(node.propertyAssignments()));
            this.setSpan(result, node);

            return result;
        }

        private visitSimplePropertyAssignment(node: SimplePropertyAssignmentSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitGetAccessorPropertyAssignment(node: GetAccessorPropertyAssignmentSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitSetAccessorPropertyAssignment(node: SetAccessorPropertyAssignmentSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitFunctionExpression(node: FunctionExpressionSyntax): any {
            throw Errors.notYetImplemented();
        }

        private visitEmptyStatement(node: EmptyStatementSyntax): AST {
            var result = new AST(NodeType.Empty);
            this.setSpan(result, node);
            return result;
        }

        private visitTryStatement(node: TryStatementSyntax): AST {
            var tryPart: AST = new Try(node.block().accept(this));
            this.setSpan(tryPart, node);

            var tryCatch: TryCatch = null;
            if (node.catchClause() !== null) {
                var varDecl = new VarDecl(this.identifierFromToken(node.catchClause().identifier()), 0)
                this.setSpan(varDecl, node.catchClause().identifier());

                var catchBit = new Catch(varDecl, node.catchClause().block().accept(this));
                this.setSpan(catchBit, node.catchClause());

                tryCatch = new TryCatch(<Try>tryPart, catchBit);
                
                tryCatch.minChar = tryPart.minChar;
                tryCatch.limChar = catchBit.limChar;
            }

            if (node.finallyClause() !== null) {
                if (tryCatch !== null) {
                    tryPart = tryCatch;
                }

                var finallyBit = new Finally(node.finallyClause().block().accept(this));
                this.setSpan(finallyBit, node.finallyClause());

                var result = new TryFinally(tryPart, finallyBit);
                this.setSpan(result, node);

                return result;
            }

            Debug.assert(tryCatch !== null);
            return tryCatch;
        }

        private visitLabeledStatement(node: LabeledStatementSyntax): LabeledStatement {
            var labelList = new ASTList();
            labelList.append(new Label(this.identifierFromToken(node.identifier())));

            var result = new LabeledStatement(labelList, node.statement().accept(this));
            this.setSpan(result, node);

            return result;
        }

        private visitDoStatement(node: DoStatementSyntax): DoWhileStatement {
            var result = new DoWhileStatement();
            this.setSpan(result, node);

            result.whileAST = this.identifierFromToken(node.whileKeyword());
            result.cond = node.condition().accept(this);
            result.body = node.statement().accept(this);

            return result;
        }

        private visitTypeOfExpression(node: TypeOfExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.Typeof, node.expression().accept(this));
            this.setSpan(result, node);
            return result;
        }

        private visitDeleteExpression(node: DeleteExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.Delete, node.expression().accept(this));
            this.setSpan(result, node);
            return result;
        }

        private visitVoidExpression(node: VoidExpressionSyntax): UnaryExpression {
            var result = new UnaryExpression(NodeType.Void, node.expression().accept(this));
            this.setSpan(result, node);
            return result;
        }

        private visitDebuggerStatement(statement: DebuggerStatementSyntax): DebuggerStatement {
            var result = new DebuggerStatement();
            this.setSpan(result, statement);
            return result;
        }
    }
}