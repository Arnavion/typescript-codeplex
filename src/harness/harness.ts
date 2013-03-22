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

///<reference path='..\compiler\io.ts'/>
///<reference path='..\compiler\typescript.ts'/>
///<reference path='..\services\typescriptServices.ts' />
///<reference path='diff.ts'/>

declare var assert: Harness.Assert;
declare var it;
declare var describe;
declare var run;
//declare var IO: IIO;
declare var __dirname; // Node-specific

function switchToForwardSlashes(path: string) {
    return path.replace(/\\/g, "/");
}

function filePath(fullPath: string) {
    fullPath = switchToForwardSlashes(fullPath);
    var components = fullPath.split("/");
    var path: string[] = components.slice(0, components.length - 1);
    return path.join("/") + "/";
}

var typescriptServiceFileName = filePath(IO.getExecutingFilePath()) + "typescriptServices.js";
var typescriptServiceFile = IO.readFile(typescriptServiceFileName);
if (typeof ActiveXObject === "function") {
    eval(typescriptServiceFile);
} else if (typeof require === "function") {
    var vm = require('vm');
    vm.runInThisContext(typescriptServiceFile, 'typescriptServices.js');
} else {
    throw new Error('Unknown context');
}

declare module process {
    export function nextTick(callback: () => any): void;
    export function on(event: string, listener: Function);
}

module Harness {
    // Settings 
    export var userSpecifiedroot = "";
    var global = <any>Function("return this").call(null);

    export interface ITestMetadata {
        id: string;
        desc: string;
        pass: bool;
        perfResults: {
            mean: number;
            min: number;
            max: number;
            stdDev: number;
            trials: number[];
        };
    }
    export interface IScenarioMetadata {
        id: string;
        desc: string;
        pass: bool;
        bugs: string[];
    }

    // Assert functions
    export module Assert {
        export var bugIds: string[] = [];
        export var throwAssertError = (error: Error) => {
            throw error;
        };

        // Marks that the current scenario is impacted by a bug
        export function bug(id: string) {
            if (bugIds.indexOf(id) < 0) {
                bugIds.push(id);
            }
        }

        // If there are any bugs in the test code, mark the scenario as impacted appropriately
        export function bugs(content: string) {
            var bugs = content.match(/\bbug (\d+)/i);
            if (bugs) {
                bugs.forEach(bug => assert.bug(bug));
            }
        }

        export function is(result: bool, msg?: string) {
            if (!result) {
                throwAssertError(new Error(msg || "Expected true, got false."));
            }
        }

        export function arrayLengthIs(arr: any[], length: number) {
            if (arr.length != length) {
                var actual = '';
                arr.forEach(n => actual = actual + '\n      ' + n.toString());
                throwAssertError(new Error('Expected array to have ' + length + ' elements. Actual elements were:' + actual));
            }
        }

        export function equal(actual, expected) {
            if (actual !== expected) {
                throwAssertError(new Error("Expected " + actual + " to equal " + expected));
            }
        }

        export function notEqual(actual, expected) {
            if (actual === expected) {
                throwAssertError(new Error("Expected " + actual + " to *not* equal " + expected));
            }
        }

        export function notNull(result) {
            if (result === null) {
                throwAssertError(new Error("Expected " + result + " to *not* be null"));
            }
        }

        export function compilerWarning(result: Compiler.CompilerResult, line: number, column: number, desc: string) {
            if (!result.isErrorAt(line, column, desc)) {
                var actual = '';
                result.errors.forEach(err => {
                    actual = actual + '\n     ' + err.toString();
                });

                throwAssertError(new Error("Expected compiler warning at (" + line + ", " + column + "): " + desc + "\nActual errors follow: " + actual));
            }
        }

        export function noDiff(text1, text2) {
            text1 = text1.replace(/^\s+|\s+$/g, "").replace(/\r\n?/g, "\n");
            text2 = text2.replace(/^\s+|\s+$/g, "").replace(/\r\n?/g, "\n");

            if (text1 !== text2) {
                var errorString = "";
                var text1Lines = text1.split(/\n/);
                var text2Lines = text2.split(/\n/);
                for (var i = 0; i < text1Lines.length; i++) {
                    if (text1Lines[i] !== text2Lines[i]) {
                        errorString += "Difference at line " + (i + 1) + ":\n";
                        errorString += "                  Left File: " + text1Lines[i] + "\n";
                        errorString += "                 Right File: " + text2Lines[i] + "\n\n";
                    }
                }
                throwAssertError(new Error(errorString));
            }
        }

        export function arrayContains(arr: any[], contains: any[]) {
            var found;

            for (var i = 0; i < contains.length; i++) {
                found = false;

                for (var j = 0; j < arr.length; j++) {
                    if (arr[j] === contains[i]) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    throwAssertError(new Error("Expected array to contain \"" + contains[i] + "\""));
                }
            }
        }

        export function arrayContainsOnce(arr: any[], filter: (item: any) => bool) {
            var foundCount = 0;

            for (var i = 0; i < arr.length; i++) {
                if (filter(arr[i])) {
                    foundCount++;
                }
            }

            if (foundCount !== 1) {
                throwAssertError(new Error("Expected array to match element only once (instead of " + foundCount + " times)"));
            }
        }
    }

    /** Splits the given string on \r\n or on only \n if that fails */
    export function splitContentByNewlines(content: string) {
        // Split up the input file by line
        // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
        // we have to string-based splitting instead and try to figure out the delimiting chars
        var lines = content.split('\r\n');
        if (lines.length === 1) {
            lines = content.split('\n');
        }
        return lines;
    }

    /** Reads a file under /tests */
    export function readFile(path: string) {

        if (path.indexOf('tests') < 0) {
            path = "tests/" + path;
        }

        var content = IO.readFile(Harness.userSpecifiedroot + path);
        if (content === null) {
            throw new Error("failed to read file at: '" + Harness.userSpecifiedroot + path + "'");
        }

        return content;
    }

    // Logger
    export interface ILogger {
        start: (fileName?: string, priority?: number) => void;
        end: (fileName?: string) => void;
        scenarioStart: (scenario: IScenarioMetadata) => void;
        scenarioEnd: (scenario: IScenarioMetadata, error?: Error) => void;
        testStart: (test: ITestMetadata) => void;
        pass: (test: ITestMetadata) => void;
        bug: (test: ITestMetadata) => void;
        fail: (test: ITestMetadata) => void;
        error: (test: ITestMetadata, error: Error) => void;
        comment: (comment: string) => void;
        verify: (test: ITestMetadata, passed: bool, actual: any, expected: any, message: string) => void;
    }

    export class Logger implements ILogger {
        public start(fileName?: string, priority?: number) { }
        public end(fileName?: string) { }
        public scenarioStart(scenario: IScenarioMetadata) { }
        public scenarioEnd(scenario: IScenarioMetadata, error?: Error) { }
        public testStart(test: ITestMetadata) { }
        public pass(test: ITestMetadata) { }
        public bug(test: ITestMetadata) { }
        public fail(test: ITestMetadata) { }
        public error(test: ITestMetadata, error: Error) { }
        public comment(comment: string) { }
        public verify(test: ITestMetadata, passed: bool, actual: any, expected: any, message: string) { }
    }

