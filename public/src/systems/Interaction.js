export class Interaction {
  constructor(player,residents,vegetation,journal,ui,events) {
    this.player=player;this.residents=residents;this.vegetation=vegetation;
    this.journal=journal;this.ui=ui;this.events=events;
    this.active=null;
    this.closest=null;
    events.on('dialog-closed',()=>{this.active=null;});
  }
  update(input) {
    if(this.active)return;
    const x=this.player.position.x,z=this.player.position.z;
    const person=this.residents.nearby(x,z,24);
    let closest=person?{type:'resident',entity:person,distance:Math.hypot(person.group.position.x-x,person.group.position.z-z)}:null;
    for(const specimen of this.vegetation.specimens){
      if(specimen.discovered)continue;
      const d=Math.hypot(specimen.x-x,specimen.z-z);
      if(d<25&&(!closest||d<closest.distance))closest={type:'specimen',entity:specimen,distance:d};
    }
    this.closest=closest;
    this.ui.setAction(closest?(closest.type==='resident'?`Talk to ${closest.entity.name}`:`Discover ${closest.entity.species.common}`):'');
    if(input.consumeInteract()&&closest)this.activate(closest);
  }
  activate(target) {
    this.active=target;
    if(target.type==='resident') {
      const person=target.entity;
      const result=this.journal.talkTo(person);
      const hour=this.residents.clock.hours;
      const message=(hour>20||hour<5?person.late:person.intro)+(result.bonus?`\n\n${result.bonus}`:'');
      this.ui.showDialog({eyebrow:person.job,title:person.name,text:message});
    } else {
      const point=target.entity;
      const result=this.journal.inspect(point);
      this.ui.showDialog({eyebrow:'Field notes · Michigan',title:point.species.common,text:`${point.species.latin}\n\nA plant associated with Great Lakes habitats. ${result.first?'Added to your discovery journal.':'Already in your journal.'}`});
    }
  }
}
