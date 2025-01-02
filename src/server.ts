import {WebSocketServer} from 'ws';
import {EventEmitter} from 'events';
import * as http from 'http';

const path = '/wss'
export class WSS {
    wss = new WebSocketServer({ noServer:true, path });
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
            });

            ws.send('something');
        });
    }
}
export const wss = new WSS()

