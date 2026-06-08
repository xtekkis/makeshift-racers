const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

function preload() {}

function create() {
  this.add.text(640, 360, 'Makeshift Racers', {
    fontSize: '48px',
    color: '#e8c14a',
    fontFamily: 'Arial'
  }).setOrigin(0.5);
}

function update() {}