export interface IRpcChannel {
    on(event: string, listener: (reqid: number, method: string, ...params: any[]) => any): any;
    on(event: string, listener: (reqid: number, error: string, result: any) => any): any;
    emit(event: string, reqid: number, method: string, ...params: any[]): any;
    emit(event: string, reqid: number, error: string, result: any): any;
}
export declare function exported(target: any, method: string | Function): void;
export declare function getRemoteService<RemoteInterface>(channel: IRpcChannel, namespace: string): RemoteInterface;
export declare function initRpcChannel(channel: IRpcChannel): void;
export declare function registerService<LocalInterface>(channel: IRpcChannel, namespace: string, handler: LocalInterface, options?: {
    replace?: boolean;
}): void;
