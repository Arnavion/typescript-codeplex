import Foo = module("interfaceDeclaration5")

class C1 implements Foo.I1 {
	public item:string;
}

// Allowed
interface I2 extends Foo.I1 {
	item:string;
}

// Negative Case
interface I3 extends Foo.I1 {
    item:number;
}

interface I4 extends Foo.I1 {
    token:string;
}

// Err - not implemented item
class C2 implements I4 {
    public token: string;
}

interface I5 extends Foo { }

// Negative case
interface I6 extends Foo.C1 { }

class C3 implements Foo.I1 { }

// Negative case 
interface Foo.I1 { }
