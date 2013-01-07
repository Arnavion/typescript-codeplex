// @target: ES5
// @declaration: true
// @comments: true

// @Filename: comments_MultiModule_MultiFile_0.ts
/// this is multi declare module
module multiM {
    /// class b
    export class b {
    }
}
/// thi is multi module 2
module multiM {
    /// class c comment
    export class c {
    }
}

new multiM.b();
new multiM.c();

// @Filename: comments_MultiModule_MultiFile_1.ts
/// this is multi module 3 comment
module multiM {
    /// class d comment
    export class d {
    }
}
new multiM.d();