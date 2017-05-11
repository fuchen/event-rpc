"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rpc = require("..");
const EventEmitter = require("events");
const assert = require("assert");
// util for test
function assertPromiseThrows(promise, errMsg) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield promise;
        }
        catch (e) {
            if (errMsg) {
                assert.equal(errMsg, e.toString());
            }
            return;
        }
        throw new assert.AssertionError('promise should throw exception');
    });
}
// Fixture: Services
class ServiceAddSub {
    add(a, b) {
        return a + b;
    }
    sub(a, b) {
        return a - b;
    }
}
__decorate([
    rpc.exported
], ServiceAddSub.prototype, "add", null);
__decorate([
    rpc.exported
], ServiceAddSub.prototype, "sub", null);
class ServiceMulDiv {
    mul(a, b) {
        return a * b;
    }
    div(a, b) {
        if (b === 0) {
            throw Error('Divide zero');
        }
        return a / b;
    }
}
__decorate([
    rpc.exported
], ServiceMulDiv.prototype, "mul", null);
__decorate([
    rpc.exported
], ServiceMulDiv.prototype, "div", null);
class ServiceForTest {
    testMethod() { }
}
__decorate([
    rpc.exported
], ServiceForTest.prototype, "testMethod", null);
// Test wrong calls
function worker1(channel) {
    return __awaiter(this, void 0, void 0, function* () {
        const notExistService = rpc.getRemoteService(channel, 'NotExist');
        yield assertPromiseThrows(notExistService.anyMethod(), 'RPC service "NotExist" is not registered');
        const test = rpc.getRemoteService(channel, 'Test');
        yield test.testMethod();
        let testAny = test;
        yield assertPromiseThrows(testAny.noSuchMethod(), 'RPC method "Test.noSuchMethod" is not defined or exported');
    });
}
// Test functionalities
function worker2(channel) {
    return __awaiter(this, void 0, void 0, function* () {
        const addSub = rpc.getRemoteService(channel, 'AddSub');
        const mulDiv = rpc.getRemoteService(channel, 'MulDiv');
        assert(7 === (yield addSub.add(4, 3)));
        assert(1 === (yield addSub.sub(4, 3)));
        assert(12 === (yield mulDiv.mul(4, 3)));
        assert(2 === (yield mulDiv.div(4, 2)));
        yield assertPromiseThrows(mulDiv.div(4, 0), 'Error: Divide zero');
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const a = new EventEmitter();
        const b = new EventEmitter();
        let _ = b.emit.bind(b);
        b.emit = a.emit.bind(a);
        a.emit = _;
        rpc.initRpcChannel(a);
        rpc.initRpcChannel(b);
        rpc.registerService(a, 'AddSub', new ServiceAddSub());
        rpc.registerService(a, 'MulDiv', new ServiceMulDiv());
        rpc.registerService(b, 'Test', new ServiceForTest());
        yield [worker1(a), worker2(b)];
        console.log('Test done');
    });
}
main();
//# sourceMappingURL=test.js.map