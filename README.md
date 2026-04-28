# TarChat + TarServer

`TarChat` is a Tauri desktop client with a Telegram-inspired layout. `TarServer` is a Go backend that serves chat data from sqlite, stores uploads in a local media directory, and pushes realtime updates over WebSocket.

## Run

Start the Go backend first:

```bash
cd /Users/zhangjiahui/TarServer
go run ./cmd/tarserver
```

Or from the workspace root:

```bash
npm run server
```

Then start the client:

```bash
npm run dev
```

For the desktop shell:

```bash
npm run tauri dev
```

## Notes

- TarServer listens on `http://127.0.0.1:9090` by default.
- Chat state is stored in `/Users/zhangjiahui/TarServer/data/tarchat.db`.
- Uploaded files and images are stored in `/Users/zhangjiahui/TarServer/data/media`.
- Seeded demo login: `jiahui` / `tar123456`.
- You can also register new users from the client.
