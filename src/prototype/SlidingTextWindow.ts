///<reference path='References.ts' />

class SlidingTextWindow {
    private DefaultWindowLength: number = 2048;

    // Underlying text that we're streaming over.
    private text: IText;

    private characterWindow: number[]; // moveable window of chars from source text
    private characterWindowCount: number = 0; // # of valid characters in characterWindow
    
    // The index in the character window array that we're at. i.e. if there 100 chars and 
    // characterWindow contains chars [70, 80), and we're on char 75, then this value would be '5'.
    // Note: it is not absolute.  It is relative to the start of the characterWindow.
    private currentRelativeCharacterIndex: number = 0;

    private _characterWindowStart: number = 0; // start of current lexeme within chars buffer

    // The position within text that the characterWindow is starting at.
    private basis: number = 0;

    private stringTable: StringTable = null;

    constructor(text: IText, stringTable: StringTable) {
        Debug.assert(stringTable !== null);
        this.text = text;
        this.stringTable = stringTable;

        this.characterWindow = ArrayUtilities.createArray(this.DefaultWindowLength);

        Debug.assert(this.characterWindow !== null);
    }

    public position(): number {
        return this.currentRelativeCharacterIndex + this.basis;
    }

    public startPosition(): number {
        return this._characterWindowStart + this.basis;
    }

    public start(): void {
        this._characterWindowStart = this.currentRelativeCharacterIndex;
    }

    public reset(position: number): void {
        // if position is within already read character range then just use what we have
        var relative = position - this.basis;
        if (relative >= 0 && relative <= this.characterWindowCount) {
            this.currentRelativeCharacterIndex = relative;
        }
        else {
            // we need to reread text buffer
            var amountToRead = MathPrototype.min(this.text.length(), position + this.characterWindow.length) - position;
            amountToRead = MathPrototype.max(amountToRead, 0);
            if (amountToRead > 0) {
                this.text.copyTo(position, this.characterWindow, 0, amountToRead);
            }

            this._characterWindowStart = 0;
            this.currentRelativeCharacterIndex = 0;
            this.basis = position;
            this.characterWindowCount = amountToRead;
        }
    }

    private moreChars(): bool {
        if (this.currentRelativeCharacterIndex >= this.characterWindowCount) {
            if (this.currentRelativeCharacterIndex + this.basis >= this.text.length()) {
                return false;
            }

            // if we are sufficiently into the char buffer, then shift chars to the left
            if (this._characterWindowStart > (this.characterWindowCount >> 2)) {
                ArrayUtilities.copy(this.characterWindow, this._characterWindowStart, this.characterWindow, 0, this.characterWindowCount - this._characterWindowStart);
                this.characterWindowCount -= this._characterWindowStart;
                this.currentRelativeCharacterIndex -= this._characterWindowStart;
                this.basis += this._characterWindowStart;
                this._characterWindowStart = 0;
            }

            if (this.characterWindowCount >= this.characterWindow.length) {
                // grow char array, since we need more contiguous space
                this.characterWindow[this.characterWindow.length * 2 - 1] = CharacterCodes.nullCharacter;
            }

            var amountToRead = MathPrototype.min(this.text.length() - (this.basis + this.characterWindowCount), this.characterWindow.length - this.characterWindowCount);
            this.text.copyTo(this.basis + this.characterWindowCount, this.characterWindow, this.characterWindowCount, amountToRead);
            this.characterWindowCount += amountToRead;
            return amountToRead > 0;
        }

        return true;
    }

    public advanceChar1(): void {
        this.currentRelativeCharacterIndex++;
    }

    public advanceCharN(n: number): void {
        this.currentRelativeCharacterIndex += n;
    }

    public peekCharAtPosition(): number {
        if (this.currentRelativeCharacterIndex >= this.characterWindowCount) {
            if (!this.moreChars()) {
                return CharacterCodes.nullCharacter;
            }
        }

        return this.characterWindow[this.currentRelativeCharacterIndex];
    }

    public peekCharN(delta: number): number {
        var position = this.position();

        this.advanceCharN(delta);
        var ch = this.peekCharAtPosition();

        this.reset(position);
        return ch;
    }

    private internCharArray(array: number[], start: number, length: number): string {
        return this.stringTable.addCharArray(array, start, length);
    }

    public getText(intern: bool): string {
        var width = this.currentRelativeCharacterIndex - this._characterWindowStart;
        return this.getSubstringText(this.startPosition(), width, intern);
    }

    private getSubstringText(position: number, length: number, intern: bool): string {
        var offset = position - this.basis;
        if (intern) {
            return this.internCharArray(this.characterWindow, offset, length);
        }
        else {
            return StringUtilities.fromCharCodeArray(this.characterWindow.slice(offset, offset + length));
        }
    }
}