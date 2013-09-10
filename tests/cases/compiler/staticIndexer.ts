class C {
    static [s: string]: number;
    [s: string]: string;
}

var c: string = C[''];
c = (new C)[''];

var d: number = C[''];
d = (new C)[''];

var x: C = C['prototype']; // Index expression has type number, and not C, so this is an error