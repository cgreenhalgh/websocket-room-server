// hello request
export interface HelloReq {
    // generic, i.e. as per these types
    protocol: string
    // server-specific
    roomProtocol: string
    roomId: string
    roomCredential?: string
    clientCredential?: string
    clientType?: string
    clientName?: string
    clientState: KVStore
    readonly?: boolean // default true
}
export const PROTOCOL = 'websocket-room-server:1'
export interface Message {
    type: MESSAGE_TYPE
}
export enum MESSAGE_TYPE {
    HELLO_FAIL_RESP,
    HELLO_SUCCESS_RESP,
    CHANGE_REQ,
    CHANGE_NOTIF,
    ACTION_REQ,
    ACTION_RESP,
    CLOSE_REQ,
    CLOSE_RESP,
}
// hello response
export interface HelloFailResp {
    type: MESSAGE_TYPE.HELLO_FAIL_RESP
    protocol: string
    roomProtocol: string
    msg?: string
}
export interface HelloSuccessResp {
    type: MESSAGE_TYPE.HELLO_SUCCESS_RESP
    protocol: string
    roomProtocol: string
    clientId: string
    clients: ClientMap
    roomState: KVStore
}
// state change request
export interface ChangeReq {
    type: MESSAGE_TYPE.CHANGE_REQ
    roomChanges?: KVSet[]
    clientChanges?: KVSet[]
    echo?: boolean // default false
}
// change notification - asynchronous
export interface ChangeNotif {
    roomChanges?: KVSet[]
    // first
    updateClients?: ClientUpdateMap
    // then
    removeClients?: string[]
    // finally
    addClients?: ClientMap
}
// arbitrary (service-defined) action request
export interface ActionReq {
    type: MESSAGE_TYPE.ACTION_REQ
    action: string
    data?: string
    id?: string
}
// action response
export interface ActionResp {
    type: MESSAGE_TYPE.ACTION_RESP
    id?: string
    success: boolean
    data?: string
    msg?: string
}
export interface CloseReq {
    type: MESSAGE_TYPE.CLOSE_REQ
    msg?: string
    flush?: boolean // default false
}
export interface CloseResp {
    type: MESSAGE_TYPE.CLOSE_RESP
}
export interface KVStore {
    [key:string] : string
}
export interface ClientInfo {
    clientType?: string
    clientName?: string
    clientState: KVStore
}
export interface ClientMap {
    [id:string] : ClientInfo
}
export interface KVSet {
    key: string
    value?: string
}
export interface ClientUpdateMap {
    [clientid:string] : KVSet[]
}

export function validateHelloReq(m:any) : HelloReq {
    if (typeof(m)!=='object' 
    || typeof(m.protocol)!=='string' 
    || typeof(m.roomProtocol)!=='string' 
    || typeof(m.roomId)!=='string' 
    || (m.roomCredential && typeof(m.roomCredential)!=='string')
    || (m.clientCredential && typeof(m.clientCredential)!=='string')
    || (m.clientType && typeof(m.clientType)!=='string')
    || (m.clientName && typeof(m.clientName)!=='string')
    || (m.readonly!==null && m.readonly!==undefined && typeof(m.readonly)!=='boolean')
    ) {
        throw new Error(`Invalid HelloReq`)
    }
    return {
        protocol: m.protocol,
        roomProtocol: m.roomProtocol,
        roomId: m.roomId,
        roomCredential: m.roomCredential,
        clientCredential: m.clientCredential,
        clientType: m.clientType,
        clientName: m.clientName,
        clientState: validateKVStore(m.clientState),
        readonly: m.readonly,
    }
}
export function validateKVStore(m:any): KVStore {
    if (typeof(m) !== 'object') {
        throw new Error(`Invalid KVStore (type)`)
    }
    for (const key in m) {
        const value = m[key]
        if (typeof(key)!=='string') {
            throw new Error(`Invalid KVStore (key)`)
        }
        if (typeof(value)!=='string') {
            throw new Error(`Invalid KVStore (value)`)
        }
    }
    return m as KVStore
}
export function validateChangeReq(m:any) : ChangeReq {
    if (typeof(m) !== 'object'
    || typeof(m.type) !== 'number' || m.type !== MESSAGE_TYPE.CHANGE_REQ
    || (m.echo !== null && m.echo !== undefined && typeof(m.echo) !== 'boolean')
    ){ 
        throw new Error('Invalid ChangeReq')
    }
    return {
        type: MESSAGE_TYPE.CHANGE_REQ,
        echo: m.echo,
        roomChanges: m.roomChanges ? validateKVSets(m.roomChanges) : undefined,
        clientChanges: m.roomChanges ? validateKVSets(m.clientChanges) : undefined,
    }
}
export function validateKVSets(m:any) : KVSet[] {
    if (!Array.isArray(m)) {
        throw new Error('Invalid KVSets (object)')
    }
    let v : KVSet[] = []
    for (const el of m) {
        const s = el as KVSet
        if (typeof(s.key)!=='string' 
        || (s.value && typeof(s.value)!=='string')
        ){
            throw new Error('Invalid KVSets (entry)')
        }
        v.push({key:s.key, value:s.value})
    }
    return v
}
export function validateActionReq(m:any) : ActionReq {
    if (typeof(m) !== 'object'
    || typeof(m.type) !== 'number' || m.type !== MESSAGE_TYPE.ACTION_REQ
    || typeof(m.action) !== 'string'
    || (m.id && typeof(m.id)!=='string')
    || (m.data && typeof(m.data)!=='string')
    ){ 
        throw new Error('Invalid ActionReq')
    }
    return {
        type: MESSAGE_TYPE.ACTION_REQ,
        action: m.action,
        id: m.id,
        data: m.data,
    }
}
export function validateCloseReq(m:any) : CloseReq {
    if (typeof(m) !== 'object'
    || typeof(m.type) !== 'number' || m.type !== MESSAGE_TYPE.CLOSE_REQ
    || (m.flush!==null && m.flush!==undefined && typeof(m.flush)!=='boolean')
    || (m.msg && typeof(m.msg) !== 'string')
    ){ 
        throw new Error('Invalid CloseReq')
    }
    return {
        type: MESSAGE_TYPE.CLOSE_REQ,
        flush: m.flush,
        msg: m.msg,
    }
}
