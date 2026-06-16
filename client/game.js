const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { debug: false }
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
let outOfBoundsTimer = 0;
const OUT_OF_BOUNDS_LIMIT = 2000;
const margin = 20;

let camOffsetX = 0;
let camOffsetY = 0;

let bumpTimer = 0;
let bumpVx = 0;
let bumpVy = 0;

const MAX_SPEED = 200;
const MAX_REVERSE = 90;
const ACCEL = 3;
const DECEL_RELEASE = 2;
const DECEL_BRAKE = 12;

const RESPAWN_POSITIONS = [
  { x: 1900, y: 3600, angle: 180 },
  { x: 1970, y: 3600, angle: 180 },
  { x: 1900, y: 3670, angle: 180 },
  { x: 1970, y: 3670, angle: 180 }
];

function preload() { }

function create() {
  this.track = new Track(this);
  this.indicators = new Indicators(this);
  this.powerUps = new PowerUps(this);

  player = this.add.circle(1900, 3600, 12, 0xe8c14a);
  player.setDepth(1);

  this.playerBody = this.physics.add.existing(
    this.add.rectangle(1900, 3600, 24, 24, 0x000000, 0)
  );
  this.playerBody.body.setMaxVelocity(200, 200);
  this.playerBody.body.setCollideWorldBounds(true);

  cursors = this.input.keyboard.createCursorKeys();
  this.wasd = {
    up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };

  this.playerAngle = 180;
  this.playerSpeed = 0;

  this.cameras.main.setBounds(0, 0, 6000, 5000);
  this.cameras.main.setZoom(1);
  this.physics.world.setBounds(0, 0, 6000, 5000);

  window.gameScene = this;
  this.otherPlayers = {};
  connectToServer("Player1");
}

function getTargetOffset(direction) {
  switch (direction) {
    case 'left': return { x: 180, y: 0 };
    case 'right': return { x: -180, y: 0 };
    case 'up': return { x: 0, y: 80 };
    case 'down': return { x: 0, y: -80 };
    default: return { x: 180, y: 0 };
  }
}

function checkCollisions(scene) {
  if (!window.lastPlayers) return;
  if (bumpTimer > 0) return;

  Object.entries(window.lastPlayers).forEach(([id, p]) => {
    if (p.dead) return;
    if (id === mySessionId) return;
    const dist = Math.hypot(scene.playerBody.x - p.x, scene.playerBody.y - p.y);
    if (dist < 25 && dist > 0) {
      const angle = Math.atan2(scene.playerBody.y - p.y, scene.playerBody.x - p.x);
      const force = 400;
      bumpVx = Math.cos(angle) * force;
      bumpVy = Math.sin(angle) * force;
      bumpTimer = 500;
      scene.playerSpeed = 0;
      sendBump(id, -Math.cos(angle) * force, -Math.sin(angle) * force);
    }
  });
}

