function x3(a: number, cb: (x: number) => number);
function x3(a: string, cb: (x: number) => number);
function x3(a: any, cb: (x: number) => number) {
    cb(a);
}

// both should be errors
x3(1, (x: string) => 1);
// BUG 669572
x3(1, (x: 'hm') => 1); 