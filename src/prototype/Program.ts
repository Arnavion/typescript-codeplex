// ///<reference path='..\compiler\parser.ts' />
///<reference path='Emitter.ts' />
///<reference path='Parser.ts' />
///<reference path='Environment.ts' />
///<reference path='TextFactory.ts' />
///<reference path='Test262.ts' />
///<reference path='Top1000.ts' />
///<reference path='tests\IncrementalParserTests.ts' />

var stringTable = Collections.createStringTable();

var specificFile = 
    // "ErrorRecovery_ParameterList2.ts";
    undefined;

class Program {
    runAllTests(environment: IEnvironment, useTypeScript: bool, verify: bool): void {
        environment.standardOut.WriteLine("");

        environment.standardOut.WriteLine("Testing Incremental 2.");
        IncrementalParserTests.runAllTests();
        if (true) {
            // return;
        }
        
        environment.standardOut.WriteLine("Testing Incremental Perf.");
        this.testIncrementalSpeed("C:\\fidelity\\src\\prototype\\SyntaxNodes.generated.ts");

        environment.standardOut.WriteLine("Testing findToken.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\findToken\\ecmascript5",
            filePath => this.runFindToken(environment, filePath, LanguageVersion.EcmaScript5, verify, /*generateBaselines:*/ false));
            
        environment.standardOut.WriteLine("Testing trivia.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\trivia\\ecmascript5",
            filePath => this.runTrivia(environment, filePath, LanguageVersion.EcmaScript5, verify, /*generateBaselines:*/ false));

        environment.standardOut.WriteLine("Testing scanner.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\scanner\\ecmascript5",
            filePath => this.runScanner(environment, filePath, LanguageVersion.EcmaScript5, verify, /*generateBaselines:*/ false));
            
        environment.standardOut.WriteLine("Testing parser.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\parser\\ecmascript5",
            filePath => this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, verify, /*generateBaselines:*/ false));
            
        environment.standardOut.WriteLine("Testing Incremental 1.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\parser\\ecmascript5",
            filePath => this.runIncremental(environment, filePath, LanguageVersion.EcmaScript5));

        environment.standardOut.WriteLine("Testing emitter 1.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\emitter\\ecmascript5",
            filePath => this.runEmitter(environment, filePath, LanguageVersion.EcmaScript5, verify, /*generateBaselines:*/ false, /*justText:*/ false));
            
        environment.standardOut.WriteLine("Testing emitter 2.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\emitter2\\ecmascript5",
            filePath => this.runEmitter(environment, filePath, LanguageVersion.EcmaScript5, verify, /*generateBaselines:*/ false, /*justText:*/ true));

