///<reference path='References.ts' />

module TypeScript.TextUtilities {
    export function parseLineStarts(text: ISimpleText): number[]{
        var length = text.length();

        // Corner case check
        if (0 === length) {
            var result: number[] = [];
            result.push(0);
            return result;
        }

        var position = 0;
        var index = 0;
        var arrayBuilder: number[] = [];
        var lineNumber = 0;

        // The following loop goes through every character in the text. It is highly
        // performance critical, and thus inlines knowledge about common line breaks
        // and non-line breaks.
        while (index < length) {
            var c = text.charCodeAt(index);
            var lineBreakLength;

            // common case - ASCII & not a line break
            if (c > CharacterCodes.carriageReturn && c <= 127) {
                index++;
                continue;
            }
            else if (c === CharacterCodes.carriageReturn && index + 1 < length && text.charCodeAt(index + 1) === CharacterCodes.lineFeed) {
                lineBreakLength = 2;
            }
            else if (c === CharacterCodes.lineFeed) {
                lineBreakLength = 1;
            }
            else {
                lineBreakLength = TextUtilities.getLengthOfLineBreak(text, index);
            }

            if (0 === lineBreakLength) {
                index++;
            }
            else {
                arrayBuilder.push(position);
                index += lineBreakLength;
                position = index;
                lineNumber++;
            }
        }

        // Create a start for the final line.  
        arrayBuilder.push(position);

        return arrayBuilder;
    }

    export function getLengthOfLineBreakSlow(text: ISimpleText, index: number, c: number): number {
        if (c === CharacterCodes.carriageReturn) {
            var next = index + 1;
            return (next < text.length()) && CharacterCodes.lineFeed === text.charCodeAt(next) ? 2 : 1;
        }
        else if (isAnyLineBreakCharacter(c)) {
            return 1;
        }
        else {
            return 0;
        }
    }

    export function getLengthOfLineBreak(text: ISimpleText, index: number): number {
        var c = text.charCodeAt(index);

        // common case - ASCII & not a line break
        if (c > CharacterCodes.carriageReturn && c <= 127) {
            return 0;
        }

        return getLengthOfLineBreakSlow(text, index, c);
    }

    export function isAnyLineBreakCharacter(c: number): boolean {
        return c === CharacterCodes.lineFeed ||
               c === CharacterCodes.carriageReturn ||
               c === CharacterCodes.nextLine ||
               c === CharacterCodes.lineSeparator ||
               c === CharacterCodes.paragraphSeparator;
    }
}