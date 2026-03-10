import Echo from "laravel-echo";
import Pusher from "pusher-js";

window.Pusher = Pusher;

interface ReverbConfig {
    key: string;
    host: string;
    port: number;
    scheme: string;
}

export function createEcho(config: ReverbConfig): Echo<"reverb"> {
    return new Echo({
        broadcaster: "reverb",
        key: config.key,
        wsHost: config.host,
        wsPort: config.port ?? 8080,
        wssPort: config.port ?? 443,
        forceTLS: (config.scheme ?? "https") === "https",
        enabledTransports: ["ws", "wss"],
    });
}
