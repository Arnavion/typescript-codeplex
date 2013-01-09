///<reference path='..\compiler\typescript.ts' />
///<reference path='harness.ts' />
///<reference path='external\json2.ts' />

module FourSlash {
    // Represents a parsed source file with metadata
    export interface FourSlashFile {
        // The contents of the file (with markers, etc stripped out)
        content: string;

        // Filename
        name: string;

        // File-specific options (name/value pairs)
        fileOptions: { [index: string]: string; };
    }

    // Represents a set of parsed source files and options
    export interface FourSlashData {
        // Global options (name/value pairs)
        globalOptions: { [index: string]: string; };

        files: FourSlashFile[];

        // A mapping from marker names to name/position pairs
        markerPositions: { [index: string]: { fileName: string; position: number; }; };
        markerNames: string[];
    }

    interface MemberListData {
        result: {
            maybeInaccurate: bool;
            isMemberCompletion: bool;
            entries: {
                name: string;
                type: string;
                kind: string;
                kindModifiers: string;
            }[];
        };
    }

    interface MarkerMap {
        [index: string]: { fileName: string; position: number; };
    }

    // List of allowed metadata names
    var fileMetadataNames = ['Filename'];
    var globalMetadataNames = ['Module', 'Target', 'BaselineFile']; // Note: Only BaselineFile is actually supported at the moment

    export var currentTestState: TestState = null;

    export class TestState {
        // Language service instance
        public langSvc: Harness.TypeScriptLS;
        private realLangSvc: Services.ILanguageService;

        // The current caret position in the active file
        public currentCaretPosition = 0;

        // The file that's currently 'opened'
        public activeFile: FourSlashFile = null;

        constructor (public testData: FourSlashData) {
            // Initialize the language service with all the scripts
            this.langSvc = new Harness.TypeScriptLS();

            for (var i = 0; i < testData.files.length; i++) {
                this.langSvc.addScript(testData.files[i].name, testData.files[i].content, false);
            }
            
            this.realLangSvc = this.langSvc.getLanguageService().languageService;

            // Open the first file by default
            this.openFile(0);
        }

        // Entry points from fourslash.ts
        public goToMarker(name = '') {
            var marker = this.getMarkerByName(name);
            if (this.activeFile.name !== marker.fileName) {
                this.openFile(marker.fileName);
            }

            if (marker.position === -1 || marker.position > this.langSvc.getScriptSourceLength(this.getActiveFileIndex())) {
                throw new Error('Marker "' + name + '" has been invalidated by unrecoverable edits to the file.');
            }

            this.currentCaretPosition = marker.position;
        }

        public moveCaretRight(count ?= 1) {
            this.currentCaretPosition += count;
            this.currentCaretPosition = Math.min(this.currentCaretPosition, this.langSvc.getScriptSourceLength(this.getActiveFileIndex()));
        }

        // Opens a file given its 0-based index or filename
        public openFile(index: number);
        public openFile(name: string);
        public openFile(indexOrName: any) {
            var fileToOpen: FourSlashFile = this.findFile(indexOrName);
            this.activeFile = fileToOpen;
        }

        public verifyErrorExistsBetweenMarkers(startMarker: string, endMarker: string) {
            var startPos = this.getMarkerByName(startMarker).position;
            var endPos = this.getMarkerByName(endMarker).position;
            var fileIndex = this.getScriptIndex(this.findFile(this.getMarkerByName(startMarker).fileName));
            var errors = this.realLangSvc.getErrors(9999);
            var exists = false;
            errors.forEach(function (error: TypeScript.ErrorEntry) {
                if (error.unitIndex != fileIndex) return;
                if ((error.minChar === startPos) && (error.limChar === endPos)) exists = true;
            });
            if (!exists) {
                IO.printLine("Expected error not found.  Error list is:");
                errors.forEach(function (error: TypeScript.ErrorEntry) {
                    IO.printLine("  minChar: " + error.minChar + ", limChar: " + error.limChar + ", message: " + error.message);
                });
                throw new Error("Error does not exist between markers: " + startMarker + ", " + endMarker);
            }
        }

