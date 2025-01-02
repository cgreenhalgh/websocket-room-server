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
- [ ] server creates (or admits) rooms.
- [ ] clients must provide room-specific authentication.
- [ ] clients may provide client-specific authentication, visible to server callbacks.
- [ ] once authenticated, client messages are visible to server as events.
- [ ] server can send messages to a single room client or all room clients.
- [ ] server can close a room (ejecting all clients).
- [ ] server can eject a single client.
- [ ] client connections time out (clients can ping).


## Build & publish

For npm/node dev env:
```
sudo docker build . --tag nodedev
sudo docker run --rm -it -v $(pwd):/app:consistent nodedev /bin/sh 
```
In that container:
```
npm login
npm run build
npm publish --access public
```

## Usage

```
import { wss } from '@cgreenhalgh/websocket-room-server'

// create http server
...

wss.addWebsockets(httpServer)
```
Note, path is "/wss" 
(to avoid conflict with e.g. vite dev websockets)
