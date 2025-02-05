import {WebSocketServer, WebSocket} from 'ws';
import {EventEmitter} from 'events';
import * as http from 'http';
import { ActionReq, ActionResp, ChangeReq, ClientInfo, HelloReq, KVSet, KVStore, validateHelloReq, PROTOCOL, HelloSuccessResp, MESSAGE_TYPE, ClientMap, ChangeNotif, validateChangeReq, ClientUpdateMap, validateActionReq } from './messages';

export enum CLIENT_STATUS {
    WAITING_FOR_HELLO,
    PROCESSING_HELLO,
    ACTIVE,
    CLOSING,
    CLOSED,
}
export interface RoomClientInfo extends ClientInfo {
    ws: WebSocket
    readonly: boolean
}
interface SocketState {
    status: CLIENT_STATUS
    lastEvent: number
    closeTimer?: ReturnType<typeof setTimeout>
    roomId?: string
    clientId?: string
    readonly: boolean
}
export interface SSWebSocket extends WebSocket {
    ss: SocketState
    isAlive: boolean
    cookies?: string
}
export interface RoomClientMap {
    [id:string]: RoomClientInfo
}
export interface RoomInfo {
    id: string
    clients: RoomClientMap
    state: KVStore
}
export interface RoomMap {
    [id:string]: RoomInfo
}
// throw an error to fail :-)
export type CheckHelloReq = (wss:WSS, req:HelloReq, clientId:string, sws:SSWebSocket) => Promise< { clientState: KVStore, readonly: boolean } >
export type HandleActionReq = (wss:WSS, req:ActionReq, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) => Promise< ActionResp >
export type CheckChangeReq = (wss:WSS, req:ChangeReq, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) => Promise< { roomChanges?: KVSet[], clientChanges?: KVSet[], echo?: boolean } >
export type HandleLeave = (wss:WSS, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) => Promise< void >

const HELLO_TIMEOUT_MS = 5000
const HEARTBEAT_INTERVAL_MS = 10000 // 30000
const path = '/wss'
export class WSS {
    wss = new WebSocketServer({ noServer:true, path });
    rooms: RoomMap = {}
    client = 0
    onHelloReq?: CheckHelloReq
    onActionReq?: HandleActionReq
    onChangeReq?: CheckChangeReq
    onLeave?: HandleLeave
    debug:boolean
    