function update() {
  const turnSpeed = 3;

  if (window.incomingBump) {
    bumpVx = window.incomingBump.vx;
    bumpVy = window.incomingBump.vy;
    bumpTimer = 500;
    this.playerSpeed = 0;
    window.incomingBump = null;
  }

  if (isDead) {
    deathTimer -= 16;

    const leaderX = window.leaderX || this.playerBody.x;
    const leaderY = window.leaderY || this.playerBody.y;
    const direction = window.leaderDirection || 'left';
    const target = getTargetOffset(direction);
    camOffsetX += (target.x - camOffsetX) * 0.05;
    camOffsetY += (target.y - camOffsetY) * 0.05;
    const scrollX = Math.max(0, Math.min(leaderX - 640 + camOffsetX, 6000 - 1280));
    const scrollY = Math.max(0, Math.min(leaderY - 360 + camOffsetY, 5000 - 720));
    this.cameras.main.setScroll(scrollX, scrollY);

    if (window.lastPlayers) {
      this.indicators.update(window.lastPlayers, mySessionId);
    }

    sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, true);
    return;
  }

  // bump timer
  if (bumpTimer > 0) {
    bumpTimer -= 16;
    this.playerBody.x += bumpVx * 0.016;
    this.playerBody.y += bumpVy * 0.016;
    bumpVx *= 0.92;
    bumpVy *= 0.92;

    player.x = this.playerBody.x;
    player.y = this.playerBody.y;

    const leaderX = window.leaderX || this.playerBody.x;
    const leaderY = window.leaderY || this.playerBody.y;
    const direction = window.leaderDirection || 'left';
    const target = getTargetOffset(direction);
    camOffsetX += (target.x - camOffsetX) * 0.05;
    camOffsetY += (target.y - camOffsetY) * 0.05;
    const scrollX = Math.max(0, Math.min(leaderX - 640 + camOffsetX, 6000 - 1280));
    const scrollY = Math.max(0, Math.min(leaderY - 360 + camOffsetY, 5000 - 720));
    this.cameras.main.setScroll(scrollX, scrollY);

    sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, false);
    return;
  }

  if (this.track.isOffTrack(this.playerBody.x, this.playerBody.y)) {
    isDead = true;
    deathTimer = 2000;
    this.playerSpeed = 0;
    player.setAlpha(0.3);
    console.log("Player died!");
  }

  const leaderX = window.leaderX || this.playerBody.x;
  const leaderY = window.leaderY || this.playerBody.y;
  const direction = window.leaderDirection || 'left';

  const target = getTargetOffset(direction);
  camOffsetX += (target.x - camOffsetX) * 0.05;
  camOffsetY += (target.y - camOffsetY) * 0.05;

  const scrollX = Math.max(0, Math.min(leaderX - 640 + camOffsetX, 6000 - 1280));
  const scrollY = Math.max(0, Math.min(leaderY - 360 + camOffsetY, 5000 - 720));
  this.cameras.main.setScroll(scrollX, scrollY);

  const isOutOfView =
    this.playerBody.x < scrollX - margin ||
    this.playerBody.x > scrollX + 1280 + margin ||
    this.playerBody.y < scrollY - margin ||
    this.playerBody.y > scrollY + 720 + margin;

  if (isOutOfView) {
    outOfBoundsTimer += 16;
    if (outOfBoundsTimer >= OUT_OF_BOUNDS_LIMIT) {
      isDead = true;
      deathTimer = 2000;
      outOfBoundsTimer = 0;
      this.playerSpeed = 0;
      player.setAlpha(0.3);
      console.log("Player out of bounds!");
    }
  } else {
    outOfBoundsTimer = 0;
  }

  if (cursors.left.isDown || this.wasd.left.isDown) {
    this.playerAngle -= turnSpeed;
  } else if (cursors.right.isDown || this.wasd.right.isDown) {
    this.playerAngle += turnSpeed;
  }

  const goingForward = cursors.up.isDown || this.wasd.up.isDown;
  const goingBack = cursors.down.isDown || this.wasd.down.isDown;

  if (goingForward) {
    this.playerSpeed += ACCEL;
    if (this.playerSpeed > MAX_SPEED) this.playerSpeed = MAX_SPEED;
  } else if (goingBack) {
    if (this.playerSpeed > 0) {
      this.playerSpeed -= DECEL_BRAKE;
      if (this.playerSpeed < 0) this.playerSpeed = 0;
    } else {
      this.playerSpeed -= ACCEL;
      if (this.playerSpeed < -MAX_REVERSE) this.playerSpeed = -MAX_REVERSE;
    }
  } else {
    if (this.playerSpeed > 0) {
      this.playerSpeed -= DECEL_RELEASE;
      if (this.playerSpeed < 0) this.playerSpeed = 0;
    } else if (this.playerSpeed < 0) {
      this.playerSpeed += DECEL_RELEASE;
      if (this.playerSpeed > 0) this.playerSpeed = 0;
    }
  }

  const rad = Phaser.Math.DegToRad(this.playerAngle);
  const vx = Math.cos(rad) * this.playerSpeed;
  const vy = Math.sin(rad) * this.playerSpeed;

  this.playerBody.x += vx * 0.016;
  this.playerBody.y += vy * 0.016;

  player.x = this.playerBody.x;
  player.y = this.playerBody.y;

  checkCollisions(this);

  this.powerUps.checkCollection(this.playerBody.x, this.playerBody.y);

  if (window.lastPlayers) {
    this.indicators.update(window.lastPlayers, mySessionId);
  }

  sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, false);
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

    if (p.dead) {
      if (scene.otherPlayers[id]) {
        scene.otherPlayers[id].setVisible(false);
      }
      return;
    }

    if (!scene.otherPlayers[id]) {
      scene.otherPlayers[id] = scene.add.circle(p.x, p.y, 12, 0x4a8fe8);
      scene.otherPlayers[id].setDepth(1);
    } else {
      scene.otherPlayers[id].setVisible(true);
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