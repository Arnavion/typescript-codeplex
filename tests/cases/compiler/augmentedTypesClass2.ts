// Checking class with other things in type space not value space

// class then interface
// BUG: 694374, don't want to allow this anymore
class c11 {
    foo() {
        return 1;
    }
}

interface c11 {
    bar(): void;
}

// class then class - covered
// class then enum 
class c33 {
    foo() {
        return 1;
    }
}
enum c33 { One };

// class then import
class c44 {
    foo() {
        return 1;
    }
}

import c44 = require(''); // BUG?: not currently allowed