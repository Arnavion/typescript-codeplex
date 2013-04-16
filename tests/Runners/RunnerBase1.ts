/// <reference path="../../src/compiler/io.ts" />
/// <reference path="../../src/harness/harness.ts" />

class RunnerBase {
    constructor(public testType?: string) { }

    // contains the tests to run
    public tests: string[] = [];

    public addTest(fileName: string) {
        this.tests.push(fileName);
    }

    public enumerateFiles(folder: string, recursive: boolean = false): string[] {
        return IO.dir(Harness.userSpecifiedroot + folder, /\.ts$/);
    }

    public runTests(): void {
        throw new Error('run method not implemented');
    }
}