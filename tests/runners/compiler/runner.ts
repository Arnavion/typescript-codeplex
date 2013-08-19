/// <reference path='..\..\..\src\harness\harness.ts' />
/// <reference path='..\..\..\src\compiler\diagnostics.ts' />
/// <reference path='..\runnerbase.ts' />

class CompilerBaselineRunner extends RunnerBase {

    private basePath = 'tests/cases';
    private errors: boolean;
    private emit: boolean;
    private decl: boolean;
    private output: boolean;

    public options: string;

    constructor(public testType?: string) {
        super(testType);
        this.errors = true;
        this.emit = true;
        this.decl = true;
        this.output = true;
        this.basePath += '/compiler';
    }    

    /** Replaces instances of full paths with filenames only */
    static removeFullPaths(text: string) {
        var fullPath = /\w+:(\/|\\)([\w+\-\.]|\/)*\.ts/g;
        var fullPathList = text.match(fullPath);
        if (fullPathList) {
            fullPathList.forEach((match: string) => text = text.replace(match, Harness.getFileName(match)));
        }
        return text;
    }

    public checkTestCodeOutput(fileName: string) {
        // strips the fileName from the path.
        var justName = fileName.replace(/^.*[\\\/]/, '');
        var content = IO.readFile(fileName, /*codepage:*/ null).contents;
        var testCaseContent = Harness.TestCaseParser.makeUnitsFromTest(content, fileName);

        var units = testCaseContent.testUnitData;
        var tcSettings = testCaseContent.settings;
        var createNewInstance = false;

        var lastUnit = units[units.length - 1];

        describe('JS output and errors for ' + fileName, () => {
            Harness.Assert.bugs(content);

            /** Compiled JavaScript emit, if any */
            var jsOutput = '';
            /** Source map content, if any */
            var sourceMapContent = "";
            /** Newline-delimited string describing compilation errors */
            var errorDescription = '';

            var createNewInstance = false;
            var emittingSourceMap = false;
            var moduleTarget = TypeScript.ModuleGenTarget.Unspecified;

            var harnessCompiler = Harness.Compiler.getCompiler(Harness.Compiler.CompilerInstance.RunTime);
            for (var i = 0; i < tcSettings.length; ++i) {
                // The compiler doesn't handle certain flags flipping during a single compilation setting. Tests on these flags will need 
                // a fresh compiler instance for themselves and then create a fresh one for the next test. Would be nice to get dev fixes
                // eventually to remove this limitation.
                if (!createNewInstance && (tcSettings[i].flag == "noimplicitany" || tcSettings[i].flag === 'target')) {
                    Harness.Compiler.recreate(Harness.Compiler.CompilerInstance.RunTime, true /*minimalDefaultLife */, tcSettings[i].flag == "noimplicitany" /*noImplicitAny*/);
                    harnessCompiler.setCompilerSettings(tcSettings);
                    createNewInstance = true;
                }

                if (tcSettings[i].flag == "sourcemap" && tcSettings[i].value.toLowerCase() === 'true') {
                    emittingSourceMap = true;
                } else if (tcSettings[i].flag === "module") {
                    if (tcSettings[i].value.toLowerCase() === "amd") {
                        moduleTarget = TypeScript.ModuleGenTarget.Asynchronous;
                    } else if (tcSettings[i].value.toLowerCase() === "commonjs") {
                        moduleTarget = TypeScript.ModuleGenTarget.Synchronous;
                    } else {
                        throw new Error('Invalid module target ' + tcSettings[i].value + '; suported values are "amd" and "commonjs"');
                    }
                }
            }

            // We need to assemble the list of input files for the compiler and other related files on the 'filesystem' (ie in a multi-file test)
            // If the last file in a test uses require or a triple slash reference we'll assume all other files will be brought in via references,
            // otherwise, assume all files are just meant to be in the same compilation session without explicit references to one another.
            var toBeCompiled: { unitName: string; content: string }[] = [];
            var otherFiles: { unitName: string; content: string }[] = [];
            if (/require\(/.test(lastUnit.content) || /reference\spath/.test(lastUnit.content)) {
                toBeCompiled.push({ unitName: 'tests/cases/compiler/' + lastUnit.name, content: lastUnit.content });
                units.forEach(unit => {
                    if (unit.name !== lastUnit.name) {
                        otherFiles.push({ unitName: 'tests/cases/compiler/' + unit.name, content: unit.content });
                    }
                });
            } else {
                toBeCompiled = units.map(unit => {
                    return { unitName: 'tests/cases/compiler/' + unit.name, content: unit.content };
                });
            }

            var result: Harness.Compiler.CompilerResult;
            harnessCompiler.compileFiles(toBeCompiled, otherFiles, moduleTarget, function (compileResult) {
                result = compileResult;
            }, function (settings) {
                settings.mapSourceFiles = emittingSourceMap;
            });

            // check errors
            if (this.errors) {
                // Surface some errors that indicate test authoring failure
                var badErrors = result.errors.filter(err => err.errorType === Harness.Compiler.ErrorType.Emit);
                if (badErrors.length > 0) {
                    throw new Error('Emit errors in ' + fileName + ': ' + badErrors.map(e => JSON.stringify(e)).join('\r\n'));
                }

                Harness.Baseline.runBaseline('Correct errors for ' + fileName, justName.replace(/\.ts/, '.errors.txt'), () => {
                    if (result.errors.length === 0) {
                        return null;
                    } else {
                        var errorDescr = result.errors.map(err => CompilerBaselineRunner.removeFullPaths(Harness.getFileName(err.fileName) + ' line ' + err.line + ' col ' + err.column + ': ' + err.message)).join('\r\n');
                        return errorDescr;
                    }
                });
            }

            // if the .d.ts is non-empty, confirm it compiles correctly as well
            if (this.decl && result.declFilesCode.length > 0) {
                var declErrors: string[] = undefined;
                result.declFilesCode.forEach(file => {
                    // don't want to use the fullpath for the unitName or the file won't be resolved correctly
                    var declFile = { unitName: 'tests/cases/compiler/' + Harness.getFileName(file.fileName), content: file.code };
                    harnessCompiler.compileFiles(
                        [declFile],
                        otherFiles,
                        TypeScript.ModuleGenTarget.Unspecified,
                        function (result) {
                            declErrors = result.errors.map(err => Harness.getFileName(err.fileName) + ' line ' + err.line + ' col ' + err.column + ': ' + err.message + '\r\n');
                        }
                    );

                    if (declErrors && declErrors.length) {
                        throw new Error('.d.ts file ' + file.fileName + ' did not compile. Errors: ' + declErrors.map(err => JSON.stringify(err)).join('\r\n'));
                    }
                });
            }

            

            if (!TypeScript.isDTSFile(lastUnit.name)) {
                if (this.emit) {
                    if (result.files.length === 0) {
                        throw new Error('Expected at least 1 js file to be emitted');
                    }

                    // check js output
                    Harness.Baseline.runBaseline('Correct JS output for ' + fileName, justName.replace(/\.ts/, '.js'), () => {
                        return result.files[0].code;
                    });

                    // Check sourcemap output
                    if (emittingSourceMap) {
                        if (result.sourceMaps.length !== 1) {
                            throw new Error('Expected exactly 1 .js.map file to be emitted, but got ' + result.sourceMaps.length);
                        }
                        
                        Harness.Baseline.runBaseline('Correct SourceMap for ' + fileName, justName.replace(/\.ts/, '.map'), () => {
                            return result.sourceMaps[0].code;
                        });
                    }
                }
            }

            if (createNewInstance) {
                Harness.Compiler.recreate(Harness.Compiler.CompilerInstance.RunTime, true);
                createNewInstance = false;
            }
        });
    }

    public initializeTests() {       
        describe("Setup compiler for compiler baselines", () => {
            // REVIEW: would like to use the minimal lib.d.ts but a bunch of tests need to be converted to use non-DOM APIs
            Harness.Compiler.recreate(Harness.Compiler.CompilerInstance.RunTime, true);
            this.parseOptions();
        });

        if (this.tests.length === 0) {
            this.enumerateFiles(this.basePath).forEach(fn => {
                fn = fn.replace(/\\/g, "/");
                this.checkTestCodeOutput(fn);
            });
        }
        else {
            this.tests.forEach(test => this.checkTestCodeOutput(test));
        }
    }

    private parseOptions() {
        if (this.options && this.options.length > 0) {
            this.errors = false;
            this.emit = false;
            this.decl = false;
            this.output = false;

            var opts = this.options.split(',');
            for (var i = 0; i < opts.length; i++) {
                switch (opts[i]) {
                    case 'error':
                        this.errors = true;
                        break;
                    case 'emit':
                        this.emit = true;
                        break;
                    case 'decl':
                        this.decl = true;
                        break;
                    case 'output':
                        this.output = true;
                        break;
                    default:
                        throw new Error('unsupported flag');
                }
            }
        }
    }
}