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

let spawnProtection = false;
let spawnProtectionTimer = 0;
const SPAWN_PROTECTION_DURATION = 5000;

let myCoins = 0;
let myHeldItem = null;
let wrenchTimer = 0;
const WRENCH_DURATION = 3000;

const MAX_SPEED = 400;
const MAX_REVERSE = 180;
const ACCEL = 6;
const DECEL_RELEASE = 4;
const DECEL_BRAKE = 24;

function preload() { }

function create() {
  this.track = new Track(this);
  this.indicators = new Indicators(this);
  this.powerUps = new PowerUps(this);

  player = this.add.circle(1900, 3566, 12, 0xe8c14a);
  const PLAYER_COLORS = [0xe8c14a, 0x4a8fe8, 0x4ae87a, 0xe84a4a, 0x9b4ae8, 0xe8874a, 0xe84a9b, 0x4ae8e8];
  if (window.playerColorIndex !== null && window.playerColorIndex !== undefined) {
    player.setFillStyle(PLAYER_COLORS[window.playerColorIndex]);
  }
  this.playerLabel = this.add.text(1900, 3566 - 20, window.playerName || 'Player', {
    fontSize: '16px', fill: '#ffffff'
  }).setDepth(10).setOrigin(0.5);
  player.setDepth(1);

  this.playerBody = this.physics.add.existing(
    this.add.rectangle(1900, 3566, 24, 24, 0x000000, 0)
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
  this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  this.playerAngle = 180;
  this.playerSpeed = 0;

  this.cameras.main.setBounds(0, 0, 6000, 5000);
  this.cameras.main.setZoom(1);
  this.physics.world.setBounds(0, 0, 6000, 5000);

  window.gameScene = this;
  this.otherPlayers = {};

  ['item-hud', 'coin-hud', 'position-hud'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  window.leaderX = 1900;
  window.leaderY = 3566;
  window.leaderDirection = 'left';
  window.playerPositioned = false;
  window.movementLocked = true;
  connectToServer(window.playerName || "Player");
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
  if (spawnProtection) return;

  Object.entries(window.lastPlayers).forEach(([id, p]) => {
    if (p.dead) return;
    if (id === mySessionId) return;
    const dist = Math.hypot(scene.playerBody.x - p.x, scene.playerBody.y - p.y);
    if (dist < 25 && dist > 0 && scene.playerSpeed > 80) {
      const toOther = Math.atan2(p.y - scene.playerBody.y, p.x - scene.playerBody.x);
      const localRad = Phaser.Math.DegToRad(scene.playerAngle);
      if (Math.cos(toOther - localRad) > 0) {
        const angle = Math.atan2(scene.playerBody.y - p.y, scene.playerBody.x - p.x);
        const force = 400;
        bumpVx = Math.cos(angle) * force;
        bumpVy = Math.sin(angle) * force;
        bumpTimer = 500;
        scene.playerSpeed = 0;
        sendBump(id, -Math.cos(angle) * force, -Math.sin(angle) * force);
      }
    }
  });
}

function isOverlappingAnyPlayer(scene) {
  if (!window.lastPlayers) return false;
  return Object.entries(window.lastPlayers).some(([id, p]) => {
    if (id === mySessionId) return false;
    if (p.dead) return false;
    const dist = Math.hypot(scene.playerBody.x - p.x, scene.playerBody.y - p.y);
    return dist < 25;
  });
}

function update(time, delta) {
  const turnSpeed = 1;

  if (window.incomingRespawn) {
    const r = window.incomingRespawn;
    isDead = false;
    deathTimer = 0;
    this.playerBody.x = r.x;
    this.playerBody.y = r.y;
    player.x = r.x;
    player.y = r.y;
    this.playerAngle = r.angle;
    this.playerSpeed = 0;
    player.setAlpha(0.4);
    spawnProtection = true;
    spawnProtectionTimer = SPAWN_PROTECTION_DURATION;
    window.incomingRespawn = null;
    myCoins = 0;
    wrenchTimer = 0;
    updateCoinHUD();
  }

  if (window.incomingBump && !spawnProtection) {
    bumpVx = window.incomingBump.vx;
    bumpVy = window.incomingBump.vy;
    bumpTimer = 500;
    this.playerSpeed = 0;
    window.incomingBump = null;
  } else if (window.incomingBump) {
    window.incomingBump = null;
  }

  if (window.incomingWrench) {
    wrenchTimer = WRENCH_DURATION;
    window.incomingWrench = null;
  }

  // spawn protection timer
  if (spawnProtection) {
    spawnProtectionTimer -= 16;
    if (spawnProtectionTimer <= 0) {
      if (!isOverlappingAnyPlayer(this)) {
        spawnProtection = false;
        player.setAlpha(1);
      } else {
        spawnProtectionTimer = 500;
      }
    }
  }

  if (isDead) {
    deathTimer -= 16;

    const leaderX = window.iAmLeader ? this.playerBody.x : (window.leaderX || this.playerBody.x);
    const leaderY = window.iAmLeader ? this.playerBody.y : (window.leaderY || this.playerBody.y);
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

    if (window.playerPositioned) sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, true);
    this.playerLabel.x = this.playerBody.x;
    this.playerLabel.y = this.playerBody.y - 20;
    return;
  }

  if (bumpTimer > 0) {
    bumpTimer -= 16;
    this.playerBody.x += bumpVx * 0.016;
    this.playerBody.y += bumpVy * 0.016;
    bumpVx *= 0.92;
    bumpVy *= 0.92;

    player.x = this.playerBody.x;
    player.y = this.playerBody.y;

    this.playerLabel.x = this.playerBody.x;
    this.playerLabel.y = this.playerBody.y - 20;

    const leaderX = window.iAmLeader ? this.playerBody.x : (window.leaderX || this.playerBody.x);
    const leaderY = window.iAmLeader ? this.playerBody.y : (window.leaderY || this.playerBody.y);
    const direction = window.leaderDirection || 'left';
    const target = getTargetOffset(direction);
    camOffsetX += (target.x - camOffsetX) * 0.05;
    camOffsetY += (target.y - camOffsetY) * 0.05;
    const scrollX = Math.max(0, Math.min(leaderX - 640 + camOffsetX, 6000 - 1280));
    const scrollY = Math.max(0, Math.min(leaderY - 360 + camOffsetY, 5000 - 720));
    this.cameras.main.setScroll(scrollX, scrollY);

    if (window.playerPositioned) sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, false);
    return;
  }

  if (!spawnProtection) {
    if (this.track.isOffTrack(this.playerBody.x, this.playerBody.y)) {
      isDead = true;
      deathTimer = 2000;
      this.playerSpeed = 0;
      player.setAlpha(0.3);
      console.log("Player died!");
    }
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

  if (isOutOfView && !spawnProtection) {
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

  if (!window.movementLocked) {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && myHeldItem) {
      sendUseItem();
      myHeldItem = null;
      updateItemHUD();
    }

    if (wrenchTimer > 0) wrenchTimer -= delta;
    const baseMax = wrenchTimer > 0 ? MAX_SPEED * 0.3 : MAX_SPEED;
    const currentMaxSpeed = baseMax * (1 + 0.15 * myCoins);
    const currentTurnSpeed = Math.max(0.3, turnSpeed - 0.12 * myCoins);

    if (cursors.left.isDown || this.wasd.left.isDown) {
      this.playerAngle -= currentTurnSpeed;
    } else if (cursors.right.isDown || this.wasd.right.isDown) {
      this.playerAngle += currentTurnSpeed;
    }

    const goingForward = cursors.up.isDown || this.wasd.up.isDown;
    const goingBack = cursors.down.isDown || this.wasd.down.isDown;

    if (goingForward) {
      this.playerSpeed += ACCEL;
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

    if (this.playerSpeed > currentMaxSpeed) this.playerSpeed = currentMaxSpeed;
  }

  const rad = Phaser.Math.DegToRad(this.playerAngle);
  const vx = Math.cos(rad) * this.playerSpeed;
  const vy = Math.sin(rad) * this.playerSpeed;

  this.playerBody.x += vx * (delta / 1000);
  this.playerBody.y += vy * (delta / 1000);

  player.x = this.playerBody.x;
  player.y = this.playerBody.y;

  this.playerLabel.x = this.playerBody.x;
  this.playerLabel.y = this.playerBody.y - 20;

  if (!window.movementLocked) {
    checkCollisions(this);
    this.powerUps.checkCollection(this.playerBody.x, this.playerBody.y);
  }

  if (window.lastPlayers) {
    this.indicators.update(window.lastPlayers, mySessionId);
    const myData = window.lastPlayers[mySessionId];
    if (myData) {
      const myScore = myData.currentCheckpoint * 100000 + (myData.trackDistance || 0);
      const rank = 1 + Object.values(window.lastPlayers).filter(p =>
        (p.currentCheckpoint * 100000 + (p.trackDistance || 0)) > myScore
      ).length;
      const posEl = document.getElementById('position-display');
      if (posEl) posEl.textContent = ['1st', '2nd', '3rd', '4th'][rank - 1] || rank + 'th';
    }
  }

  if (window.playerPositioned && !window.movementLocked) sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, isDead);
}

function updatePlayers(players, myId) {
  const scene = window.gameScene;

  if (!scene) return;

  Object.keys(players).forEach((id) => {
    if (id === myId) return;
    const p = players[id];

    if (p.dead) {
      if (scene.otherPlayers[id]) {
        scene.otherPlayers[id].setVisible(false);
        if (scene.otherPlayerLabels && scene.otherPlayerLabels[id]) {
          scene.otherPlayerLabels[id].setVisible(false);
        }
      }
      return;
    }

    if (!scene.otherPlayers[id]) {
      const PLAYER_COLORS = [0xe8c14a, 0x4a8fe8, 0x4ae87a, 0xe84a4a, 0x9b4ae8, 0xe8874a, 0xe84a9b, 0x4ae8e8];
      const color = PLAYER_COLORS[p.colorIndex !== undefined ? p.colorIndex : p.playerNumber] || 0x4a8fe8;
      scene.otherPlayers[id] = scene.add.circle(p.x, p.y, 12, color);
      scene.otherPlayers[id].setDepth(1);
      if (!scene.otherPlayerLabels) scene.otherPlayerLabels = {};
      if (!scene.otherPlayerLabels[id]) {
        scene.otherPlayerLabels[id] = scene.add.text(p.x, p.y - 20, p.name, {
          fontSize: '16px', fill: '#ffffff'
        }).setDepth(10).setOrigin(0.5);
      }
    } else {
      scene.otherPlayers[id].setVisible(true);
      scene.otherPlayers[id].x = p.x;
      scene.otherPlayers[id].y = p.y;
      if (scene.otherPlayerLabels && scene.otherPlayerLabels[id]) {
        scene.otherPlayerLabels[id].setVisible(true);
        scene.otherPlayerLabels[id].x = p.x;
        scene.otherPlayerLabels[id].y = p.y - 20;
      }
    }
  });

  Object.keys(scene.otherPlayers).forEach((id) => {
    if (!players[id]) {
      scene.otherPlayers[id].destroy();
      delete scene.otherPlayers[id];
    }
  });
  if (scene.otherPlayerLabels) {
    Object.keys(scene.otherPlayerLabels).forEach((id) => {
      if (!players[id]) {
        scene.otherPlayerLabels[id].destroy();
        delete scene.otherPlayerLabels[id];
      }
    });
  }
}

window.updatePlayers = updatePlayers;

function updateCoinHUD() {
  const el = document.getElementById('coin-count');
  if (el) el.textContent = myCoins;
}

function updateItemHUD() {
  const el = document.getElementById('item-icon');
  if (el) {
    if (myHeldItem === 'coin') el.textContent = 'COIN';
    else if (myHeldItem === 'wrench') el.textContent = 'WRENCH';
    else el.textContent = '';
  }
}

window.setCoins = (n) => { myCoins = n; updateCoinHUD(); };
window.setHeldItem = (item) => { myHeldItem = item; updateItemHUD(); };