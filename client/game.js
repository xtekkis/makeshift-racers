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
let placementTimerInterval = null;
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

const ALL_OBSTACLE_TYPES = ['barrel_red', 'barrier_red', 'barrier_white', 'cone', 'rock_small', 'rock_medium', 'rock_large', 'bush_large', 'bush_small'];
const OBSTACLE_SCALES = {
  'barrel_red':    0.35,
  'barrier_red':   0.5,
  'barrier_white': 0.5,
  'cone': 0.3,
  'rock_small':    0.4,
  'rock_medium':   0.5,
  'rock_large':    0.6,
  'bush_large':    0.6,
  'bush_small':    0.45,
};

const VEHICLE_STATS = {
  f1:    { turnSpeed: 2.2, scaleX: 0.1,  scaleY: 0.1,  accel: 6, angleOffset: -90, hitL: 12, hitW: 10, maxSpeed: 450, wrenchMult: 0.30, bumpResist: 1.0 },
  car:   { turnSpeed: 1.8, scaleX: 0.44, scaleY: 0.32, accel: 7, angleOffset:  90, hitL: 28, hitW: 18, maxSpeed: 400, wrenchMult: 0.30, bumpResist: 1.0 },
  truck: { turnSpeed: 2.0, scaleX: 0.75, scaleY: 0.4,  accel: 5, angleOffset:  90, hitL: 40, hitW: 30, maxSpeed: 400, wrenchMult: 0.50, bumpResist: 0.4 },
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
  ALL_OBSTACLE_TYPES.forEach(t => {
    this.load.image(t, 'assets/obstacles/' + t + '.png');
  });
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
  window.inPlacementPhase = false;
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
    case 'left': return { x: 300, y: 0 };
    case 'right': return { x: -300, y: 0 };
    case 'up': return { x: 0, y: 160 };
    case 'down': return { x: 0, y: -160 };
    default: return { x: 300, y: 0 };
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
      bumpVx = Math.cos(angle) * BUMP_FORCE * myStats.bumpResist;
      bumpVy = Math.sin(angle) * BUMP_FORCE * myStats.bumpResist;
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
    myHeldItem = null;
    wrenchTimer = 0;
    window.iFinished = false;
    updateCoinHUD();
    updateItemHUD();
  }

  if (window.inPlacementPhase) {
    if (this._rotateKey && Phaser.Input.Keyboard.JustDown(this._rotateKey)) {
      if (window.rotatePlacementGhost) window.rotatePlacementGhost();
    }
    return;
  }

  if (window.incomingBump && !spawnProtection) {
    const { bumpResist } = VEHICLE_STATS[vType];
    bumpVx = window.incomingBump.vx * bumpResist;
    bumpVy = window.incomingBump.vy * bumpResist;
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
      if (useItemPressed && myHeldItem && myHeldItem !== 'shield') {
        sendUseItem();
        myHeldItem = null;
        updateItemHUD();
      }

      if (wrenchTimer > 0) wrenchTimer -= delta;
      const { maxSpeed: vehicleMaxSpeed, wrenchMult } = VEHICLE_STATS[vType];
      const baseMax = wrenchTimer > 0 ? vehicleMaxSpeed * wrenchMult : vehicleMaxSpeed;
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
    }
  }

  if (window.iFinished) {
    const dt = delta / FRAME_MS;
    if (this.playerSpeed > 0) {
      this.playerSpeed -= DECEL_RELEASE * dt;
      if (this.playerSpeed < 0) this.playerSpeed = 0;
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
  if (window.inPlacementPhase) return;

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
    else if (myHeldItem === 'shield') el.textContent = 'SHIELD';
    else if (myHeldItem === 'hammer') el.textContent = 'HAMMER';
    else el.textContent = '';
  }
}

window.setCoins = (n) => { myCoins = n; updateCoinHUD(); };
window.setHeldItem = (item) => { myHeldItem = item; updateItemHUD(); };

