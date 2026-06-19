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
let expectedPlayers = 0;
let playersJoined = 0;
let checkpointArrivalCounts = [0, 0, 0, 0, 0];
let roundActive = false;

const powerupState = {};
const lobbySlots = [null, null, null, null];
let lobbyPlayerMap = {};

for (let i = 0; i < 15; i++) {
  powerupState[i] = { collected: false };
}

function getTrackDistance(x, y, path, hintSegment) {
  let totalLength = 0;
  let bestDist = Infinity;
  let bestProgress = 0;
  let bestSegment = 0;
  const numSegments = path.length - 1;

  for (let i = 0; i < numSegments; i++) {
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

    // Penalise segments far from the player's known race position so the
    // loop's last straight (which passes near the start grid) can't steal
    // the match from the correct early-race segments.
    let effectiveDist = dist;
    if (hintSegment !== undefined) {
      let segDiff = i - hintSegment;
      // Only allow a forward lap-wrap (e.g. seg 14→0) when the hint is
      // itself near the very end of the track. Never wrap backward.
      if (hintSegment >= numSegments - 3 && i <= 2) {
        segDiff = i + (numSegments - hintSegment);
      }
      if (segDiff < -1 || segDiff > 5) {
        effectiveDist += Math.abs(segDiff) * 1000;
      }
    }

    if (effectiveDist < bestDist) {
      bestDist = effectiveDist;
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
  ws.gameStarted = false;
  ws.send(JSON.stringify({ type: "init", sessionId: sessionId }));
  console.log(sessionId, "connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "lobbyJoin") {
      const slotIndex = lobbySlots.findIndex(s => s === null);
      if (slotIndex === -1) {
        ws.send(JSON.stringify({ type: "lobbyFull" }));
        ws.close();
        return;
      }
      lobbySlots[slotIndex] = { name: "Player " + (slotIndex + 1), color: null, ready: false };
      lobbyPlayerMap[sessionId] = slotIndex;
      broadcastLobby();
    }

    if (data.type === "lobbyUpdate") {
      const slotIndex = lobbyPlayerMap[sessionId];
      if (slotIndex !== undefined && lobbySlots[slotIndex]) {
        lobbySlots[slotIndex].name = data.name || ("Player " + (slotIndex + 1));
        lobbySlots[slotIndex].color = data.color;
        lobbySlots[slotIndex].ready = data.ready;
        broadcastLobby();

        const connected = lobbySlots.filter(s => s);
        if (connected.length >= 2 && connected.every(s => s.ready)) {
          startGame();
        }
      }
    }

    if (data.type === "join") {
      if (Object.keys(rooms).length >= 4) {
        ws.send(JSON.stringify({ type: "full" }));
        ws.close();
        return;
      }
      const slotIndex = lobbyPlayerMap[sessionId];
      const lobbyData = lobbySlots[slotIndex];
      const playerNumber = slotIndex !== undefined ? slotIndex : playerCount % 4;
      const pos = startPositions[playerNumber];
      playerCount++;
      const gridBonus = (3 - playerNumber) * 0.5;

      const startTrackData = getTrackDistance(pos.x, pos.y, TRACK_PATH, 0);
      rooms[sessionId] = {
        x: pos.x,
        y: pos.y,
        angle: 0,
        name: lobbyData ? lobbyData.name : (data.name || "Player"),
        colorIndex: lobbyData ? lobbyData.color : playerNumber,
        playerNumber: playerNumber,
        currentCheckpoint: 0,
        trackDistance: startTrackData.progress,
        gridBonus: gridBonus,
        trackSegment: startTrackData.segment,
        hasMoved: true,
        dead: false,
        totalScore: 0,
        roundScore: 0,
        roundCheckpointScores: [0, 0, 0, 0, 0],
        readyForNext: false
      };
      console.log(sessionId, "joined as", rooms[sessionId].name);
      ws.send(JSON.stringify({ type: "playerNumber", number: playerNumber }));

      playersJoined++;
      if (expectedPlayers > 0 && playersJoined === expectedPlayers) {
        startCountdown();
      }

      let currentLeaderId = null;
      let maxD = -Infinity;
      Object.entries(rooms).forEach(([id, p]) => {
        const d = (p.trackDistance || 0) + (p.gridBonus || 0);
        if (d > maxD) {
          maxD = d;
          currentLeaderId = id;
        }
      });

      const currentLeader = rooms[currentLeaderId];
      broadcast({
        type: "players",
        players: rooms,
        furthestX: cameraX,
        leaderHasMoved: true,
        leaderX: currentLeader ? currentLeader.x : pos.x,
        leaderY: currentLeader ? currentLeader.y : pos.y,
        leaderDirection: getSegmentDirection(currentLeader ? currentLeader.trackSegment : 0, TRACK_PATH)
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
          const newTrackData = getTrackDistance(data.x, data.y, TRACK_PATH, player.trackSegment);
          player.trackDistance = newTrackData.progress;
          player.trackSegment = newTrackData.segment;

          const nextCp = CHECKPOINTS[player.currentCheckpoint];
          if (nextCp) {
            const dist = Math.hypot(data.x - nextCp.x, data.y - nextCp.y);
            if (dist < 50) {
              const cpIndex = player.currentCheckpoint;
              player.currentCheckpoint++;
              console.log(sessionId, "passed checkpoint", cpIndex);

              if (roundActive) {
                const CHECKPOINT_POINTS = [10, 7, 5, 3];
                const pts = CHECKPOINT_POINTS[checkpointArrivalCounts[cpIndex]] ?? 0;
                checkpointArrivalCounts[cpIndex]++;
                player.roundCheckpointScores[cpIndex] = pts;
                player.roundScore += pts;
                console.log(sessionId, "earned", pts, "points at checkpoint", cpIndex);

                if (cpIndex === CHECKPOINTS.length - 1) {
                  endRound();
                }
              }

              const spawns = CHECKPOINT_SPAWNS[cpIndex];
              const angle = CHECKPOINT_ANGLES[cpIndex];
              let spawnIndex = 0;

              Object.entries(rooms).forEach(([id, p]) => {
                if (id !== sessionId && (p.dead || p.currentCheckpoint < cpIndex) && spawnIndex < spawns.length) {
                  const spawn = spawns[spawnIndex];
                  spawnIndex++;
                  if (cpIndex > p.currentCheckpoint) {
                    p.currentCheckpoint = cpIndex;
                  }
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

        if (roundActive && Object.keys(rooms).length > 0) {
          const allDead = Object.values(rooms).every(p => p.dead);
          if (allDead) {
            roundActive = false;
            broadcast({ type: "allDead" });
            setTimeout(() => resetRoundState(true), 2500);
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
          leaderHasMoved: true,
          leaderX: leader ? leader.x : 1900,
          leaderY: leader ? leader.y : 3566,
          leaderDirection: leaderDirection
        });
      }
    }

    if (data.type === "readyForNextRound") {
      if (rooms[sessionId]) {
        rooms[sessionId].readyForNext = true;
        const total = Object.keys(rooms).length;
        const ready = Object.values(rooms).filter(p => p.readyForNext).length;
        broadcast({ type: "roundReadyUpdate", ready, total });
        if (ready === total) resetRoundState(true);
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
    const slotIndex = lobbyPlayerMap[sessionId];
    if (slotIndex !== undefined) {
      lobbySlots[slotIndex] = null;
      delete lobbyPlayerMap[sessionId];
      broadcastLobby();
    }
    delete rooms[sessionId];
    if (Object.keys(rooms).length === 0) {
      cameraX = 0;
      playerCount = 0;
      checkpointArrivalCounts = [0, 0, 0, 0, 0];
      roundActive = false;
      for (let i = 0; i < 15; i++) {
        powerupState[i] = { collected: false };
      }
      console.log("All players left, resetting game state");
    }
    broadcast({ type: "players", players: rooms, furthestX: cameraX, leaderX: 1900, leaderY: 3600, leaderDirection: 'left' });
  });
});

function broadcastLobby() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "lobbyState", slots: lobbySlots }));
    }
  });
}

