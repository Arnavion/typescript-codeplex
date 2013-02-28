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
        markerPositions: { [index: string]: Marker; };

        markers: Marker[];

        ranges: Range[];
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

    export interface Marker {
        fileName: string;
        position: number;
        data?: any;
    }

    interface MarkerMap {
        [index: string]: Marker;
    }

    export interface Range {
        fileName: string;
        start: number;
        end: number;
    }

    interface ILocationInformation {
        position: number;
        sourcePosition: number;
        sourceLine: number;
        sourceColumn: number;
    }

    export interface TextSpan {
        start: number;
        end: number;
    }

    // List of allowed metadata names
    var fileMetadataNames = ['Filename'];
    var globalMetadataNames = ['Module', 'Target', 'BaselineFile']; // Note: Only BaselineFile is actually supported at the moment

    export var currentTestState: TestState = null;

    export class TestState {
        // Language service instance
        public langSvc: Harness.TypeScriptLS;
        private realLangSvc: Services.ILanguageService;
        private pullLanguageService: Services.IPullLanguageService;

        // The current caret position in the active file
        public currentCaretPosition = 0;
        public lastKnownMarker: string = "";

        // The file that's currently 'opened'
        public activeFile: FourSlashFile = null;

        constructor(public testData: FourSlashData) {
            // Initialize the language service with all the scripts
            this.langSvc = new Harness.TypeScriptLS();

            for (var i = 0; i < testData.files.length; i++) {
                this.langSvc.addScript(testData.files[i].name, testData.files[i].content, false);
            }

            this.realLangSvc = this.langSvc.getLanguageService().languageService;
            this.pullLanguageService = this.langSvc.getLanguageService().pullLanguageService;

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
            this.lastKnownMarker = name;
            this.currentCaretPosition = marker.position;
        }

        public moveCaretRight(count? = 1) {
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

        public verifyErrorExistsBetweenMarkers(startMarkerName: string, endMarkerName: string, negative: bool) {
            var startMarker = this.getMarkerByName(startMarkerName);
            var endMarker = this.getMarkerByName(endMarkerName);
            var predicate = function (errorMinChar: number, errorLimChar: number, startPos: number, endPos: number) {
                return ((errorMinChar === startPos) && (errorLimChar === endPos)) ? true : false;
            };

            var exists = this.anyErrorInRange(predicate, startMarker, endMarker);
            var errors = this.realLangSvc.getErrors(9999);

            if (exists != negative) {
                this.printErrorLog(negative, errors);
                throw new Error("Failure between markers: " + startMarkerName + ", " + endMarkerName);
            }
        }

        public verifyErrorExistsAfterMarker(markerName: string, negative: bool, after: bool) {

            var marker: Marker = this.getMarkerByName(markerName);
            var predicate: (errorMinChar: number, errorLimChar: number, startPos: number, endPos: number) => bool;

            if (after) {
                predicate = function (errorMinChar: number, errorLimChar: number, startPos: number, endPos: number) {
                    return ((errorMinChar >= startPos) && (errorLimChar >= startPos)) ? true : false;
                };
            } else {
                predicate = function (errorMinChar: number, errorLimChar: number, startPos: number, endPos: number) {
                    return ((errorMinChar <= startPos) && (errorLimChar <= startPos)) ? true : false;
                };
            }

            var exists = this.anyErrorInRange(predicate, marker);
            var errors = this.realLangSvc.getErrors(9999);

            if (exists != negative) {
                this.printErrorLog(negative, errors);
                throw new Error("Failure at marker: " + markerName);
            }

        }

        private anyErrorInRange(predicate: (errorMinChar: number, errorLimChar: number, startPos: number, endPos: number) => bool, startMarker: Marker, endMarker?: Marker) {

            var fileIndex = this.getScriptIndex(this.findFile(startMarker.fileName));
            var errors = this.realLangSvc.getErrors(9999);
            var exists = false;

            var startPos = startMarker.position;
            if (endMarker !== undefined) {
                var endPos = endMarker.position;
            }

            errors.forEach(function (error: TypeScript.ErrorEntry) {
                if (error.unitIndex != fileIndex) return;
                if (predicate(error.minChar, error.limChar, startPos, endPos)) exists = true;
            });

            return exists;

        }

        private printErrorLog(expectErrors: bool, errors: TypeScript.ErrorEntry[]) {
            if (expectErrors) {
                IO.printLine("Expected error not found.  Error list is:");
            } else {
                IO.printLine("Unexpected error(s) found.  Error list is:");
            }
            errors.forEach(function (error: TypeScript.ErrorEntry) {
                IO.printLine("  minChar: " + error.minChar + ", limChar: " + error.limChar + ", message: " + error.message + "\n");
            });
        }

        public verifyNumberOfErrorsInCurrentFile(expected: number) {
            var fileIndex = this.getScriptIndex(this.activeFile);
            var errors = this.realLangSvc.getErrors(9999);
            errors = errors.filter((error: TypeScript.ErrorEntry) => error.unitIndex == fileIndex);
            var actual = errors.length;
            if (actual != expected) {
                var errorMsg = "Actual number of errors (" + actual + ") does not match expected number (" + expected + ")";
                IO.printLine(errorMsg);
                throw new Error(errorMsg);
            }
        }

        public verifyMemberListContains(symbol: string, type?: string, docComment?: string, fullSymbolName?: string, kind?: string) {
            var members = this.getMemberListAtCaret();
            this.assertItemInCompletionList(members.entries, symbol, type, docComment, fullSymbolName, kind);
        }
        
        public verifyMemberListDoesNotContain(symbol: string) {
            var members = this.getMemberListAtCaret();
            if (members.entries.filter(e => e.name == symbol).length !== 0) {
                throw new Error('Member list did contain ' + symbol);
            }
        }

        public verifyMemberListIsEmpty(negative: bool) {
            var members = this.getMemberListAtCaret().entries;
            if ((members.length === 0) && negative) {

                throw new Error("Member list is empty at Caret");

            } else if ((members.length !== 0) && !negative) {

                var errorMsg = "\n" + "Member List contains: [" + members[0].name;
                for (var i = 1; i < members.length; i++) {
                    errorMsg += ", " + members[i].name;
                }
                errorMsg += "]\n";

                IO.printLine(errorMsg);
                throw new Error("Member list is not empty at Caret");

            }
        }

        public verifyCompletionListIsEmpty(negative: bool) {
            var completions = this.getCompletionListAtCaret().entries;
            if ((completions.length === 0) && negative) {

                throw new Error("Completion list is empty at Caret");

            } else if ((completions.length !== 0) && !negative) {

                var errorMsg = "\n" + "Completion List contains: [" + completions[0].name;
                for (var i = 1; i < completions.length; i++) {
                    errorMsg += ", " + completions[i].name;
                }
                errorMsg += "]\n";

                IO.printLine(errorMsg);
                throw new Error("Completion list is not empty at Caret");

            }
        }

        public verifyCompletionListContains(symbol: string, type?: string, docComment?: string, fullSymbolName?: string, kind?: string) {
            var completions = this.getCompletionListAtCaret();
            this.assertItemInCompletionList(completions.entries, symbol, type, docComment, fullSymbolName, kind);
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

        public verifyQuickInfo(expectedTypeName: string, negative: number, docComment?: string, symbolName?: string, kind?: string) {
            var actualQuickInfo = this.realLangSvc.getTypeAtPosition(this.activeFile.name, this.currentCaretPosition);
            var actualQuickInfoMemberName = actualQuickInfo ? actualQuickInfo.memberName.toString() : "";
            var actualQuickInfoDocComment = actualQuickInfo ? actualQuickInfo.docComment : "";
            var actualQuickInfoSymbolName = actualQuickInfo ? actualQuickInfo.fullSymbolName : "";
            var actualQuickInfoKind = actualQuickInfo ? actualQuickInfo.kind : "";
            if (negative) {
                assert.notEqual(actualQuickInfoMemberName, expectedTypeName);
                if (docComment != undefined) {
                    assert.notEqual(actualQuickInfoDocComment, docComment);
                }
                if (symbolName != undefined) {
                    assert.notEqual(actualQuickInfoSymbolName, symbolName);
                }
                if (kind != undefined) {
                    assert.notEqual(actualQuickInfoKind, kind);
                }
            } else {
                assert.equal(actualQuickInfoMemberName, expectedTypeName);
                if (docComment != undefined) {
                    assert.equal(actualQuickInfoDocComment, docComment);
                }
                if (symbolName != undefined) {
                    assert.equal(actualQuickInfoSymbolName, symbolName);
                }
                if (kind != undefined) {
                    assert.equal(actualQuickInfoKind, kind);
                }
            }
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

        public verifyCurrentSignatureHelpParameterCount(expectedCount: number) {
            assert.equal(this.getActiveSignatureHelp().parameters.length, expectedCount);
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
            var actual = help && help.formal ? help.formal.signatureGroup.length : 0;
            assert.equal(actual, expected);
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
            for (var i = 0; i < this.testData.markers.length; i++) {
                var marker = this.testData.markers[i];
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

        public getMarkers(): Marker[] {
            //  Return a copy of the list
            return this.testData.markers.slice(0);
        }

        public getRanges(): Range[] {
            //  Return a copy of the list
            return this.testData.ranges.slice(0);
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

        public verifyCurrentNameOrDottedNameSpanText(text: string) {
            var span = this.realLangSvc.getNameOrDottedNameSpan(this.activeFile.name, this.currentCaretPosition, this.currentCaretPosition);
            if (span === null) {
                throw new Error('verifyCurrentNameOrDottedNameSpanText\n' +
                           '\tExpected: "' + text + '"\n' +
                           '\t  Actual: null');
            }

            var actual = this.langSvc.getScriptSourceText(this.getActiveFileIndex(), span.minChar, span.limChar);
            if (actual !== text) {
                throw new Error('verifyCurrentNameOrDottedNameSpanText\n' +
                               '\tExpected: "' + text + '"\n' +
                               '\t  Actual: "' + actual + '"');
            }
        }

        public verifyOutliningSpans(spans: TextSpan[]) {
            var actual = this.pullLanguageService.getOutliningSpans(this.activeFile.name);

            if (actual.length !== spans.length) {
                throw new Error('verifyOutliningSpans failed - expected total spans to be ' + spans.length + ', but was ' + actual.length);
            }

            for (var i = 0; i < spans.length; i++) {
                var expectedSpan = spans[i];
                var actualSpan = actual[i];
                if (expectedSpan.start !== actualSpan.start() || expectedSpan.end !== actualSpan.end()) {
                    throw new Error('verifyOutliningSpans failed - span ' + (i + 1) + ' expected: (' + expectedSpan.start + ',' + expectedSpan.end + '),  actual: (' + actualSpan.start() + ',' + actualSpan.end() + ')');
                }
            }
        }

        public verifyMatchingBracePosition(bracePosition: number, expectedMatchPosition: number) {
            var actual = this.pullLanguageService.getMatchingBraceSpans(this.activeFile.name, bracePosition);

            if (actual.length !== 2) {
                throw new Error('verifyMatchingBracePosition failed - expected result to contain 2 spans, but it had ' + actual.length);
            }

            var actualMatchPosition = -1;
            if (bracePosition >= actual[0].start() && bracePosition <= actual[0].end()) {
                actualMatchPosition = actual[1].start();
            } else if (bracePosition >= actual[1].start() && bracePosition <= actual[1].end()) {
                actualMatchPosition = actual[0].start();
            } else {
                throw new Error('verifyMatchingBracePosition failed - could not find the brace position: ' + bracePosition + ' in the returned list: (' + actual[0].start() + ',' + actual[0].end() + ') and (' + actual[1].start() + ',' + actual[1].end() + ')');
            }

            if (actualMatchPosition !== expectedMatchPosition) {
                throw new Error('verifyMatchingBracePosition failed - expected: ' + actualMatchPosition + ',  actual: ' + expectedMatchPosition);
            }
        }

        public verifyNoMatchingBracePosition(bracePosition: number) {
            var actual = this.pullLanguageService.getMatchingBraceSpans(this.activeFile.name, bracePosition);

            if (actual.length !== 0) {
                throw new Error('verifyNoMatchingBracePosition failed - expected: 0 spans, actual: ' + actual.length);
            }
        }

        public verifyIndentationLevelAtPosition(position:number, numberOfTabs: number) {
            var actual = this.pullLanguageService.getIndentation(this.activeFile.name, position, new Services.EditorOptions());
            if (actual !== numberOfTabs) {
                throw new Error('verifyIndentationLevel failed - expected: ' + numberOfTabs + ', actual: ' + actual);
            }
        }

        public verifyIndentationLevelAtCurrentPosition(numberOfTabs: number) {
            this.verifyIndentationLevelAtPosition(this.currentCaretPosition, numberOfTabs);
        }

        private getBOF(): number {
            return 0;
        }

        private getEOF(): number {
            return this.langSvc.getScriptSourceLength(this.getActiveFileIndex())
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

        private assertItemInCompletionList(completionList: Services.CompletionEntry[], name: string, type?: string, docComment?: string, fullSymbolName?: string, kind?: string) {
            var items: { name: string; type: string; docComment: string; fullSymbolName: string;  kind: string; }[] = completionList.map(element => {
                return {
                    name: element.name,
                    type: element.type,
                    docComment: element.docComment,
                    fullSymbolName: element.fullSymbolName,
                    kind: element.kind
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
                    if (fullSymbolName != undefined) {
                        assert.equal(item.fullSymbolName, fullSymbolName);
                    }
                    if (kind != undefined) {
                        assert.equal(item.kind, kind);
                    }
                    return;
                }
            }

            var getItemString = (item: { name: string; type: string; docComment: string; fullSymbolName: string; kind: string; }) => {
                if (docComment == undefined && type == undefined && fullSymbolName == undefined && kind == undefined) {
                    return item.name;
                }

                var returnString = "\n{ name: " + item.name;
                if (type != undefined) {
                    returnString += ",type: " + item.type;
                }
                if (docComment != undefined) {
                    returnString += ",docComment: " + item.docComment;
                }
                if (fullSymbolName != undefined) {
                    returnString += ",fullSymbolName: " + item.fullSymbolName;
                }
                if (kind != undefined) {
                    returnString += ",kind: " + item.kind;
                }
                returnString += " }"

                return returnString;
            };

            var itemsDigest = items.slice(0, 10);
            var itemsString = items.map(elem => getItemString(elem)).join(",");
            if (items.length > 10) {
                itemsString += ', ...';
            }
            throw new Error('Expected "' + getItemString({ name: name, type: type, docComment: docComment, fullSymbolName: fullSymbolName, kind: kind }) + '" to be in list [' + itemsString + ']');
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

    // TOOD: should these just use the Harness's stdout/stderr?
    var fsOutput = new Harness.Compiler.WriterAggregator();
    var fsErrors = new Harness.Compiler.WriterAggregator();
    export function runFourSlashTest(filename: string) {
        var content = IO.readFile(filename);

        // Parse out the files and their metadata
        var testData = parseTestData(content);

        assert.bugs(content);

        currentTestState = new TestState(testData);
        var oldThrowAssertError = assert.throwAssertError;
        assert.throwAssertError = (error: Error) => {
            error.message = "Marker: " + currentTestState.lastKnownMarker + "\n" + error.message;
            throw error;
        }

        var mockFilename = 'test_input.ts';

        var result = '';
        var tsFn = Harness.usePull ? './tests/cases/prototyping/fourslash/fourslash.ts' : './tests/cases/fourslash/fourslash.ts';

        // TODO: previously we set these two settings on the compiler:
        //    settings.outputOption = "fourslash.js";
        //    settings.resolve = true;
        // but they appear to not affect test execution, are they still necessary? (I don't think resolve ever really worked)

        fsOutput.reset();
        fsErrors.reset();
        Harness.Compiler.addUnit(IO.readFile(tsFn), tsFn);        
        Harness.Compiler.addUnit(content, mockFilename);        
        Harness.Compiler.compile(content, mockFilename);

        var emitterIOHost: TypeScript.EmitterIOHost = {
            createFile: (s) => fsOutput,
            directoryExists: (s: string) => false,
            fileExists: (s: string) => true,
            resolvePath: (s: string)=>s
        }

        Harness.Compiler.emit(emitterIOHost);
        if (fsErrors.lines.length > 0) {
            throw new Error('Error compiling ' + filename + ': ' + fsErrors.lines.join('\r\n'));
        }
        
        result = fsOutput.lines.join('\r\n');

        // TODO: this is necessary while the Pull compiler lacks proper emit support
        // Fourslash expects 'result' to include the results of compiling the units added above, namely 'fourslash.ts'
        if (Harness.usePull) {
            result = IO.readFile('./tests/cases/prototyping/fourslash/fourslash.js') + '\r\n' + result;
        }

        // Compile and execute the test
        eval(result);
        assert.throwAssertError = oldThrowAssertError;
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

        var markerMap: MarkerMap = {};
        var markers: Marker[] = [];
        var ranges : Range[] = [];

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
                    var file = parseFileContent(currentFileContent, currentFileName, markerMap, markers, ranges);
                    file.fileOptions = currentFileOptions;
                    
                    // Store result file
                    files.push(file);
                   
                    // Reset local data
                    currentFileContent = null;
                    currentFileOptions = {};
                    currentFileName = makeDefaultFilename();
                }
            }
        }

        return {
            markerPositions: markerMap,
            markers: markers,
            globalOptions: opts,
            files: files,
            ranges: ranges
        }
    }

    enum State {
        none,
        inSlashStarMarker,
        inObjectMarker
    }

    var markerTextRegexp = /^[_a-zA-Z0-9\$]*$/;

    function reportError(fileName: string, line: number, col: number, message: string) {
        var errorMessage = fileName + "(" + line + "," + col + "): " + message;
        throw new Error(errorMessage);
    }

    function isValidSlashStarMarkerText(text: string): bool {
        return !!(text !== null && text.match(markerTextRegexp));
    }

    function recordMarker(fileName: string, location: ILocationInformation, text: string, isObjectMarker: bool, markerMap: MarkerMap,  markers: Marker[]) {
        var markerName = null;
        var markerData = null;
        if (!isObjectMarker && isValidSlashStarMarkerText(text)) {
            // SlashStar Marker text is a single word, number, or empty
            markerName = text;
        } else if (isObjectMarker) {
            // Attempt to parse the marker value as JSON
            var markerValue = null;
            try {
                markerValue = JSON2.parse("{ " + text + " }");
            } 
            catch(e) {
                reportError(fileName, location.sourceLine, location.sourceColumn, "Unable to parse marker text " + e.message);
            }

            if (markerValue === null) {
                reportError(fileName, location.sourceLine, location.sourceColumn, "Object markers can not be empty");
            }
            markerName = markerValue.name; 
            markerData = markerValue;
        }

        var marker: Marker = {
            fileName: fileName,
            position: location.position,
            data: markerData
        };

        // Allow object markers to be annonums
        if (!isObjectMarker || (markerData && markerData.name !== undefined)) {
            if (markerMap[markerName] !== undefined) {
                var message = "Marker '" + markerName + "' is duplicated in the source file contents.";
                reportError(marker.fileName, location.sourceLine, location.sourceColumn, message);
            }
            markerMap[markerName] = marker;
        }

        markers.push(marker);
    }

    function parseFileContent(content: string, fileName: string, markerMap: MarkerMap,  markers: Marker[], ranges: Range[]): FourSlashFile {
        content = chompLeadingSpace(content);

        var output: string = "";
        var openMarker: ILocationInformation = null;
        var openRanges: ILocationInformation[] = [];
        var localRanges: Range[] = [];
        var currentStart: number = 0;
        var diffrence: number = 0;
        var state: State = State.none;
        var line: number = 1;
        var column: number = 1;

        if (content.length > 0) {
            var previousChar = content.charAt(0);
            for (var i = 1; i < content.length; i++) {
                var currentChar = content.charAt(i);
                switch (state) {
                    case State.none:
                        if (previousChar === "[" && currentChar === "|") {
                            // found a range start
                            openRanges.push({
                                position: (i - 1) - diffrence,
                                sourcePosition: i - 1,
                                sourceLine: line,
                                sourceColumn: column,
                            });
                            // copy all text up to marker position
                            output += content.substring(currentStart, i - 1);
                            currentStart = i + 1;
                            diffrence += 2;
                        } else if (previousChar === "|" && currentChar === "]") {
                            // found a range end
                            var rangeStart = openRanges.pop();
                            if (!rangeStart) {
                                reportError(fileName, line, column, "Found range end with no matching start.");
                            }

                            var range: Range = {
                                fileName: fileName,
                                start: rangeStart.position,
                                end: (i - 1) - diffrence
                            };
                            localRanges.push(range);

                            // copy all text up to range marker position
                            output += content.substring(currentStart, i - 1);
                            currentStart = i + 1;
                            diffrence += 2;
                        } else if (previousChar === "/" && currentChar === "*") {
                            // found a marker
                            state = State.inSlashStarMarker;
                            openMarker = {
                                position: (i - 1) - diffrence,
                                sourcePosition: i - 1,
                                sourceLine: line,
                                sourceColumn: column,
                            };
                        } else if (previousChar === "{" && currentChar === "|") {
                            // found a marker
                            state = State.inObjectMarker;
                            openMarker = {
                                position: (i - 1) - diffrence,
                                sourcePosition: i - 1,
                                sourceLine: line,
                                sourceColumn: column,
                            };
                        }
                        break;
                    case State.inObjectMarker:
                    case State.inSlashStarMarker:
                        if ((state === State.inObjectMarker && previousChar === "|" && currentChar === "}" ) || 
                            (state === State.inSlashStarMarker && previousChar === "*" && currentChar === "/")) {
                            // RecordThe marker
                            var markerNameText = content.substring(openMarker.sourcePosition + 2, i - 1).trim();

                            // If this is a slashStarMarker, and the text is not valid, then it is a normal comment, ignore it
                            if (state !== State.inSlashStarMarker || isValidSlashStarMarkerText(markerNameText) ) {
                                recordMarker(fileName, openMarker, markerNameText, (state === State.inObjectMarker), markerMap, markers);

                                // copy all text up to range marker position
                                output += content.substring(currentStart, openMarker.sourcePosition);

                                // Set the current start to point to the end of the current marker to ignore its text
                                currentStart = i + 1;
                                diffrence += i + 1 - openMarker.sourcePosition;
                            }

                            // Reset the state
                            openMarker = null;
                            state = State.none;
                        }
                        break;
                }

                if (currentChar === '\n' && previousChar === '\r') {
                    // Ignore trailing \n after a \r
                    continue;
                }
                else if (currentChar === '\n' || currentChar === '\r') {
                    line++;
                    column = 1;
                    continue;
                }

                column++;
                previousChar = currentChar;
            }
        }
        // Add the remaining text
        output += content.substring(currentStart);

        if (openRanges.length > 0) {
            var openRange = openRanges[0];
            reportError(fileName, openRange.sourceLine, openRange.sourceColumn, "Unterminated range.");
        }


        if (openMarker !== null) {
            reportError(fileName, openMarker.sourceLine, openMarker.sourceColumn, "Unterminated marker.");
        }

        // put ranges in the correct order
        localRanges = localRanges.sort((a, b) => a.start < b.start ? -1 : 1);
        localRanges.forEach((r) => { ranges.push(r); });

        return {
                content: output,
                fileOptions: {},
                version: 0,
                name: fileName
            };
    }
}