function checkPlacementValid(scene, x, y) {
  if (scene.track.isOffTrack(x, y)) return false;
  // start/finish zone exclusion (radius 450 around finish line center)
  const fdx = x - 1800, fdy = y - 3600;
  if (fdx * fdx + fdy * fdy < 450 * 450) return false;
  // min distance between obstacles
  for (const obs of scene._placedObstacles) {
    const dx = x - obs.x, dy = y - obs.y;
    if (dx * dx + dy * dy < 220 * 220) return false;
  }
  return true;
}

window.enterPlacementPhase = function(timeLimit, menuItems) {
  window.inPlacementPhase = true;
  window.movementLocked = true;

  if (player) player.setVisible(false);
  const scene = window.gameScene;
  if (scene) {
    scene.playerLabel.setVisible(false);
    Object.values(scene.otherPlayers).forEach(s => s.setVisible(false));
    if (scene.otherPlayerLabels) Object.values(scene.otherPlayerLabels).forEach(l => l.setVisible(false));

    const pZoom = Math.min(GAME_W / 3400, GAME_H / 2500);
    const pScrollX = 2000 - GAME_W / 2;
    const pScrollY = 2600 - GAME_H / 2;
    scene.cameras.main.setZoom(pZoom);
    scene.cameras.main.setScroll(pScrollX, pScrollY);
    scene.time.delayedCall(0, () => { scene.cameras.main.setScroll(pScrollX, pScrollY); });

    scene._obstaclePlaced = false;
    scene._selectedObstacleType = null;
    scene._obstacleRotation = 0;
    scene._ghostSprite = null;
    scene._hasConfirmed = false;
    scene._placedObstacles = [];
    scene._placementValid = false;
    scene._otherGhosts = {};
    scene._lastGhostSend = 0;

    scene._domPointerMove = (e) => {
      if (!scene._ghostSprite || scene._obstaclePlaced) return;
      const canvas = scene.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : null);
      const cy = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : null);
      if (cx === null) return;
      const canvasX = (cx - rect.left) * scaleX;
      const canvasY = (cy - rect.top) * scaleY;
      const wp = scene.cameras.main.getWorldPoint(canvasX, canvasY);
      scene._ghostSprite.setPosition(wp.x, wp.y);
      const valid = checkPlacementValid(scene, wp.x, wp.y);
      scene._placementValid = valid;
      scene._ghostSprite.setTint(valid ? 0xffffff : 0xff4444);
      const now = Date.now();
      if (now - scene._lastGhostSend > 80) {
        sendGhostMove(scene._selectedObstacleType, wp.x, wp.y, scene._obstacleRotation || 0);
        scene._lastGhostSend = now;
      }
    };
    scene._domPointerUp = (e) => {
      if (!scene._selectedObstacleType || scene._obstaclePlaced || !scene._ghostSprite) return;
      const menuEl = document.getElementById('placement-menu');
      if (menuEl) {
        const r = menuEl.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
      }
      scene._obstaclePlaced = true;
      const valid = checkPlacementValid(scene, scene._ghostSprite.x, scene._ghostSprite.y);
      scene._placementValid = valid;
      scene._ghostSprite.setTint(valid ? 0xffffff : 0xff4444);
      sendGhostMove(scene._selectedObstacleType, scene._ghostSprite.x, scene._ghostSprite.y, scene._obstacleRotation || 0);
      document.getElementById('obstacle-controls').style.display = 'flex';
      const confirmBtn = document.getElementById('obstacle-confirm');
      if (confirmBtn) confirmBtn.disabled = !valid;
    };
    document.addEventListener('pointermove', scene._domPointerMove);
    document.addEventListener('pointerup', scene._domPointerUp);

    scene._rotateKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  ['item-hud', 'coin-hud', 'position-hud'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const menuEl = document.getElementById('placement-menu');
  if (menuEl && menuItems) {
    menuEl.innerHTML = '';
    menuItems.forEach(type => {
      const item = document.createElement('div');
      item.className = 'obstacle-item';
      item.dataset.type = type;
      const img = document.createElement('img');
      img.src = 'assets/obstacles/' + type + '.png';
      img.alt = type;
      item.appendChild(img);
      item.addEventListener('pointerdown', (e) => { e.preventDefault(); if (window.selectObstacle) window.selectObstacle(type); });
      menuEl.appendChild(item);
    });
    menuEl.style.display = 'flex';
  }
  document.getElementById('obstacle-controls').style.display = 'none';

  const overlay = document.getElementById('placement-overlay');
  const timerEl = document.getElementById('placement-timer');
  if (overlay) overlay.style.display = 'flex';

  let remaining = timeLimit;
  if (timerEl) timerEl.textContent = 'Place your obstacle — ' + remaining;
  placementTimerInterval = setInterval(() => {
    remaining--;
    const s = window.gameScene;
    if (timerEl && !(s && s._hasConfirmed)) timerEl.textContent = 'Place your obstacle — ' + remaining;
    if (remaining <= 0) { clearInterval(placementTimerInterval); placementTimerInterval = null; }
  }, 1000);
};