        public verifyErrorDoesNotExistBetweenMarkers(startMarker: string, endMarker: string) {
            var startPos = this.getMarkerByName(startMarker).position;
            var endPos = this.getMarkerByName(endMarker).position;
            var fileIndex = this.getScriptIndex(this.findFile(this.getMarkerByName(startMarker).fileName));
            var errors = this.realLangSvc.getErrors(9999);
            var exists = false;
            errors.forEach(function (error: TypeScript.ErrorEntry) {
                if (error.unitIndex != fileIndex) return;
                if ((error.minChar === startPos) && (error.limChar === endPos)) exists = true;
            });
            if (exists) {
                IO.printLine("Unexpected error(s) found.  Error list is:");
                errors.forEach(function (error: TypeScript.ErrorEntry) {
                    IO.printLine("  minChar: " + error.minChar + ", limChar: " + error.limChar + ", message: " + error.message + "\n");
                });
                throw new Error("Error(s) exist between markers: " + startMarker + ", " + endMarker);
            }
        }

        public verifyErrorDoesNotExistBeyondMarker(markerName? = '') {
            var startPos = this.getMarkerByName(markerName).position;
            var fileIndex = this.getScriptIndex(this.findFile(this.getMarkerByName(markerName).fileName));
            var errors = this.realLangSvc.getErrors(9999);
            var exists = false;
            errors.forEach(function (error: TypeScript.ErrorEntry) {
                if (error.unitIndex != fileIndex) return;
                if ((error.minChar >= startPos) || (error.limChar > startPos)) exists = true;
            });
            if (exists) {
                IO.printLine("Unexpected errors found.  Error list is:");
                errors.forEach(function (error: TypeScript.ErrorEntry) {
                    if ((error.minChar >= startPos) || (error.limChar > startPos)) {
                        IO.printLine("  minChar: " + error.minChar + ", limChar: " + error.limChar + ", message: " + error.message);
                    }
                });
                throw new Error("Errors exist beyond marker: " + markerName);
            }
        }

        public verifyNumberOfErrorsInCurrentFile(expected: number) {
            var fileIndex = this.getScriptIndex(this.activeFile);
            var errors = this.realLangSvc.getErrors(9999);
            errors = errors.filter( (error: TypeScript.ErrorEntry) => error.unitIndex == fileIndex);
            var actual = errors.length;
            if (actual != expected) {
                var errorMsg = "Actual number of errors (" + actual + ") does not match expected number (" + expected + ")";
                IO.printLine(errorMsg);
                throw new Error(errorMsg);
            }
        }

        public verifyMemberListContains(symbol: string, type?: string, docComment?: string) {
            var members = this.getMemberListAtCaret();
            this.assertItemInCompletionList(members.entries, symbol, type, docComment);
        }

        public verifyMemberListDoesNotContain(symbol: string) {
            var members = this.getMemberListAtCaret();
            if (members.entries.filter(e => e.name == symbol).length !== 0) {
                throw new Error('Member list did contain ' + symbol);
            }
        }

        public verifyCompletionListContains(symbol: string, type?: string, docComment?: string) {
            var completions = this.getCompletionListAtCaret();
            this.assertItemInCompletionList(completions.entries, symbol, type, docComment);
        }

        public verifyCompletionListDoesNotContain(symbol: string) {
            var completions = this.getCompletionListAtCaret();
            if (completions.entries.filter(e => e.name == symbol).length !== 0) {
                throw new Error('Completion list did contain ' + symbol);
            }
        }

        private getMemberListAtCaret() {
            return this.realLangSvc.getCompletionsAtPosition(this.activeFile.name, this.currentCaretPosition, true);
        }

        private getCompletionListAtCaret() {
            return this.realLangSvc.getCompletionsAtPosition(this.activeFile.name, this.currentCaretPosition, false);
        }

