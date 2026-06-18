let socket;
let mySessionId;

function connectToServer(playerName) {
  socket = window.gameSocket;
  mySessionId = window.lobbySessionId;

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "init") {
      mySessionId = data.sessionId;
      window.lobbySessionId = mySessionId;
    }

    if (data.type === "playerNumber") {
      window.myPlayerNumber = data.number;
      const PLAYER_COLORS = [0xe8c14a, 0x4a8fe8, 0x4ae87a, 0xe84a4a, 0x9b4ae8, 0xe8874a, 0xe84a9b, 0x4ae8e8];
      const startPositions = [
        { x: 1900, y: 3566 },
        { x: 2000, y: 3632 },
        { x: 2100, y: 3566 },
        { x: 2200, y: 3632 }
      ];
      const pos = startPositions[data.number];
      if (window.gameScene) {
        window.gameScene.playerBody.x = pos.x;
        window.gameScene.playerBody.y = pos.y;
        player.x = pos.x;
        player.y = pos.y;
        player.setFillStyle(PLAYER_COLORS[window.playerColorIndex !== null ? window.playerColorIndex : data.number]);
      }
      window.playerPositioned = true;
    }

    if (data.type === "players") {
      window.furthestX = data.furthestX || 0;
      if (data.leaderHasMoved) {
        window.leaderX = data.leaderX || window.leaderX;
        window.leaderY = data.leaderY || window.leaderY;
        window.leaderDirection = data.leaderDirection || 'left';
      }
      updateOtherPlayers(data.players);
    }

    if (data.type === "full") { console.log("Room is full!"); }
    if (data.type === "bumped") { window.incomingBump = { vx: data.vx, vy: data.vy }; }
    if (data.type === "respawn") { window.incomingRespawn = { x: data.x, y: data.y, angle: data.angle }; }
    if (data.type === "powerupCollected") {
      if (window.gameScene && window.gameScene.powerUps) {
        window.gameScene.powerUps.removeById(data.id);
      }
    }
  };

  socket.send(JSON.stringify({ type: "join", name: playerName }));
}

function sendMove(x, y, angle, dead) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "move", x, y, angle, dead }));
  }
}

function updateOtherPlayers(players) {
  window.lastPlayers = players;
  if (window.updatePlayers) { window.updatePlayers(players, mySessionId); }
}

function sendPowerupCollected(id) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "collectPowerup", id: id }));
  }
}

function sendBump(targetSessionId, vx, vy) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "bump", target: targetSessionId, vx, vy }));
  }
}