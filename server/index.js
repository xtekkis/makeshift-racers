const WebSocket = require("ws");
const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT });
const rooms = {};

const CHECKPOINTS = [
  { x: 600, y: 2600 },
  { x: 1100, y: 2400 },
  { x: 2200, y: 2000 },
  { x: 3000, y: 2000 },
  { x: 3400, y: 2800 },
];

const TRACK_PATH = [
  { x: 2000, y: 3600 },
  { x: 600,  y: 3600 },
  { x: 600,  y: 1600 },
  { x: 1600, y: 1600 },
  { x: 1600, y: 2400 },
  { x: 900,  y: 2400 },
  { x: 900,  y: 3000 },
  { x: 2200, y: 3000 },
  { x: 2200, y: 1600 },
  { x: 2600, y: 1600 },
  { x: 2600, y: 3000 },
  { x: 3000, y: 3000 },
  { x: 3000, y: 1600 },
  { x: 3400, y: 1600 },
  { x: 3400, y: 3600 },
  { x: 2000, y: 3600 },
];

const startPositions = [
  { x: 1900, y: 3600 },
  { x: 1970, y: 3600 },
  { x: 1900, y: 3670 },
  { x: 1970, y: 3670 }
];

let playerCount = 0;
let cameraX = 0;

function getTrackDistance(x, y, path) {
  let totalLength = 0;
  let bestDist = Infinity;
  let bestProgress = 0;
  let bestSegment = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1,
      ((x - a.x) * dx + (y - a.y) * dy) / (segLen * segLen)
    ));
    const closestX = a.x + t * dx;
    const closestY = a.y + t * dy;
    const dist = Math.hypot(x - closestX, y - closestY);

    if (dist < bestDist) {
      bestDist = dist;
      bestProgress = totalLength + t * segLen;
      bestSegment = i;
    }
    totalLength += segLen;
  }

  return { progress: bestProgress, segment: bestSegment };
}

function getSegmentDirection(segment, path) {
  const a = path[segment];
  const b = path[segment + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

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
        playerNumber: playerNumber,
        currentCheckpoint: 0,
        trackDistance: 0,
        trackSegment: 0
      };
      console.log(sessionId, "joined as", data.name);
      ws.send(JSON.stringify({ type: "playerNumber", number: playerNumber }));
      broadcast({
        type: "players",
        players: rooms,
        furthestX: cameraX,
        leaderX: pos.x,
        leaderY: pos.y,
        leaderDirection: 'left'
      });
    }

    if (data.type === "move") {
      if (rooms[sessionId]) {
        const player = rooms[sessionId];
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;

        const trackData = getTrackDistance(data.x, data.y, TRACK_PATH);
        player.trackDistance = trackData.progress;
        player.trackSegment = trackData.segment;

        const nextCp = CHECKPOINTS[player.currentCheckpoint];
        if (nextCp) {
          const dist = Math.hypot(data.x - nextCp.x, data.y - nextCp.y);
          if (dist < 150) {
            player.currentCheckpoint++;
            console.log(sessionId, "passed checkpoint", player.currentCheckpoint);
          }
        }

        let leaderId = null;
        let maxDistance = -1;
        Object.entries(rooms).forEach(([id, p]) => {
          const d = p.trackDistance || 0;
          if (d > maxDistance) {
            maxDistance = d;
            leaderId = id;
          }
        });

        const leader = rooms[leaderId];
        let furthestX = 0;
        Object.values(rooms).forEach((p) => { if (p.x > furthestX) furthestX = p.x; });
        if (furthestX > cameraX) cameraX = furthestX;

        const leaderDirection = leader
          ? getSegmentDirection(leader.trackSegment, TRACK_PATH)
          : 'left';

        broadcast({
          type: "players",
          players: rooms,
          furthestX: cameraX,
          leaderX: leader ? leader.x : 1900,
          leaderY: leader ? leader.y : 3600,
          leaderDirection: leaderDirection
        });
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
    broadcast({ type: "players", players: rooms, furthestX: cameraX, leaderX: 1900, leaderY: 3600, leaderDirection: 'left' });
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