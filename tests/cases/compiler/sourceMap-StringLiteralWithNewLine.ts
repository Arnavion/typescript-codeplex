// @target: ES3
// @sourcemap: true
// @module: local
interface Document {
}
interface Window {
    document: Document;
}
declare var window: Window;

module Foo {
    var x = "test1";
    var y = "test 2\
isn't this a lot of fun";
    var z = window.document;
}