        public verifyQuickInfo(expectedTypeName: string) {
            var actualQuickInfo = this.realLangSvc.getTypeAtPosition(this.activeFile.name, this.currentCaretPosition);
            var actualQuickInfoString = actualQuickInfo.memberName.toString();
            if (actualQuickInfo.docComment != "") {
                actualQuickInfoString += "\n" + actualQuickInfo.docComment;
            }
            assert.equal(actualQuickInfoString, expectedTypeName);
        }

        public verifyCurrentParameterIsVariable(isVariable: bool) {
            assert.equal(isVariable, this.getActiveParameter().isVariable);
        }

        public verifyCurrentParameterHelpName(name: string) {
            assert.equal(this.getActiveParameter().name, name);
        }

        public verifyCurrentParameterHelpDocComment(docComment: string) {
            assert.equal(this.getActiveParameter().docComment, docComment);
        }

        public verifyCurrentParameterHelpType(typeName: string) {
            assert.equal(this.getActiveParameter().type, typeName);
        }

        public verifyQuickInfoType(expected: string) {
            var memberName = this.realLangSvc.getTypeAtPosition(this.activeFile.name, this.currentCaretPosition).memberName;
            var typeName = memberName.toString();
            assert.equal(typeName, expected);
        }

        public verifyCurrentSignatureHelpReturnType(returnTypeName: string) {
            var actualReturnType = this.getActiveSignatureHelp().returnType;
            assert.equal(actualReturnType, returnTypeName);
        }

        public verifyCurrentSignatureHelpDocComment(docComment: string) {
            var actualDocComment = this.getActiveSignatureHelp().docComment;
            assert.equal(actualDocComment, docComment);
        }

        public verifyCurrentSignatureHelpCount(expected: number) {
            var help = this.realLangSvc.getSignatureAtPosition(this.activeFile.name, this.currentCaretPosition);
            assert.equal(help.formal.signatureGroup.length, expected);
        }

        public verifySignatureHelpPresent(shouldBePresent = true) {
            var actual = this.realLangSvc.getSignatureAtPosition(this.activeFile.name, this.currentCaretPosition);
            if (shouldBePresent) {
                if (!actual) {
                    throw new Error("Expected signature help to be present, but it wasn't");
                }
            } else {
                if (actual) {
                    throw new Error("Expected no signature help, but got '" + JSON2.stringify(actual) + "'");
                }
            }
        }

        private getActiveSignatureHelp() {
            var help = this.realLangSvc.getSignatureAtPosition(this.activeFile.name, this.currentCaretPosition);
            var activeFormal = help.activeFormal;

            // If the signature hasn't been narrowed down yet (e.g. no parameters have yet been entered),
            // 'activeFormal' will be -1 (even if there is only 1 signature). Signature help will show the
            // first signature in the signature group, so go with that
            if (activeFormal === -1) {
                activeFormal = 0;
            }

            return help.formal.signatureGroup[activeFormal];
        }

        private getActiveParameter() {
            var currentSig = this.getActiveSignatureHelp();
            var help = this.realLangSvc.getSignatureAtPosition(this.activeFile.name, this.currentCaretPosition);

            // Same logic as in getActiveSignatureHelp - this value might be -1 until a parameter value actually gets typed
            var currentParam = help.actual.currentParameter;
            if (currentParam === -1) currentParam = 0;

            return currentSig.parameters[currentParam];
        }

        public getBreakpointStatementLocation(pos: number) {
            var spanInfo = this.realLangSvc.getBreakpointStatementAtPosition(this.activeFile.name, pos);
            var resultString = "\n**Pos: " + pos + " SpanInfo: " + JSON2.stringify(spanInfo) + "\n** Statement: ";
            if (spanInfo !== null) {
                resultString = resultString + this.activeFile.content.substr(spanInfo.minChar, spanInfo.limChar - spanInfo.minChar);
            }
            return resultString;
        }

