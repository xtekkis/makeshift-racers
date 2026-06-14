class Indicators {
  constructor(scene) {
    this.scene = scene;
    this.arrows = {};
  }

  update(players, myId) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const camLeft = cam.scrollX;
    const camRight = cam.scrollX + cam.width;
    const camTop = cam.scrollY;
    const camBottom = cam.scrollY + cam.height;
    const padding = 40;

    Object.keys(players).forEach((id) => {
      if (id === myId) return;
      const p = players[id];

      if (p.dead) {
        if (this.arrows[id]) {
          this.arrows[id].setVisible(false);
        }
        return;
      }

      const isOffScreen =
        p.x < camLeft || p.x > camRight || p.y < camTop || p.y > camBottom;

      if (isOffScreen) {
        if (!this.arrows[id]) {
          this.arrows[id] = scene.add.triangle(0, 0, 0, -10, 8, 10, -8, 10, 0x4a8fe8);
          this.arrows[id].setDepth(10);
          this.arrows[id].setScrollFactor(0);
        }
        const screenCenterX = cam.width / 2;
        const screenCenterY = cam.height / 2;
        const targetX = p.x - cam.scrollX;
        const targetY = p.y - cam.scrollY;
        const angle = Math.atan2(targetY - screenCenterY, targetX - screenCenterX);
        const edgeX = Math.max(padding, Math.min(cam.width - padding,
          screenCenterX + Math.cos(angle) * 300));
        const edgeY = Math.max(padding, Math.min(cam.height - padding,
          screenCenterY + Math.sin(angle) * 300));
        this.arrows[id].x = edgeX;
        this.arrows[id].y = edgeY;
        this.arrows[id].rotation = angle + Math.PI / 2;
        this.arrows[id].setVisible(true);
      } else {
        if (this.arrows[id]) {
          this.arrows[id].setVisible(false);
        }
      }
    });

    Object.keys(this.arrows).forEach((id) => {
      if (!players[id]) {
        this.arrows[id].destroy();
        delete this.arrows[id];
      }
    });
  }
}