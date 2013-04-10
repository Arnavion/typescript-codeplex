// bug 662421: 'any' not correct infered on array reduction function

var paired: any[];

paired.reduce(function (a1, a2) {

    return a1.concat({});

} , []);

paired.reduce((b1, b2) => {

    return b1.concat({});
} , []);

paired.reduce((b3, b3) => b3.concat({}), []);

paired.map((c1) => c1.count);
paired.map(function (c2) { return c2.count; });