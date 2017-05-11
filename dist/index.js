// tslint:disable:variable-name
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RemoteProxy {
    constructor(channel, namespace) {
        this.__rpc_knownMethods = new Map();
        this.__rpc_pendings = {};
        this.__rpc_channel = channel;
        this.__rpc_namespace = namespace;
        channel.on('__rpc_return__' + namespace, (reqid, error, result) => {
            let callbacks = this.__rpc_pendings[reqid];
            if (!callbacks) {
                return;
            }
            delete this.__rpc_pendings[reqid];
            if (error) {
                callbacks.reject(error);
            }
            else {
                callbacks.resolve(result);
            }
        });
    }
    get(target, method) {
        let func = this.__rpc_knownMethods.get(method);
        if (func) {
            return func;
        }
        let rpcReqId = 1;
        func = (...params) => {
            return new Promise((resolve, reject) => {
                const reqid = rpcReqId++;
                this.__rpc_pendings[reqid] = { resolve, reject };
                this.__rpc_channel.emit('__rpc_call__', reqid, this.__rpc_namespace, method, ...params);
            });
        };
        func.noReturn = (...params) => {
            return new Promise((resolve, reject) => {
                this.__rpc_channel.emit('__rpc_call__', 0, this.__rpc_namespace, method, ...params);
            });
        };
        this.__rpc_knownMethods.set(method, func);
        return func;
    }
    // tslint:disable-next-line:no-empty
    set() {
        return false;
    }
}
function exported(target, method) {
    target.__exported_methods = target.__exported_methods || new Set();
    if (typeof method === 'string') {
        target.__exported_methods.add(method);
    }
    else if (typeof method === 'function') {
        target.__exported_methods.add(method.name);
    }
    else {
        throw TypeError('exported should be called with method or method name.');
    }
}
exports.exported = exported;
function getRemoteService(channel, namespace) {
    return new Proxy({}, new RemoteProxy(channel, namespace));
}
exports.getRemoteService = getRemoteService;
class ServiceRegistry {
    constructor() {
        this._registry = new WeakMap();
    }
    getService(channel, namespace) {
        const services = this._registry.get(channel);
        if (!services) {
            return;
        }
        return services.get(namespace);
    }
    addService(channel, namespace, handler) {
        let services = this._registry.get(channel);
        if (!services) {
            services = new Map();
            services.set(namespace, handler);
            this._registry.set(channel, services);
        }
        else if (services.has(namespace)) {
            throw Error(`Service ${namespace} was already registered.`);
        }
        else {
            services.set(namespace, handler);
        }
    }
}
const registry = new ServiceRegistry();
function initRpcChannel(channel) {
    channel.on('__rpc_call__', (reqid, ns, method, ...params) => {
        const handler = registry.getService(channel, ns);
        if (!handler) {
            channel.emit('__rpc_return__' + ns, reqid, `RPC service "${ns}" is not registered`, null);
            return;
        }
        if (!handler.__exported_methods.has(method)) {
            channel.emit('__rpc_return__' + ns, reqid, `RPC method "${ns}.${method}" is not defined or exported`, null);
            return;
        }
        let ret;
        try {
            ret = handler[method].call(handler, ...params);
        }
        catch (e) {
            if (reqid) {
                channel.emit('__rpc_return__' + ns, reqid, e.toString(), null);
            }
        }
        if (!reqid) {
            return;
        }
        if (ret && typeof ret.then === 'function') {
            ret.then(value => channel.emit('__rpc_return__' + ns, reqid, null, value), error => channel.emit('__rpc_return__' + ns, reqid, error, null));
        }
        else {
            channel.emit('__rpc_return__' + ns, reqid, null, ret);
        }
    });
}
exports.initRpcChannel = initRpcChannel;
function registerService(channel, namespace, handler) {
    if (!handler.__exported_methods) {
        throw TypeError('Service handler exported nothing.');
    }
    registry.addService(channel, namespace, handler);
}
exports.registerService = registerService;
//# sourceMappingURL=index.js.map