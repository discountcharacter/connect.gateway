# connect.gateway

WebSocket + HTTP gateway for teetor.calls devices. Relays signaling and file uploads to the Recorder Service.

## Setup

```bash
npm install
cp .env .env.local   # adjust if needed
node src/index.js
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| WS | `/ws/recorder` | X-Api-Key + X-Device-Phone | Device WebSocket |
| POST | `/upload` | X-Api-Key + X-Device-Phone | Multipart file upload proxy |
| GET | `/health` | none | Service health |
| GET | `/fleet` | X-Service-Token | Connected device list |
| POST | `/push/:phone` | X-Service-Token | Push message to device |

## Environment

See `.env` for all configurable values.
