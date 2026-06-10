const WebSocket = require("ws");

const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

wss.on("connection", (ws) => {
  const sessionId = Math.random().toString(36).substring(2, 9);
  ws.sessionId = sessionId;

  console.log(sessionId, "connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      rooms[sessionId] = {
        x: 175,
        y: 360,
        angle: 0,
        name: data.name || "Player"
      };
      console.log(sessionId, "joined as", data.name);
      broadcast({ type: "players", players: rooms });
    }

    if (data.type === "move") {
      if (rooms[sessionId]) {
        rooms[sessionId].x = data.x;
        rooms[sessionId].y = data.y;
        rooms[sessionId].angle = data.angle;
        broadcast({ type: "players", players: rooms });
      }
    }
  });

  ws.on("close", () => {
    console.log(sessionId, "disconnected");
    delete rooms[sessionId];
    broadcast({ type: "players", players: rooms });
  });
});

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

console.log(`Game server running on port ${PORT}`);