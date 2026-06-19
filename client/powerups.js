class PowerUps {
    constructor(scene) {
        this.scene = scene;
        this.powerups = {};

        this.definitions = [
            { id: 0, x: 550, y: 2200 },
            { id: 1, x: 600, y: 2200 },
            { id: 2, x: 650, y: 2200 },
            { id: 3, x: 850, y: 2700 },
            { id: 4, x: 900, y: 2700 },
            { id: 5, x: 950, y: 2700 },
            { id: 6, x: 2400, y: 1550 },
            { id: 7, x: 2400, y: 1600 },
            { id: 8, x: 2400, y: 1650 },
            { id: 9, x: 3200, y: 1550 },
            { id: 10, x: 3200, y: 1600 },
            { id: 11, x: 3200, y: 1650 },
            { id: 12, x: 3350, y: 3200 },
            { id: 13, x: 3400, y: 3200 },
            { id: 14, x: 3450, y: 3200 },
        ];

        this.spawn();
    }

    spawn() {
        this.definitions.forEach(def => {
            const box = this.scene.add.rectangle(def.x, def.y, 20, 20, 0xe8c14a);
            box.setDepth(2);
            this.powerups[def.id] = {
                box,
                collected: false,
                x: def.x,
                y: def.y
            };
        });
    }

    checkCollection(playerX, playerY) {
        Object.entries(this.powerups).forEach(([id, pu]) => {
            if (pu.collected) return;
            const dist = Math.hypot(playerX - pu.x, playerY - pu.y);
            if (dist < 30) {
                this.collect(parseInt(id));
            }
        });
    }

    collect(id) {
        if (this.powerups[id] && !this.powerups[id].collected) {
            this.powerups[id].collected = true;
            this.powerups[id].box.setVisible(false);

            // flash effect
            const flash = this.scene.add.rectangle(
                this.powerups[id].x,
                this.powerups[id].y,
                40, 40, 0xe8c14a, 1
            );
            flash.setDepth(3);

            this.scene.tweens.add({
                targets: flash,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 150,
                ease: 'Power2',
                onComplete: () => flash.destroy()
            });

            sendPowerupCollected(id);
        }
    }

    removeById(id) {
        if (this.powerups[id]) {
            this.powerups[id].collected = true;
            this.powerups[id].box.setVisible(false);
        }
    }

    reset() {
        Object.values(this.powerups).forEach(p => {
            p.collected = false;
            p.box.setVisible(true);
        });
    }
}