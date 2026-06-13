const WebSocket = require("ws");
const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT });
const rooms = {};
const startPositions = [
  { x: 1900, y: 3600 },
  { x: 1970, y: 3600 },
  { x: 1900, y: 3670 },
  { x: 1970, y: 3670 }
];
let playerCount = 0;
let cameraX = 0;

wss.on("connection", (ws) => {
  const sessionId = Math.random().toString(36).substring(2, 9);
  ws.sessionId = sessionId;
  ws.send(JSON.stringify({ type: "init", sessionId: sessionId }));
  console.log(sessionId, "connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      if (Object.keys(rooms).length >= 4) {
        ws.send(JSON.stringify({ type: "full" }));
        ws.close();
        return;
      }
      const pos = startPositions[playerCount % 4];
      const playerNumber = playerCount % 4;
      playerCount++;
      rooms[sessionId] = {
        x: pos.x,
        y: pos.y,
        angle: 0,
        name: data.name || "Player",
        playerNumber: playerNumber
      };
      console.log(sessionId, "joined as", data.name);
      ws.send(JSON.stringify({ type: "playerNumber", number: playerNumber }));
      broadcast({ type: "players", players: rooms, furthestX: cameraX });
    }

    if (data.type === "move") {
      if (rooms[sessionId]) {
        rooms[sessionId].x = data.x;
        rooms[sessionId].y = data.y;
        rooms[sessionId].angle = data.angle;
        let furthestX = 0;
        Object.values(rooms).forEach((p) => { if (p.x > furthestX) furthestX = p.x; });
        if (furthestX > cameraX) cameraX = furthestX;
        broadcast({ type: "players", players: rooms, furthestX: cameraX });
      }
    }
  });

  ws.on("close", () => {
    console.log(sessionId, "disconnected");
    delete rooms[sessionId];
    if (Object.keys(rooms).length === 0) {
      cameraX = 0;
      playerCount = 0;
      console.log("All players left, resetting game state");
    }
    broadcast({ type: "players", players: rooms, furthestX: cameraX });
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