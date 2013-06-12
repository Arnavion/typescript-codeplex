function makePoint(x) {
    return {
        get x() {
            return x;
        }
    };
}
;
var point = makePoint(2);
var x = point.x;

////[0.d.ts]
declare function makePoint(x: number): {
    x: number;
};
declare var point: {
    x: number;
};
declare var x: number;