        public baselineCurrentFileBreakpointLocations() {
            Harness.Baseline.runBaseline(
                "Breakpoint Locations for " + this.activeFile.name,
                this.testData.globalOptions['BaselineFile'],
                () => {
                    var fileLength = this.langSvc.getScriptSourceLength(this.getActiveFileIndex());
                    var resultString = "";
                    for (var pos = 0; pos < fileLength; pos++) {
                        resultString = resultString + this.getBreakpointStatementLocation(pos);
                    }
                    return resultString;
                },
                true /* run immediately */);
        }

        public printBreakpointLocation(pos: number) {
            IO.printLine(this.getBreakpointStatementLocation(pos));
        }

        public printCurrentParameterHelp() {
            var help = this.realLangSvc.getSignatureAtPosition(this.activeFile.name, this.currentCaretPosition);
            IO.printLine(JSON2.stringify(help));
        }

        public printCurrentQuickInfo() {
            var quickInfo = this.realLangSvc.getTypeAtPosition(this.activeFile.name, this.currentCaretPosition);
            IO.printLine(JSON2.stringify(quickInfo));
        }

        public printCurrentFileState(makeWhitespaceVisible = false) {
            for (var i = 0; i < this.testData.files.length; i++) {
                var file = this.testData.files[i];
                var active = (this.activeFile === file);
                var index = this.getScriptIndex(file);
                IO.printLine('=== Script #' + index + ' (' + file.name + ') ' + (active ? '(active, cursor at |)' : '') + ' ===');
                var content = this.langSvc.getScriptSourceText(index, 0, this.langSvc.getScriptSourceLength(index));
                if (active) {
                    content = content.substr(0, this.currentCaretPosition) + '|' + content.substr(this.currentCaretPosition);
                }
                if (makeWhitespaceVisible) {
                    content = TestState.makeWhitespaceVisible(content);
                }
                IO.printLine(content);
            }
        }

        public printCurrentSignatureHelp() {
            var sigHelp = this.getActiveSignatureHelp();
            IO.printLine(JSON2.stringify(sigHelp));
        }

        public printMemberListMembers() {
            var members = this.getMemberListAtCaret();
            IO.printLine(JSON2.stringify(members));
        }

        public printCompletionListMembers() {
            var completions = this.getCompletionListAtCaret();
            IO.printLine(JSON2.stringify(completions));
        }

        public deleteCharBehindMarker(count ?= 1) {

            var opts = new Services.FormatCodeOptions();
            var offset = this.currentCaretPosition;
            var ch = "";

            for (var i = 0; i < count; i++) {

                offset--;
                // Make the edit
                this.langSvc.editScript(this.activeFile.name, offset, offset + 1, ch);
                this.updateMarkersForEdit(this.activeFile.name, offset, offset + 1, ch);
                

                // Handle post-keystroke formatting
                var edits = this.realLangSvc.getFormattingEditsAfterKeystroke(this.activeFile.name, offset, ch, opts);
                offset += this.applyEdits(this.activeFile.name, edits);
            }

            // Move the caret to wherever we ended up
            this.currentCaretPosition = offset;

            this.fixCaretPosition();

        }

        // Enters lines of text at the current caret position
        public type(text: string) {
            var opts = new Services.FormatCodeOptions();
            var offset = this.currentCaretPosition;
            for (var i = 0; i < text.length; i++) {
                // Make the edit
                var ch = text.charAt(i);
                this.langSvc.editScript(this.activeFile.name, offset, offset, ch);
                this.updateMarkersForEdit(this.activeFile.name, offset, offset, ch);
                offset++;

                // Handle post-keystroke formatting
                var edits = this.realLangSvc.getFormattingEditsAfterKeystroke(this.activeFile.name, offset, ch, opts);
                offset += this.applyEdits(this.activeFile.name, edits);
            }

            // Move the caret to wherever we ended up
            this.currentCaretPosition = offset;

            this.fixCaretPosition();
        }

