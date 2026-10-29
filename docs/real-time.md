# Real-time Collaboration

PulseBoard pushes changes to open browsers over WebSockets using [Laravel Reverb](https://reverb.laravel.com) (server) and Laravel Echo with `pusher-js` (browser).

## What users see

- **Live boards and tasks.** When someone else changes a task, moves or reorders cards, comments, or deletes something, open board and task pages refresh the affected data automatically. Your own changes are not echoed back to you.
- **Presence.** Avatars in the board header show who else is viewing the board right now.
- **Live notifications.** New in-app notifications appear in the bell without a reload.
- **Connection status.** If the WebSocket connection drops, the header shows **Reconnecting...** (amber) while it retries, or **Disconnected** (red) when it is unavailable. Nothing is shown while connected. When the connection comes back, the board reloads its data so nothing is missed.
- If a board is deleted while you have it open, you are sent back to the team page.

## Channels

| Channel                             | Type     | Who can join                | Used for                                                          |
| ----------------------------------- | -------- | --------------------------- | ----------------------------------------------------------------- |
| `private-board.{boardId}`           | Private  | Members of the board's team | `board.changed` events (task, comment, column and GitLab updates) |
| `presence-board-presence.{boardId}` | Presence | Members of the board's team | Who is viewing the board (id, name, avatar)                       |
| `private-user.{userId}`             | Private  | That user only              | `notification.created` events                                     |

Authorization rules are in `routes/channels.php`. Events are defined in `app/Events/BoardChanged.php` and `app/Events/NotificationCreated.php`.

## Operator guide

### Processes

Real-time needs three things running:

1. **Reverb** (`php artisan reverb:start`), listening on port **8080** inside the container.
2. A **queue worker** (`php artisan queue:work redis ...`). Broadcast events are queued (`ShouldBroadcast`), so without a worker nothing is pushed.
3. The web app, which authorizes channel subscriptions at `/broadcasting/auth`.

The Docker image runs all three under Supervisor (`docker/supervisord.conf`). For manual deployments, see [Administration](administration.md#scheduler-and-queue).

### Environment variables

| Variable                                                                            | Used by            | Meaning                                                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `BROADCAST_CONNECTION`                                                              | Server             | Must be `reverb`.                                                                                                             |
| `REVERB_APP_ID`                                                                     | Server             | Required. Reverb exits if it is empty.                                                                                        |
| `REVERB_APP_KEY`                                                                    | Server and browser | Public app key. Use a random string in production.                                                                            |
| `REVERB_APP_SECRET`                                                                 | Server             | Signing secret. Use a random string in production.                                                                            |
| `REVERB_HOST`                                                                       | Server and browser | Hostname browsers connect to, for example `ws.board.example.com`.                                                             |
| `REVERB_PORT`                                                                       | Server and browser | Port browsers connect to: `443` behind a TLS proxy, `8080` for direct connections.                                            |
| `REVERB_SCHEME`                                                                     | Server and browser | `https` (uses `wss://`) or `http` (uses `ws://`).                                                                             |
| `REVERB_SERVER_HOST`, `REVERB_SERVER_PORT`                                          | Reverb process     | Bind address of the Reverb server (defaults `0.0.0.0:8080`). The Docker image passes `--host=0.0.0.0 --port=8080` explicitly. |
| `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME`, `VITE_REVERB_APP_KEY` | Browser only       | Optional overrides for the values sent to the browser. If unset, the browser gets the `REVERB_*` values.                      |

The browser configuration is sent with every page (the `reverb` shared prop from `config/reverb.php`), so it is read at runtime. You don't need to rebuild the frontend after changing these variables, but you do need to restart the app (and re-run `php artisan config:cache` if config is cached).

**Server-side publishing.** The app publishes events to Reverb over HTTP at `REVERB_SCHEME://REVERB_HOST:REVERB_PORT` (`config/broadcasting.php`). In other words, the queue worker must be able to reach the same public WebSocket address the browsers use. If the container can't resolve or reach that hostname (common with split-horizon DNS or hairpin NAT), events never arrive. In that case, point `REVERB_*` at an address reachable from the server and use the `VITE_REVERB_*` overrides for the browser.

### Reverse proxy

The recommended setup is a dedicated WebSocket subdomain:

- `board.example.com` → app container port `8000`
- `ws.board.example.com` → app container port `8080`

Then set `REVERB_HOST=ws.board.example.com`, `REVERB_PORT=443`, `REVERB_SCHEME=https`. Your proxy must pass WebSocket upgrades (`Upgrade` and `Connection` headers) to port 8080. The README has a Traefik example. For Nginx, the WebSocket location needs:

```nginx
location / {
    proxy_pass http://app:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
}
```

Keep proxy idle timeouts above Reverb's ping interval (60 seconds by default, `REVERB_APP_PING_INTERVAL`).

### Ports in the Docker Compose files

| File                               | Container port | Host port                             |
| ---------------------------------- | -------------- | ------------------------------------- |
| `docker-compose.yml` (development) | 8080           | `VITE_REVERB_PORT` (default 8080)     |
| `docker-compose.prod.yml`          | 8080           | `REVERB_EXTERNAL_PORT` (default 9080) |

The development compose file works out of the box: it publishes Reverb on host port `VITE_REVERB_PORT` (default `8080`) and tells the browser to connect to `VITE_REVERB_HOST:VITE_REVERB_PORT` over `VITE_REVERB_SCHEME` (defaults `localhost`, `8080`, `http`). Inside the container it sets `REVERB_HOST=localhost`, `REVERB_PORT=8080` and `REVERB_SCHEME=http`, so the app publishes straight to Reverb whatever `REVERB_*` says in `.env` (`.env.example` has production values there: `443` and `https`). To use another host port, for example because 8080 is taken, set `VITE_REVERB_PORT` in `.env` and recreate the container.

In production (`docker-compose.prod.yml`), `REVERB_EXTERNAL_PORT` is only the host port mapping. Browsers use `REVERB_HOST`/`REVERB_PORT` (or the `VITE_REVERB_*` overrides), which usually point at your TLS proxy rather than at this port.

### Troubleshooting

- **"Disconnected" for everyone:** check that Reverb is running, `REVERB_APP_ID` is set, and the proxy forwards upgrades to port 8080.
- **Connected, but no live updates:** check the queue worker is running and that the server can reach `REVERB_HOST:REVERB_PORT`.
- **403 on `/broadcasting/auth`:** the user isn't a member of the board's team, or the session expired.
- Reverb allows connections from any origin (`allowed_origins` is `*` in `config/reverb.php`); channel authorization is what protects the data.
