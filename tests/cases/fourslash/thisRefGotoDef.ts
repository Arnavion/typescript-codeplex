/// <reference path='FourSlash.ts' />

//// class Greeter {
////     /*def*/element: HTMLElement;
////     span: HTMLElement;
////     timerToken: number;
////     constructor(element: HTMLElement) {
////         this.element/*ref*/ = element;
////     }
//// }

goTo.marker('ref');
goTo.definition();
verify.caretAtMarker('def');