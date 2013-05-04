/// <reference path='fourslash.ts'/>
//// interface Number {
//// 	toFixed():string;
//// }
////interface Collection<T> {
////    length: number;
////    add(x: T): void;
////    remove(x: T): boolean;
////}
////
////interface Combinators {
////    map<T>(c: Collection<T>, f: (x: T) => any): Collection<any>;
////    map<T, U>(c: Collection<T>, f: (x: T) => U): Collection<U>;
////}
////
////class A {
////    foo<T>() { }
////}
////
////class B<T> {
////    foo(x: T): T { return null; }
////}
////
////var c2: Collection<number>;
////var c3: Collection<Collection<number>>;
////var c4: Collection<A>;
////var c5: Collection<B>;
////
////var _: Combinators;
////var rf1 = (x: number) => { return x.toFixed() };
////var rf2 = (x: Collection<number>) => { return x.length };
////var rf3 = (x: A) => { return x.foo() };
//// // BUG 684722
////var rf4 = <T>(x: B<T>) => { return x.foo<number>(1); };
////
////var r1a/*9*/ = _.map(c2, (x/*1*/) => { return x.toFixed() }); 
////var r1b/*10*/ = _.map(c2, rf1); 
////
////var r2a/*11*/ = _.map(c3, (x/*2*/) => { return x.toFixed() }); 
////var r2b/*12*/ = _.map(c3, rf2); 
////
////var r3a/*13*/ = _.map(c4, (x/*3*/) => { return x.foo() }); 
////var r3b/*14*/ = _.map(c4, rf3); 
////
////var r4a/*15*/ = _.map(c5, (x/*4*/) => { return x.foo() }); 
////var r4b/*16*/ = _.map(c5, rf4); 
////
////var r5a/*17*/ = _.map<number, string>(c2, (x/*5*/) => { return x.toFixed() }); 
////var r5b/*18*/ = _.map<number, string>(c2, rf1);
////
////var r6a/*19*/ = _.map<Collection<number>, string>(c3, (x/*6*/) => { return x.toFixed() });
////var r6b/*20*/ = _.map<Collection<number>, string>(c3, rf2);
////
////var r7a/*21*/ = _.map<A, string>(c4, (x/*7*/) => { return x.foo() });
////var r7b/*22*/ = _.map<A, string>(c4, rf3);
////
////var r8a/*23*/ = _.map<B, string>(c5, (x/*8*/) => { return x.foo() }); 
////var r8b/*24*/ = _.map<B, string>(c5, rf4); 

goTo.marker('1');
verify.quickInfoIs('number');
goTo.marker('2');
verify.quickInfoIs('Collection<number>');
goTo.marker('3');
verify.quickInfoIs('A');
goTo.marker('4');
verify.quickInfoIs('B<T>');
goTo.marker('5');
verify.quickInfoIs('number');
goTo.marker('6');
verify.quickInfoIs('Collection<number>');
goTo.marker('7');
verify.quickInfoIs('A');
goTo.marker('8');
verify.quickInfoIs('B<T>');

goTo.marker('9');
verify.quickInfoIs('Collection<string>');
goTo.marker('10');
verify.quickInfoIs('Collection<string>');
goTo.marker('11');
verify.quickInfoIs('Collection<any>');
goTo.marker('12');
verify.quickInfoIs('Collection<number>');
/*
goTo.marker('13');
verify.quickInfoIs('Collection<A>');
goTo.marker('14');
verify.quickInfoIs('Collection<A>');
goTo.marker('15');
verify.quickInfoIs('Collection<B<T>>');
goTo.marker('16');
verify.quickInfoIs('Collection<B<T>>');
*/
// BUG 684803
goTo.marker('17');
verify.quickInfoIs('Collection<string>');
goTo.marker('19');
// BUG 684805
verify.quickInfoIs('Collection<string>');
goTo.marker('20');
verify.quickInfoIs('Collection<any>');
goTo.marker('21');
//verify.quickInfoIs('Collection<A>');
verify.quickInfoIs('Collection<string>');
goTo.marker('22');
//verify.quickInfoIs('Collection<A>');
verify.quickInfoIs('Collection<any>');
goTo.marker('23');
//verify.quickInfoIs('Collection<B<T>>');
verify.quickInfoIs('Collection<string>');
goTo.marker('24');
//verify.quickInfoIs('Collection<B<T>>');
verify.quickInfoIs('Collection<string>');