        private fixCaretPosition() {
            // The caret can potentially end up between the \r and \n, which is confusing. If
            // that happens, move it back one character
            if (this.currentCaretPosition > 0) {
                var ch = this.langSvc.getScriptSourceText(this.getActiveFileIndex(), this.currentCaretPosition - 1, this.currentCaretPosition);
                if (ch === '\r') {
                    this.currentCaretPosition--;
                }
            };
        }

        private applyEdits(filename: string, edits: Services.TextEdit[]): number {
            // We get back a set of edits, but langSvc.editScript only accepts one at a time. Use this to keep track
            // of the incremental offest from each edit to the next. Assumption is that these edit ranges don't overlap
            // or come in out-of-order.
            var runningOffset = 0;
            for (var j = 0; j < edits.length; j++) {
                this.langSvc.editScript(filename, edits[j].minChar + runningOffset, edits[j].limChar + runningOffset, edits[j].text);
                this.updateMarkersForEdit(filename, edits[j].minChar + runningOffset, edits[j].limChar + runningOffset, edits[j].text);
                var change = (edits[j].minChar - edits[j].limChar) + edits[j].text.length;
                runningOffset += change;
            }
            return runningOffset;
        }

        public formatDocument() {
            var edits = this.realLangSvc.getFormattingEditsForRange(this.activeFile.name, 0, this.langSvc.getScriptSourceLength(this.getActiveFileIndex()), new Services.FormatCodeOptions());
            this.currentCaretPosition += this.applyEdits(this.activeFile.name, edits);
            this.fixCaretPosition();
        }

        private updateMarkersForEdit(filename: string, minChar: number, limChar: number, text: string) {
            for (var i = 0; i < this.testData.markerNames.length; i++) {
                var marker = this.testData.markerPositions[this.testData.markerNames[i]];
                if (marker.fileName === filename) {
                    if (marker.position > minChar) {
                        if (marker.position < limChar) {
                            // Marker is inside the edit - mark it as invalidated (?)
                            marker.position = -1;
                        } else {
                            // Move marker back/forward by the appropriate amount
                            marker.position += (minChar - limChar) + text.length;
                        }
                    }
                }
            }
        }

        public goToBOF() {
            this.currentCaretPosition = 0;
        }

        public goToEOF() {
            this.currentCaretPosition = this.langSvc.getScriptSourceLength(this.getActiveFileIndex());
        }

        public goToDefinition() {
            this.realLangSvc.refresh();
            var defn = this.realLangSvc.getDefinitionAtPosition(this.activeFile.name, this.currentCaretPosition);
            this.openFile(defn.unitIndex);
            this.currentCaretPosition = defn.minChar;
        }

        public verifyCaretAtMarker(markerName? = '') {
            var pos = this.getMarkerByName(markerName);
            if (pos.fileName != this.activeFile.name) {
                throw new Error('verifyCaretAtMarker failed - expected to be in file "' + pos.fileName + '", but was in file "' + this.activeFile.name + '"');
            }
            if (pos.position != this.currentCaretPosition) {
                throw new Error('verifyCaretAtMarker failed - expected to be at marker "/*' + markerName + '*/, but was at position ' + this.currentCaretPosition + '(' + this.getLineColStringAtCaret() + ')');
            }
        }

        public verifySmartIndentLevel(numberOfTabs: number) {
            var actual = this.realLangSvc.getSmartIndentAtLineNumber(this.activeFile.name, this.getCurrentLineNumberZeroBased(), new Services.EditorOptions()) / 4;
            if (actual != numberOfTabs) {
                throw new Error('verifySmartIndentLevel failed - expected tab depth to be ' + numberOfTabs + ', but was ' + actual);
            }
        }

        public verifyCurrentLineContent(text: string) {
            var actual = this.getCurrentLineContent();
            if (actual !== text) {
                throw new Error('verifyCurrentLineContent\n' +
                '\tExpected: "' + text + '"\n' +
                '\t  Actual: "' + actual + '"');
            }
        }

