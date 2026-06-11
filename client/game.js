const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let isDead = false;
let deathTimer = 0;
const RESPAWN_X = 150;
const RESPAWN_Y = 400;

function preload() { }

function create() {
  this.track = new Track(this);

  player = this.physics.add.image(175, 360, null);
  player = this.add.circle(175, 360, 12, 0xe8c14a);
  player.setDepth(1);

  this.playerBody = this.physics.add.existing(
    this.add.rectangle(175, 360, 24, 24, 0x000000, 0)
  );
  this.playerBody.body.setCollideWorldBounds(true);
  this.playerBody.body.setMaxVelocity(200, 200);

  cursors = this.input.keyboard.createCursorKeys();
  this.wasd = {
    up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };

  this.playerAngle = -90;
  this.playerSpeed = 0;

  this.cameras.main.setBounds(0, 0, 1280, 720);
  this.cameras.main.startFollow(this.playerBody, true, 0.1, 0.1);
  this.cameras.main.setZoom(1);

  window.gameScene = this;
  this.otherPlayers = {};
  connectToServer("Player1");
}

function update() {
  const speed = 180;
  const turnSpeed = 3;

  if (isDead) {
    deathTimer -= 16;
    if (deathTimer <= 0) {
      isDead = false;
      this.playerBody.x = RESPAWN_X;
      this.playerBody.y = RESPAWN_Y;
      player.x = RESPAWN_X;
      player.y = RESPAWN_Y;
      player.setAlpha(1);
    }
    return;
  }

  if (this.track.isOffTrack(this.playerBody.x, this.playerBody.y)) {
    isDead = true;
    deathTimer = 2000;
    this.playerSpeed = 0;
    player.setAlpha(0.3);
    console.log("Player died!");
  }

  if (cursors.left.isDown || this.wasd.left.isDown) {
    this.playerAngle -= turnSpeed;
  } else if (cursors.right.isDown || this.wasd.right.isDown) {
    this.playerAngle += turnSpeed;
  }

  if (cursors.up.isDown || this.wasd.up.isDown) {
    this.playerSpeed = speed;
  } else if (cursors.down.isDown || this.wasd.down.isDown) {
    this.playerSpeed = -speed / 2;
  } else {
    this.playerSpeed *= 0.95;
  }

  const rad = Phaser.Math.DegToRad(this.playerAngle);
  const vx = Math.cos(rad) * this.playerSpeed;
  const vy = Math.sin(rad) * this.playerSpeed;

  this.playerBody.x += vx * 0.016;
  this.playerBody.y += vy * 0.016;

  player.x = this.playerBody.x;
  player.y = this.playerBody.y;

  this.cameras.main.setFollowOffset(
    -(this.playerBody.x - 640),
    -(this.playerBody.y - 360)
  );

  sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle);
}

function updatePlayers(players, myId) {
  const scene = window.gameScene;
  if (!scene) return;

  if (myId && players[myId] && !scene.positionSet) {
    scene.playerBody.x = players[myId].x;
    scene.playerBody.y = players[myId].y;
    player.x = players[myId].x;
    player.y = players[myId].y;
    scene.positionSet = true;
  }

  Object.keys(players).forEach((id) => {
    if (id === myId) return;
    const p = players[id];
    if (!scene.otherPlayers[id]) {
      scene.otherPlayers[id] = scene.add.circle(p.x, p.y, 12, 0x4a8fe8);
      scene.otherPlayers[id].setDepth(1);
    } else {
      scene.otherPlayers[id].x = p.x;
      scene.otherPlayers[id].y = p.y;
    }
  });

  Object.keys(scene.otherPlayers).forEach((id) => {
    if (!players[id]) {
      scene.otherPlayers[id].destroy();
      delete scene.otherPlayers[id];
    }
  });
}

window.updatePlayers = updatePlayers;