        environment.standardOut.WriteLine("Testing against monoco.");
        this.runTests(environment, "C:\\temp\\monoco-files",
            filePath => this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, /*verify:*/ false, /*generateBaselines:*/ false));
            
        environment.standardOut.WriteLine("Testing against 262.");
        this.runTests(environment, "C:\\fidelity\\src\\prototype\\tests\\test262",
            filePath => this.runParser(environment, filePath, LanguageVersion.EcmaScript5, useTypeScript, /*verify: */ false, /*generateBaselines:*/ false));
    }

    private testIncrementalSpeed(filePath: string): void {
        var contents = Environment.readFile(filePath, /*useUTF8:*/ true);
        // environment.standardOut.WriteLine(filePath);

        var text = TextFactory.create(contents);
        var tree = Parser.parse(text, LanguageVersion.EcmaScript5, stringTable);

        var totalIncrementalTime = 0;
        var count = 1000;

        for (var i = 0; i < count; i++) {
            var start = new Date().getTime();

            var changeLength = i * 2;
            var tree2 = Parser.incrementalParse(
                tree.sourceUnit(), [new TextChangeRange(new TextSpan((text.length() / 2) - i, changeLength), changeLength)], text, LanguageVersion.EcmaScript5, stringTable);
            var end = new Date().getTime();

            var diff = (end - start);
            totalIncrementalTime += (end - start);

            Debug.assert(tree.structuralEquals(tree2));

            tree = tree2;
        }
        
        // Environment.standardOut.WriteLine("Parsing time    : " + totalParseTime);
        Environment.standardOut.WriteLine("Incremental time: " + totalIncrementalTime);
        Environment.standardOut.WriteLine("Incremental rate: " + (contents.length * count) / totalIncrementalTime);

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

    private checkResult(filePath: string, result: any, verify: bool, generateBaseline: bool, justText: bool): void {
        if (generateBaseline) {
            var actualResult = justText ? result : JSON2.stringify(result, null, 4);
            var expectedFile = filePath + ".expected";

            // environment.standardOut.WriteLine("Generating baseline for: " + filePath);
            Environment.writeFile(expectedFile, actualResult, /*useUTF8:*/ true);
        }
        else if (verify) {
            var actualResult = justText ? result : JSON2.stringify(result, null, 4);
            var expectedFile = filePath + ".expected";
            var actualFile = filePath + ".actual";

            var expectedResult = null;
            if (!Environment.fileExists(expectedFile)) {
                Environment.writeFile(expectedFile, "", false);
            }
            else {
                expectedResult = Environment.readFile(expectedFile, /*useUTF8:*/ true);
            }

            if (expectedResult !== actualResult) {
                Environment.standardOut.WriteLine(" !! Test Failed. Results written to: " + actualFile);
                Environment.writeFile(actualFile, actualResult, /*useUTF8:*/ true);
            }
        }
    }
    
    runEmitter(environment: IEnvironment,
               filePath: string,
               languageVersion: LanguageVersion,
               verify: bool,
               generateBaseline: bool,
               justText: bool): void {
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

        var text = TextFactory.create(contents);

        var tree = Parser.parse(text, languageVersion, stringTable);
        var emitted = Emitter.emit(<SourceUnitSyntax>tree.sourceUnit());

        end = new Date().getTime();
        totalTime += (end - start);
        
        var result = justText
            ? <any>emitted.fullText()
            : { fullText: emitted.fullText().split("\r\n"), sourceUnit: emitted };
        this.checkResult(filePath, result, verify, generateBaseline, justText);
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
            //var text1 = new TypeScript.StringSourceText(contents);
            //var parser1 = new TypeScript.Parser(); 
            //parser1.errorRecovery = true;
            //var unit1 = parser1.parse(text1, filePath, 0);

            end = new Date().getTime();
            totalTime += (end - start);
        }
        else {
            var text = TextFactory.create(contents);
            var tree = Parser.parse(text, languageVersion, stringTable);

            end = new Date().getTime();
            totalTime += (end - start);

            Debug.assert(tree.sourceUnit().fullWidth() === contents.length);
            
            this.checkResult(filePath, tree, verify, generateBaseline, false);
        }
    }

    runIncremental(environment: IEnvironment,
        filePath: string,
        languageVersion: LanguageVersion): void {
        if (!StringUtilities.endsWith(filePath, ".ts") && !StringUtilities.endsWith(filePath, ".js")) {
            return;
        }

        if (filePath.indexOf("RealSource") >= 0) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);
        // environment.standardOut.WriteLine(filePath);

        var text = TextFactory.create(contents);

        var tree1 = Parser.parse(text, languageVersion, stringTable);
        var tree2 = Parser.incrementalParse(
            Syntax.emptySourceUnit(), [new TextChangeRange(new TextSpan(0, 0), text.length())], text, languageVersion, stringTable);

        Debug.assert(tree1.structuralEquals(tree2));
    }

    runFindToken(environment: IEnvironment, filePath: string,
        languageVersion: LanguageVersion, verify: bool, generateBaseline: bool): void {
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

        var text = TextFactory.create(contents);
        var tree = Parser.parse(text, languageVersion, stringTable);
        var sourceUnit = tree.sourceUnit();

        end = new Date().getTime();
        totalTime += (end - start);

        Debug.assert(tree.sourceUnit().fullWidth() === contents.length);

        var result = {};

        for (var i = 0; i <= contents.length; i++) {
            var token = sourceUnit.findToken(i).token;

            Debug.assert(token.isToken());
            if (i === contents.length) {
                Debug.assert(token.kind() === SyntaxKind.EndOfFileToken);
            }
            else {
                Debug.assert(!token.isMissing());
                Debug.assert(token.width() > 0 || token.kind() === SyntaxKind.EndOfFileToken);
                Debug.assert(token.fullWidth() > 0);
            }

            result[i] = token;
        }
        
        this.checkResult(filePath, result, verify, generateBaseline, /*justText:*/ false);
    }

    runTrivia(environment: IEnvironment, filePath: string,
              languageVersion: LanguageVersion, verify: bool, generateBaseline: bool): void {
        if (!StringUtilities.endsWith(filePath, ".ts")) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);

        var start: number, end: number;
        start = new Date().getTime();

        var text = TextFactory.create(contents);
        var scanner = new Scanner(text, languageVersion, stringTable);

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

        end = new Date().getTime();
        totalTime += (end - start);

        this.checkResult(filePath, tokens, verify, generateBaseline, false);
    }

    runScanner(environment: IEnvironment,
        filePath: string, languageVersion: LanguageVersion, verify: bool, generateBaseline: bool): void {
        if (!StringUtilities.endsWith(filePath, ".ts")) {
            return;
        }

        var contents = environment.readFile(filePath, /*useUTF8:*/ true);

        var start: number, end: number;
        start = new Date().getTime();

        var text = TextFactory.create(contents);
        var scanner = new Scanner(text, languageVersion, stringTable);

        var tokens: ISyntaxToken[] = [];
        var textArray: string[] = [];
        var diagnostics: SyntaxDiagnostic[] = [];

        while (true) {
            var token = scanner.scan(diagnostics, /*allowRegularExpression:*/ false);
            tokens.push(token);

            if (token.tokenKind === SyntaxKind.EndOfFileToken) {
                break;
            }
        }

        end = new Date().getTime();
        totalTime += (end - start);

        if (verify) {
            var tokenText = ArrayUtilities.select(tokens, t => t.fullText()).join("");

            if (tokenText !== contents) {
                throw new Error("Token invariant broken!");
            }
        }

        var result = diagnostics.length === 0 ? <any>tokens : { diagnostics: diagnostics, tokens: tokens };
        this.checkResult(filePath, result, verify, generateBaseline, false);
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
                    var stringText = TextFactory.create(contents);
                    var tree = Parser.parse(stringText, LanguageVersion.EcmaScript5, stringTable);

                    if (isNegative) {
                        var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1);
                        var canParseSuccessfully = <bool>negative262ExpectedResults[fileName];

                        if (canParseSuccessfully) {
                            // We expected to parse this successfully.  Report an error if we didn't.
                            if (tree.diagnostics() && tree.diagnostics().length > 0) {
                                environment.standardOut.WriteLine("Negative test. Unexpected failure: " + filePath);
                                failCount++;
                            }
                        }
                        else {
                            // We expected to fail on this.  Report an error if we don't.
                            if (tree.diagnostics() === null || tree.diagnostics().length === 0) {
                                environment.standardOut.WriteLine("Negative test. Unexpected success: " + filePath);
                                failCount++;
                            }
                        }
                    }
                    else {
                        // Not a negative test.  We can't have any errors or skipped tokens.
                        if (tree.diagnostics() && tree.diagnostics().length > 0) {
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
                    var stringText = TextFactory.create(contents);
                    var tree = Parser.parse(stringText, LanguageVersion.EcmaScript5, stringTable);

                    //environment.standardOut.WriteLine(filePath);
                    // environment.standardOut.Write(".");

                    if (canParseSuccessfully) {
                        if (tree.diagnostics() && tree.diagnostics().length > 0) {
                            environment.standardOut.WriteLine("Unexpected failure: " + filePath);
                            failCount++;
                        }
                    }
                    else {
                        // We expected to fail on this.  Report an error if we don't.
                        if (tree.diagnostics() === null || tree.diagnostics().length === 0) {
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