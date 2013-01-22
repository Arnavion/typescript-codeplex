/// <reference path='..\..\..\src\harness\harness.ts' />
/// <reference path='..\..\..\src\compiler\diagnostics.ts' />
/// <reference path='..\runnerbase.ts' />

class CompilerBaselineRunner extends RunnerBase {

    // the compiler flags which we support and functions to set the right settings
    private supportedFlags: { flag: string; setFlag: (x: TypeScript.CompilationSettings, value: string) => void; }[] = [
    { flag: 'comments', setFlag: (x: TypeScript.CompilationSettings, value: string) => { x.emitComments = value.toLowerCase() === 'true' ? true : false; } },
    { flag: 'declaration', setFlag: (x: TypeScript.CompilationSettings, value: string) => { x.generateDeclarationFiles = value.toLowerCase() === 'true' ? true : false; } },
    {
        flag: 'module', setFlag: (x: TypeScript.CompilationSettings, value: string) => {
            switch (value.toLowerCase()) {
                // this needs to be set on the global variable
                case 'amd':
                    TypeScript.moduleGenTarget = TypeScript.ModuleGenTarget.Asynchronous;
                    x.moduleGenTarget = TypeScript.ModuleGenTarget.Asynchronous;
                    break;
                case 'commonjs':
                    TypeScript.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
                    x.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
                    break;
                default:
                    TypeScript.moduleGenTarget = TypeScript.ModuleGenTarget.Local;
                    x.moduleGenTarget = TypeScript.ModuleGenTarget.Local;
                    break;
            }
        }
    },
    { flag: 'nolib', setFlag: (x: TypeScript.CompilationSettings, value: string) => { x.useDefaultLib = value.toLowerCase() === 'true' ? true : false; } },
    { flag: 'sourcemap', setFlag: (x: TypeScript.CompilationSettings, value: string) => { x.mapSourceFiles = value.toLowerCase() === 'true' ? true : false; } },
    { flag: 'target', setFlag: (x: TypeScript.CompilationSettings, value: string) => { x.codeGenTarget = value.toLowerCase() === 'es3' ? TypeScript.CodeGenTarget.ES3 : TypeScript.CodeGenTarget.ES5; } },
    { flag: 'out', setFlag: (x: TypeScript.CompilationSettings, value: string) => { x.outputOption = value; } },
    { flag: 'filename', setFlag: (x: TypeScript.CompilationSettings, value: string) => { /* used for multifile tests, doesn't change any compiler settings */; } },
    ];

