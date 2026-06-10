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
    if (data.type === "players") {
      updateOtherPlayers(data.players);
    }
  };

  socket.onerror = (error) => {
    console.error("Connection error", error);
  };

  socket.onclose = () => {
    console.log("Disconnected from server");
  };
}

function sendMove(x, y, angle) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "move", x, y, angle }));
  }
}

function updateOtherPlayers(players) {
  if (window.updatePlayers) {
    window.updatePlayers(players);
  }
}