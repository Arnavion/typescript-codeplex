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

            var jsOutputAsync = '';
            var jsOutputSync = '';
            var sourceMapRecordAsync = "";
            var sourceMapRecordSync = "";

            var declFilesCode: { fileName: string; code: string; }[] = []

            var errorDescriptionAsync = '';
            var errorDescriptionLocal = '';
            var createNewInstance = false;
            var emittingSourceMap = false;

            var harnessCompiler = Harness.Compiler.getCompiler(Harness.Compiler.CompilerInstance.RunTime);
            // The compiler doesn't handle certain flags flipping during a single compilation setting. Tests on these flags will need 
            // a fresh compiler instance for themselves and then create a fresh one for the next test. Would be nice to get dev fixes
            // eventually to remove this limitation.
            for (var i = 0; i < tcSettings.length; ++i) {
                if (!createNewInstance && (tcSettings[i].flag == "noimplicitany" || tcSettings[i].flag === 'target')) {
                    Harness.Compiler.recreate(Harness.Compiler.CompilerInstance.RunTime, true /*minimalDefaultLife */, tcSettings[i].flag == "noimplicitany" /*noImplicitAny*/);
                    harnessCompiler.setCompilerSettings(tcSettings);
                    createNewInstance = true;
                }

                if (tcSettings[i].flag == "sourcemap" && tcSettings[i].value.toLowerCase() === 'true') {
                    emittingSourceMap = true;
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

            harnessCompiler.compileFiles(toBeCompiled, otherFiles, function (result) {
                var jsResult = result.commonJS;
                for (var i = 0; i < jsResult.errors.length; i++) {
                    errorDescriptionLocal += Harness.getFileName(jsResult.errors[i].file) + ' line ' + jsResult.errors[i].line + ' col ' + jsResult.errors[i].column + ': ' + jsResult.errors[i].message + '\r\n';
                }
                jsOutputSync = jsResult.code;
                sourceMapRecordSync = jsResult.sourceMapRecord;

                // AMD output
                var amdResult = result.amd;
                for (var i = 0; i < amdResult.errors.length; i++) {
                    errorDescriptionAsync += Harness.getFileName(amdResult.errors[i].file) + ' line ' + amdResult.errors[i].line + ' col ' + amdResult.errors[i].column + ': ' + amdResult.errors[i].message + '\r\n';
                }
                jsOutputAsync = amdResult.code;
                declFilesCode = result.commonJS.declFilesCode;
                sourceMapRecordAsync = amdResult.sourceMapRecord;
            }, function (settings?: TypeScript.CompilationSettings) {
                tcSettings.push({ flag: "module", value: "commonjs" });
                harnessCompiler.setCompilerSettings(tcSettings);
            });

            // check errors
            if (this.errors) {
                Harness.Baseline.runBaseline('Correct errors for ' + fileName + ' (commonjs)', justName.replace(/\.ts/, '.errors.txt'), () => {
                    if (errorDescriptionLocal === '') {
                        return null;
                    } else {
                        // Certain errors result in full paths being reported, namely when types of external modules are involved
                        // we'll strip the full path and just report the filename
                        var fullPath = /\w+:(\/|\\)([\w+\-\.]|\/)*\.ts/g;
                        var hasFullPath = errorDescriptionLocal.match(fullPath);
                        if (hasFullPath) {
                            hasFullPath.forEach(match => {
                                var filename = Harness.getFileName(match);
                                errorDescriptionLocal = errorDescriptionLocal.replace(match, filename);
                                errorDescriptionAsync = errorDescriptionAsync.replace(match, filename); // should be the same errors
                            });
                        }
                        return errorDescriptionLocal;
                    }
                });
            }

            // if the .d.ts is non-empty, confirm it compiles correctly as well
            if (this.decl && declFilesCode) {
                var declErrors = '';
                declFilesCode.forEach(file => {
                    // don't want to use the fullpath for the unitName or the file won't be resolved correctly
                    var declFile = { unitName: 'tests/cases/compiler/' + Harness.getFileName(file.fileName), content: file.code };
                    harnessCompiler.compileFiles(
                        [declFile],
                        [], // TODO: is this right?
                        function (result) {
                            var jsOutputSync = result.commonJS;
                            for (var i = 0; i < jsOutputSync.errors.length; i++) {
                                declErrors += Harness.getFileName(jsOutputSync.errors[i].file) + ' line ' + jsOutputSync.errors[i].line + ' col ' + jsOutputSync.errors[i].column + ': ' + jsOutputSync.errors[i].message + '\r\n';
                            }
                        });

                    Harness.Baseline.runBaseline('.d.ts for ' + fileName + ' compiles without error', Harness.getFileName(file.fileName).replace(/\.ts/, '.errors.txt'), () => {
                        return (declErrors === '') ? null : declErrors;
                    });
                });
            }

            if (!TypeScript.isDTSFile(lastUnit.name)) {
                if (this.emit) {
                    // check js output
                    Harness.Baseline.runBaseline('Correct JS output (commonjs) for ' + fileName, justName.replace(/\.ts/, '.commonjs.js'), () => {
                        return jsOutputSync;
                    });

                    Harness.Baseline.runBaseline('Correct JS output (AMD) for ' + fileName, justName.replace(/\.ts/, '.amd.js'), () => {
                        return jsOutputAsync;
                    });

                    // Check sourcemap output
                    if (emittingSourceMap) {
                        Harness.Baseline.runBaseline('Correct SourceMap Record (commonjs) for ' + fileName, justName.replace(/\.ts/, '.sourcemapRecord.commonjs.baseline'), () => {
                            return sourceMapRecordSync;
                        });

                        Harness.Baseline.runBaseline('Correct SourceMap Record (AMD) for ' + fileName, justName.replace(/\.ts/, '.sourcemapRecord.amd.baseline'), () => {
                            return sourceMapRecordAsync;
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