function startGame() {
  playerCount = 0;
  expectedPlayers = lobbySlots.filter(s => s !== null).length;
  playersJoined = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "gameStart" }));
    }
  });
}

function startCountdown() {
  let count = 3;
  broadcast({ type: "countdown", count });
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      broadcast({ type: "countdown", count });
    } else {
      broadcast({ type: "go" });
      roundActive = true;
      clearInterval(interval);
    }
  }, 1000);
}

function endRound() {
  if (!roundActive) return;
  roundActive = false;
  Object.values(rooms).forEach(p => { p.totalScore += p.roundScore; });
  const winnerEntry = Object.entries(rooms).find(([, p]) => p.totalScore >= 250);
  broadcast({
    type: "roundEnd",
    players: rooms,
    winnerId: winnerEntry ? winnerEntry[0] : null
  });
}

function resetRoundState(startNew) {
  checkpointArrivalCounts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 15; i++) powerupState[i] = { collected: false };
  broadcast({ type: "powerupsReset" });
  Object.entries(rooms).forEach(([id, p]) => {
    p.currentCheckpoint = 0;
    p.roundScore = 0;
    p.roundCheckpointScores = [0, 0, 0, 0, 0];
    p.readyForNext = false;
    p.dead = false;
    const pos = startPositions[p.playerNumber];
    const td = getTrackDistance(pos.x, pos.y, TRACK_PATH, 0);
    p.x = pos.x;
    p.y = pos.y;
    p.trackDistance = td.progress;
    p.trackSegment = td.segment;
    wss.clients.forEach(client => {
      if (client.sessionId === id && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "respawn", x: pos.x, y: pos.y, angle: 180 }));
      }
    });
  });
  if (startNew) startCountdown();
}

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

console.log(`Game server running on port ${PORT}`);