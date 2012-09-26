﻿///<reference path='..\..\compiler\typescript.ts' />
///<reference path='..\..\harness\harness.ts' />

describe('Compiling tests\\compiler\\propertySignatureTests.ts', function() {
    /* BUG 13986
    it('The Identifier of a property signature must be unique within its containing type. ', function(){
        var code  = 'var foo: { a:string; a: string; };';
            Harness.Compiler.compileString(code, 'property signatures', function(result) {
                assert.equal(result.errors.length, 1);
                assert.compilerWarning(result, 1, 9, 'Duplicate identifier a');
        });
    });*/

    it('If a property signature omits a TypeAnnotation, the Any type is assumed.', function(){
        var code  = 'var foo: { a; }; foo.a = 2; foo.a = "0";';
            Harness.Compiler.compileString(code, 'property signatures', function(result) {
            assert.equal(result.errors.length, 0);
        });
    })
});