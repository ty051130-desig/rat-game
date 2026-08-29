export class TouchControls {
  constructor(zone, base, thumb) {
    this.zone = zone;
    this.base = base;
    this.thumb = thumb;
    this.value = { x: 0, z: 0 };
    this.pointerId = null;
    this.maxRadius = 45;

    this.onPointerDown = (event) => {
      if (this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.zone.setPointerCapture?.(event.pointerId);
      this.updateFromPointer(event);
      event.preventDefault();
    };

    this.onPointerMove = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.updateFromPointer(event);
      event.preventDefault();
    };

    this.onPointerUp = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.reset();
      event.preventDefault();
    };

    zone.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    zone.addEventListener('pointermove', this.onPointerMove, { passive: false });
    zone.addEventListener('pointerup', this.onPointerUp, { passive: false });
    zone.addEventListener('pointercancel', this.onPointerUp, { passive: false });

    // Prevent iOS/Android long-press selection, callouts and drag gestures
    // from stealing the virtual joystick interaction.
    for (const eventName of ['contextmenu', 'selectstart', 'dragstart']) {
      zone.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
    }

    zone.addEventListener('lostpointercapture', () => {
      this.pointerId = null;
      this.reset();
    });
  }

  updateFromPointer(event) {
    const rect = this.base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);

    if (length > this.maxRadius) {
      const scale = this.maxRadius / length;
      dx *= scale;
      dy *= scale;
    }

    this.thumb.style.transform = `translate(${dx}px, ${dy}px)`;

    // Screen up is game -Z, screen down is game +Z.
    const deadZone = 0.10;
    let x = dx / this.maxRadius;
    let z = dy / this.maxRadius;
    const magnitude = Math.hypot(x, z);

    if (magnitude < deadZone) {
      x = 0;
      z = 0;
    }

    this.value.x = x;
    this.value.z = z;
  }

  reset() {
    this.value.x = 0;
    this.value.z = 0;
    this.thumb.style.transform = 'translate(0px, 0px)';
  }

  getInput() {
    return this.value;
  }
}