    // Logger-related functions
    var loggers: ILogger[] = [];
    export function registerLogger(logger: ILogger) {
        loggers.push(logger);
    }
    export function emitLog(field: string, ...params: any[]) {
        for (var i = 0; i < loggers.length; i++) {
            if (typeof loggers[i][field] === 'function') {
                loggers[i][field].apply(loggers[i], params);
            }
        }
    }

    // BDD Framework
    export interface IDone {
        (e?: Error): void;
    }
    export class Runnable {
        constructor(public description: string, public block: any) { }

        // The current stack of Runnable objects
        static currentStack: Runnable[] = [];

        // The error, if any, that occurred when running 'block'
        public error: Error = null;

        // Whether or not this object has any failures (including in its descendants)
        public passed = null;

        // A list of bugs impacting this object
        public bugs: string[] = [];

        // A list of all our child Runnables
        public children: Runnable[] = [];

        public addChild(child: Runnable): void {
            this.children.push(child);
        }

        /** Call function fn, which may take a done function and may possibly execute
         *  asynchronously, calling done when finished. Returns true or false depending
         *  on whether the function was asynchronous or not.
         */
        public call(fn: (done?: IDone) => void , done: IDone) {
            var isAsync = true;

            try {
                if (fn.length === 0) {
                    // No async.
                    fn();
                    done();

                    return false;
                } else {
                    // Possibly async

                    Runnable.pushGlobalErrorHandler(done);

                    fn(function () {
                        isAsync = false; // If we execute synchronously, this will get called before the return below.
                        Runnable.popGlobalErrorHandler();
                        done();
                    });

                    return isAsync;
                }

            } catch (e) {
                done(e);

                return false;
            }
        }

        public run(done: IDone) { }

        public runBlock(done: IDone) {
            return this.call(this.block, done);
        }

        public runChild(index: number, done: IDone) {
            var that = this;
            return this.call(<any>((done) => that.children[index].run(done)), done);
        }

        static errorHandlerStack: { (e: Error): void; }[] = [];

        static pushGlobalErrorHandler(done: IDone) {
            Runnable.errorHandlerStack.push(function (e) {
                done(e);
            });
        }

        static popGlobalErrorHandler() {
            Runnable.errorHandlerStack.pop();
        }

        static handleError(e: Error) {
            if (Runnable.errorHandlerStack.length === 0) {
                IO.printLine('Global error: ' + e);
            } else {
                Runnable.errorHandlerStack[Runnable.errorHandlerStack.length - 1](e);
            }
        }
    }
    export class TestCase extends Runnable {
        public description: string;
        public block;

        constructor(description: string, block: any) {
            super(description, block);
            this.description = description;
            this.block = block;
        }

        public addChild(child: Runnable): void {
            throw new Error("Testcases may not be nested inside other testcases");
        }

        /** Run the test case block and fail the test if it raised an error. If no error is raised, the test passes. */
        public run(done: IDone) {
            var that = this;

            Runnable.currentStack.push(this);

            emitLog('testStart', { desc: this.description });

            if (this.block) {
                var async = this.runBlock(<any>function (e) {
                    if (e) {
                        that.passed = false;
                        that.error = e;
                        emitLog('error', { desc: this.description, pass: false }, e);
                    } else {
                        that.passed = true;

                        emitLog('pass', { desc: this.description, pass: true });
                    }

                    Runnable.currentStack.pop();

                    done()
                });
            }

        }
    }

    export class Scenario extends Runnable {
        public description: string;
        public block;

        constructor(description: string, block: any) {
            super(description, block);
            this.description = description;
            this.block = block;
        }

        /** Run the block, and if the block doesn't raise an error, run the children. */
        public run(done: IDone) {
            var that = this;

            Runnable.currentStack.push(this);

            emitLog('scenarioStart', { desc: this.description });

            var async = this.runBlock(<any>function (e) {
                Runnable.currentStack.pop();
                if (e) {
                    that.passed = false;
                    that.error = e;
                    var metadata: IScenarioMetadata = { id: undefined, desc: this.description, pass: false, bugs: assert.bugIds };
                    // Report all bugs affecting this scenario
                    assert.bugIds.forEach(desc => emitLog('bug', metadata, desc));
                    emitLog('scenarioEnd', metadata, e);
                    done();
                } else {
                    that.passed = true; // so far so good.
                    that.runChildren(done);
                }
            });
        }

        /** Run the children of the scenario (other scenarios and test cases). If any fail,
         *  set this scenario to failed. Synchronous tests will run synchronously without
         *  adding stack frames.
         */
        public runChildren(done: IDone, index = 0) {
            var that = this;
            var async = false;

            for (; index < this.children.length; index++) {
                async = this.runChild(index, <any>function (e) {
                    that.passed = that.passed && that.children[index].passed;

                    if (async)
                        that.runChildren(done, index + 1);
                });

                if (async)
                    return;
            }

            var metadata: IScenarioMetadata = { id: undefined, desc: this.description, pass: this.passed, bugs: assert.bugIds };
            // Report all bugs affecting this scenario
            assert.bugIds.forEach(desc => emitLog('bug', metadata, desc));
            emitLog('scenarioEnd', metadata);

            done();
        }
    }
    export class Run extends Runnable {
        constructor() {
            super('Test Run', null);
        }

        public run() {
            emitLog('start');
            this.runChildren();
        }

        public runChildren(index = 0) {
            var async = false;
            var that = this;

            for (; index < this.children.length; index++) {
                // Clear out bug descriptions
                assert.bugIds = [];

                async = this.runChild(index, <any>function (e) {
                    if (async) {
                        that.runChildren(index + 1);
                    }
                });

                if (async) {
                    return;
                }
            }

            Perf.runBenchmarks();
            emitLog('end');
        }
    }

    // Performance test
    export module Perf {
        export module Clock {
            export var now: () => number;
            export var resolution: number;

            declare module WScript {
                export function InitializeProjection();
            }

            declare module TestUtilities {
                export function QueryPerformanceCounter(): number;
                export function QueryPerformanceFrequency(): number;
            }

            if (typeof WScript !== "undefined" && typeof global['WScript'].InitializeProjection !== "undefined") {
                // Running in JSHost.
                global['WScript'].InitializeProjection();

                now = function () {
                    return TestUtilities.QueryPerformanceCounter();
                }

                resolution = TestUtilities.QueryPerformanceFrequency();
            } else {
                now = function () {
                    return Date.now();
                }

                resolution = 1000;
            }
        }

        export class Timer {
            public startTime;
            public time = 0;

            public start() {
                this.time = 0;
                this.startTime = Clock.now();
            }

            public end() {
                // Set time to MS.
                this.time = (Clock.now() - this.startTime) / Clock.resolution * 1000;
            }
        }

        export class Dataset {
            public data: number[] = [];

            public add(value: number) {
                this.data.push(value);
            }

            public mean() {
                var sum = 0;
                for (var i = 0; i < this.data.length; i++) {
                    sum += this.data[i];
                }

                return sum / this.data.length;
            }

            public min() {
                var min = this.data[0];

                for (var i = 1; i < this.data.length; i++) {
                    if (this.data[i] < min) {
                        min = this.data[i];
                    }
                }

                return min;
            }

