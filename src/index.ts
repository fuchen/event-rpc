// tslint:disable:variable-name

export interface IRpcChannel {
  on(event: string, listener: (reqid: number, method: string, ...params: any[]) => any)
  on(event: string, listener: (reqid: number, error: string, result: any) => any)

  emit(event: string, reqid: number, method: string, ...params: any[])
  emit(event: string, reqid: number, error: string, result: any)
  // on(event: '__rpc_call__', listener: (namespace: string, reqid: number, method: string, ...params: any[]) => any)
  // on(event: '__rpc_return__', listener: (namespace: string, reqid: number, error: string, result: any) => any)
  // emit(event: '__rpc_call__', namespace: string, reqid: number, method: string, ...params: any[])
  // emit(event: '__rpc_return__', namespace: string, reqid: number, error: string, result: any)
}

class RemoteProxy {
  private __rpc_channel: IRpcChannel
  private __rpc_knownMethods = new Map()
  private __rpc_namespace: string
  private __rpc_pendings = {}

  constructor(channel: IRpcChannel, namespace: string) {
    this.__rpc_channel = channel
    this.__rpc_namespace = namespace

    channel.on('__rpc_return__' + namespace, (reqid, error, result) => {
      let callbacks = this.__rpc_pendings[reqid]
      if (!callbacks) {
        return
      }

      delete this.__rpc_pendings[reqid]

      if (error) {
        callbacks.reject(error)
      } else {
        callbacks.resolve(result)
      }
    })
  }

  public get(target, method) {
    let func = this.__rpc_knownMethods.get(method)
    if (func) {
      return func
    }

    let rpcReqId = 1

    func = (...params) => {
      return new Promise((resolve, reject) => {
        const reqid = rpcReqId++
        this.__rpc_pendings[reqid] = { resolve, reject }
        this.__rpc_channel.emit('__rpc_call__', reqid, this.__rpc_namespace, method, ...params)
      })
    }

    func.noReturn = (...params) => {
      return new Promise((resolve, reject) => {
        this.__rpc_channel.emit('__rpc_call__', 0, this.__rpc_namespace, method, ...params)
      })
    }

    this.__rpc_knownMethods.set(method, func)
    return func
  }

  // tslint:disable-next-line:no-empty
  public set() {
    return false
  }
}

export function exported(target: any, method: string | Function) {
  target.__exported_methods = target.__exported_methods || new Set()
  if (typeof method === 'string') {
    target.__exported_methods.add(method)
  } else if (typeof method === 'function') {
    target.__exported_methods.add(method.name)
  } else {
    throw TypeError('exported should be called with method or method name.')
  }
}

export function getRemoteService<RemoteInterface>(
  channel: IRpcChannel,
  namespace: string
): RemoteInterface {
   return new Proxy({}, new RemoteProxy(channel, namespace)) as RemoteInterface
}

class ServiceRegistry {
  private _registry = new WeakMap<IRpcChannel, Map<string, any>>()

  public getService(channel: IRpcChannel, namespace: string): any {
    const services = this._registry.get(channel)
    if (!services) {
      return
    }
    return services.get(namespace)
  }

  public addService(channel: IRpcChannel, namespace: string, handler: any): void {
    let services = this._registry.get(channel)
    if (!services) {
      services = new Map<string, any>()
      services.set(namespace, handler)
      this._registry.set(channel, services)
    } else if (services.has(namespace)) {
      throw Error(`Service ${namespace} was already registered.`)
    } else {
      services.set(namespace, handler)
    }
  }
}

const registry = new ServiceRegistry()

export function initRpcChannel(channel: IRpcChannel): void {
  channel.on('__rpc_call__', (reqid, ns, method, ...params) => {
    const handler = registry.getService(channel, ns)
    if (!handler) {
      channel.emit('__rpc_return__' + ns, reqid, `RPC service "${ns}" is not registered`, null)
      return
    }

    if (!handler .__exported_methods.has(method)) {
      channel.emit('__rpc_return__' + ns, reqid, `RPC method "${ns}.${method}" is not defined or exported`, null)
      return
    }

    let ret
    try {
      ret = handler[method].call(handler, ...params)
    } catch (e) {
      if (reqid) {
        channel.emit('__rpc_return__' + ns, reqid, e.toString(), null)
      }
    }
    if (!reqid) {
      return
    }
    if (ret && typeof ret.then === 'function') {
      ret.then(
        value => channel.emit('__rpc_return__' + ns, reqid, null, value),
        error => channel.emit('__rpc_return__' + ns, reqid, error, null)
      )
    } else {
      channel.emit('__rpc_return__' + ns, reqid, null, ret)
    }
  })
}

export function registerService<LocalInterface>(
  channel: IRpcChannel,
  namespace: string,
  handler: LocalInterface
): void {
  if (!(handler as any).__exported_methods) {
    throw TypeError('Service handler exported nothing.')
  }
  registry.addService(channel, namespace, handler)
}
