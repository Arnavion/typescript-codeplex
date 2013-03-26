///<reference path='References.ts' />

module TypeScript {
    export class SyntaxTree {
        private _sourceUnit: SourceUnitSyntax;
        private _isDeclaration: bool;
        private _parserDiagnostics: SyntaxDiagnostic[];
        private _allDiagnostics: SyntaxDiagnostic[] = null;
        private _fileName: string;
        private _lineMap: LineMap;
        private _languageVersion: LanguageVersion;
        private _parseOptions: ParseOptions;

        constructor(sourceUnit: SourceUnitSyntax,
                    isDeclaration: bool,
                    diagnostics: SyntaxDiagnostic[],
                    fileName: string,
                    lineMap: LineMap,
                    languageVersion: LanguageVersion,
                    parseOtions: ParseOptions) {
            this._sourceUnit = sourceUnit;
            this._isDeclaration = isDeclaration;
            this._parserDiagnostics = diagnostics;
            this._fileName = fileName;
            this._lineMap = lineMap;
            this._languageVersion = languageVersion;
            this._parseOptions = parseOtions;
        }

        public toJSON(key) {
            var result: any = {};

            result.isDeclaration = this._isDeclaration;
            result.languageVersion = (<any>LanguageVersion)._map[this._languageVersion];
            result.parseOptions = this._parseOptions;

            if (this.diagnostics().length > 0) {
                result.diagnostics = this.diagnostics();
            }

            result.sourceUnit = this._sourceUnit;
            result.lineMap = this._lineMap;

            return result;
        }

        public sourceUnit(): SourceUnitSyntax {
            return this._sourceUnit;
        }

        public isDeclaration(): bool {
            return this._isDeclaration;
        }

        private computeDiagnostics(): SyntaxDiagnostic[]{
            if (this._parserDiagnostics.length > 0) {
                return this._parserDiagnostics;
            }

            // No parser reported diagnostics.  Check for any additional grammar diagnostics.
            var diagnostics: SyntaxDiagnostic[] = [];
            this.sourceUnit().accept(new GrammarCheckerWalker(this.fileName(), diagnostics, this.isDeclaration()));

            return diagnostics;
        }

        public diagnostics(): SyntaxDiagnostic[] {
            if (this._allDiagnostics === null) {
                this._allDiagnostics = this.computeDiagnostics();
            }

            return this._allDiagnostics;
        }

        public fileName(): string {
            return this._fileName;
        }

        public lineMap(): LineMap {
            return this._lineMap;
        }

        public languageVersion(): LanguageVersion {
            return this._languageVersion;
        }

        public parseOptions(): ParseOptions {
            return this._parseOptions;
        }

        public structuralEquals(tree: SyntaxTree): bool {
            return ArrayUtilities.sequenceEquals(this.diagnostics(), tree.diagnostics(), SyntaxDiagnostic.equals) &&
                this.sourceUnit().structuralEquals(tree.sourceUnit());
        }
    }

    class GrammarCheckerWalker extends PositionTrackingWalker {
        private inAmbientDeclaration: bool;

        constructor(private fileName: string,
                    private diagnostics: IDiagnostic[],
                    private isDeclaration: bool) {
            super();

            // Everything in an declaration file is in an ambient declaration
            this.inAmbientDeclaration = isDeclaration;
        }

        private childFullStart(parent: ISyntaxElement, child: ISyntaxElement): number {
            return this.position() + Syntax.childOffset(parent, child);
        }

        private childStart(parent: ISyntaxNode, child: ISyntaxElement): number {
            return this.childFullStart(parent, child) + child.leadingTriviaWidth();
        }

        private getToken(list: ISyntaxList, kind: SyntaxKind): ISyntaxToken {
            for (var i = 0, n = list.childCount(); i < n; i++) {
                var token = <ISyntaxToken>list.childAt(i);
                if (token.tokenKind === kind) {
                    return token;
                }
            }

            return null;
        }

        private containsToken(list: ISyntaxList, kind: SyntaxKind): bool {
            return this.getToken(list, kind) !== null;
        }

        private pushDiagnostic(start: number, length: number, diagnosticCode: DiagnosticCode, args: any[] = null): void {
            this.diagnostics.push(new SyntaxDiagnostic(
                this.fileName, start, length, diagnosticCode, args));
        }

