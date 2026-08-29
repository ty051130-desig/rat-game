import { Player } from './player.js?v=10.2';
import { RatSpawner } from './ratSpawner.js?v=10.2';
import { Stage } from './stage.js?v=10.2';

export class Game {
  constructor(scene, stageData, playerGLTF = null) {
    this.scene = scene;
    this.data = stageData;
    this.state = 'playing';
    this.kills = 0;
    this.stage = new Stage(scene, stageData);
    this.player = new Player(
      scene,
      this.stage,
      stageData.playerStart,
      playerGLTF,
      stageData.character
    );
    this.spawner = new RatSpawner(scene, this.stage, stageData.pipes);

    this.scoreEl = document.querySelector('#score');
    this.stageLabelEl = document.querySelector('.stage-label');
    this.stageNameEl = document.querySelector('.stage-name');
    this.messageEl = document.querySelector('#message');
    this.cardEl = document.querySelector('#message-card');
    this.badgeEl = document.querySelector('#result-badge');
    this.titleEl = document.querySelector('#message-title');
    this.subEl = document.querySelector('#message-sub');

    this.stageLabelEl.textContent = `STAGE ${stageData.stageNumber ?? 1}`;
    this.stageNameEl.textContent = stageData.name;
    this.updateScore();
  }

  setTouchInput(x, z) {
    this.player?.setTouchInput(x, z);
  }

  update(dt) {
    if (this.state !== 'playing') return;

    this.player.update(dt);
    this.spawner.update(dt, this.player);

    for (const rat of [...this.spawner.rats]) {
      const result = rat.contactResult(this.player);
      if (result === 'player-caught') {
        this.lose();
        return;
      }
      if (result === 'rat-caught') {
        this.spawner.removeRat(rat);
        this.kills += 1;
        this.updateScore();
        if (this.kills >= this.data.targetKills) {
          this.win();
          return;
        }
      }
    }
  }

  updateScore() {
    this.scoreEl.textContent = `退治 ${this.kills} / ${this.data.targetKills}`;
  }

  showResult(type, badge, title, sub) {
    this.messageEl.classList.remove('win', 'lose', 'hidden');
    this.messageEl.classList.add(type);
    this.badgeEl.textContent = badge;
    this.titleEl.textContent = title;
    this.subEl.textContent = sub;
  }

  win() {
    this.state = 'won';
    this.spawner.enabled = false;
    this.player.setAnimation?.('Idle');
    this.showResult('win', '★', 'STAGE CLEAR!', `${this.kills}匹のネズミを退治しました`);
  }

  lose() {
    this.state = 'lost';
    this.spawner.enabled = false;
    this.player.setAnimation?.('Idle');
    this.showResult('lose', '×', 'GAME OVER', 'ネズミにつかまりました');
  }
}
