# WebSocket Room Server

Chris Greenhalgh, Copyright (c) The University of Nottingham, 2024

Meant to be a simple room-style messageing server to act as the 
live collaboration backbone for
[cardographer](https://github.com/MixedRealityLab/cardographer-platform).

Split into a separate module package to hopefully make it easier
to integrate in both the vite dev and productions builds of 
cardographer.

Status: websocket server skeleton from ws example

## Requirements

Requirements:
- [x] Run in server only.
- [x] standard websocket interface.
- [x] server creates (or admits) rooms.
- [x] clients must provide room-specific authentication.
- [x] clients may provide client-specific authentication, visible to server callbacks.
- [x] once authenticated, client messages are visible to server as events.
- [x] server can send messages to a single room client or all room clients.
- [ ] server can close a room (ejecting all clients).
- [ ] server can eject a single client.
- [x] client connections time out (clients can ping).


## Design

Notes:
- Each room has some state - KV store.
- Each client has some optional state - KV store.
- Each room has a current set of clients.
- Each room has some actions that the room-specific server logic can perform.
- The room-specific server logic can enforce constraints on clients joining and client state changes.

## Build & publish

For npm/node dev env:
```
sudo docker build . --tag nodedev
sudo docker run --rm -it -v $(pwd):/app:consistent -p 3003:3003 nodedev /bin/sh 
```
(port is just for test server - see [](testserver/))

In that container:
```
npm login
npm run clean
npm run build
npm publish --access public
```

## Server Usage

See also [test server](testserver/src/index.ts).

```
import { wss } from '@cgreenhalgh/websocket-room-server'

// create http server
...

wss.addWebsockets(httpServer)
// check new clients (optional)
wss.onHelloReq = async function (wss: WSS, req: HelloReq, clientId: string) : Promise<{ clientState: KVStore, readonly: boolean } > {
    ...
    return {
        clientState: req.clientState,
        readonly: !!req.readonly,
    }
}
// validate/respond to change (optional)
wss.onChangeReq = async function(wss:WSS, req:ChangeReq, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) : Promise< { roomChanges?: KVSet[], clientChanges?: KVSet[], echo?: boolean } > {
    ...
    return {
        roomChanges: req.roomChanges,
        clientChanges: req.clientChanges,
        echo: !!req.echo,
    }
}
// handle action request (required if used)
wss.onActionReq = async function(wss:WSS, req:ActionReq, room:RoomInfo, clientId:string, clientInfo:RoomClientInfo) : Promise< ActionResp > {
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
```

### Client info

Note, ws path is "/wss" 
(to avoid conflict with e.g. vite dev websockets)

See [trivial example client](testserver/static/index.html).
