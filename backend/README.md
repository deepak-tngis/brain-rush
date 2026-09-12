# Brain Rush backend

A deliberately minimal NestJS service exposing a single endpoint.

```
GET /health  ->  200  {"status":"ok"}
```

**The game does not depend on this service.** Brain Rush generates every puzzle
on the device and stores all progress in AsyncStorage, so it plays fully offline;
only adverts ever touch the network. This service exists so a deployment has
something to health-check, and as a place to hang future server-side work.

## Running

```bash
npm install
npm run start:dev        # watch mode on http://localhost:3000
npm run build && npm run start:prod
```

`PORT` overrides the listening port (default 3000).

## Tests

```bash
npm test
```
