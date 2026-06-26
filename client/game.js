const _isMobile = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches;
const GAME_W = _isMobile ? Math.max(window.screen.width, window.screen.height) : 1280;
const GAME_H = _isMobile ? Math.min(window.screen.width, window.screen.height) : 720;
let vpHalfW = GAME_W / 2;
let vpHalfH = GAME_H / 2;
let vpW = GAME_W;
let vpH = GAME_H;

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
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
const BUMP_DURATION = 500;
const BUMP_FORCE = 400;
const BUMP_DECAY = 0.92;

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
const DEATH_DURATION = 2000;
const COLLISION_MIN_SPEED = 80;
const CAM_LERP = 0.05;
const FRAME_MS = 1000 / 60;
const NUM_CAR_VARIANTS = 8;

const VEHICLE_STATS = {
  f1:    { turnSpeed: 1.0, scaleX: 0.1,  scaleY: 0.1,  accel: 6, angleOffset: -90, hitL: 15, hitW: 8  },
  car:   { turnSpeed: 2.5, scaleX: 0.44, scaleY: 0.32, accel: 6, angleOffset:  90, hitL: 25, hitW: 20 },
  truck: { turnSpeed: 2.5, scaleX: 0.75, scaleY: 0.4,  accel: 3, angleOffset:  90, hitL: 40, hitW: 30 },
};

function obbOverlap(ax, ay, aAngle, aHitL, aHitW, bx, by, bHitL, bHitW) {
  const dx = bx - ax;
  const dy = by - ay;
  const rad = -aAngle * Math.PI / 180;
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(localX) < aHitL + bHitL && Math.abs(localY) < aHitW + bHitW;
}

function getVehicleTexKey(vType, carIndex, turning) {
  if (vType === 'truck') return 'truck_0';
  if (turning) return vType + '_' + carIndex + turning;
  return vType + '_' + carIndex;
}

function preload() {
  for (let i = 0; i < NUM_CAR_VARIANTS; i++) {
    this.load.image('f1_' + i,           'assets/f1_' + i + '.png');
    this.load.image('f1_' + i + '_left', 'assets/f1_' + i + '_left.png');
    this.load.image('f1_' + i + '_right','assets/f1_' + i + '_right.png');
    this.load.image('car_' + i,          'assets/car_' + i + '.png');
  }
  this.load.image('truck_0', 'assets/truck_0.png');
}

function create() {
  this.track = new Track(this);
  this.indicators = new Indicators(this);
  this.powerUps = new PowerUps(this);

  const vType = window.vehicleType || 'f1';
  const createStats = VEHICLE_STATS[vType];
  this.carIndex = (window.playerColorIndex !== null && window.playerColorIndex !== undefined)
    ? window.playerColorIndex : 0;
  player = this.add.image(1900, 3566, getVehicleTexKey(vType, this.carIndex));
  player.setScale(createStats.scaleX, createStats.scaleY);
  player.setAngle(180 + createStats.angleOffset);
  player.setDepth(1);
  this.playerLabel = this.add.text(1900, 3566 - 20, window.playerName || 'Player', {
    fontSize: '16px', fill: '#ffffff'
  }).setDepth(10).setOrigin(0.5);

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
  const CAM_ZOOM = _isMobile ? 0.6 : 1;
  this.cameras.main.setZoom(CAM_ZOOM);
  vpHalfW = GAME_W / (2 * CAM_ZOOM);
  vpHalfH = GAME_H / (2 * CAM_ZOOM);
  vpW = GAME_W / CAM_ZOOM;
  vpH = GAME_H / CAM_ZOOM;
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

  const myStats = VEHICLE_STATS[window.vehicleType || 'f1'];

  Object.entries(window.lastPlayers).forEach(([id, p]) => {
    if (p.dead) return;
    if (id === mySessionId) return;
    if (scene.playerSpeed <= COLLISION_MIN_SPEED) return;
    const theirStats = VEHICLE_STATS[p.vehicleType || 'f1'] || VEHICLE_STATS.f1;
    if (!obbOverlap(scene.playerBody.x, scene.playerBody.y, scene.playerAngle, myStats.hitL, myStats.hitW,
                    p.x, p.y, theirStats.hitL, theirStats.hitW)) return;
    const toOther = Math.atan2(p.y - scene.playerBody.y, p.x - scene.playerBody.x);
    const localRad = Phaser.Math.DegToRad(scene.playerAngle);
    if (Math.cos(toOther - localRad) > 0) {
      const angle = Math.atan2(scene.playerBody.y - p.y, scene.playerBody.x - p.x);
      bumpVx = Math.cos(angle) * BUMP_FORCE;
      bumpVy = Math.sin(angle) * BUMP_FORCE;
      bumpTimer = BUMP_DURATION;
      scene.playerSpeed = 0;
      sendBump(id, -Math.cos(angle) * BUMP_FORCE, -Math.sin(angle) * BUMP_FORCE);
    }
  });
}

