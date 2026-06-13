class Track {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.width = 4000;
    this.height = 800;
    this.draw();
  }

  draw() {
    const g = this.graphics;

    // track surface
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(0, 100, this.width, 600);

    // inner grass
    g.fillStyle(0x1a3a1a, 1);
    g.fillRect(200, 250, this.width - 400, 300);

    // outer boundary top
    g.lineStyle(6, 0x888888, 1);
    g.lineBetween(0, 100, this.width, 100);

    // outer boundary bottom
    g.lineBetween(0, 700, this.width, 700);

    // inner boundary top
    g.lineStyle(4, 0x555555, 1);
    g.lineBetween(200, 250, this.width - 200, 250);

    // inner boundary bottom
    g.lineBetween(200, 550, this.width - 200, 550);

    // start line
    g.lineStyle(6, 0xe8c14a, 1);
    g.lineBetween(200, 100, 200, 250);
    g.lineBetween(200, 550, 200, 700);

    // checkpoints
    g.lineStyle(4, 0x4a8fe8, 0.6);
    g.lineBetween(800, 100, 800, 250);
    g.lineBetween(800, 550, 800, 700);

    g.lineBetween(1600, 100, 1600, 250);
    g.lineBetween(1600, 550, 1600, 700);

    g.lineBetween(2400, 100, 2400, 250);
    g.lineBetween(2400, 550, 2400, 700);

    g.lineBetween(3200, 100, 3200, 250);
    g.lineBetween(3200, 550, 3200, 700);

    g.lineBetween(3800, 100, 3800, 250);
    g.lineBetween(3800, 550, 3800, 700);

    // finish line
    g.lineStyle(6, 0xe84a4a, 1);
    g.lineBetween(3900, 100, 3900, 250);
    g.lineBetween(3900, 550, 3900, 700);
  }

  isOffTrack(x, y) {
    const outerTop = 100;
    const outerBottom = 700;
    const innerTop = 250;
    const innerBottom = 550;
    const trackStart = 0;
    const trackEnd = 4000;

    const outsideBounds = x < trackStart || x > trackEnd || y < outerTop || y > outerBottom;
    const insideInner = x > 200 && x < 3800 && y > innerTop && y < innerBottom;

    return outsideBounds || insideInner;
  }
}