        public verifyTextAtCaretIs(text: string) {
            var actual = this.langSvc.getScriptSourceText(this.getActiveFileIndex(), this.currentCaretPosition, this.currentCaretPosition + text.length);
            if (actual !== text) {
                throw new Error('verifyTextAtCaretIs\n' +
                '\tExpected: "' + text + '"\n' +
                '\t  Actual: "' + actual + '"');
            }
        }

        // Get the text of the entire line the caret is currently at
        private getCurrentLineContent() {
            // The current caret position (in line/col terms)
            var line = this.getCurrentCaretFilePosition().line;
            // The line/col of the start of this line
            var pos = this.langSvc.lineColToPosition(this.activeFile.name, line, 1);
            // The index of the current file
            var fileIndex = this.getActiveFileIndex();
            // The text from the start of the line to the end of the file
            var text = this.langSvc.getScriptSourceText(fileIndex, pos, this.langSvc.getScriptSourceLength(fileIndex));

            // Truncate to the first newline
            var newlinePos = text.indexOf('\n');
            if (newlinePos === -1) {
                return text;
            } else {
                if (text.charAt(newlinePos - 1) == '\r') {
                    newlinePos--;
                }
                return text.substr(0, newlinePos);
            }
        }

        private getCurrentCaretFilePosition() {
            return this.langSvc.positionToLineCol(this.activeFile.name, this.currentCaretPosition);
        }

        private assertItemInCompletionList(completionList: Services.CompletionEntry[], name: string, type?: string, docComment?: string) {
            var items: { name: string; type: string; docComment: string; }[] = completionList.map(element => {
                return {
                    name: element.name,
                    type: element.type,
                    docComment: element.docComment
                };
            });

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item.name == name) {
                    if (docComment != undefined) {
                        assert.equal(item.docComment, docComment);
                    }
                    if (type != undefined) {
                        assert.equal(item.type, type);
                    }
                    return;
                }
            }

            var getItemString = (item: { name: string; type: string; docComment: string; }) => {
                if (docComment == undefined && type == undefined) {
                    return item.name;
                }

                var returnString = "\n{ name: " + item.name;
                if (type != undefined) {
                    returnString += ",type: " + item.type;
                }
                if (docComment != undefined) {
                    returnString += ",docComment: " + item.docComment;
                }
                returnString += " }"

                return returnString;
            };