        private pushDiagnostic1(elementFullStart: number, element: ISyntaxElement, diagnosticCode: DiagnosticCode, args: any[] = null): void {
            this.diagnostics.push(new SyntaxDiagnostic(
                this.fileName, elementFullStart + element.leadingTriviaWidth(), element.width(), diagnosticCode, args));
        }

        private visitCatchClause(node: CatchClauseSyntax): void {
            if (node.typeAnnotation) {
                this.pushDiagnostic(
                    this.childStart(node, node.typeAnnotation),
                    node.typeAnnotation.width(),
                    DiagnosticCode.A_catch_clause_variable_cannot_have_a_type_annotation);
            }

            super.visitCatchClause(node);
        }

        private visitParameterList(node: ParameterListSyntax): void {
            var parametersPosition = this.childFullStart(node, node.parameters);
            var parameterFullStart = parametersPosition;

            var seenOptionalParameter = false;
            var parameterCount = node.parameters.nonSeparatorCount();

            for (var i = 0, n = node.parameters.childCount(); i < n; i++) {
                var nodeOrToken = node.parameters.childAt(i);
                if (i % 2 === 0) {
                    var parameterIndex = i / 2;
                    var parameter = <ParameterSyntax>node.parameters.childAt(i);

                    if (parameter.dotDotDotToken) {
                        if (parameterIndex != (parameterCount - 1)) {
                            this.pushDiagnostic1(
                                parameterFullStart, parameter,
                                DiagnosticCode.Rest_parameter_must_be_last_in_list);
                            break;
                        }
                    }
                    else if (parameter.questionToken || parameter.equalsValueClause) {
                        seenOptionalParameter = true;

                        if (parameter.questionToken && parameter.equalsValueClause) {
                            this.pushDiagnostic1(
                                parameterFullStart, parameter,
                                DiagnosticCode.Parameter_cannot_have_question_mark_and_initializer);
                            break;
                        }
                    }
                    else {
                        if (seenOptionalParameter) {
                            this.pushDiagnostic1(
                                parameterFullStart, parameter,
                                DiagnosticCode.Required_parameter_cannot_follow_optional_parameter);
                            break;
                        }
                    }
                }

                parameterFullStart += nodeOrToken.fullWidth();
            }
            
            super.visitParameterList(node);
        }

        private visitIndexSignature(node: IndexSignatureSyntax): void {
            var parameterFullStart = this.childFullStart(node, node.parameter);
            var parameter = node.parameter;

            if (parameter.dotDotDotToken) {
                this.pushDiagnostic1(
                    parameterFullStart, parameter,
                    DiagnosticCode.Index_signatures_cannot_have_rest_parameters);
            }
            else if (parameter.publicOrPrivateKeyword) {
                this.pushDiagnostic1(
                    parameterFullStart, parameter,
                    DiagnosticCode.Index_signature_parameter_cannot_have_accessibility_modifierss);
            }
            else if (parameter.questionToken) {
                this.pushDiagnostic1(
                    parameterFullStart, parameter,
                    DiagnosticCode.Index_signature_parameter_cannot_have_a_question_mark);
            }
            else if (parameter.equalsValueClause) {
                this.pushDiagnostic1(
                    parameterFullStart, parameter,
                    DiagnosticCode.Index_signature_parameter_cannot_have_an_initializer);
            }
            else if (!parameter.typeAnnotation) {
                this.pushDiagnostic1(
                    parameterFullStart, parameter,
                    DiagnosticCode.Index_signature_parameter_must_have_a_type_annotation);
            }
            else if (parameter.typeAnnotation.type.kind() !== SyntaxKind.StringKeyword &&
                     parameter.typeAnnotation.type.kind() !== SyntaxKind.NumberKeyword) {
                this.pushDiagnostic1(
                    parameterFullStart, parameter,
                    DiagnosticCode.Index_signature_parameter_type_must_be__string__or__number_);
            }
            else if (!node.typeAnnotation) {
                this.pushDiagnostic1(
                    this.position(), node,
                    DiagnosticCode.Index_signature_must_have_a_type_annotation);
            }

            super.visitIndexSignature(node);
        }

