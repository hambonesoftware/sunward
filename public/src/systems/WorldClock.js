export class WorldClock {
  constructor(events) { this.events=events; this.hours=9.7; this.speed=0.016; this.lastHour=-1; }
  update(dt) {
    this.hours=(this.hours+dt*this.speed)%24;
    const hour=Math.floor(this.hours);
    if (hour!==this.lastHour) { this.lastHour=hour; this.events.emit('hour-changed',{hour}); }
  }
  skip(hours=2) { this.hours=(this.hours+hours)%24; this.lastHour=-1; this.update(0); }
  display() {
    const hour=Math.floor(this.hours); const minute=Math.floor((this.hours-hour)*60);
    const h12=hour%12||12;
    return `${h12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
  }
}
