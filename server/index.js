const { Server } = require("colyseus");
const http = require("http");
const RaceRoom = require("./RaceRoom");

const port = 3000;
const app = http.createServer();
const gameServer = new Server({ server: app });

gameServer.define("race", RaceRoom);

gameServer.listen(port).then(() => {
  console.log(`Game server running on port ${port}`);
});