        private checkClassDeclarationHeritageClauses(node: ClassDeclarationSyntax): bool {
            var heritageClausesFullStart = this.childFullStart(node, node.heritageClauses);
            var heritageClauseFullStart = heritageClausesFullStart;

            var seenExtendsClause = false;
            var seenImplementsClause = false;

            for (var i = 0, n = node.heritageClauses.childCount(); i < n; i++) {
                Debug.assert(i <= 2);
                var heritageClause = <HeritageClauseSyntax>node.heritageClauses.childAt(i);

                if (heritageClause.extendsOrImplementsKeyword.tokenKind === SyntaxKind.ExtendsKeyword) {
                    if (seenExtendsClause) {
                        this.pushDiagnostic1(heritageClauseFullStart, heritageClause,
                            DiagnosticCode._extends__clause_already_seen);
                        return true;
                    }

                    if (seenImplementsClause) {
                        this.pushDiagnostic1(heritageClauseFullStart, heritageClause,
                            DiagnosticCode._extends__clause_must_precede__implements__clause);
                        return true;
                    }

                    if (heritageClause.typeNames.nonSeparatorCount() > 1) {
                        this.pushDiagnostic1(heritageClauseFullStart, heritageClause,
                            DiagnosticCode.Class_can_only_extend_single_type);
                        return true;
                    }

                    seenExtendsClause = true;
                }
                else {
                    Debug.assert(heritageClause.extendsOrImplementsKeyword.tokenKind === SyntaxKind.ImplementsKeyword);
                    if (seenImplementsClause) {
                        this.pushDiagnostic1(heritageClauseFullStart, heritageClause,
                            DiagnosticCode._implements__clause_already_seen);
                        return true;
                    }

                    seenImplementsClause = true;
                }

                heritageClauseFullStart += heritageClause.fullWidth();
            }

            return false;
        }

        private checkForDisallowedDeclareModifier(modifiers: ISyntaxList): bool {
            if (this.inAmbientDeclaration) {
                var declareToken = this.getToken(modifiers, SyntaxKind.DeclareKeyword);

                if (declareToken) {
                    this.pushDiagnostic1(this.childFullStart(modifiers, declareToken), declareToken,
                        DiagnosticCode._declare__modifier_not_allowed_for_code_already_in_an_ambient_context);
                    return true;
                }
            }
            
            return false;
        }

        private visitClassDeclaration(node: ClassDeclarationSyntax): void {
            if (this.checkForDisallowedDeclareModifier(node.modifiers)) {
                this.skip(node);
                return;
            }

            if (this.checkClassDeclarationHeritageClauses(node)) {
                this.skip(node);
                return;
            }

            var savedInAmbientDeclaration = this.inAmbientDeclaration;
            this.inAmbientDeclaration = this.inAmbientDeclaration || this.containsToken(node.modifiers, SyntaxKind.DeclareKeyword);
            super.visitClassDeclaration(node);
            this.inAmbientDeclaration = savedInAmbientDeclaration;
        }

        private checkInterfaceDeclarationHeritageClauses(node: InterfaceDeclarationSyntax): void {
            var heritageClausesFullStart = this.childFullStart(node, node.heritageClauses);
            var heritageClauseFullStart = heritageClausesFullStart;

            var seenExtendsClause = false;

            for (var i = 0, n = node.heritageClauses.childCount(); i < n; i++) {
                Debug.assert(i <= 1);
                var heritageClause = <HeritageClauseSyntax>node.heritageClauses.childAt(i);

                if (heritageClause.extendsOrImplementsKeyword.tokenKind === SyntaxKind.ExtendsKeyword) {
                    if (seenExtendsClause) {
                        this.pushDiagnostic1(heritageClauseFullStart, heritageClause,
                            DiagnosticCode._extends__clause_already_seen);
                        return;
                    }

                    seenExtendsClause = true;
                }
                else {
                    Debug.assert(heritageClause.extendsOrImplementsKeyword.tokenKind === SyntaxKind.ImplementsKeyword);
                    this.pushDiagnostic1(heritageClauseFullStart, heritageClause,
                        DiagnosticCode.Interface_declaration_cannot_have__implements__clause);
                    return;
                }

                heritageClauseFullStart += heritageClause.fullWidth();
            }
        }

