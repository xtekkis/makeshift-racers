class Track {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.trackW = 200;

    this.path = [
      { x: 2000, y: 3600 }, // start
      { x: 600, y: 3600 }, // bottom going left
      { x: 600, y: 1600 }, // up left side
      { x: 1600, y: 1600 }, // top left going right
      { x: 1600, y: 2400 }, // S down
      { x: 900, y: 2400 }, // S left
      { x: 900, y: 3000 }, // S down
      { x: 2200, y: 3000 }, // S right
      { x: 2200, y: 1600 }, // up first U
      { x: 2600, y: 1600 }, // right of first U
      { x: 2600, y: 3000 }, // down first U
      { x: 3000, y: 3000 }, // connector
      { x: 3000, y: 1600 }, // up second U
      { x: 3400, y: 1600 }, // right of second U
      { x: 3400, y: 3600 }, // down right side
      { x: 2000, y: 3600 }, // back to start
    ];

    this.checkpoints = [
      { x1: 500, y1: 2600, x2: 700, y2: 2600 },   // cp1 left side going up
      { x1: 1100, y1: 2300, x2: 1100, y2: 2500 },  // cp2 inside S top
      { x1: 2100, y1: 2000, x2: 2300, y2: 2000 }, // cp4 first U top
      { x1: 2900, y1: 2000, x2: 3100, y2: 2000 }, // cp5 second U top
      { x1: 3300, y1: 2800, x2: 3500, y2: 2800 }, // cp6 right side going down
    ];

    this.draw();
  }

  draw() {
    const g = this.graphics;

    // border layer
    g.lineStyle(this.trackW + 24, 0x555555, 1);
    g.beginPath();
    g.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      g.lineTo(this.path[i].x, this.path[i].y);
    }
    g.strokePath();

    // track surface
    g.lineStyle(this.trackW, 0x2a2a3a, 1);
    g.beginPath();
    g.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      g.lineTo(this.path[i].x, this.path[i].y);
    }
    g.strokePath();

    // start/finish line
    g.lineStyle(8, 0xe84a4a, 1);
    g.lineBetween(1800, 3700, 1800, 3500);

    // checkpoints
    g.lineStyle(5, 0x4a8fe8, 0.9);
    this.checkpoints.forEach(cp => {
      g.lineBetween(cp.x1, cp.y1, cp.x2, cp.y2);
    });
  }

  isOffTrack(x, y) {
    const tw = this.trackW / 2 + 10;
    const path = this.path;

    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];

      if (a.x === b.x) {
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        if (x >= a.x - tw && x <= a.x + tw && y >= minY - tw && y <= maxY + tw) {
          return false;
        }
      } else {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        if (y >= a.y - tw && y <= a.y + tw && x >= minX - tw && x <= maxX + tw) {
          return false;
        }
      }
    }
    return true;
  }
}