function isOverlappingAnyPlayer(scene) {
  if (!window.lastPlayers) return false;
  const myStats = VEHICLE_STATS[window.vehicleType || 'f1'];
  return Object.entries(window.lastPlayers).some(([id, p]) => {
    if (id === mySessionId) return false;
    if (p.dead) return false;
    const theirStats = VEHICLE_STATS[p.vehicleType || 'f1'] || VEHICLE_STATS.f1;
    return obbOverlap(scene.playerBody.x, scene.playerBody.y, scene.playerAngle, myStats.hitL, myStats.hitW,
                      p.x, p.y, theirStats.hitL, theirStats.hitW);
  });
}

function update(time, delta) {
  const vType = window.vehicleType || 'f1';
  const { turnSpeed, angleOffset, accel } = VEHICLE_STATS[vType];

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
    player.setTexture(getVehicleTexKey(vType, this.carIndex));
    player.setAngle(this.playerAngle + angleOffset);
    player.setAlpha(0.4);
    spawnProtection = true;
    spawnProtectionTimer = SPAWN_PROTECTION_DURATION;
    window.incomingRespawn = null;
    myCoins = 0;
    wrenchTimer = 0;
    window.iFinished = false;
    updateCoinHUD();
  }

  if (window.incomingBump && !spawnProtection) {
    bumpVx = window.incomingBump.vx;
    bumpVy = window.incomingBump.vy;
    bumpTimer = BUMP_DURATION;
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
    spawnProtectionTimer -= delta;
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
    deathTimer -= delta;

    const leaderX = window.iAmLeader ? this.playerBody.x : (window.leaderX || this.playerBody.x);
    const leaderY = window.iAmLeader ? this.playerBody.y : (window.leaderY || this.playerBody.y);
    const direction = window.leaderDirection || 'left';
    const target = getTargetOffset(direction);
    camOffsetX += (target.x - camOffsetX) * CAM_LERP;
    camOffsetY += (target.y - camOffsetY) * CAM_LERP;
    const scrollX = Math.max(0, Math.min(leaderX - vpHalfW + camOffsetX, 6000 - vpW));
    const scrollY = Math.max(0, Math.min(leaderY - vpHalfH + camOffsetY, 5000 - vpH));
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
    bumpTimer -= delta;
    this.playerBody.x += bumpVx * (delta / 1000);
    this.playerBody.y += bumpVy * (delta / 1000);
    bumpVx *= Math.pow(BUMP_DECAY, delta / FRAME_MS);
    bumpVy *= Math.pow(BUMP_DECAY, delta / FRAME_MS);

    player.x = this.playerBody.x;
    player.y = this.playerBody.y;
    player.setAngle(this.playerAngle + angleOffset);

    this.playerLabel.x = this.playerBody.x;
    this.playerLabel.y = this.playerBody.y - 20;

    const leaderX = window.iAmLeader ? this.playerBody.x : (window.leaderX || this.playerBody.x);
    const leaderY = window.iAmLeader ? this.playerBody.y : (window.leaderY || this.playerBody.y);
    const direction = window.leaderDirection || 'left';
    const target = getTargetOffset(direction);
    camOffsetX += (target.x - camOffsetX) * CAM_LERP;
    camOffsetY += (target.y - camOffsetY) * CAM_LERP;
    const scrollX = Math.max(0, Math.min(leaderX - vpHalfW + camOffsetX, 6000 - vpW));
    const scrollY = Math.max(0, Math.min(leaderY - vpHalfH + camOffsetY, 5000 - vpH));
    this.cameras.main.setScroll(scrollX, scrollY);

    if (window.playerPositioned) sendMove(this.playerBody.x, this.playerBody.y, this.playerAngle, false);
    return;
  }

  if (this.track.isOffTrack(this.playerBody.x, this.playerBody.y)) {
    isDead = true;
    deathTimer = DEATH_DURATION;
    this.playerSpeed = 0;
    player.setAlpha(0.3);
    console.log("Player died!");
  }

  const leaderX = window.iAmLeader ? this.playerBody.x : (window.leaderX || this.playerBody.x);
  const leaderY = window.iAmLeader ? this.playerBody.y : (window.leaderY || this.playerBody.y);
  const direction = window.leaderDirection || 'left';

  const target = getTargetOffset(direction);
  camOffsetX += (target.x - camOffsetX) * 0.05;
  camOffsetY += (target.y - camOffsetY) * 0.05;

  const scrollX = Math.max(0, Math.min(leaderX - vpHalfW + camOffsetX, 6000 - vpW));
  const scrollY = Math.max(0, Math.min(leaderY - vpHalfH + camOffsetY, 5000 - vpH));
  this.cameras.main.setScroll(scrollX, scrollY);

  const isOutOfView =
    this.playerBody.x < scrollX - margin ||
    this.playerBody.x > scrollX + vpW + margin ||
    this.playerBody.y < scrollY - margin ||
    this.playerBody.y > scrollY + vpH + margin;

  if (isOutOfView && !spawnProtection) {
    outOfBoundsTimer += delta;
    if (outOfBoundsTimer >= OUT_OF_BOUNDS_LIMIT) {
      isDead = true;
      deathTimer = DEATH_DURATION;
      outOfBoundsTimer = 0;
      this.playerSpeed = 0;
      player.setAlpha(0.3);
      console.log("Player out of bounds!");
    }
  } else {
    outOfBoundsTimer = 0;
  }

  if (!window.movementLocked) {
    const dt = delta / FRAME_MS;
    if (!window.iFinished) {
      const useItemPressed = Phaser.Input.Keyboard.JustDown(this.spaceKey) || window.mobileItemPressed;
      window.mobileItemPressed = false;
      if (useItemPressed && myHeldItem) {
        sendUseItem();
        myHeldItem = null;
        updateItemHUD();
      }

      if (wrenchTimer > 0) wrenchTimer -= delta;
      const baseMax = wrenchTimer > 0 ? MAX_SPEED * 0.3 : MAX_SPEED;
      const currentMaxSpeed = baseMax * (1 + 0.15 * myCoins);
      const currentTurnSpeed = Math.max(0.3, turnSpeed - 0.12 * myCoins) * (delta / FRAME_MS);

      const dpad = window.dpad || { left: false, right: false, up: false, down: false };
      const goingLeft = cursors.left.isDown || this.wasd.left.isDown || dpad.left;
      const goingRight = cursors.right.isDown || this.wasd.right.isDown || dpad.right;
      const goingForward = cursors.up.isDown || this.wasd.up.isDown || dpad.up;
      const goingBack = cursors.down.isDown || this.wasd.down.isDown || dpad.down;

      if (goingLeft) {
        this.playerAngle -= currentTurnSpeed;
      } else if (goingRight) {
        this.playerAngle += currentTurnSpeed;
      }

      if (goingForward) {
        this.playerSpeed += accel * dt;
      } else if (goingBack) {
        if (this.playerSpeed > 0) {
          this.playerSpeed -= DECEL_BRAKE * dt;
          if (this.playerSpeed < 0) this.playerSpeed = 0;
        } else {
          this.playerSpeed -= accel * dt;
          if (this.playerSpeed < -MAX_REVERSE) this.playerSpeed = -MAX_REVERSE;
        }
      } else {
        if (this.playerSpeed > 0) {
          this.playerSpeed -= DECEL_RELEASE * dt;
          if (this.playerSpeed < 0) this.playerSpeed = 0;
        } else if (this.playerSpeed < 0) {
          this.playerSpeed += DECEL_RELEASE * dt;
          if (this.playerSpeed > 0) this.playerSpeed = 0;
        }
      }

      if (this.playerSpeed > currentMaxSpeed) this.playerSpeed = currentMaxSpeed;
    } else {
      // Crossed finish — coast to a stop, no input
      if (this.playerSpeed > 0) {
        this.playerSpeed -= DECEL_RELEASE * dt;
        if (this.playerSpeed < 0) this.playerSpeed = 0;
      }
    }
  }

  const rad = Phaser.Math.DegToRad(this.playerAngle);
  const vx = Math.cos(rad) * this.playerSpeed;
  const vy = Math.sin(rad) * this.playerSpeed;

  this.playerBody.x += vx * (delta / 1000);
  this.playerBody.y += vy * (delta / 1000);

  player.x = this.playerBody.x;
  player.y = this.playerBody.y;
  let turning = '';
  if (vType === 'f1' && !window.movementLocked) {
    const _dpad = window.dpad || { left: false, right: false };
    if (cursors.left.isDown || this.wasd.left.isDown || _dpad.left) turning = '_left';
    else if (cursors.right.isDown || this.wasd.right.isDown || _dpad.right) turning = '_right';
  }
  player.setTexture(getVehicleTexKey(vType, this.carIndex, turning));
  player.setAngle(this.playerAngle + angleOffset);

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
      const pVType = p.vehicleType || 'f1';
      const pStats = VEHICLE_STATS[pVType] || VEHICLE_STATS.f1;
      const idx = Math.min(p.colorIndex !== undefined ? p.colorIndex : (p.playerNumber || 0), NUM_CAR_VARIANTS - 1);
      scene.otherPlayers[id] = scene.add.image(p.x, p.y, getVehicleTexKey(pVType, idx));
      scene.otherPlayers[id].setScale(pStats.scaleX, pStats.scaleY);
      scene.otherPlayers[id].setAngle((p.angle || 0) + pStats.angleOffset);
      scene.otherPlayers[id].setDepth(1);
      if (!scene.otherPlayerLabels) scene.otherPlayerLabels = {};
      if (!scene.otherPlayerLabels[id]) {
        scene.otherPlayerLabels[id] = scene.add.text(p.x, p.y - 20, p.name, {
          fontSize: '16px', fill: '#ffffff'
        }).setDepth(10).setOrigin(0.5);
      }
    } else {
      const pVType = p.vehicleType || 'f1';
      const pStats = VEHICLE_STATS[pVType] || VEHICLE_STATS.f1;
      scene.otherPlayers[id].setVisible(true);
      scene.otherPlayers[id].x = p.x;
      scene.otherPlayers[id].y = p.y;
      scene.otherPlayers[id].setAngle((p.angle || 0) + pStats.angleOffset);
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