        private visitInterfaceDeclaration(node: InterfaceDeclarationSyntax): void {
            this.checkInterfaceDeclarationHeritageClauses(node);

            super.visitInterfaceDeclaration(node);
        }

        private checkClassElementModifiers(list: ISyntaxList): void {
            var modifierFullStart = this.position();

            var seenAccessibilityModifier = false;
            var seenStaticModifier = false;

            for (var i = 0, n = list.childCount(); i < n; i++) {
                var modifier = <ISyntaxToken>list.childAt(i);
                if (modifier.tokenKind === SyntaxKind.PublicKeyword ||
                    modifier.tokenKind === SyntaxKind.PrivateKeyword) {

                    if (seenAccessibilityModifier) {
                        this.pushDiagnostic1(modifierFullStart, modifier,
                            DiagnosticCode.Accessibility_modifier_already_seen);
                        return;
                    }

                    if (seenStaticModifier) {
                        this.pushDiagnostic1(modifierFullStart, modifier,
                            DiagnosticCode.Accessibility_modifier_must_precede__static__modifier);
                        return;
                    }

                    seenAccessibilityModifier = true;
                }
                else if (modifier.tokenKind === SyntaxKind.StaticKeyword) {
                    if (seenStaticModifier) {
                        this.pushDiagnostic1(modifierFullStart, modifier,
                            DiagnosticCode._static__modifier_already_seen);
                        return;
                    }

                    seenStaticModifier = true;
                }
                else {
                    this.pushDiagnostic1(modifierFullStart, modifier,
                        DiagnosticCode._0__modifier_cannot_appear_on_a_class_element, [modifier.text()]);
                    return;
                }

                modifierFullStart += modifier.fullWidth();
            }
        }

        private visitMemberVariableDeclaration(node: MemberVariableDeclarationSyntax): void {
            this.checkClassElementModifiers(node.modifiers);

            super.visitMemberVariableDeclaration(node);
        }

        private visitMemberFunctionDeclaration(node: MemberFunctionDeclarationSyntax): void {
            this.checkClassElementModifiers(node.modifiers);

            super.visitMemberFunctionDeclaration(node);
        }

        private visitGetMemberAccessorDeclaration(node: GetMemberAccessorDeclarationSyntax): void {
            this.checkClassElementModifiers(node.modifiers);

            super.visitGetMemberAccessorDeclaration(node);
        }

        private visitSetMemberAccessorDeclaration(node: SetMemberAccessorDeclarationSyntax): void {
            this.checkClassElementModifiers(node.modifiers);

            super.visitSetMemberAccessorDeclaration(node);
        }

        private checkEnumDeclarationElements(node: EnumDeclarationSyntax): bool {
            var enumElementsFullStart = this.childFullStart(node, node.enumElements);
            var enumElementFullStart = enumElementsFullStart;
            var seenExplicitMember = false;
            for (var i = 0, n = node.enumElements.childCount(); i < n; i++) {
                var nodeOrToken = node.enumElements.childAt(i);
                if (i % 2 === 0) {
                    var enumElement = <EnumElementSyntax>nodeOrToken;

                    if (enumElement.equalsValueClause) {
                        seenExplicitMember = true;
                    }
                    else if (seenExplicitMember) {
                        this.pushDiagnostic1(enumElementFullStart, enumElement,
                            DiagnosticCode.Enum_element_must_have_initializer);
                        return true;
                    }
                }

                enumElementFullStart += nodeOrToken.fullWidth();
            }

            return false;
        }

        private visitEnumDeclaration(node: EnumDeclarationSyntax): void {
            if (this.checkForDisallowedDeclareModifier(node.modifiers)) {
                this.skip(node);
                return;
            }
            
            if (this.checkEnumDeclarationElements(node)) {
                this.skip(node);
                return;
            }

            var savedInAmbientDeclaration = this.inAmbientDeclaration;
            this.inAmbientDeclaration = this.inAmbientDeclaration || this.containsToken(node.modifiers, SyntaxKind.DeclareKeyword);
            super.visitEnumDeclaration(node);
            this.inAmbientDeclaration = savedInAmbientDeclaration;
        }

