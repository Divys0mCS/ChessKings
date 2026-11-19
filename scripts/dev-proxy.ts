import http from "node:http";
import net from "node:net";

/**
 * In development the browser talks to one origin (:3000). This tiny proxy
 * forwards regular HTTP to the Next.js dev server and upgrades for
 * /socket.io/* to the standalone Socket.IO process. Production is expected to
 * use a real reverse proxy with the same routing.
 */

const PORT = Number(process.env.PROXY_PORT ?? 3000);
const WEB_PORT = Number(process.env.WEB_PORT ?? 3001);
const SOCKET_PORT = Number(process.env.SOCKET_PORT ?? 4001);
const HOST = "127.0.0.1";

function targetPort(url: string): number {
  return url.startsWith("/socket.io") ? SOCKET_PORT : WEB_PORT;
}

const server = http.createServer((req, res) => {
  const port = targetPort(req.url ?? "/");
  const upstream = http.request(
    {
      host: HOST,
      port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: req.headers.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
    }
    res.end(`Dev proxy could not reach :${port} (${error.message})`);
  });

  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const port = targetPort(req.url ?? "/");
  const upstream = net.connect(port, HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] http://0.0.0.0:${PORT} -> next :${WEB_PORT}, socket.io :${SOCKET_PORT}`);
});
