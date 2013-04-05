﻿//﻿
// Copyright (c) Microsoft Corporation.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='typescript.ts' />

module TypeScript {
    // Note: Any addition to the NodeType should also be supported with addition to AstWalkerDetailCallback
    export enum NodeType {
        None,
        List,
        Script,

        // Literals
        TrueLiteral,
        FalseLiteral,
        StringLiteral,
        RegularExpressionLiteral,
        NumericLiteral,
        NullLiteral,

        // Types
        TypeParameter,
        GenericType,
        TypeRef,

        // Declarations
        FunctionDeclaration,
        ClassDeclaration,
        InterfaceDeclaration,
        ModuleDeclaration,
        ImportDeclaration,
        VariableDeclarator,
        VariableDeclaration,

        // Expressions
        Name,
        ArrayLiteralExpression,
        ObjectLiteralExpression,
        OmittedExpression,
        VoidExpression,
        CommaExpression,
        PlusExpression,
        NegateExpression,
        DeleteExpression,
        ThisExpression,
        SuperExpression,
        InExpression,
        MemberAccessExpression,
        InstanceOfExpression,
        TypeOfExpression,
        ElementAccessExpression,
        InvocationExpression,
        ObjectCreationExpression,
        Asg,
        AsgAdd,
        AsgSub,
        AsgDiv,
        AsgMul,
        AsgMod,
        AsgAnd,
        AsgXor,
        AsgOr,
        AsgLsh,
        AsgRsh,
        AsgRs2,
        ConditionalExpression,
        LogOr,
        LogAnd,
        Or,
        Xor,
        And,
        Eq,
        Ne,
        Eqv,
        NEqv,
        Lt,
        Le,
        Gt,
        Ge,
        Add,
        Sub,
        Mul,
        Div,
        Mod,
        Lsh,
        Rsh,
        Rs2,
        Not,
        LogNot,
        IncPre,
        DecPre,
        IncPost,
        DecPost,
        CastExpression,
        ParenthesizedExpression,
        Member,
        Parameter,

        // Statements
        ReturnStatement,
        BreakStatement,
        ContinueStatement,
        ThrowStatement,
        ForStatement,
        ForInStatement,
        IfStatement,
        WhileStatement,
        DoStatement,
        Block,
        SwitchStatement,
        TryStatement,
        VariableStatement,
        ExportAssignment,
        WithStatement,
        ExpressionStatement,
        LabeledStatement,
        DebuggerStatement,
        EmptyStatement,

        // Clauses
        CaseClause,
        CatchClause,

        Comment,
        LastAsg = AsgRs2,
    }
}