        private visitInvocationExpression(node: InvocationExpressionSyntax): void {
            if (node.expression.kind() === SyntaxKind.SuperKeyword &&
                node.argumentList.typeArgumentList !== null) {
                this.pushDiagnostic1(this.position(), node,
                    DiagnosticCode._super__invocation_cannot_have_type_arguments);
            }

            super.visitInvocationExpression(node);
        }

        private visitModuleDeclaration(node: ModuleDeclarationSyntax): void {
            if (this.checkForDisallowedDeclareModifier(node.modifiers)) {
                this.skip(node);
                return;
            }

            if (this.inAmbientDeclaration) {
            }
            else {
                if (node.stringLiteral && !this.containsToken(node.modifiers, SyntaxKind.DeclareKeyword)) {
                    var stringLiteralFullStart = this.childFullStart(node, node.stringLiteral);
                    this.pushDiagnostic1(stringLiteralFullStart, node.stringLiteral,
                        DiagnosticCode.Non_ambient_modules_cannot_use_quoted_names);
                    this.skip(node);
                    return;
                }
            }

            var savedInAmbientDeclaration = this.inAmbientDeclaration;
            this.inAmbientDeclaration = this.inAmbientDeclaration || this.containsToken(node.modifiers, SyntaxKind.DeclareKeyword);
            super.visitModuleDeclaration(node);
            this.inAmbientDeclaration = savedInAmbientDeclaration;
        }

        private visitBlock(node: BlockSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Implementations_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitBlock(node);
        }

        private visitBreakStatement(node: BreakStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node,
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitBreakStatement(node);
        }

        private visitContinueStatement(node: ContinueStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node,
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitContinueStatement(node);
        }

        private visitDebuggerStatement(node: DebuggerStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node,
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitDebuggerStatement(node);
        }

        private visitDoStatement(node: DoStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitDoStatement(node);
        }

        private visitEmptyStatement(node: EmptyStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node,
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitEmptyStatement(node);
        }

        private visitExpressionStatement(node: ExpressionStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node,
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitExpressionStatement(node);
        }

        private visitForInStatement(node: ForInStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitForInStatement(node);
        }

        private visitForStatement(node: ForStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitForStatement(node);
        }

        private visitIfStatement(node: IfStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitIfStatement(node);
        }

        private visitLabeledStatement(node: LabeledStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitLabeledStatement(node);
        }

        private visitReturnStatement(node: ReturnStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitReturnStatement(node);
        }

        private visitSwitchStatement(node: SwitchStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitSwitchStatement(node);
        }

        private visitThrowStatement(node: ThrowStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitThrowStatement(node);
        }

        private visitTryStatement(node: TryStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitTryStatement(node);
        }

        private visitWhileStatement(node: WhileStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitWhileStatement(node);
        }

        private visitWithStatement(node: WithStatementSyntax): void {
            if (this.inAmbientDeclaration) {
                this.pushDiagnostic1(this.position(), node.firstToken(),
                    DiagnosticCode.Statements_are_not_allowed_in_ambient_declarations);
                this.skip(node);
                return;
            }

            super.visitWithStatement(node);
        }

        private visitFunctionDeclaration(node: FunctionDeclarationSyntax): void {
            if (this.checkForDisallowedDeclareModifier(node.modifiers)) {
                this.skip(node);
                return;
            }

            var savedInAmbientDeclaration = this.inAmbientDeclaration;
            this.inAmbientDeclaration = this.inAmbientDeclaration || this.containsToken(node.modifiers, SyntaxKind.DeclareKeyword);
            super.visitFunctionDeclaration(node);
            this.inAmbientDeclaration = savedInAmbientDeclaration;
        }

        private visitVariableStatement(node: VariableStatementSyntax): void {
            if (this.checkForDisallowedDeclareModifier(node.modifiers)) {
                this.skip(node);
                return;
            }

            var savedInAmbientDeclaration = this.inAmbientDeclaration;
            this.inAmbientDeclaration = this.inAmbientDeclaration || this.containsToken(node.modifiers, SyntaxKind.DeclareKeyword);
            super.visitVariableStatement(node);
            this.inAmbientDeclaration = savedInAmbientDeclaration;
        }
    }
}