window.exitPlacementPhase = function() {
  window.inPlacementPhase = false;

  if (placementTimerInterval) { clearInterval(placementTimerInterval); placementTimerInterval = null; }

  const overlay = document.getElementById('placement-overlay');
  if (overlay) overlay.style.display = 'none';
  document.getElementById('placement-menu').style.display = 'none';
  document.getElementById('obstacle-controls').style.display = 'none';

  ['item-hud', 'coin-hud', 'position-hud'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  const scene = window.gameScene;
  const normalZoom = _isMobile ? 0.6 : 1;
  if (scene) {
    scene.cameras.main.setZoom(normalZoom);
    vpHalfW = GAME_W / (2 * normalZoom);
    vpHalfH = GAME_H / (2 * normalZoom);
    vpW = GAME_W / normalZoom;
    vpH = GAME_H / normalZoom;

    if (scene._domPointerMove) document.removeEventListener('pointermove', scene._domPointerMove);
    if (scene._domPointerUp) document.removeEventListener('pointerup', scene._domPointerUp);
    scene._domPointerMove = null;
    scene._domPointerUp = null;

    if (scene._ghostSprite) { scene._ghostSprite.destroy(); scene._ghostSprite = null; }
    if (scene._otherGhosts) {
      Object.values(scene._otherGhosts).forEach(s => s.destroy());
      scene._otherGhosts = {};
    }
    if (scene._rotateKey) {
      scene.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.R);
      scene._rotateKey = null;
    }
    scene._obstaclePlaced = false;
    scene._selectedObstacleType = null;
    scene._obstacleRotation = 0;
    scene._hasConfirmed = false;
  }

  document.querySelectorAll('.obstacle-item.used').forEach(el => el.classList.remove('used'));
  const confirmBtn = document.getElementById('obstacle-confirm');
  if (confirmBtn) confirmBtn.disabled = false;

  if (player) player.setVisible(true);
  if (scene) scene.playerLabel.setVisible(true);
};

window.markObstacleUsed = function(type) {
  const el = document.querySelector(`.obstacle-item[data-type="${type}"]`);
  if (el) el.classList.add('used');
};

window.handlePlayerGhostMove = function(sessionId, type, x, y, rotation) {
  const scene = window.gameScene;
  if (!scene || !window.inPlacementPhase) return;
  let sprite = scene._otherGhosts[sessionId];
  if (sprite && sprite._locked) return;
  if (!sprite || sprite._obstacleType !== type) {
    if (sprite) sprite.destroy();
    sprite = scene.add.image(x, y, type);
    sprite.setAlpha(0.4);
    sprite.setTint(0xaaddff);
    sprite.setScale(OBSTACLE_SCALES[type] || 0.5);
    sprite.setDepth(2);
    sprite._obstacleType = type;
    sprite._locked = false;
    scene._otherGhosts[sessionId] = sprite;
  }
  sprite.setPosition(x, y);
  sprite.setAngle(rotation || 0);
};