            var itemsDigest = items.slice(0, 10);
            var itemsString = items.map(elem => getItemString(elem)).join(",");
            if (items.length > 10) {
                itemsString += ', ...';
            }
            throw new Error('Expected "' + getItemString({ name: name, type: type, docComment: docComment }) + '" to be in list [' + itemsString + ']');
        }

        private getScriptIndex(file: FourSlashFile) {
            for (var i = 0; i < this.langSvc.scripts.length; i++) {
                if (this.langSvc.scripts[i].name == file.name) {
                    return i;
                }
            }
            throw new Error("Couldn't determine the file index of " + file.name);
        }

        private findFile(indexOrName: any) {
            var result: FourSlashFile = null;
            if (typeof indexOrName === 'number') {
                var index = <number>indexOrName;
                if (index >= this.testData.files.length) {
                    throw new Error('File index (' + index + ') in openFile was out of range. There are only ' + this.testData.files.length + ' files in this test.');
                } else {
                    result = this.testData.files[index];
                }
            } else if (typeof indexOrName === 'string') {
                var name = <string>indexOrName;
                var availableNames = [];
                var foundIt = false;
                for (var i = 0; i < this.testData.files.length; i++) {
                    var fn = this.testData.files[i].name;
                    if (fn) {
                        if (fn === name) {
                            result = this.testData.files[i];
                            foundIt = true;
                            break;
                        }
                        availableNames.push(fn);
                    }
                }

                if (!foundIt) {
                    throw new Error('No test file named "' + name + '" exists. Available file names are:' + availableNames.join(', '));
                }
            } else {
                throw new Error('Unknown argument type');
            }

            return result;
        }

        private getActiveFileIndex() {
            return this.getScriptIndex(this.activeFile);
        }

        private getCurrentLineNumberZeroBased() {
            return this.getCurrentLineNumberOneBased() - 1;
        }

        private getCurrentLineNumberOneBased() {
            return this.langSvc.positionToLineCol(this.activeFile.name, this.currentCaretPosition).line;
        }

        private getLineColStringAtCaret() {
            var pos = this.langSvc.positionToLineCol(this.activeFile.name, this.currentCaretPosition);
            return 'line ' + pos.line + ', col ' + pos.col;
        }

        private getMarkerByName(markerName: string) {
            var markerPos = this.testData.markerPositions[markerName];
            if (markerPos === undefined) {
                var markerNames = [];
                for (var m in this.testData.markerPositions) markerNames.push(m);
                throw new Error('Unknown marker "' + markerName + '" Available markers: ' + markerNames.map(m => '"' + m + '"').join(', '));
            } else {
                return markerPos;
            }
        }

        private static makeWhitespaceVisible(text: string) {
            return text.replace(/ /g, '\u00B7').replace(/\r/g, '\u00B6').replace(/\n/g, '\u2193\n').replace(/\t/g, '\u2192\   ');
        }
    }

    var fsCompiler: TypeScript.TypeScriptCompiler;
    var fsOutput = new Harness.Compiler.WriterAggregator();
    var fsErrors = new Harness.Compiler.WriterAggregator();
    export function runFourSlashTest(filename: string) {
        var content = IO.readFile(filename);

        // Parse out the files and their metadata
        var testData = parseTestData(content);

        assert.bugs(content);

        currentTestState = new TestState(testData);

        var mockFilename = 'test_input.ts';
        if (fsCompiler === undefined) {
            // Set up the compiler
            var settings = new TypeScript.CompilationSettings();
            settings.outputOption = "fourslash.js";
            settings.resolve = true;
            fsCompiler = new TypeScript.TypeScriptCompiler(fsErrors, new TypeScript.NullLogger(), settings);
            
            // TODO: Figure out how to make the reference tags in the input file resolve correctly?
            var tsFn = './tests/cases/fourslash/fourslash.ts';
            fsCompiler.addUnit(IO.readFile(tsFn), tsFn);
            fsCompiler.addUnit(content, mockFilename);
            fsCompiler.addUnit(Harness.Compiler.libText, 'lib.d.ts', true);
        } else {
            // Re-use the existing compiler instance (saves ~800ms/test)
            fsOutput.reset();
            fsErrors.reset();
            fsCompiler.updateUnit(content, mockFilename, false);
        }

        var result = '';
        fsCompiler.typeCheck();

        var emitterIOHost: TypeScript.EmitterIOHost = {
            createFile: (s) => fsOutput,
            directoryExists: (s: string) => false,
            fileExists: (s: string) => true,
            resolvePath: (s: string)=>s
        }

        fsCompiler.emit(emitterIOHost);
        if (fsErrors.lines.length > 0) {
            throw new Error('Error compiling ' + filename + ': ' + fsErrors.lines.join('\r\n'));
        }
        
        result = fsOutput.lines.join('\r\n');

        // Compile and execute the test
        eval(result);
    }

    function chompLeadingSpace(content: string) {
        var lines = content.split("\n");
        for (var i = 0; i < lines.length; i++) {
            if ((lines[i].length !== 0) && (lines[i].charAt(0) !== ' ')) {
                return content;
            }
        }

        return lines.map(s => s.substr(1)).join('\n');
    }

    function parseTestData(contents: string): FourSlashData {
        // Regex for parsing options in the format "@Alpha: Value of any sort"
        var optionRegex = /^\s*@(\w+): (.*)\s*/;
        
        // List of all the subfiles we've parsed out
        var files: FourSlashFile[] = [];
        // Global options
        var opts = {};
        // Marker positions
        var makeDefaultFilename = () => 'file_' + files.length + '.ts';

        // Split up the input file by line
        // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
        // we have to string-based splitting instead and try to figure out the delimiting chars
        var lines = contents.split('\n');

        var markers: MarkerMap = {};
        var markerNames: string[] = [];

        // Stuff related to the subfile we're parsing
        var currentFileContent: string = null;
        var currentFileName = makeDefaultFilename();
        var currentFileOptions = {};

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var lineLength = line.length;
            
            if (lineLength > 0 && line.charAt(lineLength - 1) == '\r') {
                line = line.substr(0, lineLength - 1);
            }

            if (line.substr(0, 4) === '////') {
                // Subfile content line

                // Append to the current subfile content, inserting a newline needed
                if (currentFileContent === null) {
                    currentFileContent = '';
                } else {
                    // End-of-line
                    currentFileContent = currentFileContent + '\n';
                }

                currentFileContent = currentFileContent + line.substr(4);
            } else if (line.substr(0, 2) === '//') {
                // Comment line, check for global/file @options and record them
                var match = optionRegex.exec(line.substr(2));
                if (match) {
                    var globalNameIndex = globalMetadataNames.indexOf(match[1]);
                    var fileNameIndex = fileMetadataNames.indexOf(match[1]);
                    if (globalNameIndex == -1) {
                        if (fileNameIndex == -1) {
                            throw new Error('Unrecognized metadata name "' + match[1] + '". Available global metadata names are: ' + globalMetadataNames.join(', ') + '; file metadata names are: ' + fileMetadataNames.join(', '));
                        } else {
                            currentFileOptions[match[1]] = match[2];
                        }
                    } else {
                        opts[match[1]] = match[2];
                    }
                }
            } else {
                // Empty line or code line, terminate current subfile if there is one
                if (currentFileContent) {
                    var fileData = parseFileContent(currentFileContent, currentFileName);
                    fileData.file.fileOptions = currentFileOptions;
                    
                    // Store result file
                    files.push(fileData.file);
                    // Merge in markers
                    for (var j = 0; j < fileData.markerNames.length; j++) {
                        var name = fileData.markerNames[j];
                        if (markerNames.indexOf(name) !== -1) {
                            throw new Error('Marker "/*' + name + '*/" is duplicated in the source file contents. Marker names must be distinct across files.');
                        } else {
                            markers[name] = fileData.markers[name];
                            markerNames.push(name);
                        }
                    }

                    // Reset local data
                    currentFileContent = null;
                    currentFileOptions = {};
                    currentFileName = makeDefaultFilename();
                }
            }
        }

        return {
            markerPositions: markers,
            markerNames: markerNames,
            globalOptions: opts,
            files: files
        }
    }

    function parseFileContent(content: string, filename: string): { file: FourSlashFile; markers: MarkerMap; markerNames: string[]; } {
        content = chompLeadingSpace(content);

        var markers: MarkerMap = {};
        var markerNames: string[] = [];
        
        var output = '';
        var limChar = 0;
        // Parse out markers
        // TODO: this could be a lot more efficient, though it's already < 1ms per file (for current file sizes)
        for (var i = 0; i < content.length; i++) {
            // The start of the string, a slash, a star, 0 or more alphanums, a star, a slash
            var regex = /^\/\*([A-Za-z0-9]*)\*\//;
            var match = regex.exec(content.substr(i));
            if (match && match.length) {
                // Found a marker! 
                // See if this conflicts with an existing marker
                if (markers[match[1]] !== undefined) {
                    throw new Error('Marker "/*' + match[1] + '*/" is duplicated in the source file contents.');
                } else {
                    // Record its name, position, and jump forward by
                    // the appropriate amount
                    markers[match[1]] = {
                        fileName: filename,
                        position: limChar
                    };
                    markerNames.push(match[1]);
                    i += match[0].length - 1;
                }
            } else {
                // Should just continue
                output = output + content.substr(i, 1);
                limChar++;
            }
        }

        var file: FourSlashFile = {
            content: output,
            fileOptions: {},
            version: 0,
            name: filename
        };

        return { file: file, markers: markers, markerNames: markerNames };
    }
}
