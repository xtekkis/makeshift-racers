const { Room } = require("colyseus");

class RaceRoom extends Room {
  onCreate(options) {
    console.log("Race room created!");
    this.maxClients = 4;

    this.setState({
      players: {}
    });

    this.onMessage("move", (client, data) => {
      const player = this.state.players[client.sessionId];
      if (player) {
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;
      }
    });
  }

  onJoin(client, options) {
    console.log(client.sessionId, "joined!");
    this.state.players[client.sessionId] = {
      x: 400,
      y: 300,
      angle: 0,
      score: 0,
      name: options.name || "Player"
    };
  }

  onLeave(client) {
    console.log(client.sessionId, "left!");
    delete this.state.players[client.sessionId];
  }

  onDispose() {
    console.log("Room disposed!");
  }
}

module.exports = RaceRoom;