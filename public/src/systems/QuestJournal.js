const MILESTONES=[
  {title:'Meet June at the bakery',description:'Say hello to June Bell, who always saves a pastry for newcomers.',npc:'june'},
  {title:'Visit Mateo by the water',description:'Bring June’s little parcel to the fisherman at the dock.',npc:'mateo'},
  {title:'Find Ellen’s garden',description:'Ask Ellen about the flowers and trees that grow near the dunes.',npc:'ellen'},
  {title:'A place to belong',description:'You’ve made friends in Bayberry Cove. Explore, meet everyone, and find local plants.',npc:null}
];

export class QuestJournal {
  constructor(events) {
    this.events=events;
    const saved=this.load();
    this.stage=Math.min(saved.stage||0,MILESTONES.length-1);
    this.met=new Set(saved.met||[]);
    this.discovered=new Set(saved.discovered||[]);
  }
  load() {
    try{return JSON.parse(localStorage.getItem('sunward-michigan-save')||'{}');}
    catch{return {};}
  }
  persist() {
    try{localStorage.setItem('sunward-michigan-save',JSON.stringify({stage:this.stage,met:[...this.met],discovered:[...this.discovered]}));}
    catch{/* browsing in private mode still supports an unsaved session */}
  }
  milestone() {return MILESTONES[this.stage];}
  talkTo(person) {
    const first=!this.met.has(person.id);
    this.met.add(person.id);
    let bonus='';
    if(this.milestone().npc===person.id){
      this.stage=Math.min(this.stage+1,MILESTONES.length-1);
      bonus=person.id==='june'?'June hands you a warm parcel for Mateo.':person.id==='mateo'?'Mateo gives you a little map to Ellen’s garden.':'You’re starting to feel like one of the locals.';
      this.events.emit('quest-complete',{stage:this.stage,message:bonus});
    }
    this.persist();this.events.emit('journal-updated');
    return {first,bonus};
  }
  inspect(specimen) {
    const first=!this.discovered.has(specimen.id);
    this.discovered.add(specimen.id);specimen.discovered=true;
    this.persist();this.events.emit('journal-updated');
    return {first};
  }
  applySavedSpecimens(specimens){
    for(const point of specimens)point.discovered=this.discovered.has(point.id);
  }
}
