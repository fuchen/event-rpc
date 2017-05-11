import * as rpc from '..'
import * as EventEmitter from 'events'
import * as assert from 'assert'

// util for test
async function assertPromiseThrows<T>(promise: Promise<T>, errMsg?: string) {
  try {
    await promise
  } catch (e) {
    if (errMsg) {
      assert.equal(errMsg, e.toString())
    }
    return
  }
  throw new assert.AssertionError('promise should throw exception')
}

// Fixture: Services
class ServiceAddSub {
  @rpc.exported
  public add(a, b) {
    return a + b
  }

  @rpc.exported
  public sub(a, b) {
    return a - b
  }
}

class ServiceMulDiv {
  @rpc.exported
  public mul(a, b): number {
    return a * b
  }

  @rpc.exported
  public div(a, b): number {
    if (b === 0) {
      throw Error('Divide zero')
    }
    return a / b
  }
}

class ServiceForTest {
  @rpc.exported
  public testMethod() {}
}

// Test wrong calls
async function worker1(channel) {
  const notExistService = rpc.getRemoteService<any>(channel, 'NotExist')
  await assertPromiseThrows(notExistService.anyMethod(), 'RPC service "NotExist" is not registered')

  const test = rpc.getRemoteService<ServiceForTest>(channel, 'Test')

  await test.testMethod()

  let testAny = test as any
  await assertPromiseThrows(testAny.noSuchMethod(), 'RPC method "Test.noSuchMethod" is not defined or exported')
}

// Test functionalities
async function worker2(channel) {

  const addSub = rpc.getRemoteService<ServiceAddSub>(channel, 'AddSub')
  const mulDiv = rpc.getRemoteService<ServiceMulDiv>(channel, 'MulDiv')

  assert(7 === await addSub.add(4, 3))
  assert(1 === await addSub.sub(4, 3))
  assert(12 === await mulDiv.mul(4, 3))
  assert(2 === await mulDiv.div(4, 2))
  await assertPromiseThrows<number>(<Promise<number>> <any> mulDiv.div(4, 0), 'Error: Divide zero')
}

async function main() {
  const a = new EventEmitter()
  const b = new EventEmitter()

  let _ = b.emit.bind(b)
  b.emit = a.emit.bind(a)
  a.emit = _

  rpc.initRpcChannel(a)
  rpc.initRpcChannel(b)

  rpc.registerService(a, 'AddSub', new ServiceAddSub())
  rpc.registerService(a, 'MulDiv', new ServiceMulDiv())
  rpc.registerService(b, 'Test', new ServiceForTest())

  await [ worker1(a), worker2(b) ]
  console.log('Test done')
}

main()
