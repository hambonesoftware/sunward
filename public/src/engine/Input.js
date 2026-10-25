export class Input {
  constructor(canvas, stick, interactButton, jumpButton) {
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.interactRequested = false;
    this.jumpRequested = false;
    this.cameraHeading = 0;
    this.cameraPitch = 0.2;
    this.stick = stick;
    this.stickThumb = stick?.querySelector('.joystick-thumb');
    this.stickPointer = null;
    this.lookPointer = null;
    this.lastLook = null;

    window.addEventListener('keydown', event => {
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.code === 'KeyE' && !event.repeat) this.interactRequested = true;
      if (event.code === 'Space' && !event.repeat) this.jumpRequested = true;
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    interactButton?.addEventListener('pointerdown', event => { event.preventDefault(); this.interactRequested = true; });
    jumpButton?.addEventListener('pointerdown', event => { event.preventDefault(); this.jumpRequested = true; });

    if (stick) {
      const moveStick = event => {
        const bounds = stick.getBoundingClientRect();
        const dx = event.clientX - (bounds.left + bounds.width/2);
        const dy = event.clientY - (bounds.top + bounds.height/2);
        const length = Math.hypot(dx, dy);
        const limit = bounds.width * 0.31;
        const magnitude = Math.min(length, limit) / limit;
        this.joystick.x = length ? dx/length * magnitude : 0;
        this.joystick.y = length ? dy/length * magnitude : 0;
        this.stickThumb.style.transform = `translate(${this.joystick.x*limit}px, ${this.joystick.y*limit}px)`;
      };
      stick.addEventListener('pointerdown', event => {
        event.preventDefault(); this.stickPointer = event.pointerId;
        stick.setPointerCapture(event.pointerId); moveStick(event);
      });
      stick.addEventListener('pointermove', event => { if (this.stickPointer === event.pointerId) moveStick(event); });
      const clearStick = event => {
        if (this.stickPointer !== event.pointerId) return;
        this.stickPointer = null; this.joystick = {x:0, y:0};
        this.stickThumb.style.transform = 'translate(0,0)';
      };
      stick.addEventListener('pointerup', clearStick);
      stick.addEventListener('pointercancel', clearStick);
    }

    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      this.lookPointer = event.pointerId;
      this.lastLook = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== this.lookPointer || !this.lastLook) return;
      this.look.x += event.clientX - this.lastLook.x;
      this.look.y += event.clientY - this.lastLook.y;
      this.lastLook = { x: event.clientX, y: event.clientY };
    });
    const stopLook = event => {
      if (event.pointerId === this.lookPointer) { this.lookPointer = null; this.lastLook = null; }
    };
    canvas.addEventListener('pointerup', stopLook);
    canvas.addEventListener('pointercancel', stopLook);
    canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  moveAxis() {
    const key = code => this.keys.has(code) ? 1 : 0;
    const x = key('KeyD') + key('ArrowRight') - key('KeyA') - key('ArrowLeft') + this.joystick.x;
    const y = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - this.joystick.y;
    const mag = Math.max(1, Math.hypot(x,y));
    return {x:x/mag, y:y/mag};
  }

  consumeInteract() { const value=this.interactRequested; this.interactRequested=false; return value; }
  consumeJump() { const value=this.jumpRequested; this.jumpRequested=false; return value; }
  consumeLook() {
    const delta={...this.look}; this.look={x:0,y:0}; return delta;
  }
  sprinting() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
}
