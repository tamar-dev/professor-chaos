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
  private finaleArt:Phaser.GameObjects.GameObject[]=[];
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
    this.machineGlow=this.add.circle(600,320,45,0xc6a5ff,.18).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:this.machineGlow,alpha:.4,scale:1.35,duration:1150,yoyo:true,repeat:-1});
    const robotSprite=this.textures.exists('robot-sprite')
      ? this.add.image(0,0,'robot-sprite').setDisplaySize(100,106)
      : this.add.rectangle(0,0,72,76,0x90d7c6).setStrokeStyle(3,0xe5fffa);
    const targetRing=this.add.circle(0,0,58,0xffe0a0,.05).setStrokeStyle(2,0xffdf98,.55);
    this.robot=this.add.container(1000,395,[targetRing,robotSprite]).setDepth(9);
    this.robot.setSize(115,115).setInteractive({useHandCursor:true});
    this.tweens.add({targets:targetRing,alpha:.28,scale:1.12,duration:850,yoyo:true,repeat:-1});
    this.tweens.add({targets:robotSprite,y:-7,duration:1150,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    this.robot.on('pointerdown',()=>this.tapRobot());
    this.input.keyboard?.on('keydown-ESC',()=>this.focus('wide'));
    this.input.keyboard?.on('keydown-ONE',()=>this.focus('desk'));
    this.input.keyboard?.on('keydown-TWO',()=>this.focus('machine'));
    this.input.keyboard?.on('keydown-THREE',()=>this.focus('robots'));
    this.input.keyboard?.on('keydown-H',()=>this.hint());
    this.loadSave();
    this.drawHotspots();
    this.focus('wide',false);
    if(this.save.stage==='finale')this.showDuck();
    this.report(this.save.stage==='intro'?'המעבדה שקטה מדי... משהו עומד לקרות!':'ברוכים השבים למעבדה! ההתקדמות נשמרה.');
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
      [0,1,2].forEach((i)=>{
        const x=510+i*90;
        this.hotspot(x,455,27,'⚙ '+(this.save.dials[i]+1),()=>this.turnDial(i));
      });
      this.hotspot(600,375,38,'⚡ הפעלה',()=>this.activate());
    }
  }
  start(){
    if(this.save.stage!=='intro')return;
    this.save.stage='search';this.focus('wide');
    this.cameras.main.shake(650,.006);this.cameras.main.flash(450,170,105,230);
    this.scatter(600,350,22);
    this.drawHotspots();
    this.report('אוי לא! שלושה גבישים נעלמו. חפשו בספרים, במגירה ואצל הרובוט!');
  }
  private scatter(x:number,y:number,n:number){
    for(let i=0;i<n;i++){
      const angle=Math.PI*2*i/n;const color=[0x8ce1dd,0xd8b6ff,0xffd48e][i%3];
      const p=this.add.circle(x,y,Phaser.Math.Between(3,7),color).setDepth(20);
      this.tweens.add({targets:p,x:x+Math.cos(angle)*Phaser.Math.Between(80,230),y:y+Math.sin(angle)*Phaser.Math.Between(70,170),alpha:0,scale:0,duration:Phaser.Math.Between(500,1050),onComplete:()=>p.destroy()});
    }
  }
  private collect(id:Item){
    if(this.save.found.includes(id)||this.save.stage==='intro')return;
    this.save.found.push(id);this.scatter(id==='book'?170:id==='drawer'?260:1000,id==='book'?278:id==='drawer'?505:400,15);
    this.cameras.main.flash(160,130,220,210);
    if(this.save.found.length===3){
      this.save.stage='calibrate';this.drawHotspots();this.focus('machine');
      this.report('שלושת הגבישים בידיכם! כוונו את החוגות לפי הרמז: 3, 2, 4.');
    }else{
      this.drawHotspots();this.report('גביש נמצא! '+this.save.found.length+' מתוך 3. ממשיכים לחפש.');
    }
  }
  private tapRobot(){
    if(this.robotRunning||this.save.found.includes('robot')||!['search','robot'].includes(this.save.stage))return;
    this.save.stage='robot';
    this.save.robotHits++;
    this.robotMotion?.stop();
    this.scatter(this.robot.x,this.robot.y,7);
    if(this.save.robotHits>=3){
      this.robotRunning=false;this.robot.setPosition(1000,395);
      this.collect('robot');this.report('תפסתם את הרובוט! הוא החזיר את הגביש.');
      return;
    }
    this.robotRunning=true;
    this.focus('robots');
    const positions=[{x:920,y:260},{x:1090,y:355},{x:970,y:470},{x:1060,y:250}];
    const next=positions[this.save.robotHits%positions.length];
    this.robotMotion=this.tweens.add({targets:this.robot,x:next.x,y:next.y,angle:this.save.robotHits%2?12:-12,duration:780,ease:'Sine.easeInOut',onUpdate:()=>{if(Math.random()<.16)this.robotTrail();},onComplete:()=>{this.robotRunning=false;}});
    this.report('הרובוט מתחמק! עוד '+(3-this.save.robotHits)+' תפיסות והוא נכנע.');
  }
  private robotTrail(){
    const puff=this.add.circle(this.robot.x,this.robot.y+30,Phaser.Math.Between(5,11),0x9df2e8,.55).setDepth(8);
    this.tweens.add({targets:puff,y:puff.y+20,alpha:0,scale:2,duration:450,onComplete:()=>puff.destroy()});
  }
  turnDial(i:number){
    if(this.save.stage!=='calibrate')return;
    this.save.dials[i]=(this.save.dials[i]+1)%4;
    this.scatter(510+i*90,455,5);this.drawHotspots();
    this.report('חוגות: '+this.save.dials.map(n=>n+1).join(' · ')+'. רמז: 3 · 2 · 4');
  }
  activate(){
    if(this.save.stage!=='calibrate')return;
    if(!this.save.dials.every((n,i)=>n===DIAL_TARGET[i])){
      this.cameras.main.shake(220,.004);
      this.report('ביפ! משהו לא מכוון. סדר החוגות הנכון: 3 · 2 · 4.');
      return;
    }
    this.save.stage='finale';this.drawHotspots();this.focus('wide');
    this.time.delayedCall(850,()=>{if(this.save.stage==='finale')this.showDuck();});
    this.cameras.main.shake(1300,.012);this.cameras.main.flash(800,165,110,245);
    this.scatter(600,310,70);
    this.tweens.add({targets:this.machineGlow,scale:5,alpha:.8,duration:1400,yoyo:true});
    this.time.delayedCall(1000,()=>{if(this.save.stage==='finale')this.report('🎉 הצלחתם! המכונה התעוררה... וייצרה ברווז גומי ענק! 🦆 המשך יבוא!');});
    this.report('המכונה מתעוררת! תחזיקו חזק...');
  }
  private showDuck(){
    if(this.finaleArt.length)return;
    // Draw the comic payoff as actual game objects, not merely as a status message.
    const shadow=this.add.ellipse(600,560,260,45,0x2b1c2b,.55).setDepth(30);
    const body=this.add.ellipse(600,490,220,165,0xffd44d).setStrokeStyle(5,0xfff0a0).setDepth(31);
    const head=this.add.circle(610,390,88,0xffd44d).setStrokeStyle(5,0xfff0a0).setDepth(32);
    const eye=this.add.circle(646,365,11,0x1d2336).setDepth(33);
    const eyeGlint=this.add.circle(650,361,3,0xffffff).setDepth(34);
    const beak=this.add.ellipse(679,411,95,40,0xff9148).setStrokeStyle(3,0xffc078).setDepth(33);
    const wing=this.add.ellipse(546,484,95,66,0xffe477).setAngle(-20).setDepth(33);
    const title=this.add.text(600,575,'QUACK! 🦆',{fontFamily:'Arial',fontSize:'43px',color:'#fff5c6',stroke:'#3c2b36',strokeThickness:7}).setOrigin(.5).setDepth(35);
    this.finaleArt=[shadow,body,head,eye,eyeGlint,beak,wing,title];
    for(const part of this.finaleArt){(part as Phaser.GameObjects.Shape|Phaser.GameObjects.Text).setAlpha(0);}
    this.tweens.add({targets:this.finaleArt,alpha:1,duration:450});
    this.tweens.add({targets:[body,head,eye,eyeGlint,beak,wing],y:'-=12',duration:800,yoyo:true,repeat:2,ease:'Sine.easeInOut'});
    this.scatter(600,385,55);
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
  hint(){
    const stage=this.save.stage;
    if(stage==='intro')this.report('הפרופסור השאיר כפתור אדום ענק. מה כבר יכול להשתבש?');
    else if(stage==='search'||stage==='robot')this.report('חפשו את הסימונים הזוהרים: ספר, מגירה ורובוט. את הרובוט צריך לתפוס 3 פעמים.');
    else if(stage==='calibrate')this.report('לחצו על החוגות עד שיופיעו המספרים 3, 2, 4 משמאל לימין.');
    else this.report('ניצחתם! אפשר להתחיל משחק חדש.');
  }
  restart(){
    this.robotMotion?.stop();this.robotRunning=false;
    for(const part of this.finaleArt)part.destroy();this.finaleArt=[];
    this.save={stage:'intro',found:[],dials:[0,0,0],robotHits:0};
    this.robot.setPosition(1000,395);this.robot.setAngle(0);
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
  activate(){this.scene()?.activate();}
  restart(){this.scene()?.restart();}
  ngOnDestroy(){this.game?.destroy(true);}
}
bootstrapApplication(AppComponent).catch(console.error);
