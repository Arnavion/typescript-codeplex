///<reference path='References.ts' />
///<reference path='..\compiler\parser.ts' />
///<reference path='Test262.ts' />
///<reference path='Top1000.ts' />

var stringTable = new StringTable();

var specificFile = 
    // "Trivia11.ts";
    undefined;

class Program {
    runAllTests(environment: IEnvironment, useTypeScript: bool, verify: bool): void {
        environment.standardOut.WriteLine("");
            
        environment.standardOut.WriteLine("Testing trivia.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\trivia\\ecmascript5",
            filePath => this.runTrivia(environment, filePath, LanguageVersion.EcmaScript5, verify));
            
        environment.standardOut.WriteLine("Testing emitter.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\emitter\\ecmascript5",
            filePath => this.runEmitter(environment, filePath, LanguageVersion.EcmaScript5, verify));

        environment.standardOut.WriteLine("Testing scanner.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\scanner\\ecmascript5",
            filePath => this.runScanner(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, verify, /*generateBaselines:*/ false));
            
        environment.standardOut.WriteLine("Testing parser.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\parser\\ecmascript5",
            filePath => this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, verify, /*generateBaselines:*/ false));
            
        environment.standardOut.WriteLine("Testing against monoco.");
        this.runTests(environment, "C:\\temp\\monoco-files",
            filePath => this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, /*verify: */ false, /*allowErrors:*/ false));
            
        environment.standardOut.WriteLine("Testing against 262.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\test262",
            filePath => this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, /*verify: */ false, /*generateBaselines:*/ false));
    }

    private handleException(environment: IEnvironment, filePath: string, e: Error): void {
        environment.standardOut.WriteLine("");
        if ((<string>e.message).indexOf(filePath) < 0) {
            environment.standardOut.WriteLine("Exception: " + filePath + ": " + e.message);
        }
        else {
            environment.standardOut.WriteLine(e.message);
        }
    }

    private runTests(
        environment: IEnvironment,
        path: string,
        action: (filePath: string) => void) {

        var testFiles = environment.listFiles(path, null, { recursive: true });
        for (var index in testFiles) {
            var filePath = testFiles[index];
            if (specificFile !== undefined && filePath.indexOf(specificFile) < 0) {
                continue;
            }


            try {
                action(filePath);
            }
            catch (e) {
                this.handleException(environment, filePath, e);
           }
        }
    }

    runEmitter(environment: IEnvironment,
               filePath: string,
               languageVersion: LanguageVersion,
               verify: bool,
               generateBaseline?: bool = false): void {
        if (true) {
            // return;
        }

        if (!StringUtilities.endsWith(filePath, ".ts") && !StringUtilities.endsWith(filePath, ".js")) {
            return;
        }

        if (filePath.indexOf("RealSource") >= 0) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);
        // environment.standardOut.WriteLine(filePath);

        var start: number, end: number;
        start = new Date().getTime();

        totalSize += contents.length;

        var text = new StringText(contents);

        var parser = new Parser(text, languageVersion, stringTable);
        var tree = parser.parseSyntaxTree();
        var emitted = new Emitter(true).emit(<SourceUnitSyntax>tree.sourceUnit());

        if (generateBaseline) {
            var result = { fullText: emitted.fullText(), sourceUnit: emitted };
            var actualResult = JSON2.stringify(result, null, 4);

            var expectedFile = filePath + ".expected";

            // environment.standardOut.WriteLine("Generating baseline for: " + filePath);
            environment.writeFile(expectedFile, actualResult, /*useUTF8:*/ true);
        }
        else if (verify) {
            var result = { fullText: emitted.fullText(), sourceUnit: emitted };
            var actualResult = JSON2.stringify(result, null, 4);

            var expectedFile = filePath + ".expected";
            var actualFile = filePath + ".actual";

            var expectedResult = environment.readFile(expectedFile, /*useUTF8:*/ true);

            if (expectedResult !== actualResult) {
                environment.standardOut.WriteLine(" !! Test Failed. Results written to: " + actualFile);
                environment.writeFile(actualFile, actualResult, /*useUTF8:*/ true);
            }
        }

        end = new Date().getTime();
        totalTime += (end - start);
    }

    runParser(environment: IEnvironment,
              filePath: string,
              languageVersion: LanguageVersion,
              useTypeScript: bool,
              verify: bool,
              generateBaseline?: bool = false): void {
        if (!StringUtilities.endsWith(filePath, ".ts") && !StringUtilities.endsWith(filePath, ".js")) {
            return;
        }

        if (filePath.indexOf("RealSource") >= 0) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);
        // environment.standardOut.WriteLine(filePath);
        
        var start: number, end: number;
        start = new Date().getTime();

        totalSize += contents.length;

        if (useTypeScript) {
            var text1 = new TypeScript.StringSourceText(contents);
            var parser1 = new TypeScript.Parser(); 
            parser1.errorRecovery = true;
            var unit1 = parser1.parse(text1, filePath, 0);
        }
        else {
            var text = new StringText(contents);
            var parser = new Parser(text, languageVersion, stringTable);
            var unit = parser.parseSyntaxTree();

            //if (!allowErrors) {
            //    if (unit.diagnostics() && unit.diagnostics().length) {
            //        throw new Error("File had unexpected error!");
            //    }
            //}

            if (generateBaseline) {
                var actualResult = JSON2.stringify(unit, null, 4);
                var expectedFile = filePath + ".expected";

                // environment.standardOut.WriteLine("Generating baseline for: " + filePath);
                environment.writeFile(expectedFile, actualResult, /*useUTF8:*/ true);
            }
            else if (verify) {
                var actualResult = JSON2.stringify(unit, null, 4);
                var expectedFile = filePath + ".expected";
                var actualFile = filePath + ".actual";

                var expectedResult = environment.readFile(expectedFile, /*useUTF8:*/ true);

                if (expectedResult !== actualResult) {
                    environment.standardOut.WriteLine(" !! Test Failed. Results written to: " + actualFile);
                    environment.writeFile(actualFile, actualResult, /*useUTF8:*/ true);
                }
            }
        }
        
        end = new Date().getTime();
        totalTime += (end - start);
    }

    runTrivia(environment: IEnvironment, filePath: string, languageVersion: LanguageVersion, verify: bool): void {
        if (!StringUtilities.endsWith(filePath, ".ts")) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);

        var start: number, end: number;
        start = new Date().getTime();
        try {
            var text = new StringText(contents);
            var scanner = Scanner.create(text, languageVersion);

            var tokens: ISyntaxToken[] = [];
            var textArray: string[] = [];
            var diagnostics: SyntaxDiagnostic[] = [];

            while (true) {
                var token = scanner.scan(diagnostics, /*allowRegularExpression:*/ false);
                tokens.push(token.realize());

                if (token.tokenKind === SyntaxKind.EndOfFileToken) {
                    break;
                }
            }

            if (verify) {
                var actualResult = JSON2.stringify(tokens, null, 4);
                var expectedFile = filePath + ".expected";
                var actualFile = filePath + ".actual";

                var expectedResult = environment.readFile(expectedFile, /*useUTF8:*/ true);

                if (expectedResult !== actualResult) {
                    environment.standardOut.WriteLine(" !! Test Failed. Results written to: " + actualFile);
                    environment.writeFile(actualFile, actualResult, true);
                }
            }
        }
        finally {
            end = new Date().getTime();
            totalTime += (end - start);
        }
    }

    runScanner(environment: IEnvironment,
              filePath: string, languageVersion: LanguageVersion, useTypeScript: bool, verify: bool, generateBaseline: bool): void {
        if (!StringUtilities.endsWith(filePath, ".ts")) {
            return;
        }

        if (useTypeScript) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);

        var start: number, end: number;
        start = new Date().getTime();
        try {
            var text = new StringText(contents);
            var scanner = Scanner.create(text, languageVersion);

            var tokens: ISyntaxToken[] = [];
            var textArray: string[] = [];
            var diagnostics: SyntaxDiagnostic[] = [];

            while (true) {
                var token = scanner.scan(diagnostics, /*allowRegularExpression:*/ false);
                tokens.push(token);

                if (verify) {
                    var tokenText = token.text();
                    var tokenFullText = token.fullText();

                    textArray.push(tokenFullText);

                    if (tokenFullText.substr(token.start() - token.fullStart(), token.width()) !== tokenText) {
                        throw new Error("Token invariant broken!");
                    }
                }

                if (token.tokenKind === SyntaxKind.EndOfFileToken) {
                    break;
                }
            }

            var result = diagnostics.length === 0 ? <any>tokens : { diagnostics: diagnostics, tokens: tokens };

            if (generateBaseline) {
                var actualResult = JSON2.stringify(result, null, 4);
                var expectedFile = filePath + ".expected";

                environment.writeFile(expectedFile, actualResult, /*useUTF8:*/ true);
            }
            if (verify) {
                var fullText = textArray.join("");

                if (contents !== fullText) {
                    throw new Error("Full text didn't match!");
                }

                var actualResult = JSON2.stringify(result, null, 4);
                var expectedFile = filePath + ".expected";
                var actualFile = filePath + ".actual";

                var expectedResult = environment.readFile(expectedFile, /*useUTF8:*/ true);

                if (expectedResult !== actualResult) {
                    environment.standardOut.WriteLine(" !! Test Failed. Results written to: " + actualFile);
                    environment.writeFile(actualFile, actualResult, true);
                }
            }
        }
        finally {
            end = new Date().getTime();
            totalTime += (end - start);
        }
    }

    run(environment: IEnvironment, useTypeScript: bool): void {
        environment.standardOut.WriteLine("Testing input files.");
        for (var index in environment.arguments) {
            var filePath: string = environment.arguments[index];
            if (specificFile !== undefined && filePath.indexOf(specificFile) < 0) {
                continue;
            }

            this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, /*verify:*/ false, /*allowErrors:*/ false);
        }
    }

    run262(environment: IEnvironment): void {
        var path = "C:\\temp\\test262\\suite";
        var testFiles = environment.listFiles(path, null, { recursive: true });

        var testCount = 0;
        var failCount = 0;
        var skippedTests:string[] = [];

        for (var index in testFiles) {
            var filePath: string = testFiles[index];

            if (specificFile !== undefined && filePath.indexOf(specificFile) < 0) {
                continue;
            }

            // All 262 files are utf8.  But they dont' have a BOM.  Force them to be read in
            // as UTF8.
            var contents = environment.readFile(filePath, /*useUTF8:*/ true);

            var start: number, end: number;
            start = new Date().getTime();

            try {
                totalSize += contents.length;
                var isNegative = contents.indexOf("@negative") >= 0

                testCount++;

                try {
                    var stringText = new StringText(contents);
                    var parser = new Parser(stringText, LanguageVersion.EcmaScript5, stringTable);

                    var syntaxTree = parser.parseSyntaxTree();
            //environment.standardOut.Write(".");

                    if (isNegative) {
                        var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1);
                        var canParseSuccessfully = <bool>negative262ExpectedResults[fileName];

                        if (canParseSuccessfully) {
                            // We expected to parse this successfully.  Report an error if we didn't.
                            if (syntaxTree.diagnostics() && syntaxTree.diagnostics().length > 0) {
                                environment.standardOut.WriteLine("Negative test. Unexpected failure: " + filePath);
                                failCount++;
                            }
                        }
                        else {
                            // We expected to fail on this.  Report an error if we don't.
                            if (syntaxTree.diagnostics() === null || syntaxTree.diagnostics().length === 0) {
                                environment.standardOut.WriteLine("Negative test. Unexpected success: " + filePath);
                                failCount++;
                            }
                        }
                    }
                    else {
                        // Not a negative test.  We can't have any errors or skipped tokens.
                        if (syntaxTree.diagnostics() && syntaxTree.diagnostics().length > 0) {
                            environment.standardOut.WriteLine("Unexpected failure: " + filePath);
                            failCount++;
                        }
                    }
                }
                catch (e) {
                    failCount++;
                    this.handleException(environment, filePath, e);
                }
            }
            finally {
                end = new Date().getTime();
                totalTime += (end - start);
            }
        }

        environment.standardOut.WriteLine("");
        environment.standardOut.WriteLine("Test 262 results:");
        environment.standardOut.WriteLine("Test Count: " + testCount);
        environment.standardOut.WriteLine("Skip Count: " + skippedTests.length);
        environment.standardOut.WriteLine("Fail Count: " + failCount);

        for (var i = 0; i < skippedTests.length; i++) {
            environment.standardOut.WriteLine(skippedTests[i]);
        }
    }

    runTop1000(environment: IEnvironment): void {
        environment.standardOut.WriteLine("Testing top 1000 sites.");

        var path = "C:\\Temp\\TopJSFiles";
        var testFiles = environment.listFiles(path, null, { recursive: true });

        var testCount = 0;
        var failCount = 0;
        var skippedTests:string[] = [];

        for (var index in testFiles) {
            var filePath: string = testFiles[index];

            if (specificFile !== undefined && filePath.indexOf(specificFile) < 0) {
                continue;
            }

            var canParseSuccessfully = expectedTop1000Failures[filePath.substr(path.length + 1)] === undefined;
            var contents = environment.readFile(filePath, /*useUTF8:*/ true);

            var start: number, end: number;
            start = new Date().getTime();

            try {
                totalSize += contents.length;
                testCount++;

                try {
                    var stringText = new StringText(contents);
                    var parser = new Parser(stringText, LanguageVersion.EcmaScript5, stringTable);

                    var syntaxTree = parser.parseSyntaxTree();
            //environment.standardOut.WriteLine(filePath);
            // environment.standardOut.Write(".");

                    if (canParseSuccessfully) {
                        if (syntaxTree.diagnostics() && syntaxTree.diagnostics().length > 0) {
                            environment.standardOut.WriteLine("Unexpected failure: " + filePath);
                            failCount++;
                        }
                    }
                    else {
                        // We expected to fail on this.  Report an error if we don't.
                        if (syntaxTree.diagnostics() === null || syntaxTree.diagnostics().length === 0) {
                            environment.standardOut.WriteLine("Unexpected success: " + filePath);
                            failCount++;
                        }
                    }
                }
                catch (e) {
                    failCount++;
                    this.handleException(environment, filePath, e);
                }
            }
            finally {
                end = new Date().getTime();
                totalTime += (end - start);
            }
        }

        environment.standardOut.WriteLine("");
        environment.standardOut.WriteLine("Top 1000 results:");
        environment.standardOut.WriteLine("Test Count: " + testCount);
        environment.standardOut.WriteLine("Skip Count: " + skippedTests.length);
        environment.standardOut.WriteLine("Fail Count: " + failCount);

        for (var i = 0; i < skippedTests.length; i++) {
            environment.standardOut.WriteLine(skippedTests[i]);
        }
    }
}

// (<any>WScript).StdIn.ReadLine();
var totalSize = 0;
var totalTime = 0;
var program = new Program();

// New parser.
if (true) {
    totalTime = 0;
    totalSize = 0;
    program.runAllTests(Environment, false, true);
    program.run(Environment, false);
    Environment.standardOut.WriteLine("Total time: " + totalTime);
    Environment.standardOut.WriteLine("Total size: " + totalSize);
}

// Existing parser.
if (false) {
    totalTime = 0;
    totalSize = 0;
    program.runAllTests(Environment, true, false);
    program.run(Environment, true);
    Environment.standardOut.WriteLine("Total time: " + totalTime);
    Environment.standardOut.WriteLine("Total size: " + totalSize);
}

// Test 262.
if (true) {
    totalTime = 0;
    totalSize = 0;
    program.run262(Environment);
    Environment.standardOut.WriteLine("Total time: " + totalTime);
    Environment.standardOut.WriteLine("Total size: " + totalSize);
}

// Test Top 1000 sites.
if (false) {
    totalTime = 0;
    totalSize = 0;
    program.runTop1000(Environment);
    Environment.standardOut.WriteLine("Total time: " + totalTime);
    Environment.standardOut.WriteLine("Total size: " + totalSize);
}