    constructor(debug:boolean = false) {
        let _this = this
        this.debug = debug
        // heartbeat - see https://github.com/websockets/ws?tab=readme-ov-file#how-to-detect-and-close-broken-connections
        const interval = setInterval(function ping() {
            //console.log(`ping...`)
            _this.wss.clients.forEach(function each(ws:SSWebSocket) {
                //console.log(`ping ${ws}`)
                if (ws.isAlive === false) {
                    if (debug) console.log(`timeout websocket ${ws.ss?.clientId}`)
                    return ws.terminate(); // causes close event
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, HEARTBEAT_INTERVAL_MS);
          
        this.wss.on('close', function close() {
            clearInterval(interval);
        });
    } 

    addWebsockets (httpServer:http.Server) : void {
        const _this = this
        if (this.debug) console.log(`Set up websockets on ${path}...`)
        httpServer.on('upgrade', (req, socket, head) => {
            if (this.wss.shouldHandle(req)) {
                this.wss.handleUpgrade(req, socket, head, function done(ws) {
                    ((_this.wss as unknown) as EventEmitter).emit('connection', ws, req);
                });
            }
        })
        // TODO proper websocket setup
        this.wss.on('connection', function connection(ws, req) {
            let clientId = `connection:${++_this.client}`
            const remote = req.headers['x-forwarded-for'] || req.socket.remoteAddress
            const cookieHeader = req.headers['cookie'] 
            if (_this.debug) console.log(`Connected websocket (${clientId} from ${remote})`);
            let sws = ws as SSWebSocket
            sws.cookies = cookieHeader
            
            ws.on('error', function error(event) { 
                console.error(`Error on ${clientId}`, event) 
            });
            ws.on('message', async function message(data) {
                if (_this.debug) console.log(`message from ${clientId}: ${data}`);
                try {
                    if (sws.ss.status == CLIENT_STATUS.WAITING_FOR_HELLO) {
                        sws.ss.status = CLIENT_STATUS.PROCESSING_HELLO
                        let helloReq = validateHelloReq(JSON.parse(String(data)))
                        //console.log(`hello`, helloReq)
                        if (helloReq.protocol != PROTOCOL) {
                            _this.closeSocket(sws, `wrong protocol (${helloReq.protocol} vs ${PROTOCOL}`)
                            return
                        }
                        let { clientState, readonly } = _this.onHelloReq 
                        ? await _this.onHelloReq(wss, helloReq, clientId, sws) 
                        : { clientState: helloReq.clientState, readonly: !!helloReq.readonly }
                        // OK
                        _this.clearTimer(sws)
                        sws.ss.status = CLIENT_STATUS.ACTIVE
                        sws.ss.roomId = helloReq.roomId
                        sws.ss.readonly = readonly
                        // default room setup
                        let room = _this.rooms[sws.ss.roomId]
                        if (!room) {
                            if (_this.debug) console.log(`creating room ${sws.ss.roomId} (default)`)
                            room = {
                                id: sws.ss.roomId,
                                clients: {},
                                state: {},
                            }
                            _this.rooms[sws.ss.roomId] = room
                        }
                        // new client
                        room.clients[clientId] = {
                            ws: sws,
                            readonly: readonly,
                            clientType: helloReq.clientType,
                            clientName: helloReq.clientName,
                            clientState,
                        }
                        let helloResp: HelloSuccessResp = {
                            type: MESSAGE_TYPE.HELLO_SUCCESS_RESP,
                            protocol: PROTOCOL,
                            roomProtocol: helloReq.roomProtocol, // maybe :-)
                            clientId: sws.ss.clientId,
                            clients: _this.getClientMap(room),
                            roomState: room.state,
                            readonly,
                        }
                        ws.send(JSON.stringify(helloResp))
                        if (!readonly) {
                            // announce join
                            let addClients: ClientMap = {}
                            addClients[sws.ss.clientId] = {
                                clientType: helloReq.clientType,
                                clientName: helloReq.clientName,
                                clientState,
                            }
                            _this.broadcastChange(room, {type: MESSAGE_TYPE.CHANGE_NOTIF, addClients }, sws.ss.clientId )
                        }
                    } else if (sws.ss.status == CLIENT_STATUS.PROCESSING_HELLO) {
                        throw new Error(`received message while processing hello`)
                    } else if (sws.ss.status == CLIENT_STATUS.CLOSING || sws.ss.status == CLIENT_STATUS.CLOSED) {
                        if (_this.debug) console.log(`ignore message while closing/closed`)
                    } else if (sws.ss.status == CLIENT_STATUS.ACTIVE) {
                        let msg = JSON.parse(String(data))
                        if (typeof(msg.type) !== 'number') {
                            throw new Error(`message without numerical type (${typeof(msg.type)}`)
                        }
                        let room = _this.rooms[sws.ss.roomId]
                        let clientId = sws.ss.clientId
                        let client = room.clients[clientId]
                        if (msg.type === MESSAGE_TYPE.CHANGE_REQ) {
                            let changeReq = validateChangeReq(msg)
                            let { roomChanges, clientChanges, echo } = _this.onChangeReq 
                            ? await _this.onChangeReq(wss, changeReq, room, clientId, client) 
                            : { roomChanges: changeReq.roomChanges, clientChanges: changeReq.clientChanges, echo: !!changeReq.echo }
                            // room changes
                            if (roomChanges) {
                                if (roomChanges.length > 0 && sws.ss.readonly) {
                                    throw new Error(`readonly client cannot change room state`)
                                }
                                for (let c of roomChanges) {
                                    room.state[c.key] = c.value
                                }
                                if (_this.debug) console.log(`room ${sws.ss.roomId} state`, room.state)
                            }
                            if (clientChanges) {
                                for (let c of clientChanges) {
                                    client.clientState[c.key] = c.value
                                }
                                if (_this.debug) console.log(`client ${sws.ss.clientId} state`, client.clientState)
                            }
                            // notify
                            if (!sws.ss.readonly && (changeReq.clientChanges || changeReq.roomChanges)) {
                                let updateClients: ClientUpdateMap = {}
                                updateClients[clientId] = clientChanges
                                let changeNotif : ChangeNotif = {
                                    type: MESSAGE_TYPE.CHANGE_NOTIF,
                                    roomChanges,
                                    updateClients,
                                }
                                _this.broadcastChange(room, changeNotif, echo ? null : clientId)
                            }
                        } else if (msg.type == MESSAGE_TYPE.ACTION_REQ) {
                            let actionReq = validateActionReq(msg)
                            if (!_this.onActionReq) {
                                throw new Error(`unhandled actions`)
                            }
                            let actionResp = await _this.onActionReq(_this, actionReq, room, clientId, client)
                            ws.send(JSON.stringify(actionResp))
                        } else {
                            throw new Error(`Unhandled message type ${msg.type}`)
                        }
                    }
                } catch (err) {
                    if (_this.debug) console.log(`Error handling message from ${clientId}: ${err.message}`, err)
                    _this.closeSocket(sws, `error: ${err.message}`)
                }
            });
            ws.on('close', function () {
                if (_this.debug) console.log(`close event on ${clientId}`);
                sws.ss.status = CLIENT_STATUS.CLOSED
                _this.tidyUp(sws)
            });
            ws.on('pong', function () { sws.isAlive = true })

            sws.ss = {
                status: CLIENT_STATUS.WAITING_FOR_HELLO,
                closeTimer: setTimeout( () => { _this.timeoutSocket(sws) }, HELLO_TIMEOUT_MS ),
                lastEvent: Date.now(),
                clientId,
                readonly : true,
            }
            sws.isAlive = true
        })
    }
    broadcastChange(room:RoomInfo, changeNotif: ChangeNotif, skipClientId?: string) {
        const data = JSON.stringify(changeNotif)
        for (const clientId in room.clients) {
            if (clientId == skipClientId) {
                continue
            }
            const client = room.clients[clientId]
            client.ws.send(data)
        }
    }
    getClientMap(room: RoomInfo): ClientMap {
        let res:ClientMap = {}
        for (const id in room.clients) {
            const client = room.clients[id]
            if (client.readonly) {
                continue
            }
            res[id] = { 
                clientState: client.clientState,
                clientName: client.clientName,
                clientType: client.clientType,
            }
        }
        return res
    }
    tidyUp(sws: SSWebSocket) {
        this.clearTimer(sws)
        if (sws.ss.roomId && this.rooms[sws.ss.roomId] && sws.ss.clientId && this.rooms[sws.ss.roomId].clients[sws.ss.clientId]) {
            if (this.debug) console.log(`remove client ${sws.ss.clientId} from room ${sws.ss.roomId}`)
            let room = this.rooms[sws.ss.roomId]
            const client = room.clients[sws.ss.clientId]
            delete room.clients[sws.ss.clientId]
            if (!sws.ss.readonly) {
                // broadcast
                let removeClients: string[] = [ sws.ss.clientId ]
                this.broadcastChange(this.rooms[sws.ss.roomId], {type: MESSAGE_TYPE.CHANGE_NOTIF, removeClients })
            }
            if (Object.keys(this.rooms[sws.ss.roomId].clients).length == 0) {
                console.log(`room ${sws.ss.roomId} is now empty`)
            }
            if (this.onLeave) {
                this.onLeave(this, room, sws.ss.clientId, client)
            }
        }
    }
    clearTimer(sws: SSWebSocket) {
        if (sws.ss.closeTimer) {
            clearTimeout(sws.ss.closeTimer)
            sws.ss.closeTimer = null
        }
    }
    timeoutSocket(sws: SSWebSocket) {
        sws.ss.closeTimer = null
        this.closeSocket(sws, 'no hello received in time')
    }
    closeSocket(sws: SSWebSocket, reason: string) {
        if (this.debug) console.log(`close ${sws.ss.clientId} - ${reason}`)
        if (sws.ss.status === CLIENT_STATUS.ACTIVE) {
            sws.ss.status = CLIENT_STATUS.CLOSING
        }
        this.clearTimer(sws)
        sws.ss.closeTimer = null
        sws.close(1002, reason) // protocol error
    }
}
export const wss = new WSS()

