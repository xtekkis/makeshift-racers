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

const CHECKPOINT_ANGLES = [
  -90,
  180,
  -90,
  -90,
  90,
];

function generateSpawns(cx, cy, direction) {
  const offset = 100;
  if (direction === 'up') {
    return [
      { x: cx + 34, y: cy + offset },
      { x: cx - 32, y: cy + offset * 2 },
      { x: cx + 34, y: cy + offset * 3 },
    ];
  } else if (direction === 'down') {
    return [
      { x: cx + 34, y: cy - offset },
      { x: cx - 32, y: cy - offset * 2 },
      { x: cx + 34, y: cy - offset * 3 },
    ];
  } else if (direction === 'left') {
    return [
      { x: cx + offset, y: cy + 34 },
      { x: cx + offset * 2, y: cy - 32 },
      { x: cx + offset * 3, y: cy + 34 },
    ];
  } else {
    return [
      { x: cx - offset, y: cy + 34 },
      { x: cx - offset * 2, y: cy - 32 },
      { x: cx - offset * 3, y: cy + 34 },
    ];
  }
}

const CHECKPOINT_SPAWNS = [
  generateSpawns(600, 2600, 'up'),
  generateSpawns(1100, 2400, 'left'),
  generateSpawns(2200, 2000, 'up'),
  generateSpawns(3000, 2000, 'up'),
  generateSpawns(3400, 2800, 'down'),
];

const TRACK_PATH = [
  { x: 2000, y: 3600 },
  { x: 600, y: 3600 },
  { x: 600, y: 1600 },
  { x: 1600, y: 1600 },
  { x: 1600, y: 2400 },
  { x: 900, y: 2400 },
  { x: 900, y: 3000 },
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
  { x: 1900, y: 3566 },
  { x: 2000, y: 3632 },
  { x: 2100, y: 3566 },
  { x: 2200, y: 3632 }
];

let playerCount = 0;
let cameraX = 0;

const powerupState = {};
for (let i = 0; i < 15; i++) {
  powerupState[i] = { collected: false };
}

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
      const gridBonus = (3 - playerNumber) * 0.5;

      rooms[sessionId] = {
        x: pos.x,
        y: pos.y,
        angle: 0,
        name: data.name || "Player",
        playerNumber: playerNumber,
        currentCheckpoint: 0,
        trackDistance: 0,
        gridBonus: gridBonus,
        trackSegment: 0,
        hasMoved: false,
        dead: false
      };
      console.log(sessionId, "joined as", data.name);
      ws.send(JSON.stringify({ type: "playerNumber", number: playerNumber }));

      const firstAlive = Object.values(rooms).find(p => !p.dead);
      broadcast({
        type: "players",
        players: rooms,
        furthestX: cameraX,
        leaderX: firstAlive ? firstAlive.x : pos.x,
        leaderY: firstAlive ? firstAlive.y : pos.y,
        leaderDirection: 'left'
      });
    }

    if (data.type === "move") {
      if (rooms[sessionId]) {
        const player = rooms[sessionId];
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;
        player.dead = data.dead || false;

        if (!player.dead) {
          const newTrackData = getTrackDistance(data.x, data.y, TRACK_PATH);

          if (!player.hasMoved) {
            const startPos = startPositions[player.playerNumber];
            const distMoved = Math.hypot(data.x - startPos.x, data.y - startPos.y);
            if (distMoved > 200) {
              player.hasMoved = true;
            }
          }

          if (player.hasMoved) {
            player.trackDistance = newTrackData.progress;
            player.trackSegment = newTrackData.segment;
          }

          const nextCp = CHECKPOINTS[player.currentCheckpoint];
          if (nextCp) {
            const dist = Math.hypot(data.x - nextCp.x, data.y - nextCp.y);
            if (dist < 50) {
              const cpIndex = player.currentCheckpoint;
              player.currentCheckpoint++;
              console.log(sessionId, "passed checkpoint", cpIndex);

              const spawns = CHECKPOINT_SPAWNS[cpIndex];
              const angle = CHECKPOINT_ANGLES[cpIndex];
              let spawnIndex = 0;

              Object.entries(rooms).forEach(([id, p]) => {
                if (p.dead && spawnIndex < spawns.length) {
                  const spawn = spawns[spawnIndex];
                  spawnIndex++;
                  wss.clients.forEach((client) => {
                    if (client.sessionId === id && client.readyState === WebSocket.OPEN) {
                      client.send(JSON.stringify({
                        type: "respawn",
                        x: spawn.x,
                        y: spawn.y,
                        angle: angle
                      }));
                    }
                  });
                }
              });
            }
          }
        }

        let leaderId = null;
        let maxDistance = -1;
        Object.entries(rooms).forEach(([id, p]) => {
          if (!p.dead) {
            const d = (p.trackDistance || 0) + (p.gridBonus || 0);
            if (d > maxDistance) {
              maxDistance = d;
              leaderId = id;
            }
          }
        });

        if (!leaderId) {
          leaderId = Object.keys(rooms).find(id => !rooms[id].dead);
        }

        const anyoneMoved = Object.values(rooms).some(p => p.hasMoved);
        if (!anyoneMoved) {
          leaderId = Object.keys(rooms).find(id => rooms[id].playerNumber === 0);
        }

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

    if (data.type === "collectPowerup") {
      if (!powerupState[data.id].collected) {
        powerupState[data.id].collected = true;
        broadcast({ type: "powerupCollected", id: data.id });
        console.log(sessionId, "collected powerup", data.id);
      }
    }

    if (data.type === "bump") {
      wss.clients.forEach((client) => {
        if (client.sessionId === data.target && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "bumped", vx: data.vx, vy: data.vy }));
        }
      });
    }
  });

  ws.on("close", () => {
    console.log(sessionId, "disconnected");
    delete rooms[sessionId];
    if (Object.keys(rooms).length === 0) {
      cameraX = 0;
      playerCount = 0;
      for (let i = 0; i < 15; i++) {
        powerupState[i] = { collected: false };
      }
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