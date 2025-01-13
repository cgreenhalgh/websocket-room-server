// from default node adapter server, https://github.com/sveltejs/kit/blob/main/packages/adapter-node/src/index.js
// without LISTEN_FDS support
//import { handler } from '../build/handler.js';
//import { env } from '../build/env.js';
import polka from 'polka';
import { MESSAGE_TYPE, type ActionReq,type ActionResp, type HelloReq, type KVStore, type KVSet, WSS, wss, type ChangeReq, type RoomInfo, type RoomClientInfo, type SSWebSocket } from '@cgreenhalgh/websocket-room-server'
import serveStatic from 'serve-static'
import {serialize} from 'cookie'

export const path = false
export const host = process.env['HOST'] ?? '0.0.0.0';
export const port = process.env['PORT'] ?? '3003';

const app = polka() //.use(handler);
const serve = serveStatic('static', { index: 'index.html' })
app.use(serve)
app.get('/test', (req, res) => {
    res.setHeader(
        "Set-Cookie",
        serialize("name", 'example', {
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 7, // 1 week
        }),
      );
    res.end('Hello world!');
});

const { server } = app.listen({ path, host, port }, () => {
    console.log(`Listening on ${path || `http://${host}:${port}`}`);
});
// add my websockets to HTTP server
wss.addWebsockets(server)

const MYPROTOCOL = "cardographer:1"

// example handlers for testing/validation
wss.onHelloReq = async function (wss: WSS, req: HelloReq, clientId: string, sws: SSWebSocket) : Promise<{ clientState: KVStore, readonly: boolean } > {
    console.log(`on hello for ${clientId} in room ${req.roomId} with protocol ${req.roomProtocol}`)
    console.log(`- cookies`, sws.cookies)
    if (req.roomProtocol !== MYPROTOCOL) {
        throw new Error(`wrong room protocol (${req.roomProtocol} vs ${MYPROTOCOL})`)
    }
    // TODO...?
    return {
        clientState: req.clientState,
        readonly: !!req.readonly,
    }
}
wss.onChangeReq = async function(wss:WSS, req:ChangeReq, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) : Promise< { roomChanges?: KVSet[], clientChanges?: KVSet[], echo?: boolean } > {
    console.log(`vet room changes ${JSON.stringify(req.roomChanges)} & client changes ${JSON.stringify(req.clientChanges)} for ${clientId}`)
    // TODO...?
    return {
        roomChanges: req.roomChanges,
        clientChanges: req.clientChanges,
        echo: !!req.echo,
    }
}
wss.onActionReq = async function(wss:WSS, req:ActionReq, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) : Promise< ActionResp > {
    console.log(`Action ${req.action}(${req.data}) by ${clientId}`)
    if (req.action == 'test') {
        return {
            type: MESSAGE_TYPE.ACTION_RESP,
            id: req.id,
            success: true,
            data: req.data,
            // msg: 'error...'
        }
    }
}


export { app };