            public max() {
                var max = this.data[0];

                for (var i = 1; i < this.data.length; i++) {
                    if (this.data[i] > max) {
                        max = this.data[i];
                    }
                }

                return max;
            }

            public stdDev() {
                var sampleMean = this.mean();
                var sumOfSquares = 0;
                for (var i = 0; i < this.data.length; i++) {
                    sumOfSquares += Math.pow(this.data[i] - sampleMean, 2);
                }

                return Math.sqrt(sumOfSquares / this.data.length);
            }
        }

        // Base benchmark class with some defaults.
        export class Benchmark {
            public iterations = 10;
            public description = "";
            public bench(subBench?: () => void ) { }
            public before() { }
            public beforeEach() { }
            public after() { }
            public afterEach() { }
            public results: { [x: string]: Dataset; } = <{ [x: string]: Dataset; }>{};

            public addTimingFor(name: string, timing: number) {
                this.results[name] = this.results[name] || new Dataset();
                this.results[name].add(timing);
            }
        }

        export var benchmarks: { new (): Benchmark; }[] = [];

        var timeFunction: (
            benchmark: Benchmark,
            description?: string,
            name?: string,
            f?: (bench?: { (): void; }) => void
        ) => void;

        timeFunction = function (
            benchmark: Benchmark,
            description: string = benchmark.description,
            name: string = '',
            f = benchmark.bench
        ): void {

            var t = new Timer();
            t.start();

            var subBenchmark = function (name, f): void {
                timeFunction(benchmark, description, name, f);
            }

            f.call(benchmark, subBenchmark);

            t.end();

            benchmark.addTimingFor(name, t.time);
        }

        export function runBenchmarks() {
            for (var i = 0; i < benchmarks.length; i++) {
                var b = new benchmarks[i]();


                var t = new Timer();
                b.before();
                for (var j = 0; j < b.iterations; j++) {
                    b.beforeEach();
                    timeFunction(b);
                    b.afterEach();
                }
                b.after();

                for (var prop in b.results) {
                    var description = b.description + (prop ? ": " + prop : '');

                    emitLog('testStart', { desc: description });

                    emitLog('pass', {
                        desc: description, pass: true, perfResults: {
                            mean: b.results[prop].mean(),
                            min: b.results[prop].min(),
                            max: b.results[prop].max(),
                            stdDev: b.results[prop].stdDev(),
                            trials: b.results[prop].data
                        }
                    });
                }

            }
        }

        // Replace with better type when classes are assignment compatible with
        // the below type.
        // export function addBenchmark(BenchmarkClass: {new(): Benchmark;}) {
        export function addBenchmark(BenchmarkClass: any) {
            benchmarks.push(BenchmarkClass);
        }

    }

    /** Functionality for compiling TypeScript code */
    export module Compiler {
        /** Aggregate various writes into a single array of lines. Useful for passing to the
         *  TypeScript compiler to fill with source code or errors.
         */
        export class WriterAggregator implements ITextWriter {
            public lines: string[] = [];
            public currentLine = "";

            public Write(str) {
                this.currentLine += str;
            }

            public WriteLine(str) {
                this.lines.push(this.currentLine + str);
                this.currentLine = "";
            }

            public Close() {
                if (this.currentLine.length > 0) { this.lines.push(this.currentLine); }
                this.currentLine = "";
            }

            public reset() {
                this.lines = [];
                this.currentLine = "";
            }
        }

        /** Mimics having multiple files, later concatenated to a single file. */
        export class EmitterIOHost implements TypeScript.EmitterIOHost {

            private fileCollection = {};

            /** create file gets the whole path to create, so this works as expected with the --out parameter */
            public createFile(s: string, useUTF8?: bool): ITextWriter {

                if (this.fileCollection[s]) {
                    return <ITextWriter>this.fileCollection[s];
                }

                var writer = new Harness.Compiler.WriterAggregator();
                this.fileCollection[s] = writer;
                return writer;
            }

            public directoryExists(s: string) { return false; }
            public fileExists(s: string) { return typeof this.fileCollection[s] !== 'undefined'; }
            public resolvePath(s: string) { return s; }

            public reset() { this.fileCollection = {}; }

            public toArray(): { fileName: string; file: WriterAggregator; }[] {
                var result: { fileName: string; file: WriterAggregator; }[] = [];

                for (var p in this.fileCollection) {
                    if (this.fileCollection.hasOwnProperty(p)) {
                        var current = <Harness.Compiler.WriterAggregator>this.fileCollection[p];
                        if (current.lines.length > 0) {
                            if (p !== '0.js') { current.lines.unshift('////[' + p + ']'); }
                            result.push({ fileName: p, file: this.fileCollection[p] });
                        }
                    }
                }
                return result;
            }
        }

        var libFolder: string = global['WScript'] ? TypeScript.filePath(global['WScript'].ScriptFullName) : (__dirname + '/');
        export var libText = IO ? IO.readFile(libFolder + "lib.d.ts") : '';

        var stdout = new EmitterIOHost();
        var stderr = new WriterAggregator();

        export function isDeclareFile(fileName: string) {
            return /\.d\.ts$/.test(fileName);
        }

        export function makeDefaultCompilerForTest(c?: TypeScript.TypeScriptCompiler) {
            var compiler = c || new TypeScript.TypeScriptCompiler(stderr);
            compiler.settings.codeGenTarget = TypeScript.LanguageVersion.EcmaScript5;
            compiler.settings.controlFlow = true;
            compiler.settings.controlFlowUseDef = true;
            compiler.settings.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
            compiler.parseEmitOption(stdout);
            compiler.addSourceUnit("lib.d.ts", TypeScript.ScriptSnapshot.fromString(Harness.Compiler.libText));
            return compiler;
        }

        var compiler: TypeScript.TypeScriptCompiler;
        recreate();

        // pullUpdateUnit is sufficient if an existing unit is updated, if a new unit is added we need to do a full typecheck
        var needsFullTypeCheck = true;
        export function compile(code?: string, fileName?: string) {
            if (needsFullTypeCheck) {
                compiler.pullTypeCheck(true);
                needsFullTypeCheck = false;
            }
            else {
                // requires unit to already exist in the compiler
                compiler.updateSourceUnit(fileName, TypeScript.ScriptSnapshot.fromString(""), null);
                compiler.updateSourceUnit(fileName, TypeScript.ScriptSnapshot.fromString(code), null);
            }
        }

        // Types
        export class Type {
            constructor(public type, public code, public identifier) { }

            public normalizeToArray(arg: any) {
                if ((Array.isArray && Array.isArray(arg)) || arg instanceof Array)
                    return arg;

                return [arg];
            }

            public compilesOk(testCode): bool {
                var errors = null;
                compileString(testCode, 'test.ts', function (compilerResult) {
                    errors = compilerResult.errors;
                })

                return errors.length === 0;
            }

            public isSubtypeOf(other: Type) {
                var testCode = 'class __test1__ {\n';
                testCode += '    public test() {\n';
                testCode += '        ' + other.code + ';\n';
                testCode += '        return ' + other.identifier + ';\n';
                testCode += '    }\n';
                testCode += '}\n';
                testCode += 'class __test2__ extends __test1__ {\n';
                testCode += '    public test() {\n';
                testCode += '        ' + this.code + ';\n';
                testCode += '        return ' + other.identifier + ';\n';
                testCode += '    }\n';
                testCode += '}\n';

                return this.compilesOk(testCode);
            }

