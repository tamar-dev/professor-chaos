import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import Phaser from 'phaser';

type Zone = 'wide' | 'desk' | 'machine' | 'robots';
type Stage = 'intro' | 'search' | 'robot' | 'calibrate' | 'finale';
type Item = 'book' | 'drawer' | 'robot';
interface SaveData { stage:Stage; found:Item[]; dials:number[]; robotHits:number; }
interface ViewState { stage:Stage; found:number; robotHits:number; dials:number[]; message:string; finished:boolean; }
const STORAGE_KEY='professor-chaos-save-v2';
const EMPTY:SaveData={stage:'intro',found:[],dials:[0,0,0],robotHits:0};
const VIEWS:Record<Zone,{x:number;y:number;zoom:number}>={
  wide:{x:600,y:338,zoom:1},desk:{x:275,y:375,zoom:1.65},
  machine:{x:600,y:340,zoom:1.55},robots:{x:980,y:360,zoom:1.65}
};
const DIAL_TARGET=[2,1,3];
class Laboratory extends Phaser.Scene {
  private save:SaveData={...EMPTY,found:[],dials:[0,0,0]};
  private zone:Zone='wide';
  private robot!:Phaser.GameObjects.Container;
  private robotMotion?:Phaser.Tweens.Tween;
  private markers:Phaser.GameObjects.GameObject[]=[];
  private machineGlow!:Phaser.GameObjects.Arc;
  private robotRunning=false;
  private robotOrb?:Phaser.GameObjects.Arc;
  private robotShadow?:Phaser.GameObjects.Arc;
  private finaleArt:Phaser.GameObjects.GameObject[]=[];
  private clueVisible=false;
  private clueArt:Phaser.GameObjects.GameObject[]=[];
  private cinematic?:Phaser.GameObjects.Container;
  private cinematicBusy=false;
  private sequenceId=0;
  private announce:(state:ViewState)=>void=()=>{};
  constructor(){super('laboratory');}
  setReporter(fn:(state:ViewState)=>void){this.announce=fn;this.report('לחצו על התחלה כדי להעיר את המעבדה');}
  preload(){this.load.image('laboratory','assets/lab-master.webp');this.load.svg('robot-sprite','assets/robot.svg',{width:160,height:170});}
  create(){
    this.cameras.main.setBackgroundColor('#281c28');
    if(this.textures.exists('laboratory')){
      this.add.image(600,337.5,'laboratory').setDisplaySize(1200,675);
    } else {
      this.add.rectangle(600,337,1200,675,0x563b35);
      this.add.text(600,290,'Professor Chaos',{fontSize:'54px',color:'#ffe6a4'}).setOrigin(.5);
    }
    const light=this.add.circle(600,300,115,0x8adce8,.08).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:light,alpha:.26,scale:1.25,duration:1900,yoyo:true,repeat:-1});
    this.addAtmosphere();
    this.machineGlow=this.add.circle(600,320,45,0xc6a5ff,.18).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:this.machineGlow,alpha:.4,scale:1.35,duration:1150,yoyo:true,repeat:-1});
    // The painted robot already exists in the background. Do not draw a second robot over it.
    // Its escaped energy core becomes the moving target only after the first interaction.
    const restingRing=this.add.circle(0,0,48,0x9df7ed,.025).setStrokeStyle(2,0x8ce8e1,.35);
    const energyCore=this.add.circle(0,0,19,0x9dfaff,.85).setStrokeStyle(5,0xd5ffff,.95).setBlendMode(Phaser.BlendModes.ADD);
    const outerGlow=this.add.circle(0,0,36,0x54baff,.15).setBlendMode(Phaser.BlendModes.ADD);
    this.robotOrb=energyCore;
    this.robot=this.add.container(1000,395,[restingRing,outerGlow,energyCore]).setDepth(9);
    this.robot.setSize(105,105).setInteractive({useHandCursor:true});
    energyCore.setVisible(false);outerGlow.setVisible(false);
    this.tweens.add({targets:restingRing,alpha:.65,scale:1.13,duration:1150,yoyo:true,repeat:-1});
    this.tweens.add({targets:outerGlow,scale:1.4,alpha:.5,duration:650,yoyo:true,repeat:-1});
    this.robot.on('pointerdown',()=>this.tapRobot());
    this.input.keyboard?.on('keydown-ESC',()=>this.focus('wide'));
    this.input.keyboard?.on('keydown-ONE',()=>this.focus('desk'));
    this.input.keyboard?.on('keydown-TWO',()=>this.focus('machine'));
    this.input.keyboard?.on('keydown-THREE',()=>this.focus('robots'));
    this.input.keyboard?.on('keydown-H',()=>this.hint());
    this.loadSave();
    this.buildCinema();
    this.drawHotspots();
    if(this.save.robotHits>0&&!this.save.found.includes('robot')){this.robotOrb?.setVisible(true);(this.robot.list[1] as Phaser.GameObjects.Arc).setVisible(true);this.robot.setPosition(this.save.robotHits===1?860:1110,225);}
    this.focus('wide',false);
    if(this.save.stage==='finale')this.showPortal();
    this.report(this.save.stage==='intro'?'המעבדה שקטה מדי... משהו עומד לקרות!':'ברוכים השבים למעבדה! ההתקדמות נשמרה.');
  }
  private addAtmosphere(){
    // Ambient particles float in the same world space as the laboratory artwork.
    for(let i=0;i<34;i++){
      const x=Phaser.Math.Between(20,1180);
      const y=Phaser.Math.Between(40,610);
      const radius=Phaser.Math.FloatBetween(1.3,3.6);
      const mote=this.add.circle(x,y,radius,i%3===0?0x9deee8:0xffdba0,Phaser.Math.FloatBetween(.13,.35)).setDepth(3);
      this.tweens.add({targets:mote,y:y-Phaser.Math.Between(20,80),x:x+Phaser.Math.Between(-35,35),alpha:0,duration:Phaser.Math.Between(3200,7300),yoyo:true,repeat:-1,delay:Phaser.Math.Between(0,2500),ease:'Sine.easeInOut'});
    }
    const lamp=this.add.circle(480,120,70,0xffd69d,.035).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    this.tweens.add({targets:lamp,alpha:.2,scale:1.4,duration:2300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
  }
  private buildCinema(){
    const top=this.add.rectangle(600,27,1200,54,0x08090e,1);
    const bottom=this.add.rectangle(600,648,1200,54,0x08090e,1);
    this.cinematic=this.add.container(0,0,[top,bottom]).setDepth(900).setScrollFactor(0).setVisible(false);
  }
  private cinematicShot(duration:number,callback:()=>void){
    const id=++this.sequenceId;
    this.cinematicBusy=true;
    const layer=this.cinematic;
    if(layer){
      layer.setVisible(true).setAlpha(0);
      this.tweens.add({targets:layer,alpha:1,duration:350,ease:'Sine.easeOut'});
    }
    this.time.delayedCall(duration,()=>{
      if(id!==this.sequenceId)return;
      if(layer)this.tweens.add({targets:layer,alpha:0,duration:280,onComplete:()=>{if(id===this.sequenceId)layer.setVisible(false);}});
      this.cinematicBusy=false;
      callback();
    });
  }
  private loadSave(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw)return;
      const data=JSON.parse(raw) as Partial<SaveData>;
      if(!Array.isArray(data.found)||!Array.isArray(data.dials))return;
      this.save={
        stage:['intro','search','robot','calibrate','finale'].includes(data.stage||'')?data.stage!:'intro',
        found:data.found.filter(x=>['book','drawer','robot'].includes(x)),
        dials:[0,1,2].map(i=>Number(data.dials?.[i]||0)%4),
        robotHits:Math.min(3,Math.max(0,Number(data.robotHits||0)))
      };
    }catch{ /* Ignore invalid saved state. */ }
  }
  private persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.save));}catch{ /* Storage may be disabled. */ }}
  private report(message:string){
    this.persist();
    this.announce({stage:this.save.stage,found:this.save.found.length,robotHits:this.save.robotHits,dials:[...this.save.dials],message,finished:this.save.stage==='finale'});
  }
  private hotspot(x:number,y:number,r:number,label:string,action:()=>void){
    const ring=this.add.circle(x,y,r,0xffe2a0,.07).setStrokeStyle(3,0xffd78b,.65).setDepth(10).setInteractive({useHandCursor:true});
    this.tweens.add({targets:ring,alpha:.35,scale:1.08,duration:1250,yoyo:true,repeat:-1});
    ring.on('pointerdown',action);
    const tag=this.add.text(x,y-r-19,label,{fontFamily:'Arial',fontSize:'18px',color:'#fff4d8',backgroundColor:'#302331dd',padding:{x:9,y:5}}).setOrigin(.5).setDepth(11);
    this.markers.push(ring,tag);
    return ring;
  }
  private clearMarkers(){for(const m of this.markers)m.destroy();this.markers=[];}
  private drawHotspots(){
    this.clearMarkers();
    const stage=this.save.stage;
    if(stage==='intro'){this.hotspot(600,400,42,'🔴 כפתור אדום',()=>this.start());return;}
    if(stage==='search'||stage==='robot'){
      if(!this.save.found.includes('book'))this.hotspot(170,278,42,'📚 ספר סודי',()=>this.collect('book'));
      if(!this.save.found.includes('drawer'))this.hotspot(260,505,38,'🗄 מגירה',()=>this.collect('drawer'));
      // The robot itself is clickable and its hit area moves with the chase.
      return;
    }
    if(stage==='calibrate'){
      this.hotspot(385,205,35,'📜 רמז נסתר',()=>this.revealClue());
      [0,1,2].forEach((i)=>{
        const x=510+i*90;
        this.hotspot(x,455,27,'⚙ '+(this.save.dials[i]+1),()=>this.turnDial(i));
      });
      this.hotspot(600,375,38,'⚡ הפעלה',()=>this.activate());
    }
  }
  start(){
    if(this.save.stage!=='intro')return;
    this.save.stage='search';this.focus('machine');
    this.report('המכונה מתחילה לרעוד...');
    this.cinematicShot(1150,()=>{
      if(this.save.stage!=='search')return;
      this.cameras.main.shake(900,.012);this.cameras.main.flash(550,170,105,230);
      this.scatter(600,350,45);
      this.robot.setAngle(-18);
      this.time.delayedCall(350,()=>this.robot.setAngle(0));
      this.focus('wide');
      this.drawHotspots();
      this.report('אזעקה! שלושה גבישי אנרגיה נעלמו. המעבדה בידיים שלכם!');
    });
  }
  private scatter(x:number,y:number,n:number){
    for(let i=0;i<n;i++){
      const angle=Math.PI*2*i/n;const color=[0x8ce1dd,0xd8b6ff,0xffd48e][i%3];
      const p=this.add.circle(x,y,Phaser.Math.Between(3,7),color).setDepth(20);
      this.tweens.add({targets:p,x:x+Math.cos(angle)*Phaser.Math.Between(80,230),y:y+Math.sin(angle)*Phaser.Math.Between(70,170),alpha:0,scale:0,duration:Phaser.Math.Between(500,1050),onComplete:()=>p.destroy()});
    }
  }
  private collect(id:Item){
    if(this.cinematicBusy||this.save.found.includes(id)||this.save.stage==='intro')return;
    this.save.found.push(id);this.scatter(id==='book'?170:id==='drawer'?260:1000,id==='book'?278:id==='drawer'?505:400,15);
    this.cameras.main.flash(160,130,220,210);
    if(this.save.found.length===3){
      this.save.stage='calibrate';this.drawHotspots();this.focus('machine');
      this.report('שלושת הגבישים בידיכם! חפשו את השרטוט שעל הלוח כדי לגלות את הקוד למכונה.');
    }else{
      this.drawHotspots();this.report('גביש נמצא! '+this.save.found.length+' מתוך 3. ממשיכים לחפש.');
    }
  }
  private tapRobot(){
    if(this.cinematicBusy||this.robotRunning||this.save.found.includes('robot')||!['search','robot'].includes(this.save.stage))return;
    this.save.stage='robot';
    this.save.robotHits++;
    this.robotMotion?.stop();

    this.scatter(this.robot.x,this.robot.y,7);
    if(this.save.robotHits>=3){
      this.robotRunning=false;this.robot.setPosition(1000,395);this.robotOrb?.setVisible(false);(this.robot.list[1] as Phaser.GameObjects.Arc).setVisible(false);
      this.collect('robot');this.report('תפסתם את הרובוט! הוא החזיר את הגביש.');
      return;
    }
    this.robotRunning=true;
    this.robotOrb?.setVisible(true);
    (this.robot.list[1] as Phaser.GameObjects.Arc).setVisible(true);
    this.focus('robots');
    const positions=[{x:860,y:225},{x:1110,y:225},{x:905,y:475},{x:1060,y:190}];
    const next=positions[(this.save.robotHits-1)%positions.length];
    this.robotMotion=this.tweens.add({targets:this.robot,x:next.x,y:next.y,duration:950,ease:'Cubic.easeInOut',onUpdate:()=>{if(Math.random()<.28)this.robotTrail();},onComplete:()=>{this.robotRunning=false;}});
    this.report('הרובוט מתחמק! עוד '+(3-this.save.robotHits)+' תפיסות והוא נכנע.');
  }
  private robotTrail(){
    const puff=this.add.circle(this.robot.x,this.robot.y+30,Phaser.Math.Between(5,11),0x9df2e8,.55).setDepth(8);
    this.tweens.add({targets:puff,y:puff.y+20,alpha:0,scale:2,duration:450,onComplete:()=>puff.destroy()});
  }
  private revealClue(){
    if(this.save.stage!=='calibrate')return;
    this.clueVisible=!this.clueVisible;
    for(const item of this.clueArt)item.destroy();
    this.clueArt=[];
    if(this.clueVisible){
      const paper=this.add.rectangle(600,260,385,225,0xf3dba5,.97).setStrokeStyle(7,0x8a6342).setDepth(42);
      const heading=this.add.text(600,191,'THE PROFESSOR\'S NOTES',{fontFamily:'Arial',fontSize:'24px',color:'#3c2d2c'}).setOrigin(.5).setDepth(43);
      const hint=this.add.text(600,251,'⚙  3   ·   2   ·   4  ⚙',{fontFamily:'Arial',fontSize:'34px',color:'#5c4857'}).setOrigin(.5).setDepth(43);
      const footer=this.add.text(600,311,'לחצו שוב על הלוח לסגירה',{fontFamily:'Arial',fontSize:'18px',color:'#56423b'}).setOrigin(.5).setDepth(43);
      this.clueArt=[paper,heading,hint,footer];
      this.report('מצאתם את השרטוט של הפרופסור! הקוד הוא 3 · 2 · 4.');
    }else this.report('סגרתם את השרטוט. עכשיו אפשר לכוון את החוגות.');
  }
  turnDial(i:number){
    if(this.save.stage!=='calibrate')return;
    this.save.dials[i]=(this.save.dials[i]+1)%4;
    this.scatter(510+i*90,455,5);this.drawHotspots();
    this.report('חוגות: '+this.save.dials.map(n=>n+1).join(' · ')+'. '+(this.clueVisible?'הקוד מהשרטוט: 3 · 2 · 4':'אפשר לחזור לשרטוט כדי לבדוק את הקוד.'));
  }
  activate(){
    if(this.save.stage!=='calibrate')return;
    if(!this.save.dials.every((n,i)=>n===DIAL_TARGET[i])){
      this.cameras.main.shake(220,.004);
      this.report('ביפ! משהו לא מכוון. חפשו את השרטוט בלוח המעבדה כדי למצוא את הסדר.');
      return;
    }
    this.save.stage='finale';this.clearClue();this.drawHotspots();this.focus('machine');
    this.report('המערכת נטענת...');
    this.tweens.add({targets:this.machineGlow,scale:4,alpha:.8,duration:1250,yoyo:true});
    this.cinematicShot(1650,()=>{
      if(this.save.stage!=='finale')return;
      this.cameras.main.shake(1200,.014);this.cameras.main.flash(950,210,165,255);
      this.scatter(600,310,90);
      this.focus('wide');
      this.time.delayedCall(400,()=>{if(this.save.stage==='finale')this.showPortal();});
      this.report('האנרגיה התייצבה... אבל במרכז המעבדה נפתח שער מסתורי. מה נמצא מעבר לו?');
    });
  }
  private clearClue(){
    for(const item of this.clueArt)item.destroy();
    this.clueArt=[];this.clueVisible=false;
  }
  private showPortal(){
    if(this.finaleArt.length)return;
    // An unstable energy aperture grows from the machine's existing core.
    const outer=this.add.ellipse(600,327,270,365,0x271a56,.6).setStrokeStyle(11,0x7de9f0,.85).setDepth(28);
    const inner=this.add.ellipse(600,327,215,315,0x132f58,.85).setStrokeStyle(7,0xc7a2ff,.75).setDepth(29);
    const core=this.add.ellipse(600,327,135,240,0x9cecf3,.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
    const halo=this.add.ellipse(600,327,330,420,0x8a7aff,.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(27);
    this.finaleArt=[halo,outer,inner,core];
    for(const part of this.finaleArt){(part as Phaser.GameObjects.Arc).setAlpha(0).setScale(.08);}
    this.tweens.add({targets:this.finaleArt,alpha:1,scale:1,duration:1200,ease:'Back.easeOut'});
    this.tweens.add({targets:outer,angle:3,duration:1200,yoyo:true,repeat:-1});
    this.tweens.add({targets:inner,angle:-5,duration:1400,yoyo:true,repeat:-1});
    this.tweens.add({targets:core,alpha:.8,scaleX:1.12,duration:750,yoyo:true,repeat:-1});
    this.scatter(600,327,85);
  }
  focus(zone:Zone,animate=true){
    this.zone=zone;const t=VIEWS[zone];
    if(animate){this.cameras.main.pan(t.x,t.y,600,'Cubic.easeInOut');this.cameras.main.zoomTo(t.zoom,600,'Cubic.easeInOut');}
    else{this.cameras.main.centerOn(t.x,t.y);this.cameras.main.setZoom(t.zoom);}
  }
  interact(item:'book'|'drawer'|'robot'){
    if(item==='robot')this.tapRobot();
    else if(this.save.stage==='search'||this.save.stage==='robot')this.collect(item);
  }
  dial(i:number){this.turnDial(i);}
  clue(){this.revealClue();}
  hint(){
    const stage=this.save.stage;
    if(stage==='intro')this.report('הפרופסור השאיר כפתור אדום ענק. מה כבר יכול להשתבש?');
    else if(stage==='search'||stage==='robot')this.report('חפשו את הסימונים הזוהרים: ספר, מגירה ורובוט. את הרובוט צריך לתפוס 3 פעמים.');
    else if(stage==='calibrate')this.report('הרמז מוסתר בשרטוט שעל לוח המעבדה, בצד השמאלי של המכונה.');
    else this.report('ניצחתם! אפשר להתחיל משחק חדש.');
  }
  restart(){
    this.sequenceId++;this.cinematicBusy=false;this.cinematic?.setVisible(false);
    this.robotMotion?.stop();this.robotRunning=false;this.clearClue();
    
    for(const part of this.finaleArt)part.destroy();this.finaleArt=[];
    this.save={stage:'intro',found:[],dials:[0,0,0],robotHits:0};
    this.robot.setPosition(1000,395);this.robot.setAngle(0);this.robotOrb?.setVisible(false);(this.robot.list[1] as Phaser.GameObjects.Arc).setVisible(false);
    this.tweens.killTweensOf(this.machineGlow);this.machineGlow.setScale(1).setAlpha(.2);
    this.tweens.add({targets:this.machineGlow,alpha:.4,scale:1.35,duration:1150,yoyo:true,repeat:-1});
    this.drawHotspots();this.focus('wide');this.report('המעבדה מוכנה להרפתקה חדשה. לחצו על הכפתור האדום!');
  }
}
@Component({
  selector:'app-root',standalone:true,
  template:`<main class="shell">
    <header class="masthead"><div><span class="eyebrow">THE CHAOS LAB · EPISODE 01</span><h1>⚡ פרופסור כאוס</h1><p>המעבדה יצאה משליטה — האם תצליחו להציל את ההמצאה?</p></div><span class="version">MVP · 0.2</span></header>
    <nav class="zones" aria-label="ניווט בחדר">
      <button (click)="focus('wide')">🏠 כל החדר</button><button (click)="focus('desk')">📚 שולחן</button>
      <button (click)="focus('machine')">⚙ מכונה</button><button (click)="focus('robots')">🤖 רובוטים</button>
    </nav>
    <section class="game-frame" aria-label="חדר המעבדה האינטראקטיבי"><div id="game"></div></section>
    <section class="status-panel" aria-live="polite">
      <div class="status-copy"><strong>{{title}}</strong><p>{{state.message}}</p></div>
      <div class="stats"><span>💎 {{state.found}} / 3</span><span>🤖 {{state.robotHits}} / 3</span></div>
    </section>
    <div class="toolbar"><button (click)="start()" [disabled]="state.stage!=='intro'">▶ התחילו הרפתקה</button>
      <button (click)="hint()">💡 רמז</button><button (click)="activate()" [disabled]="state.stage!=='calibrate'">⚡ הפעילו מכונה</button>
      <button (click)="restart()">↻ התחלה מחדש</button></div>
    @if (state.stage==='search'||state.stage==='robot') {
      <div class="toolbar" aria-label="פעולות חקירה נגישות">
        <button (click)="interact('book')">📚 בדקו ספר</button>
        <button (click)="interact('drawer')">🗄 פתחו מגירה</button>
        <button (click)="interact('robot')">🤖 תפסו רובוט</button>
      </div>
    }
    @if (state.stage==='calibrate') {
      <div class="toolbar"><button (click)="clue()">📜 פתחו את שרטוט הפרופסור</button></div>
      <div class="toolbar" aria-label="כיוון חוגות">
        <button (click)="dial(0)">⚙ חוגה 1: {{state.dials[0]+1}}</button>
        <button (click)="dial(1)">⚙ חוגה 2: {{state.dials[1]+1}}</button>
        <button (click)="dial(2)">⚙ חוגה 3: {{state.dials[2]+1}}</button>
      </div>
    }
    <p class="help">לחצו על העיגולים הזוהרים בתוך החדר · Esc לחזרה למבט הכללי · מקשים 1–3 למעבר אזורים · H לרמז</p>
  </main>`
})
class AppComponent implements AfterViewInit,OnDestroy {
  state:ViewState={stage:'intro',found:0,robotHits:0,dials:[0,0,0],message:'טוענים את המעבדה...',finished:false};
  private game?:Phaser.Game;
  constructor(private cdr:ChangeDetectorRef){}
  get title(){return ({intro:'ברוכים הבאים, ממציאים!',search:'חפשו את הגבישים',robot:'תפוס את הרובוט!',calibrate:'כוונו את המכונה',finale:'המעבדה ניצלה!'} as Record<Stage,string>)[this.state.stage];}
  private scene(){return this.game?.scene.getScene('laboratory') as Laboratory|undefined;}
  ngAfterViewInit(){
    this.game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1200,height:675,backgroundColor:'#281c28',
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Laboratory]});
    this.game.events.once(Phaser.Core.Events.READY,()=>{const s=this.scene();if(s?.sys.isActive())this.attach(s);else s?.events.once(Phaser.Scenes.Events.CREATE,()=>this.attach(s));});
  }
  private attach(s:Laboratory){s.setReporter((next)=>{this.state=next;this.cdr.detectChanges();});}
  focus(z:Zone){this.scene()?.focus(z);}
  start(){this.scene()?.start();}
  hint(){this.scene()?.hint();}
  interact(item:'book'|'drawer'|'robot'){this.scene()?.interact(item);}
  dial(i:number){this.scene()?.dial(i);}
  clue(){this.scene()?.clue();}
  activate(){this.scene()?.activate();}
  restart(){this.scene()?.restart();}
  ngOnDestroy(){this.game?.destroy(true);}
}
bootstrapApplication(AppComponent).catch(console.error);
