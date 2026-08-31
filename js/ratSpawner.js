import { Rat } from './rat.js?v=11.2';

export class RatSpawner {
  constructor(scene, stage, pipeDefs) {
    this.scene = scene;
    this.stage = stage;
    this.rats = [];
    this.enabled = true;
    this.visualTime = 0;

    this.warningDuration = 2.0;
    this.criticalDuration = 1.0;

    this.spawners = pipeDefs.map((p) => {
      const spawner = {
        ...p,
        timer: p.initialDelay,
        visual: this.stage.getPipeVisual(p.id),
        shakeSeed: Math.random() * Math.PI * 2
      };
      this.resetPipeWarningVisual(spawner);
      return spawner;
    });
  }

  update(dt, player) {
    if (!this.enabled) return;

    this.visualTime += dt;

    for (const s of this.spawners) {
      s.timer -= dt;
      this.updatePipeWarningVisual(s);

      if (s.timer <= 0) {
        if (!this.isSpawnCellBusy(s.cell)) {
          this.rats.push(new Rat(this.scene, this.stage, s.cell, s.facing));
          s.timer += s.interval;
          this.resetPipeWarningVisual(s);
        } else {
          s.timer = 0.45;
        }
      }
    }

    for (const rat of this.rats) rat.update(dt, player);
  }

  updatePipeWarningVisual(spawner) {
    if (!spawner.visual) return;

    const timeLeft = Math.max(0, spawner.timer);
    if (timeLeft > this.warningDuration) {
      this.resetPipeWarningVisual(spawner);
      return;
    }

    const progress = 1 - timeLeft / this.warningDuration;
    const urgent = timeLeft <= this.criticalDuration;
    const pulseSpeed = urgent ? 24 : 14;
    const pulse = 0.5 + 0.5 * Math.sin(this.visualTime * pulseSpeed + spawner.shakeSeed);

    const maxShake = urgent ? 0.06 : 0.028;
    const shakeAmount = 0.006 + progress * maxShake;
    const xShake = Math.sin(this.visualTime * 19 + spawner.shakeSeed) * shakeAmount;
    const zShake = Math.cos(this.visualTime * 23 + spawner.shakeSeed) * shakeAmount;

    if (spawner.side === 'left' || spawner.side === 'right') {
      spawner.visual.position.set(xShake * 0.25, 0, zShake);
    } else if (spawner.side === 'bottom' || spawner.side === 'top') {
      spawner.visual.position.set(xShake, 0, zShake * 0.25);
    }

    const rim = spawner.visual.userData.warningRim;
    if (rim) {
      // Subtle red pulse on the lip itself, so side-facing pipes are readable too.
      rim.material.opacity = urgent
        ? 0.38 + 0.18 * pulse
        : 0.12 + 0.10 * pulse;
      const rimScale = 1 + (urgent ? 0.025 : 0.012) * pulse;
      rim.scale.set(rimScale, rimScale, rimScale);
    }

    const glow = spawner.visual.userData.warningGlow;
    if (glow) {
      // Keep the inner glow much softer than the rim.
      glow.material.opacity = urgent
        ? 0.16 + 0.12 * pulse
        : 0.04 + 0.06 * pulse;
      const glowScale = 1 + progress * 0.10 + (urgent ? 0.08 : 0.04) * pulse;
      glow.scale.set(glowScale, glowScale, glowScale);
    }

    const dust = spawner.visual.userData.warningDust;
    if (dust) {
      dust.material.opacity = urgent
        ? 0.10 + 0.14 * pulse
        : 0.04 + 0.06 * pulse;
      const dustScale = 1 + progress * (urgent ? 0.32 : 0.18);
      dust.scale.set(dustScale, dustScale, dustScale);
    }
  }

  resetPipeWarningVisual(spawner) {
    if (!spawner.visual) return;

    spawner.visual.position.set(0, 0, 0);

    const rim = spawner.visual.userData.warningRim;
    if (rim) {
      rim.material.opacity = 0;
      rim.scale.set(1, 1, 1);
    }

    const glow = spawner.visual.userData.warningGlow;
    if (glow) {
      glow.material.opacity = 0;
      glow.scale.set(1, 1, 1);
    }

    const dust = spawner.visual.userData.warningDust;
    if (dust) {
      dust.material.opacity = 0;
      dust.scale.set(1, 1, 1);
    }
  }

  isSpawnCellBusy(cellName) {
    const c = this.stage.parseCell(cellName);
    return this.rats.some((r) => !r.dead && r.cell.row === c.row && r.cell.col === c.col && r.progress < 0.55);
  }

  removeRat(rat) {
    rat.destroy();
    this.rats = this.rats.filter((r) => r !== rat);
  }

  clear() {
    for (const rat of this.rats) rat.destroy();
    this.rats = [];

    for (const s of this.spawners) {
      this.resetPipeWarningVisual(s);
    }
  }
}