            // TODO: Find an implementation of isIdenticalTo that works.
            //public isIdenticalTo(other: Type) {
            //    var testCode = 'module __test1__ {\n';
            //    testCode += '    ' + this.code + ';\n';
            //    testCode += '    export var __val__ = ' + this.identifier + ';\n';
            //    testCode += '}\n';
            //    testCode += 'var __test1__val__ = __test1__.__val__;\n';

            //    testCode += 'module __test2__ {\n';
            //    testCode += '    ' + other.code + ';\n';
            //    testCode += '    export var __val__ = ' + other.identifier + ';\n';
            //    testCode += '}\n';
            //    testCode += 'var __test2__val__ = __test2__.__val__;\n';

            //    testCode += 'function __test__function__() { if(true) { return __test1__val__ }; return __test2__val__; }';

            //    return this.compilesOk(testCode);
            //}

            public assertSubtypeOf(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    if (!this.isSubtypeOf(others[i])) {
                        throw new Error("Expected " + this.type + " to be a subtype of " + others[i].type);
                    }
                }
            }

            public assertNotSubtypeOf(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    if (this.isSubtypeOf(others[i])) {
                        throw new Error("Expected " + this.type + " to be a subtype of " + others[i].type);
                    }
                }
            }

            //public assertIdenticalTo(other: Type) {
            //    if (!this.isIdenticalTo(other)) {
            //        throw new Error("Expected " + this.type + " to be identical to " + other.type);
            //    }
            //}

            //public assertNotIdenticalTo(other: Type) {
            //    if (!this.isIdenticalTo(other)) {
            //        throw new Error("Expected " + this.type + " to not be identical to " + other.type);
            //    }
            //}

            public isAssignmentCompatibleWith(other: Type) {
                var testCode = 'module __test1__ {\n';
                testCode += '    ' + this.code + ';\n';
                testCode += '    export var __val__ = ' + this.identifier + ';\n';
                testCode += '}\n';
                testCode += 'var __test1__val__ = __test1__.__val__;\n';

                testCode += 'module __test2__ {\n';
                testCode += '    export ' + other.code + ';\n';
                testCode += '    export var __val__ = ' + other.identifier + ';\n';
                testCode += '}\n';
                testCode += 'var __test2__val__ = __test2__.__val__;\n';

                testCode += '__test2__val__ = __test1__val__;';

                return this.compilesOk(testCode);
            }