    public checkTestCodeOutput(filename: string) {
        var that = this;
        function setSettings(tcSettings: Harness.TestCaseParser.CompilerSetting[], settings: TypeScript.CompilationSettings) {
            tcSettings.forEach((item) => {
                var idx = that.supportedFlags.filter((x) => x.flag === item.flag.toLowerCase());
                if (idx && idx.length != 1) {
                    throw new Error('Unsupported flag \'' + item.flag + '\'');
                }

                idx[0].setFlag(settings, item.value);
            });
        }

        var basePath = 'tests/cases/compiler/';
        // strips the filename from the path.
        var justName = filename.replace(/^.*[\\\/]/, '');
        var content = IO.readFile(filename);
        var testCaseContent = Harness.TestCaseParser.makeUnitsFromTest(content, justName);

        var units = testCaseContent.testUnitData;
        var tcSettings = testCaseContent.settings;

        var lastUnit = units[units.length - 1];
        describe('JS output and errors for ' + filename, function () {
            assert.bugs(content);

            var jsOutputAsync = '';
            var jsOutputSync = '';

            var declFileName = Harness.Compiler.isDeclareFile(lastUnit.name) ? lastUnit.name : lastUnit.name.replace('.ts', '.d.ts');
            var declFileCode = '';

            var errorDescriptionAsync = '';
            var errorDescriptionLocal = '';

            // compile as CommonJS module                    
            Harness.Compiler.compileUnits(units, function (result) {
                for (var i = 0; i < result.errors.length; i++) {
                    errorDescriptionLocal += result.errors[i].file + ' line ' + result.errors[i].line + ' col ' + result.errors[i].column + ': ' + result.errors[i].message + '\r\n';
                }
                jsOutputSync = result.code;

                // save away any generated .d.ts code for later verification
                result.fileResults.forEach(r => {
                    if (r.filename === declFileName) {
                        declFileCode = r.file.lines.join('\n');
                    }
                });
            }, function (settings?: TypeScript.CompilationSettings) {
                tcSettings.push({ flag: "module", value: "commonjs" });
                setSettings(tcSettings, settings);
            });
                    
            // compile as AMD module
            Harness.Compiler.compileUnits(units, function (result) {
                for (var i = 0; i < result.errors.length; i++) {
                    errorDescriptionAsync += result.errors[i].file + ' line ' + result.errors[i].line + ' col ' + result.errors[i].column + ': ' + result.errors[i].message + '\r\n';
                }
                jsOutputAsync = result.code;
            }, function (settings?: TypeScript.CompilationSettings) {
                tcSettings.push({ flag: "module", value: "amd" });
                setSettings(tcSettings, settings);
            });

            // check errors
            Harness.Baseline.runBaseline('Correct errors for ' + filename + ' (commonjs)', justName.replace(/\.ts/, '.errors.txt'), () => {
                if (errorDescriptionLocal === '') {
                    return null;
                } else {
                    return errorDescriptionLocal;
                }
            });

            // check errors
            Harness.Baseline.runBaseline('Correct errors for ' + filename + ' (async)', justName.replace(/\.ts/, '.errors.txt'), () => {
                if (errorDescriptionAsync === '') {
                    return null;
                } else {
                    return errorDescriptionAsync;
                }
            });

            // if the .d.ts is non-empty, confirm it compiles correctly as well
            if (!declFileCode) {
                var declErrors = '';
                Harness.Compiler.compileString(declFileCode, declFileName, function (result) {
                    for (var i = 0; i < result.errors.length; i++) {
                        declErrors += result.errors[i].file + ' line ' + result.errors[i].line + ' col ' + result.errors[i].column + ': ' + result.errors[i].message + '\r\n';
                    }
                });

                Harness.Baseline.runBaseline('.d.ts for ' + filename + ' compiles without error', declFileName.replace(/\.ts/, '.errors.txt'), () => {
                    return (declErrors === '') ? null : declErrors;
                });
            }

            if (!Harness.Compiler.isDeclareFile(lastUnit.name)) {
                // check js output
                Harness.Baseline.runBaseline('Correct JS output (commonjs) for ' + filename, justName.replace(/\.ts/, '.commonjs.js'), () => {
                    return jsOutputSync;
                });

                Harness.Baseline.runBaseline('Correct JS output (AMD) for ' + filename, justName.replace(/\.ts/, '.amd.js'), () => {
                    return jsOutputAsync;
                });

                // check runtime output
                Harness.Baseline.runBaseline('Correct runtime output for ' + filename, justName.replace(/\.ts/, '.output.txt'), () => {
                    var runResult = null;
                    Harness.Runner.runJSString(jsOutputSync, (error, result) => {
                        if (error === null) {
                            runResult = result;
                        }
                    });

                    if (typeof runResult === 'string') {
                        // Some interesting runtime result to report
                        return runResult;
                    } else {
                        return null;
                    }
                });
            }
        });
    }

    public runTests() {
        Harness.Compiler.recreate()

        if (this.tests.length === 0) {
            this.enumerateFiles('tests/cases/compiler').forEach(fn => {
                fn = fn.replace(/\\/g, "/");
                this.checkTestCodeOutput(fn);
            });
        }
        else {
            this.tests.forEach(test => this.checkTestCodeOutput(test));
        }
    }
}