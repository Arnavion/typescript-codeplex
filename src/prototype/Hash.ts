///<reference path='References.ts' />

class Hash {
    // This table uses FNV1a as a string hash
    private static FNV_BASE = 2166136261;
    private static FNV_PRIME = 16777619;

    private static computeFnv1aCharArrayHashCode(text: number[], start: number, len: number): number {
        var hashCode = FNV_BASE;
        var end = start + len;

        for (var i = start; i < end; i++) {
            hashCode = (hashCode ^ text[i]) * FNV_PRIME;
        }

        return hashCode;
    }

    public static computeMurmur2CharArrayHashCode(key: number[], start: number, len: number): number {
        // 'm' and 'r' are mixing constants generated offline.
        // They're not really 'magic', they just happen to work well.
        var m = 0x5bd1e995;
        var r = 24;

        // Initialize the hash to a 'random' value
        var numberOfCharsLeft = len;
        var h = (0 ^ numberOfCharsLeft);

        // Mix 4 bytes at a time into the hash.  NOTE: 4 bytes is two chars, so we iterate
        // through the string two chars at a time.
        var index = start;
        while (numberOfCharsLeft >= 2) {
            var c1 = key[index];
            var c2 = key[index + 1]; 

            var k = c1 | (c2 << 16);

            k *= m;
            k ^= k >> r;
            k *= m;

            h *= m;
            h ^= k;

            index += 2;
            numberOfCharsLeft -= 2;
        }

        // Handle the last char (or 2 bytes) if they exist.  This happens if the original string had
        // odd length.
        if (numberOfCharsLeft == 1) {
            h ^= key[index];
            h *= m;
        }

        // Do a few final mixes of the hash to ensure the last few bytes are well-incorporated.

        h ^= h >> 13;
        h *= m;
        h ^= h >> 15;

        return h;
    }

    public static computeMurmur2StringHashCode(key: string): number {
        // 'm' and 'r' are mixing constants generated offline.
        // They're not really 'magic', they just happen to work well.
        var m = 0x5bd1e995;
        var r = 24;

        // Initialize the hash to a 'random' value
        var start = 0;
        var len = key.length;
        var numberOfCharsLeft = len;
        var h = (0 ^ numberOfCharsLeft);

        // Mix 4 bytes at a time into the hash.  NOTE: 4 bytes is two chars, so we iterate
        // through the string two chars at a time.
        var index = start;
        while (numberOfCharsLeft >= 2) {
            var c1 = key.charCodeAt(index);
            var c2 = key.charCodeAt(index + 1);

            var k = c1 | (c2 << 16);

            k *= m;
            k ^= k >> r;
            k *= m;

            h *= m;
            h ^= k;

            index += 2;
            numberOfCharsLeft -= 2;
        }

        // Handle the last char (or 2 bytes) if they exist.  This happens if the original string had
        // odd length.
        if (numberOfCharsLeft == 1) {
            h ^= key.charCodeAt(index);
            h *= m;
        }

        // Do a few final mixes of the hash to ensure the last few bytes are well-incorporated.

        h ^= h >> 13;
        h *= m;
        h ^= h >> 15;

        return h;
    }

    private static primes =
        [ 3, 7, 11, 17, 23, 29, 37, 47, 59, 71, 89, 107, 131, 163, 197, 239, 293, 353, 431, 521,
          631, 761, 919, 1103, 1327, 1597, 1931, 2333, 2801, 3371, 4049, 4861, 5839, 7013, 8419,
          10103, 12143, 14591, 17519, 21023, 25229, 30293, 36353, 43627, 52361, 62851, 75431, 
          90523, 108631, 130363, 156437, 187751, 225307, 270371, 324449, 389357, 467237, 560689,
          672827, 807403, 968897, 1162687, 1395263, 1674319, 2009191, 2411033, 2893249, 3471899,
          4166287, 4999559, 5999471, 7199369 ];

    public static getPrime(min: number): number {
        for (var i = 0; i < primes.length; i++) {
            var num = primes[i];
            if (num >= min) {
                return num;
            }
        }

        throw Errors.notYetImplemented();
    }

    public static expandPrime(oldSize: number): number {
        var num = oldSize << 1;
        if (num > 2146435069 && 2146435069 > oldSize) {
            return 2146435069;
        }
        return getPrime(num);
    }
}