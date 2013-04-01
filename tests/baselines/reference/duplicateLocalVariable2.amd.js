define(["require", "exports"], function(require, exports) {
    var TestCase = (function () {
        function TestCase(name, test, errorMessageRegEx) {
            this.name = name;
            this.test = test;
            this.errorMessageRegEx = errorMessageRegEx;
        }
        return TestCase;
    })();
    exports.TestCase = TestCase;    
    var TestRunner = (function () {
        function TestRunner() {
            this.tests = [];
        }
        TestRunner.arrayCompare = function arrayCompare(arg1, arg2) {
            return (arg1.every(function (val, index) {
                return val === arg2[index];
            }));
        };
        TestRunner.prototype.addTest = function (test) {
            this.tests.push(test);
        };
        return TestRunner;
    })();
    exports.TestRunner = TestRunner;    
    exports.tests = (function () {
        var testRunner = new TestRunner();
        testRunner.addTest(new TestCase("Check UTF8 encoding", function () {
            var fb = new FileManager.FileBuffer(20);
            fb.writeUtf8Bom();
            var chars = [
                0x0054, 
                0x00E8, 
                0x1D23, 
                0x2020, 
                0x000D, 
                0x000A
            ];
            for(var i in chars) {
                fb.writeUtf8CodePoint(chars[i]);
            }
            fb.index = 0;
            var bytes = [];
            for(var i = 0; i < 14; i++) {
                bytes.push(fb.readByte());
            }
            var expected = [
                0xEF, 
                0xBB, 
                0xBF, 
                0x54, 
                0xC3, 
                0xA8, 
                0xE1, 
                0xB4, 
                0xA3, 
                0xE2, 
                0x80, 
                0xA0, 
                0x0D, 
                0x0A
            ];
            return TestRunner.arrayCompare(bytes, expected);
        }));
        return testRunner;
    })();
})