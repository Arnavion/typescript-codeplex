///<reference path='References.ts' />

class StringTableEntry {
    constructor(public Text: string,
                public HashCode: number,
                public Next: StringTableEntry) {
    }
}

// A table of interned strings.  Faster and better than an arbitrary hashtable for the needs of the
// scanner. Specifically, the scanner operates over a sliding window of characters, with a start 
// and end pointer for the current lexeme.  The scanner then wants to get the *interned* string
// represented by that subsection.
//
// Importantly, if the string is already interned, then it wants ask "is the string represented by 
// this section of a char array contained within the table" in a non-allocating fashion.  i.e. if 
// you have "[' ', 'p', 'u', 'b', 'l', 'i', 'c', ' ']" and you ask to get the string represented by
//  range [1, 7), then this table will return "public" without any allocations if that value was 
// already in the table.
//
// Of course, if the value is not in the table then there will be an initial cost to allocate the 
// string and the bucket for the table.  However, that is only incurred the first time each unique 
// string is added.
class StringTable {
    private entries: StringTableEntry[] = [];
    private count: number = 0;

    constructor(capacity: number = 256) {
        var size = Hash.getPrime(capacity);
        this.entries = ArrayUtilities.createArray(size);
    }

    public addCharArray(key: number[], start: number, len: number): string {
        // Compute the hash for this key.  Also ensure that it fits within 31 bits  (so that it 
        // stays a non-heap integer, and so we can index into the array safely).
        var hashCode = Hash.computeSimple31BitCharArrayHashCode(key, start, len) % 0x7FFFFFFF;

        // First see if we already have the string represented by "key[start, start + len)" already
        // present in this table.  If we do, just return that string.  Do this without any 
        // allocations
        var entry = this.findCharArrayEntry(key, start, len, hashCode);
        if (entry !== null) {
            return entry.Text;
        }

        // We don't have an entry for that string in our table.  Convert that 
        var slice: number[] = key.slice(start, start + len);
        return this.addEntry(StringUtilities.fromCharCodeArray(slice), hashCode);
    }

    private findCharArrayEntry(key: number[], start: number, len: number, hashCode: number): StringTableEntry {
        for (var e = this.entries[hashCode % this.entries.length]; e !== null; e = e.Next) {
            if (e.HashCode === hashCode && StringTable.textCharArrayEquals(e.Text, key, start, len)) {
                return e;
            }
        }

        return null;
    }

    private addEntry(text: string, hashCode: number): string {
        var index = hashCode %  this.entries.length;

        var e = new StringTableEntry(text, hashCode, this.entries[index]);

        this.entries[index] = e;
        if (this.count === this.entries.length) {
            this.grow();
        }

        this.count++;
        return e.Text;
    }

    private dumpStats() {
        var standardOut = Environment.standardOut;
        
        standardOut.WriteLine("----------------------")
        standardOut.WriteLine("String table stats");
        standardOut.WriteLine("Count            : " + this.count);
        standardOut.WriteLine("Entries Length   : " + this.entries.length);

        var occupiedSlots = 0;
        for (var i = 0; i < this.entries.length; i++) {
            if (this.entries[i] !== null) {
                occupiedSlots++;
            }
        }
        
        standardOut.WriteLine("Occupied slots   : " + occupiedSlots);
        standardOut.WriteLine("Avg Length/Slot  : " + (this.count / occupiedSlots));
        standardOut.WriteLine("----------------------");
    }
    
    private grow(): void {
        // this.dumpStats();

        var newSize = Hash.expandPrime(this.entries.length);

        var oldEntries = this.entries;
        var newEntries: StringTableEntry[] = ArrayUtilities.createArray(newSize);

        this.entries = newEntries;

        for (var i = 0; i < oldEntries.length; i++) {
            var e = oldEntries[i];
            while (e !== null) {
                var newIndex = e.HashCode % newSize;
                var tmp = e.Next;
                e.Next = newEntries[newIndex];
                newEntries[newIndex] = e;
                e = tmp;
            }
        }

        this.dumpStats();
    }

    private static textCharArrayEquals(text: string, array: number[], start: number, length: number): bool {
        if (text.length !== length) {
            return false;
        }

        // use array.Length to eliminate the rangecheck
        var s = start;
        for (var i = 0; i < text.length; i++) {
            if (text.charCodeAt(i) !== array[s]) {
                return false;
            }

            s++;
        }

        return true;
    }
}