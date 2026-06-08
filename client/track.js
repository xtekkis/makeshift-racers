class Track {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.draw();
  }

  draw() {
    const g = this.graphics;

    // outer boundary
    g.lineStyle(4, 0x888888, 1);
    g.strokeRect(100, 100, 1080, 520);

    // inner boundary (creates the track shape)
    g.lineStyle(4, 0x888888, 1);
    g.strokeRect(250, 200, 780, 320);

    // track surface
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(100, 100, 1080, 520);

    // inner grass
    g.fillStyle(0x1a3a1a, 1);
    g.fillRect(250, 200, 780, 320);

    // start line
    g.lineStyle(4, 0xe8c14a, 1);
    g.lineBetween(100, 360, 250, 360);

    // checkpoints
    g.lineStyle(3, 0x4a8fe8, 0.6);
    g.lineBetween(100, 200, 250, 200);  // checkpoint 1
    g.lineBetween(1030, 200, 1180, 200); // checkpoint 2
    g.lineBetween(1030, 360, 1180, 360); // checkpoint 3
    g.lineBetween(1030, 520, 1180, 520); // checkpoint 4
    g.lineBetween(100, 520, 250, 520);   // checkpoint 5
  }
}