export class HUD {
  constructor(events,profile,terrain,journal) {
    this.events=events;this.profile=profile;this.terrain=terrain;this.journal=journal;
    this.clockNode=document.getElementById('clock');
    this.startScreen=document.getElementById('start-screen');
    this.startButton=document.getElementById('start-button');
    this.dialog=document.getElementById('dialog');
    this.toastNode=document.getElementById('toast');
    this.actionHint=document.getElementById('action-hint');
    this.actionText=document.getElementById('action-text');
    this.actionButton=document.getElementById('action-button');
    this.map=document.getElementById('mini-map');this.mapContext=this.map.getContext('2d');
    this.mapBase=this.makeMapBase();
    this.activeAction='';
    this.startButton.addEventListener('click',()=>{
      this.startScreen.style.display='none';this.events.emit('game-started');
    });
    document.getElementById('skip-time').addEventListener('click',()=>events.emit('skip-time'));
    document.getElementById('dialog-close').addEventListener('click',()=>this.hideDialog());
    window.addEventListener('keydown',event=>{
      if(!this.dialog.hidden&&['Escape','Enter','KeyE'].includes(event.code))this.hideDialog();
    });
    events.on('journal-updated',()=>this.updateJournal());
    events.on('quest-complete',detail=>this.toast(detail.message||'A new chapter begins!'));
    this.updateJournal();
  }

  ready(){this.startButton.disabled=false;this.startButton.textContent='Step into Bayberry Cove  →';}
  showError(message){const node=document.getElementById('error');node.textContent=message;node.hidden=false;this.startButton.textContent='Unable to load game';}
  updateJournal(){
    const item=this.journal.milestone();
    document.getElementById('quest-title').textContent=item.title;
    document.getElementById('quest-description').textContent=item.description;
    document.getElementById('residents-count').textContent=`${this.journal.met.size} / ${this.profile.residents.length} neighbors met`;
    document.getElementById('plants-count').textContent=`${this.journal.discovered.size} / 5 plants found`;
  }
  setAction(label){
    if(label===this.activeAction)return;this.activeAction=label;
    this.actionHint.hidden=!label;this.actionButton.hidden=!label;
    this.actionText.textContent=label;
    this.actionButton.textContent=label||'';
  }
  showDialog({eyebrow,title,text}){
    document.getElementById('dialog-eyebrow').textContent=eyebrow;
    document.getElementById('dialog-title').textContent=title;
    document.getElementById('dialog-text').textContent=text;
    this.dialog.hidden=false;this.events.emit('dialog-opened');
  }
  hideDialog(){if(this.dialog.hidden)return;this.dialog.hidden=true;this.events.emit('dialog-closed');}
  toast(message){
    this.toastNode.textContent=message;this.toastNode.hidden=false;
    clearTimeout(this.toastTimeout);
    this.toastTimeout=setTimeout(()=>{this.toastNode.hidden=true;},4300);
  }

  toMap(x,z){
    const margin=6,span=this.map.width-2*margin;
    return [margin+(x/this.terrain.width+.5)*span,margin+(z/this.terrain.depth+.5)*span];
  }
  makeMapBase(){
    const canvas=document.createElement('canvas');canvas.width=164;canvas.height=164;
    const context=canvas.getContext('2d');
    const {width,height}=canvas;
    for(let py=0;py<height;py+=2)for(let px=0;px<width;px+=2){
      const x=(px/width-.5)*this.terrain.width,z=(py/height-.5)*this.terrain.depth;
      const h=this.terrain.heightAt(x,z);
      const above=h-this.terrain.waterY;
      context.fillStyle=above<.3?'#76b8c4':above<6?'#e9cf95':above>37?'#608968':'#94bb84';
      context.fillRect(px,py,2,2);
    }
    const town=this.toMap(this.profile.village.x,this.profile.village.z);
    context.fillStyle='#fff5db';context.strokeStyle='#55785a';context.lineWidth=1.4;
    context.beginPath();context.arc(town[0],town[1],7,0,2*Math.PI);context.fill();context.stroke();
    return canvas;
  }

  update(clock,player,residents) {
    this.clockNode.textContent=clock.display();
    const context=this.mapContext;
    context.clearRect(0,0,this.map.width,this.map.height);
    context.drawImage(this.mapBase,0,0);
    for(const person of residents.people){
      const [x,y]=this.toMap(person.group.position.x,person.group.position.z);
      context.beginPath();context.arc(x,y,2,0,Math.PI*2);context.fillStyle='#d86c54';context.fill();
    }
    const [px,py]=this.toMap(player.position.x,player.position.z);
    context.save();context.translate(px,py);context.rotate(-player.group.rotation.y);
    context.beginPath();context.moveTo(0,-8);context.lineTo(5,6);context.lineTo(0,3);context.lineTo(-5,6);context.closePath();
    context.fillStyle='#fff8e8';context.strokeStyle='#2c6354';context.lineWidth=2;context.fill();context.stroke();
    context.restore();
  }
}
