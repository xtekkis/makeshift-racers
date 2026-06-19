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
      const myPlayer = data.players[mySessionId];
      if (myPlayer) window.myRoundScore = myPlayer.roundScore || 0;
      updateOtherPlayers(data.players);
    }

    if (data.type === "countdown") {
      window.movementLocked = true;
      const overlay = document.getElementById('countdown-overlay');
      const text = document.getElementById('countdown-text');
      if (overlay && text) {
        overlay.style.display = 'flex';
        text.style.color = 'white';
        text.textContent = data.count;
      }
    }

    if (data.type === "go") {
      const overlay = document.getElementById('countdown-overlay');
      const text = document.getElementById('countdown-text');
      if (text) {
        text.style.color = '#4ae87a';
        text.textContent = 'GO!';
      }
      setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
        window.movementLocked = false;
      }, 900);
    }

    if (data.type === "allDead") {
      window.movementLocked = true;
      const overlay = document.getElementById('countdown-overlay');
      const text = document.getElementById('countdown-text');
      if (overlay && text) {
        text.style.color = '#e84a4a';
        text.style.fontSize = '60px';
        text.textContent = 'Everyone wiped out!';
        overlay.style.display = 'flex';
        setTimeout(() => {
          text.style.fontSize = '140px';
          overlay.style.display = 'none';
        }, 2000);
      }
    }

    if (data.type === "roundEnd") {
      window.movementLocked = true;
      window.roundEndData = data;
    }

    if (data.type === "roundReadyUpdate") {
      const statusEl = document.getElementById('ready-status');
      if (statusEl) statusEl.textContent = data.ready + ' / ' + data.total + ' ready';
    }

    if (data.type === "powerupsReset") {
      if (window.gameScene && window.gameScene.powerUps) {
        window.gameScene.powerUps.reset();
      }
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