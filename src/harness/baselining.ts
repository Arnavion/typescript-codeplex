﻿// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

/// <reference path="harness.ts" />

interface spanInformation {
    start: number;
    end: number;
    data: string;
}

var standardCompletionItems: string[] = null;
function getStandardCompletionItems(): string[]{
    if (standardCompletionItems === null) {
        var svs = new Harness.TypeScriptLS();
        var filename = 'empty.ts';
        var contents = '\n\nconsole.log("hi");';
        svs.addScript(filename, contents, true);

        var langSvc = svs.getLanguageService();

        standardCompletionItems = (<string>(langSvc.getCompletionsAtPosition(filename, 1, false))).trim().split('\n').slice(1);
        standardCompletionItems = standardCompletionItems.sort();
    }
    return standardCompletionItems.slice(0);
}

function cleanAndSplitCompletionList(completions: string): string[] {
    if(completions.trim() === 'false') {
        return ['(empty)'];
    }
    
    var actualItems = completions.trim().split('\n').slice(1);
    actualItems = actualItems.sort();
    
    var standardItems = getStandardCompletionItems();
    var resultItems: string[] = [];
    var presentStandardItems: string[] = [];
    
    var actualIndex = 0;
    var standardIndex = 0;
    
    while(actualIndex < actualItems.length) {
        if(actualItems[actualIndex] == standardItems[standardIndex]) {
            // Matched an item from the standard list - remove it from both lists
            actualItems.splice(actualIndex, 1);
            presentStandardItems.push(standardItems[standardIndex]);
            standardItems.splice(standardIndex, 1);
        } else if(actualItems[actualIndex] > standardItems[standardIndex]) {
            // This means we skipped something in standard
            standardIndex++;
        } else if(actualItems[actualIndex] < standardItems[standardIndex]) {
            // New item from the actual completion list
            resultItems.push(actualItems[actualIndex]);
            actualIndex++;
        } else {
            // Ran off the end of the standard items array
            resultItems.push(actualItems[actualIndex]);
            actualIndex++;
        }
    }
    
    if(presentStandardItems.length === 0) {
        // Don't emit anything -- all of the standard items are missing
    } else if(standardItems.length === 0) {
        // The exact set of standard items was present
        resultItems.push('(standard items)');
    } else if(presentStandardItems.length > standardItems.length) {
        standardItems.forEach(function(s) { resultItems.push('(missing standard item) ' + s); });
    } else {
        presentStandardItems.forEach(function(s) { resultItems.push('(present standard item) ' + s); });
    }
 
    var formattedResultItems: string[] = [];
    for(var i = 0; i < resultItems.length; i++) {
        var formatted = resultItems[i].replace('\t', '               '.substring(0, 15 - resultItems[i].indexOf('\t')));
        formattedResultItems.push(formatted);
    }

    return formattedResultItems;
}

function getIntellisenseTypeRegions(scriptText: string): spanInformation[] {
    return getIntellisenseRegions(scriptText, function(ls, filename, i) { return ls.getTypeAtPosition(filename, i); });
}

function getIntellisenseDefinitionRegions(scriptText: string): spanInformation[] {
    return getIntellisenseRegions(scriptText, function(ls, filename, i) { return ls.getDefinitionAtPosition(filename, i); });
}

function getIntellisenseMemberListRegions(scriptText: string): spanInformation[] {
    return getIntellisenseRegions(scriptText, function(ls, filename, i) { return ls.getCompletionsAtPosition(filename, i, true).split('\n').slice(1).join('\n'); });
}

function getIntellisenseCompletionListRegions(scriptText: string): spanInformation[] {
    return getIntellisenseRegions(scriptText, function(ls, filename, i) { return cleanAndSplitCompletionList(ls.getCompletionsAtPosition(filename, i, false)).join('\n'); });
}

function getIntellisenseSignatureRegions(scriptText: string): spanInformation[] {
    return getIntellisenseRegions(scriptText, function(ls, filename, i) { return ls.getSignatureAtPosition(filename, i); });
}

function getIntellisenseRegions(scriptText: string, getDataAtPoint: any): spanInformation[] {
    var result: spanInformation[] = [];

    // Set up the compiler
    var typescriptLS = new Harness.TypeScriptLS();
    var filename = 'sample.ts';
    typescriptLS.addScript(filename, scriptText, true);

    // Get the language service
    var ls = typescriptLS.getLanguageService();
    
    // Now walk through the characters of the script and generate the spans

    // Keep track of where in the document we are
    var line = 1;
    var col = 0;
    
    var currentSpan: spanInformation = { start: 0, end: null, data: '' };

    var previous = getDataAtPoint(ls, filename, 0);
    for(var i = 0; i < scriptText.length; i++) {
        var current = getDataAtPoint(ls, filename, i);
        
        if(current != previous) {
            currentSpan.end = i;
            
            if (currentSpan.data) {
                result.push(currentSpan);
            }
            
            currentSpan = { start: i, end: null, data: current };
        }
        
        previous = current;
    }
    
    return result;
}