window.lockPlayerObstacle = function(sessionId, obstacle) {
  const scene = window.gameScene;
  if (!scene) return;
  let sprite = scene._otherGhosts[sessionId];
  if (!sprite || sprite._obstacleType !== obstacle.type) {
    if (sprite) sprite.destroy();
    sprite = scene.add.image(obstacle.x, obstacle.y, obstacle.type);
    sprite.setScale(OBSTACLE_SCALES[obstacle.type] || 0.5);
    sprite.setDepth(2);
    sprite._obstacleType = obstacle.type;
    scene._otherGhosts[sessionId] = sprite;
  }
  sprite.setPosition(obstacle.x, obstacle.y);
  sprite.setAngle(obstacle.rotation || 0);
  sprite.setAlpha(1.0);
  sprite.clearTint();
  sprite._locked = true;
};

window.selectObstacle = function(type) {
  const scene = window.gameScene;
  if (!scene || !window.inPlacementPhase || scene._hasConfirmed) return;

  document.querySelectorAll('.obstacle-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === type);
  });

  if (scene._ghostSprite) { scene._ghostSprite.destroy(); scene._ghostSprite = null; }

  scene._selectedObstacleType = type;
  scene._obstacleRotation = 0;
  scene._obstaclePlaced = false;

  const ptr = scene.input.activePointer;
  const wp = scene.cameras.main.getWorldPoint(ptr.x || GAME_W / 2, ptr.y || GAME_H / 2);
  scene._ghostSprite = scene.add.image(wp.x, wp.y, type);
  scene._ghostSprite.setAlpha(0.6);
  scene._ghostSprite.setScale(OBSTACLE_SCALES[type] || 0.5);
  scene._ghostSprite.setDepth(3);
  scene._ghostSprite.setAngle(0);
  const initValid = checkPlacementValid(scene, wp.x, wp.y);
  scene._placementValid = initValid;
  scene._ghostSprite.setTint(initValid ? 0xffffff : 0xff4444);

  const confirmBtn = document.getElementById('obstacle-confirm');
  if (confirmBtn) confirmBtn.disabled = false;
  document.getElementById('obstacle-controls').style.display = 'none';
};

window.rotatePlacementGhost = function() {
  const scene = window.gameScene;
  if (!scene || !scene._ghostSprite) return;
  scene._obstacleRotation = ((scene._obstacleRotation || 0) + 90) % 360;
  scene._ghostSprite.setAngle(scene._obstacleRotation);
  if (scene._selectedObstacleType) {
    sendGhostMove(scene._selectedObstacleType, scene._ghostSprite.x, scene._ghostSprite.y, scene._obstacleRotation);
  }
};

window.confirmObstaclePlacement = function() {
  const scene = window.gameScene;
  if (!scene || !scene._ghostSprite || !scene._obstaclePlaced || scene._hasConfirmed) return;
  if (!scene._placementValid) return;
  scene._hasConfirmed = true;
  scene._ghostSprite.setAlpha(1.0);
  scene._ghostSprite.clearTint();
  sendPlaceObstacle(scene._selectedObstacleType, scene._ghostSprite.x, scene._ghostSprite.y, scene._obstacleRotation);
  if (placementTimerInterval) { clearInterval(placementTimerInterval); placementTimerInterval = null; }
  document.getElementById('obstacle-controls').style.display = 'none';
  document.getElementById('placement-menu').style.display = 'none';
  const timerEl = document.getElementById('placement-timer');
  if (timerEl) timerEl.textContent = 'Waiting for others…';
};