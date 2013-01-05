// @target: ES5
// @declaration: true
// @comments: true

/// This is comment for c1
class c1 {
    /// p1 is property of c1
    public p1: number;
    /// sum with property
    public p2(/** number to add*/b: number) {
        return this.p1 + b;
    }
    /// getter property
    public get p3() {
        return this.p2(this.p1);
    }
    /// setter property
    public set p3(/** this is value*/value: number) {
        this.p1 = this.p2(value);
    }
    /// pp1 is property of c1
    private pp1: number;
    /// sum with property
    private pp2(/** number to add*/b: number) {
        return this.p1 + b;
    }
    /// getter property
    private get pp3() {
        return this.pp2(this.pp1);
    }
    /// setter property
    private set pp3( /** this is value*/value: number) {
        this.pp1 = this.pp2(value);
    }
    /// Constructor method
    constructor() {
    }
    /// s1 is static property of c1
    static s1: number;
    /// static sum with property
    static s2(/** number to add*/b: number) {
        return c1.s1 + b;
    }
    /// static getter property
    static get s3() {
        return c1.s2(c1.s1);
    }
    /// setter property
    static set s3( /** this is value*/value: number) {
        c1.s1 = c1.s2(value);
    }
    public nc_p1: number;
    public nc_p2(b: number) {
        return this.nc_p1 + b;
    }
    public get nc_p3() {
        return this.nc_p2(this.nc_p1);
    }
    public set nc_p3(value: number) {
        this.nc_p1 = this.nc_p2(value);
    }
    private nc_pp1: number;
    private nc_pp2(b: number) {
        return this.nc_pp1 + b;
    }
    private get nc_pp3() {
        return this.nc_pp2(this.nc_pp1);
    }
    private set nc_pp3(value: number) {
        this.nc_pp1 = this.nc_pp2(value);
    }
    static nc_s1: number;
    static nc_s2(b: number) {
        return c1.nc_s1 + b;
    }
    static get nc_s3() {
        return c1.nc_s2(c1.nc_s1);
    }
    static set nc_s3(value: number) {
        c1.nc_s1 = c1.nc_s2(value);
    }
}
var i1 = new c1();
var i1_p = i1.p1;
var i1_f = i1.p2;
var i1_r = i1.p2(20);
var i1_prop = i1.p3;
i1.p3 = i1_prop;
var i1_nc_p = i1.nc_p1;
var i1_ncf = i1.nc_p2;
var i1_ncr = i1.nc_p2(20);
var i1_ncprop = i1.nc_p3;
i1.nc_p3 = i1_ncprop;
var i1_s_p = c1.s1;
var i1_s_f = c1.s2;
var i1_s_r = c1.s2(20);
var i1_s_prop = c1.s3;
c1.s3 = i1_s_prop;
var i1_s_nc_p = c1.nc_s1;
var i1_s_ncf = c1.nc_s2;
var i1_s_ncr = c1.nc_s2(20);
var i1_s_ncprop = c1.nc_s3;
c1.nc_s3 = i1_s_ncprop;
var i1_c = c1;
class cProperties {
    private val: number;
    /// getter only property
    public get p1() {
        return this.val;
    }
    public get nc_p1() {
        return this.val;
    }
    ///setter only property
    public set p2(value: number) {
        this.val = value;
    }
    public set nc_p2(value: number) {
        this.val = value;
    }
}
var cProperties_i = new cProperties();
cProperties_i.p2 = cProperties_i.p1;
cProperties_i.nc_p2 = cProperties_i.nc_p1;
