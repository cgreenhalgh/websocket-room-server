import {WebSocketServer} from 'ws';
import {EventEmitter} from 'events';
import * as http from 'http';
import { ActionReq, ActionResp, ChangeReq, ClientInfo, HelloReq, KVSet, KVStore } from './messages';

export enum CLIENT_STATUS {
    WAITING_FOR_HELLO,
    PROCESSING_HELLO,
    ACTIVE,
    FLUSHING,
    CLOSED,
}
export interface RoomClientInfo extends ClientInfo {
    ws: WebSocket
    readonly: boolean
}
interface SocketState {
    status: CLIENT_STATUS
    lastEvent: Date
    roomId?: string
    clientId?: string
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
export type CheckHelloReq = (wss:WSS, req:HelloReq, clientId:string) => Promise< { clientState: KVStore, readonly: boolean } >
export type HandleActionReq = (wss:WSS, req:ActionReq, room:RoomInfo, client:RoomClientInfo) => Promise< ActionResp >
export type CheckChangeReq = (wss:WSS, req:ChangeReq, room:RoomInfo, client:RoomClientInfo) => Promise< { roomChanges?: KVSet[], clientChanges?: KVSet[], echo?: boolean } >

const path = '/wss'
export class WSS {
    wss = new WebSocketServer({ noServer:true, path });
    rooms: RoomMap = {}
    onHelloReq?: CheckHelloReq
    onActionReq?: HandleActionReq
    onChangeReq?: CheckChangeReq

    WSS() {
    } 

    addWebsockets (httpServer:http.Server) : void {
        const _this = this
        console.log(`Set up websockets on ${path}...`)
        httpServer.on('upgrade', (req, socket, head) => {
            if (this.wss.shouldHandle(req)) {
                this.wss.handleUpgrade(req, socket, head, function done(ws) {
                    ((_this.wss as unknown) as EventEmitter).emit('connection', ws, req);
                });
            }
        })
        // TODO proper websocket setup
        this.wss.on('connection', function connection(ws) {
            console.log(`Connected websocket`);
            ws.on('error', console.error);

            ws.on('message', function message(data) {
                console.log('received: %s', data);
                // E.g. echo
                ws.send(data);
            });
            ws.on('close', function close() {
                console.log('closed websocket');
            });

        });
    }
}
export const wss = new WSS()

