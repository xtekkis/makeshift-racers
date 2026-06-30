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
      if (!window.playerName) {
        window.playerName = 'Player ' + (data.number + 1);
        if (window.gameScene && window.gameScene.playerLabel) {
          window.gameScene.playerLabel.setText(window.playerName);
        }
      }
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
        const idx = window.playerColorIndex !== null ? window.playerColorIndex : data.number;
        window.gameScene.carIndex = idx;
        player.setTexture('f1_' + idx);
      }
      window.playerPositioned = true;
    }

    if (data.type === "players") {
      window.furthestX = data.furthestX || 0;
      if (data.leaderHasMoved) {
        window.leaderX = data.leaderX || window.leaderX;
        window.leaderY = data.leaderY || window.leaderY;
        window.leaderDirection = data.leaderDirection || 'left';
        const alive = Object.entries(data.players).filter(([,p]) => !p.dead);
        const sorted = alive.sort(([,a],[,b]) => b.currentCheckpoint !== a.currentCheckpoint ? b.currentCheckpoint - a.currentCheckpoint : b.trackDistance - a.trackDistance);
        window.iAmLeader = sorted.length > 0 && sorted[0][0] === mySessionId;
      }
      const myPlayer = data.players[mySessionId];
      if (myPlayer) window.myRoundScore = myPlayer.roundScore || 0;
      updateOtherPlayers(data.players);
    }

    if (data.type === "countdown") {
      hideScoreboard();
      window.movementLocked = true;
      const overlay = document.getElementById('countdown-overlay');
      const text = document.getElementById('countdown-text');
      if (overlay && text) {
        overlay.style.display = 'flex';
        text.style.color = 'white';
        text.style.fontSize = '140px';
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
      }
    }

    if (data.type === "youFinished") {
      window.iFinished = true;
    }

    if (data.type === "roundEnd") {
      window.iFinished = true;
      window.movementLocked = true;
      window.roundEndData = data;
      showScoreboard(data);
    }

    if (data.type === "roundReadyUpdate") {
      const statusEl = document.getElementById('ready-status');
      if (statusEl) statusEl.textContent = data.ready + ' / ' + data.total + ' ready';
    }

    if (data.type === "placementStart") {
      hideScoreboard();
      if (window.enterPlacementPhase) window.enterPlacementPhase(data.timeLimit, data.menuItems);
    }

    if (data.type === "placementEnd") {
      if (window.exitPlacementPhase) window.exitPlacementPhase();
    }

    if (data.type === "powerupsReset") {
      if (window.gameScene && window.gameScene.powerUps) {
        window.gameScene.powerUps.reset();
      }
    }

    if (data.type === "full") { console.log("Room is full!"); }
    if (data.type === "bumped") { window.incomingBump = { vx: data.vx, vy: data.vy }; }
    if (data.type === "respawn") { window.incomingRespawn = { x: data.x, y: data.y, angle: data.angle }; }
    if (data.type === "itemAssigned") { if (window.setHeldItem) window.setHeldItem(data.item); }
    if (data.type === "coinUpdate") { if (window.setCoins) window.setCoins(data.coins); }
    if (data.type === "wrenchHit") { window.incomingWrench = true; }
    if (data.type === "shieldBroken") { if (window.setHeldItem) window.setHeldItem(null); }
    if (data.type === "powerupCollected") {
      if (window.gameScene && window.gameScene.powerUps) {
        window.gameScene.powerUps.removeById(data.id);
      }
    }
  };

  socket.send(JSON.stringify({ type: "join", name: playerName, vehicleType: window.vehicleType || 'f1' }));
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

function sendUseItem() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "useItem" }));
  }
}

function sendPlaceObstacle(obstacleType, x, y, rotation) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "placeObstacle", obstacleType, x, y, rotation }));
  }
}