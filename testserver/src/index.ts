// from default node adapter server, https://github.com/sveltejs/kit/blob/main/packages/adapter-node/src/index.js
// without LISTEN_FDS support
//import { handler } from '../build/handler.js';
//import { env } from '../build/env.js';
import polka from 'polka';
import {HelloReq, KVStore, WSS, wss} from '@cgreenhalgh/websocket-room-server'
import serveStatic from 'serve-static'
import { validateHelloReq } from '../../dist/messages';

export const path = false
export const host = process.env['HOST'] ?? '0.0.0.0';
export const port = process.env['PORT'] ?? '3003';

const app = polka() //.use(handler);
const serve = serveStatic('static', { index: 'index.html' })
app.use(serve)
app.get('/test', (req, res) => {
    res.end('Hello world!');
});

const { server } = app.listen({ path, host, port }, () => {
    console.log(`Listening on ${path || `http://${host}:${port}`}`);
});
// add my websockets to HTTP server
wss.addWebsockets(server)

const MYPROTOCOL = "cardographer:1"

wss.onHelloReq = async function (wss: WSS, req: HelloReq, clientId: string) : Promise<{ clientState: KVStore, readonly: boolean } > {
    console.log(`on hello for ${clientId} in room ${req.roomId} with protocol ${req.roomProtocol}`)
    if (req.roomProtocol !== MYPROTOCOL) {
        throw new Error(`wrong room protocol (${req.roomProtocol} vs ${MYPROTOCOL})`)
    }
    // TODO 
    return {
        clientState: req.clientState,
        readonly: !!req.readonly,
    }
}

export { app };
