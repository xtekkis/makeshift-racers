let socket;
let mySessionId;

function connectToServer(playerName) {
  socket = new WebSocket("ws://localhost:3000");

  socket.onopen = () => {
    console.log("Connected to server!");
    socket.send(JSON.stringify({ type: "join", name: playerName }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "init") {
      mySessionId = data.sessionId;
      console.log("My session ID:", mySessionId);
    }

    if (data.type === "playerNumber") {
      window.myPlayerNumber = data.number;
      console.log("My player number:", data.number);
    }

    if (data.type === "players") {
      window.furthestX = data.furthestX || 0;
      window.leaderX = data.leaderX || 0;
      window.leaderY = data.leaderY || 3600;
      window.leaderDirection = data.leaderDirection || 'left';
      updateOtherPlayers(data.players);
    }

    if (data.type === "full") {
      console.log("Room is full!");
    }

    if (data.type === "powerupCollected") {
      if (window.gameScene && window.gameScene.powerUps) {
        window.gameScene.powerUps.removeById(data.id);
      }
    }
  };

  socket.onerror = (error) => {
    console.error("Connection error", error);
  };

  socket.onclose = () => {
    console.log("Disconnected from server");
  };
}

function sendMove(x, y, angle, dead) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "move", x, y, angle, dead }));
  }
}

function updateOtherPlayers(players) {
  window.lastPlayers = players;
  if (window.updatePlayers) {
    window.updatePlayers(players, mySessionId);
  }
}

function sendPowerupCollected(id) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "collectPowerup", id: id }));
  }
}