class Foo {
}
class Foo2 extends Foo {
    x() {
        var lamda = (_super: number) => { // Error 
            return x => this;   // New scope.  So should inject new _this capture
        }
    }
    y(_super: number) { // Error 
        var lambda = () => {
            return x => this;   // New scope.  So should inject new _this capture
        }
    }
}