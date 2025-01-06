# test/dev server

Test server for websocket-room-server with trivial pure javascript client.
Using polka.

Inside test/dev container...
```
(cd testserver; npm install)
```
For linked development...
```
npm link ..
```
```
npm run clean; npm run build; (cd testserver; npm run build)
(cd testserver; node build)
```
open localhost:3003