            public assertAssignmentCompatibleWith(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    var other = others[i];

                    if (!this.isAssignmentCompatibleWith(other)) {
                        throw new Error("Expected " + this.type + " to be assignment compatible with " + other.type);
                    }
                }
            }

            public assertNotAssignmentCompatibleWith(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    var other = others[i];

                    if (this.isAssignmentCompatibleWith(other)) {
                        throw new Error("Expected " + this.type + " to not be assignment compatible with " + other.type);
                    }
                }
            }

            public assertThisCanBeAssignedTo(desc: string, these: any[], notThese: any[]) {
                it(desc + " is assignable to ", () => {
                    this.assertAssignmentCompatibleWith(these);
                });
        
                it(desc + " not assignable to ", () => {
                    this.assertNotAssignmentCompatibleWith(notThese);
                });
            }

        }

        export class TypeFactory {
            public any: Type;
            public number: Type;
            public string: Type;
            public bool: Type;

            constructor() {
                this.any = this.get('var x : any', 'x');
                this.number = this.get('var x : number', 'x');
                this.string = this.get('var x : string', 'x');
                this.bool = this.get('var x : bool', 'x');
            }

            public get (code: string, target: any) {
                var targetIdentifier = '';
                var targetPosition = -1;
                if (typeof target === "string") {
                    targetIdentifier = target;
                }
                else if (typeof target === "number") {
                    targetPosition = target;
                }
                else {
                    throw new Error("Expected string or number not " + (typeof target));
                }

                var errors = null;
                compileString(code, 'test.ts', function (compilerResult) {
                    errors = compilerResult.errors;
                })

                if (errors.length > 0)
                    throw new Error("Type definition contains errors: " + errors.join(","));

                var matchingIdentifiers: Type[] = [];

                var fileNames = compiler.fileNameToScript.getAllKeys();
                for (var m = 0; m < fileNames.length; m++) {
                    var script2 = <TypeScript.Script>compiler.fileNameToScript.lookup(fileNames[m]);
                    if (script2.locationInfo.fileName !== 'lib.d.ts') {
                        if (targetPosition > -1) {
                            var tyInfo = compiler.pullGetTypeInfoAtPosition(targetPosition, script2);
                            var name = this.getTypeInfoName(tyInfo.ast);
                            var foundValue = new Type(tyInfo.symbol.getTypeName(), code, name);
                            if (!matchingIdentifiers.some(value => (value.identifier === foundValue.identifier) && (value.code === foundValue.code) && (value.type === foundValue.type))) {
                                matchingIdentifiers.push(foundValue);
                            }
                        }
                        else {
                            for (var pos = 0; pos < code.length; pos++) {
                                tyInfo = compiler.pullGetTypeInfoAtPosition(pos, script2);
                                name = this.getTypeInfoName(tyInfo.ast);
                                if (name === targetIdentifier) {
                                    foundValue = new Type(tyInfo.symbol.getTypeName(), code, targetIdentifier);
                                    if (!matchingIdentifiers.some(value => (value.identifier === foundValue.identifier) && (value.code === foundValue.code) && (value.type === foundValue.type))) {
                                        matchingIdentifiers.push(foundValue);
                                    }
                                }
                            }
                        }
                    }
                }

                if (matchingIdentifiers.length === 0) {
                    if (targetPosition > -1) {
                        throw new Error("Could not find an identifier at position " + targetPosition);
                    }
                    else {
                        throw new Error("Could not find an identifier " + targetIdentifier + " in any known scopes");
                    }
                }
                else if (matchingIdentifiers.length > 1) {
                    throw new Error("Found multiple matching identifiers for " + target);
                }
                else {
                    return matchingIdentifiers[0];
                }
            }

            private getTypeInfoName(ast : TypeScript.AST) {
                var name = '';
                switch (ast.nodeType) {
                    case TypeScript.NodeType.Name: // Type Name?
                    case TypeScript.NodeType.Null:
                    case TypeScript.NodeType.List:
                    case TypeScript.NodeType.Empty:
                    case TypeScript.NodeType.EmptyExpr:
                    case TypeScript.NodeType.Asg:
                    case TypeScript.NodeType.True:
                    case TypeScript.NodeType.False:
                    case TypeScript.NodeType.ArrayLit:
                    case TypeScript.NodeType.TypeRef:
                        break;
                    case TypeScript.NodeType.Super:
                        name = (<any>ast).text;
                        break;
                    case TypeScript.NodeType.Regex:
                        name = (<TypeScript.RegexLiteral>ast).text;
                        break;
                    case TypeScript.NodeType.QString:
                        name = (<any>ast).text;
                        break;
                    case TypeScript.NodeType.NumberLit:
                        name = (<TypeScript.NumberLiteral>ast).text;
                        break;
                    case TypeScript.NodeType.Return:
                        //name = (<TypeScript.ReturnStatement>tyInfo.ast).returnExpression.actualText; // why is this complaining?
                        break;
                    case TypeScript.NodeType.InterfaceDeclaration:
                        name = (<TypeScript.InterfaceDeclaration>ast).name.actualText;
                        break;
                    case TypeScript.NodeType.ModuleDeclaration:
                        name = (<TypeScript.ModuleDeclaration>ast).name.actualText;
                        break;
                    case TypeScript.NodeType.ClassDeclaration:
                        name = (<TypeScript.ClassDeclaration>ast).name.actualText;
                        break;
                    case TypeScript.NodeType.FuncDecl:
                        name = !(<TypeScript.FuncDecl>ast).name ? "" : (<TypeScript.FuncDecl>ast).name.actualText; // name === null for lambdas
                        break;
                    default:
                        // TODO: is there a reason to mess with all the special cases above and not just do this (ie take whatever property is there and works?)
                        var a = <any>ast;
                        name = (a.id) ? (a.id.actualText) : (a.name) ? a.name.actualText : (a.text) ? a.text : '';
                        break;
                }

                return name;
            }

            public isOfType(expr: string, expectedType: string) {
                var actualType = this.get('var _v_a_r_ = ' + expr, '_v_a_r_');

                it('Expression "' + expr + '" is of type "' + expectedType + '"', function () {
                    assert.equal(actualType.type, expectedType);
                });
            }
        }

        /** Contains the code and errors of a compilation and some helper methods to check its status. */
        export class CompilerResult {
            public code: string;
            public errors: CompilerError[];

            /** @param fileResults an array of strings for the fileName and an ITextWriter with its code */
            constructor(public fileResults: { fileName: string; file: WriterAggregator; }[], errorLines: string[], public scripts: TypeScript.Script[]) {
                var lines = [];
                fileResults.forEach(v => lines = lines.concat(v.file.lines));
                this.code = lines.join("\n")

                this.errors = [];

                for (var i = 0; i < errorLines.length; i++) {
                    var match = errorLines[i].match(/([^\(]*)\((\d+),(\d+)\):\s+((.*[\s\r\n]*.*)+)\s*$/);
                    if (match) {
                        this.errors.push(new CompilerError(match[1], parseFloat(match[2]), parseFloat(match[3]), match[4]));
                    }
                    else {
                        WScript.Echo("non-match on: " + errorLines[i]);
                    }
                }
            }

            public isErrorAt(line: number, column: number, message: string) {
                for (var i = 0; i < this.errors.length; i++) {
                    if (this.errors[i].line === line && this.errors[i].column === column && this.errors[i].message === message)
                        return true;
                }

                return false;
            }
        }

        // Compiler Error.
        export class CompilerError {
            constructor(public file: string,
                    public line: number,
                    public column: number,
                    public message: string) { }

            public toString() {
                return this.file + "(" + this.line + "," + this.column + "): " + this.message;
            }
        }

        /** Create a new instance of the compiler with default settings and lib.d.ts, then typecheck */
        export function recreate() {
            compiler = makeDefaultCompilerForTest();
            compiler.pullTypeCheck(true);
        }

        export function reset() {
            stdout.reset();
            stderr.reset();

            var files = compiler.fileNameToLocationInfo.getAllKeys();

            for (var i = 0; i < files.length; i++) {
                var fname = files[i];
                if (fname !== 'lib.d.ts') {
                    updateUnit('', fname);
                }
            }

            compiler.pullErrorReporter.hasErrors = false;            
        }

        // Defines functions to invoke before compiling a piece of code and a post compile action intended to clean up the
        // effects of preCompile, preferably with something lighter weight than a full recreate()
        export interface CompilationContext {
            fileName: string;
            preCompile: () => void;
            postCompile: () => void;
        }

        export function addUnit(code: string, unitName?: string, isDeclareFile?: bool, references?: TypeScript.IFileReference[]) {
            var script: TypeScript.Script = null;
            var uName = unitName || '0' + (isDeclareFile ? '.d.ts' : '.ts');

            var fileNames = compiler.fileNameToLocationInfo.getAllKeys();
            for (var i = 0; i < fileNames.length; i++) {
                if (compiler.fileNameToLocationInfo.lookup(fileNames[i]).fileName === uName) {
                    updateUnit(code, uName);
                    script = <TypeScript.Script>compiler.fileNameToScript.lookup(fileNames[i]);
                }
            }
            if (!script) {
                // TODO: make this toggleable, shouldn't be necessary once typecheck bugs are cleaned up
                // but without it subsequent tests are treated as edits, making for somewhat useful stress testing
                // of persistent typecheck state
                //compiler.addUnit("", uName, isResident, references); // equivalent to compiler.deleteUnit(...)
                script = compiler.addSourceUnit(uName, TypeScript.ScriptSnapshot.fromString(code), references);
                needsFullTypeCheck = true;
            }

            return script;
        }

        export function updateUnit(code: string, unitName: string) {
            compiler.updateSourceUnit(unitName, TypeScript.ScriptSnapshot.fromString(code), null);
        }

        export function compileFile(path: string, callback: (res: CompilerResult) => void , settingsCallback?: (settings?: TypeScript.CompilationSettings) => void , context?: CompilationContext, references?: TypeScript.IFileReference[]) {
            path = switchToForwardSlashes(path);
            var fileName = path.match(/[^\/]*$/)[0];
            var code = readFile(path);

            compileUnit(code, fileName, callback, settingsCallback, context, references);
        }

        export function compileUnit(code: string, fileName: string, callback: (res: CompilerResult) => void , settingsCallback?: (settings?: TypeScript.CompilationSettings) => void , context?: CompilationContext, references?: TypeScript.IFileReference[]) {
            // not recursive
            function clone/* <T> */(source: any, target: any) {
                for (var prop in source) {
                    target[prop] = source[prop];
                }
            }

            var oldCompilerSettings = new TypeScript.CompilationSettings();
            clone(compiler.settings, oldCompilerSettings);
            var oldEmitSettings = new TypeScript.EmitOptions(compiler.settings);
            clone(compiler.emitOptions, oldEmitSettings);

            if (settingsCallback) {
                settingsCallback(compiler.settings);
                compiler.emitOptions = new TypeScript.EmitOptions(compiler.settings);
            }

            try {
                compileString(code, fileName, callback, context, references);
            } finally {
                // If settingsCallback exists, assume that it modified the global compiler instance's settings in some way.
                // So that a test doesn't have side effects for tests run after it, restore the compiler settings to their previous state.
                if (settingsCallback) {
                    compiler.settings = oldCompilerSettings;
                    compiler.emitOptions = oldEmitSettings;
                }
            }
        }

        export function compileUnits(units: TestCaseParser.TestUnitData[], callback: (res: Compiler.CompilerResult) => void , settingsCallback?: () => void ) {
            var lastUnit = units[units.length - 1];
            var unitName = switchToForwardSlashes(lastUnit.name).match(/[^\/]*$/)[0];

            var dependencies = units.slice(0, units.length - 1);
            var compilationContext = Harness.Compiler.defineCompilationContextForTest(unitName, dependencies);

            compileUnit(lastUnit.content, unitName, callback, settingsCallback, compilationContext, lastUnit.references);
        }

        export function emit(ioHost: TypeScript.EmitterIOHost) {
            compiler.emit(ioHost);
        }

        export function compileString(code: string, unitName: string, callback: (res: Compiler.CompilerResult) => void , context?: CompilationContext, references?: TypeScript.IFileReference[]) {
            var scripts: TypeScript.Script[] = [];

            reset();

            if (context) {
                context.preCompile();
            }

            var isDeclareFile = Harness.Compiler.isDeclareFile(unitName);
            // for single file tests just add them as using the old '0.ts' naming scheme
            var uName = context ? unitName : ((isDeclareFile) ? '0.d.ts' : '0.ts');
            scripts.push(addUnit(code, uName, isDeclareFile, references));
            compile(code, uName);

            compiler.pullErrorReporter.textWriter = stderr;

            var syntacticDiagnostics = compiler.fileNameToSyntaxTree.lookup(uName).diagnostics();
            compiler.pullErrorReporter.reportErrors(syntacticDiagnostics.map(d => new TypeScript.PullError(d.start(), d.length(), uName, d.message())));

            var semanticErrors = compiler.pullGetErrorsForFile(uName);
            compiler.pullErrorReporter.reportErrors(semanticErrors);

            var errorLines = stderr.lines;
            emit(stdout);
            compiler.emitDeclarations();

            if (context) {
                context.postCompile();
            }

            callback(new CompilerResult(stdout.toArray(), errorLines, scripts));
        }

        /** Returns a set of functions which can be later executed to add and remove given dependencies to the compiler so that
         *  a file can be successfully compiled. These functions will add/remove named units and code to the compiler for each dependency. 
         */
        export function defineCompilationContextForTest(fileName: string, dependencies: TestCaseParser.TestUnitData[]): CompilationContext {
            // if the given file has no dependencies, there is no context to return, it can be compiled without additional work
            if (dependencies.length === 0) {
                return null;
            } else {
                var addedFiles = [];
                var precompile = () => {
                    // REVIEW: if any dependency has a triple slash reference then does postCompile potentially have to do a recreate since we can't update references with updateUnit?
                    // easy enough to do if so, prefer to avoid the recreate cost until it proves to be an issue
                    dependencies.forEach(dep => {
                        addUnit(dep.content, dep.name, Harness.Compiler.isDeclareFile(dep.name));
                        addedFiles.push(dep.name);
                    });
                };
                var postcompile = () => {
                    addedFiles.forEach(file => {
                        updateUnit('', file);
                    });
                };
                var context = {
                    fileName: fileName,
                    preCompile: precompile,
                    postCompile: postcompile
                };
                return context;
            }
        }
    }

    /** Parses the test cases files 
     *  extracts options and individual files in a multifile test
     */
    export module TestCaseParser {
        /** all the necesarry information to set the right compiler settings */
        export interface CompilerSetting {
            flag: string;
            value: string;
        }

        /** All the necessary information to turn a multi file test into useful units for later compilation */
        export interface TestUnitData {
            content: string;
            name: string;
            fileOptions: any;
            originalFilePath: string;
            references: TypeScript.IFileReference[];
        }

        // Regex for parsing options in the format "@Alpha: Value of any sort"
        var optionRegex = /^[\/]{2}\s*@(\w+):\s*(\S*)/gm;  // multiple matches on multiple lines

        // List of allowed metadata names
        var fileMetadataNames = ["filename", "comments", "declaration", "module", "nolib", "sourcemap", "target", "out"];

        function extractCompilerSettings(content: string): CompilerSetting[] {

            var opts = [];

            var match;
            while ((match = optionRegex.exec(content)) != null) {
                opts.push({ flag: match[1], value: match[2] });
            }

            return opts;
        }

        /** Given a test file containing // @Filename directives, return an array of named units of code to be added to an existing compiler instance */
        export function makeUnitsFromTest(code: string, fileName: string): { settings: CompilerSetting[]; testUnitData: TestUnitData[]; } {

            var settings = extractCompilerSettings(code);

            // List of all the subfiles we've parsed out
            var files: TestUnitData[] = [];

            var lines = splitContentByNewlines(code);

            // Stuff related to the subfile we're parsing
            var currentFileContent: string = null;
            var currentFileOptions = {};
            var currentFileName = null;
            var refs: TypeScript.IFileReference[] = [];

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var isTripleSlashReference = /[\/]{3}\s*<reference path/.test(line);
                var testMetaData = optionRegex.exec(line);
                // Triple slash references need to be tracked as they are added to the compiler as an additional parameter to addUnit
                if (isTripleSlashReference) {
                    var isRef = line.match(/reference\spath='(\w*_?\w*\.?d?\.ts)'/);
                    if (isRef) {
                        var ref = {
                            line:0,
                            character:0,
                            position:0,
                            length:0,
                            path: isRef[1],
                            isResident: false
                        };

                        refs.push(ref);
                    }
                } else if (testMetaData) {
                    // Comment line, check for global/file @options and record them
                    optionRegex.lastIndex = 0;
                    var fileNameIndex = fileMetadataNames.indexOf(testMetaData[1].toLowerCase());
                    if (fileNameIndex === -1) {
                        throw new Error('Unrecognized metadata name "' + testMetaData[1] + '". Available file metadata names are: ' + fileMetadataNames.join(', '));
                    } else if (fileNameIndex === 0) {
                        currentFileOptions[testMetaData[1]] = testMetaData[2];
                    } else {
                        continue;
                    }

                    // New metadata statement after having collected some code to go with the previous metadata
                    if (currentFileName) {
                        // Store result file
                        var newTestFile =
                            {
                                content: currentFileContent,
                                name: currentFileName,
                                fileOptions: currentFileOptions,
                                originalFilePath: fileName,
                                references: refs
                            };
                        files.push(newTestFile);

                        // Reset local data
                        currentFileContent = null;
                        currentFileOptions = {};
                        currentFileName = testMetaData[2];
                        refs = [];
                    } else {
                        // First metadata marker in the file
                        currentFileName = testMetaData[2];
                    }
                } else {
                    // Subfile content line
                    // Append to the current subfile content, inserting a newline needed
                    if (currentFileContent === null) {
                        currentFileContent = '';
                    } else {
                        // End-of-line
                        currentFileContent = currentFileContent + '\n';
                    }
                    currentFileContent = currentFileContent + line;
                }
            }

            // normalize the fileName for the single file case
            currentFileName = files.length > 0 ? currentFileName : '0.ts';

            // EOF, push whatever remains
            var newTestFile2 = {
                content: currentFileContent || '',
                name: currentFileName,
                fileOptions: currentFileOptions,
                originalFilePath: fileName,
                references: refs
            };
            files.push(newTestFile2);

            return { settings: settings, testUnitData: files };
        }
    }

    export class ScriptInfo {
        public version: number = 1;
        public editRanges: { length: number; textChangeRange: TypeScript.TextChangeRange; }[] = [];
        public lineMap: TypeScript.LineMap = null;

        constructor(public fileName: string, public content: string) {
            this.setContent(content);
        }

        private setContent(content: string): void {
            this.content = content;
            this.lineMap = TypeScript.LineMap.fromString(content);
        }

        public updateContent(content: string): void {
            this.editRanges = [];
            this.setContent(content);
            this.version++;
        }

        public editContent(minChar: number, limChar: number, newText: string): void {
            // Apply edits
            var prefix = this.content.substring(0, minChar);
            var middle = newText;
            var suffix = this.content.substring(limChar);
            this.setContent(prefix + middle + suffix);

            // Store edit range + new length of script
            this.editRanges.push({
                length: this.content.length,
                textChangeRange: new TypeScript.TextChangeRange(
                    TypeScript.TextSpan.fromBounds(minChar, limChar), newText.length)
            });

            // Update version #
            this.version++;
        }

        public getTextChangeRangeSinceVersion(version: number): TypeScript.TextChangeRange {
            if (this.version === version) {
                // No edits!
                return TypeScript.TextChangeRange.unchanged;
            }

            var initialEditRangeIndex = this.editRanges.length - (this.version - version);

            var entries = this.editRanges.slice(initialEditRangeIndex);
            return TypeScript.TextChangeRange.collapseChangesAcrossMultipleVersions(entries.map(e => e.textChangeRange));
        }
    }

    class ScriptSnapshotShim implements Services.IScriptSnapshotShim {
        private lineMap: TypeScript.LineMap = null;

        constructor(private scriptInfo: ScriptInfo) {
        }

        public getText(start: number, end: number): string {
            return this.scriptInfo.content.substring(start, end);
        }

        public getLength(): number {
            return this.scriptInfo.content.length;
        }

        public getLineStartPositions(): string {
            if (this.lineMap === null) {
                this.lineMap = TypeScript.LineMap.fromString(this.scriptInfo.content);
            }

            return JSON2.stringify(this.lineMap.lineStarts());
        }

        public getTextChangeRangeSinceVersion(scriptVersion: number): string {
            var range = this.scriptInfo.getTextChangeRangeSinceVersion(scriptVersion);
            if (range === null) {
                return null;
            }

            return JSON2.stringify({ span: { start: range.span().start(), length: range.span().length() }, newLength: range.newLength() });
        }
    }

    export class TypeScriptLS implements Services.ILanguageServiceShimHost {
        private ls: Services.ILanguageServiceShim = null;

        private fileNameToScript = new TypeScript.StringHashTable();

        public addDefaultLibrary() {
            this.addScript("lib.d.ts", Harness.Compiler.libText);
        }

        public addFile(fileName: string) {
            var code: string = readFile(name);
            this.addScript(name, code);
        }

        private getScriptInfo(fileName: string): ScriptInfo {
            return this.fileNameToScript.lookup(fileName);
        }

        public addScript(fileName: string, content: string) {
            var script = new ScriptInfo(fileName, content);
            this.fileNameToScript.add(fileName, script);
        }

        public updateScript(fileName: string, content: string) {
            var script = this.getScriptInfo(fileName);
            if (script !== null) {
                script.updateContent(content);
                return;
            }

            this.addScript(name, content);
        }

        public editScript(fileName: string, minChar: number, limChar: number, newText: string) {
            var script = this.getScriptInfo(fileName);
            if (script !== null) {
                script.editContent(minChar, limChar, newText);
                return;
            }

            throw new Error("No script with name '" + name + "'");
        }

        //////////////////////////////////////////////////////////////////////
        // ILogger implementation
        //
        public information(): bool { return false; }
        public debug(): bool { return true; }
        public warning(): bool { return true; }
        public error(): bool { return true; }
        public fatal(): bool { return true; }

        public log(s: string): void {
            // For debugging...
            //IO.printLine("TypeScriptLS:" + s);
        }

        //////////////////////////////////////////////////////////////////////
        // ILanguageServiceShimHost implementation
        //

        public getCompilationSettings(): string/*json for Tools.CompilationSettings*/ {
            return ""; // i.e. default settings
        }

        public getScriptFileNames(): string {
            return JSON2.stringify(this.fileNameToScript.getAllKeys());
        }

        public getScriptSnapshot(fileName: string): Services.IScriptSnapshotShim {
            return new ScriptSnapshotShim(this.getScriptInfo(fileName));
        }

        public getScriptVersion(fileName: string): number {
            return this.getScriptInfo(fileName).version;
        }

        /** Return a new instance of the language service shim, up-to-date wrt to typecheck.
         *  To access the non-shim (i.e. actual) language service, use the "ls.languageService" property.
         */
        public getLanguageService(): Services.ILanguageServiceShim {
            var ls = new Services.TypeScriptServicesFactory().createLanguageServiceShim(this);
            ls.refresh(true);
            this.ls = ls;
            return ls;
        }

        /** Parse file given its source text */
        public parseSourceText(fileName: string, sourceText: TypeScript.IScriptSnapshot): TypeScript.Script {
            return TypeScript.SyntaxTreeToAstVisitor.visit(
                TypeScript.Parser.parse(TypeScript.SimpleText.fromScriptSnapshot(sourceText), TypeScript.isDTSFile(fileName)),
                fileName, new TypeScript.CompilationSettings());
        }

        /** Parse a file on disk given its fileName */
        public parseFile(fileName: string) {
            var sourceText = TypeScript.ScriptSnapshot.fromString(IO.readFile(fileName))
            return this.parseSourceText(fileName, sourceText);
        }
        
        /**
         * @param line 1 based index
         * @param col 1 based index
        */
        public lineColToPosition(fileName: string, line: number, col: number): number {
            var script: ScriptInfo = this.fileNameToScript.lookup(fileName);
            assert.notNull(script);
            assert.is(line >= 1);
            assert.is(col >= 1);

            return script.lineMap.getPosition(line - 1, col - 1);
        }

        /**
         * @param line 0 based index
         * @param col 0 based index
        */
        public positionToZeroBasedLineCol(fileName: string, position: number): TypeScript.ILineAndCharacter {
            var script: ScriptInfo = this.fileNameToScript.lookup(fileName);
            assert.notNull(script);

            var result = script.lineMap.getLineAndCharacterFromPosition(position);
            
            assert.is(result.line() >= 0);
            assert.is(result.character() >= 0);
            return { line: result.line(), character: result.character() };
        }

        /** Verify that applying edits to sourceFileName result in the content of the file baselineFileName */
        public checkEdits(sourceFileName: string, baselineFileName: string, edits: Services.TextEdit[]) {
            var script = readFile(sourceFileName);
            var formattedScript = this.applyEdits(script, edits);
            var baseline = readFile(baselineFileName);

            assert.noDiff(formattedScript, baseline);
            assert.equal(formattedScript, baseline);
        }


        /** Apply an array of text edits to a string, and return the resulting string. */
        public applyEdits(content: string, edits: Services.TextEdit[]): string {
            var result = content;
            edits = this.normalizeEdits(edits);

            for (var i = edits.length - 1; i >= 0; i--) {
                var edit = edits[i];
                var prefix = result.substring(0, edit.minChar);
                var middle = edit.text;
                var suffix = result.substring(edit.limChar);
                result = prefix + middle + suffix;
            }
            return result;
        }

        /** Normalize an array of edits by removing overlapping entries and sorting entries on the minChar position. */
        private normalizeEdits(edits: Services.TextEdit[]): Services.TextEdit[] {
            var result: Services.TextEdit[] = [];

            function mapEdits(edits: Services.TextEdit[]): { edit: Services.TextEdit; index: number; }[] {
                var result = [];
                for (var i = 0; i < edits.length; i++) {
                    result.push({ edit: edits[i], index: i });
                }
                return result;
            }

            var temp = mapEdits(edits).sort(function (a, b) {
                var result = a.edit.minChar - b.edit.minChar;
                if (result === 0)
                    result = a.index - b.index;
                return result;
            });

            var current = 0;
            var next = 1;
            while (current < temp.length) {
                var currentEdit = temp[current].edit;

                // Last edit
                if (next >= temp.length) {
                    result.push(currentEdit);
                    current++;
                    continue;
                }
                var nextEdit = temp[next].edit;

                var gap = nextEdit.minChar - currentEdit.limChar;

                // non-overlapping edits
                if (gap >= 0) {
                    result.push(currentEdit);
                    current = next;
                    next++;
                    continue;
                }

                // overlapping edits: for now, we only support ignoring an next edit 
                // entirely contained in the current edit.
                if (currentEdit.limChar >= nextEdit.limChar) {
                    next++;
                    continue;
                }
                else {
                    throw new Error("Trying to apply overlapping edits");
                }
            }

            return result;
        }
    }

    // Describe/it definitions
    export function describe(description: string, block: () => any) {
        var newScenario = new Scenario(description, block);

        if (Runnable.currentStack.length === 0) {
            Runnable.currentStack.push(currentRun);
        }

        Runnable.currentStack[Runnable.currentStack.length - 1].addChild(newScenario);
    }
    export function it(description: string, block: () => void ) {
        var testCase = new TestCase(description, block);
        Runnable.currentStack[Runnable.currentStack.length - 1].addChild(testCase);
    }

    export function run() {
        if (typeof process !== "undefined") {
            process.on('uncaughtException', Runnable.handleError);
        }

        Baseline.reset();
        currentRun.run();
    }

    /** Runs TypeScript or Javascript code. */
    export module Runner {
        export function runCollateral(path: string, callback: (error: Error, result: any) => void ) {
            path = switchToForwardSlashes(path);
            runString(readFile(path), path.match(/[^\/]*$/)[0], callback);
        }

        export function runJSString(code: string, callback: (error: Error, result: any) => void ) {
            // List of names that get overriden by various test code we eval
            var dangerNames: any = ['Array'];

            var globalBackup: any = {};
            var n: string = null;
            for (n in dangerNames) {
                globalBackup[dangerNames[n]] = global[dangerNames[n]];
            }

            try {
                var res = eval(code);

                for (n in dangerNames) {
                    global[dangerNames[n]] = globalBackup[dangerNames[n]];
                }

                callback(null, res);
            } catch (e) {
                for (n in dangerNames) {
                    global[dangerNames[n]] = globalBackup[dangerNames[n]];
                }

                callback(e, null);
            }
        }

        export function runString(code: string, unitName: string, callback: (error: Error, result: any) => void ) {
            Compiler.compileString(code, unitName, function (res) {
                runJSString(res.code, callback);
            });
        }
    }

    /** Support class for baseline files */
    export module Baseline {
        var htmlBaselineReport = new Diff.HtmlBaselineReport('baseline-report.html');

        var firstRun = true;

        export interface BaselineOptions {
            LineEndingSensitive?: bool;
        }

        function localPath(fileName: string) {
            return Harness.userSpecifiedroot + 'tests/baselines/local/' + fileName;
        }

        function referencePath(fileName: string) {
            return Harness.userSpecifiedroot + 'tests/baselines/reference/' + fileName;
        }

        export function reset() {
            htmlBaselineReport.reset();
        }

        function generateActual(actualFilename: string, generateContent: () => string): string {
            // Create folders if needed
            IO.createDirectory(IO.dirName(IO.dirName(actualFilename)));
            IO.createDirectory(IO.dirName(actualFilename));

            // Delete the actual file in case it fails
            if (IO.fileExists(actualFilename)) {
                IO.deleteFile(actualFilename);
            }

            var actual = generateContent();

            if (actual === undefined) {
                throw new Error('The generated content was "undefined". Return "null" if no baselining is required."');
            }

            // Store the content in the 'local' folder so we
            // can accept it later (manually)
            if (actual !== null) {
                IO.writeFile(actualFilename, actual);
            }

            return actual;
        }

        function compareToBaseline(actual: string, relativeFilename: string, opts: BaselineOptions) {
            // actual is now either undefined (the generator had an error), null (no file requested),
            // or some real output of the function
            if (actual === undefined) {
                // Nothing to do
                return;
            }

            var refFilename = referencePath(relativeFilename);

            if (actual === null) {
                actual = '<no content>';
            }

            var expected = '<no content>';
            if (IO.fileExists(refFilename)) {
                expected = IO.readFile(refFilename);
            }

            var lineEndingSensitive = opts && opts.LineEndingSensitive;

            if (!lineEndingSensitive) {
                expected = expected.replace(/\r\n?/g, '\n')
                actual = actual.replace(/\r\n?/g, '\n')
            }

            return { expected: expected, actual: actual };
        }

        function writeComparison(expected: string, actual: string, relativeFilename: string, actualFilename: string, descriptionForDescribe: string) {
            if (expected != actual) {
                // Overwrite & issue error
                var errMsg = 'The baseline file ' + relativeFilename + ' has changed. Please refer to baseline-report.html and ';
                errMsg += 'either fix the regression (if unintended) or run nmake baseline-accept (if intended).'

                var refFilename = referencePath(relativeFilename);
                htmlBaselineReport.addDifference(descriptionForDescribe, actualFilename, refFilename, expected, actual, /*includeUnchangedRegions:*/ true);

                throw new Error(errMsg);
            }
        }

        export function runBaseline(
            descriptionForDescribe: string,
            relativeFilename: string,
            generateContent: () => string,
            runImmediately? = false,
            opts?: BaselineOptions) {

            var actual = <string>undefined;
            var actualFilename = localPath(relativeFilename);

            if (runImmediately) {
                actual = generateActual(actualFilename, generateContent);
                var comparison = compareToBaseline(actual, relativeFilename, opts);
                writeComparison(comparison.expected, comparison.actual, relativeFilename, actualFilename, descriptionForDescribe);
            } else {
                describe(descriptionForDescribe, () => {
                    var actual: string;

                    it('Can generate the content without error', () => {
                        actual = generateActual(actualFilename, generateContent);
                    });

                    it('Matches the baseline file', () => {
                        var comparison = compareToBaseline(actual, relativeFilename, opts);
                        writeComparison(comparison.expected, comparison.actual, relativeFilename, actualFilename, descriptionForDescribe);
                    });
                });
            }
        }
    }

    var currentRun = new Run();

    global.describe = describe;
    global.run = run;
    global.it = it;
    global.assert = Harness.Assert;
}
