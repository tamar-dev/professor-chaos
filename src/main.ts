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
  wide:{x:600,y:338,zoom:1},desk:{x:290,y:400,zoom:1.65},
  machine:{x:685,y:325,zoom:1.55},robots:{x:1010,y:360,zoom:1.65}
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
  private clueVisible=false;
  private clueArt:Phaser.GameObjects.GameObject[]=[];
  private cinematic?:Phaser.GameObjects.Container;
  private cinematicBusy=false;
  private sequenceId=0;
  private crystalLights:Phaser.GameObjects.Arc[]=[];
  private dialNeedles:Phaser.GameObjects.Graphics[]=[];
  private inventoryGems:Phaser.GameObjects.Arc[]=[];
  private collecting=false;
  private inspecting=false;
  private bookPage=0;
  private bookOverlay:Phaser.GameObjects.GameObject[]=[];
  private bookOpen=false;
  private announce:(state:ViewState)=>void=()=>{};
  constructor(){super('laboratory');}
  setReporter(fn:(state:ViewState)=>void){this.announce=fn;this.report('לחצו על התחלה כדי להעיר את המעבדה');}
  preload(){this.load.image('laboratory','assets/lab-master.webp');this.load.svg('robot-sprite','assets/robot.svg',{width:160,height:170});this.load.svg('professor','assets/professor.svg',{width:350,height:430});}
  create(){
    this.cameras.main.setBackgroundColor('#281c28');
    this.buildStoryWorld();
    const light=this.add.circle(665,270,115,0x8adce8,.08).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:light,alpha:.26,scale:1.25,duration:1900,yoyo:true,repeat:-1});
    this.addAtmosphere();
    this.machineGlow=this.add.circle(665,270,45,0xc6a5ff,.18).setBlendMode(Phaser.BlendModes.ADD);
    this.buildMachineFeedback();
    this.buildInventory();
    this.tweens.add({targets:this.machineGlow,alpha:.4,scale:1.35,duration:1150,yoyo:true,repeat:-1});
    const robotShadow=this.add.ellipse(0,62,80,14,0x050a14,.25);
    const robotSprite=this.add.circle(0,0,24,0xa8f9f4,.92).setStrokeStyle(6,0xe6ffff,.95).setBlendMode(Phaser.BlendModes.ADD);
    const aura=this.add.circle(0,0,42,0x5cefe7,.025);
    this.robot=this.add.container(1030,295,[robotShadow,aura,robotSprite]).setDepth(12);
    this.robot.setSize(115,115).setInteractive({useHandCursor:true});
    robotSprite.setVisible(false);robotShadow.setVisible(false);
    this.tweens.add({targets:robotSprite,y:-11,duration:1100,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    this.tweens.add({targets:robotShadow,scaleX:.75,alpha:.2,duration:1100,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    this.tweens.add({targets:aura,scale:1.18,alpha:.25,duration:850,yoyo:true,repeat:-1});
    this.robot.on('pointerdown',()=>this.tapRobot());
    this.robot.on('pointerover',()=>{if(['search','robot'].includes(this.save.stage))this.tweens.add({targets:aura,alpha:.6,scale:1.35,duration:180});});
    this.robot.on('pointerout',()=>this.tweens.add({targets:aura,alpha:.12,scale:1,duration:220}));
    this.input.keyboard?.on('keydown-ESC',()=>this.focus('wide'));
    this.input.keyboard?.on('keydown-ONE',()=>this.focus('desk'));
    this.input.keyboard?.on('keydown-TWO',()=>this.focus('machine'));
    this.input.keyboard?.on('keydown-THREE',()=>this.focus('robots'));
    this.input.keyboard?.on('keydown-H',()=>this.hint());
    this.loadSave();
    this.buildCinema();
    this.drawHotspots();
    this.refreshMachineFeedback();
    this.refreshInventory();
    if(this.save.robotHits>0&&!this.save.found.includes('robot')){this.robot.setPosition(this.save.robotHits===1?1060:920,315);(this.robot.list[2] as Phaser.GameObjects.Arc).setVisible(true);}
    this.focus('wide',false);
    if(this.save.stage==='finale')this.showPortal();
    this.report(this.save.stage==='intro'?'המעבדה שקטה מדי... משהו עומד לקרות!':'ברוכים השבים למעבדה! ההתקדמות נשמרה.');
  }
  private buildStoryWorld(){
    // Preserve the richly painted laboratory as the set, then animate independent foreground layers.
    this.add.image(600,337.5,'laboratory').setDisplaySize(1200,675).setDepth(0);
    const shade=this.add.graphics().setDepth(1);
    shade.fillGradientStyle(0x060914,0x060914,0x130b1d,0x130b1d,.42,.18,.35,.45);
    shade.fillRect(0,0,1200,675);
    // Keep the original artwork intact: it already contains its own characters,
    // lighting and perspective. Avoid pasting a differently rendered figure on top.
    // Electricity traces the actual machine instead of unrelated screen-space ornaments.
    const conduit=this.add.graphics().setDepth(7);
    const dot=this.make.graphics({x:0,y:0});dot.fillStyle(0xa5ffff);dot.fillCircle(4,4,4);dot.generateTexture('chaos-spark',8,8);dot.destroy();
    const sparks=this.add.particles(665,267,'chaos-spark',{speed:{min:12,max:55},scale:{start:.09,end:0},lifespan:850,frequency:110,quantity:1,blendMode:'ADD'});
    sparks.setDepth(8);
    const machineLight=this.add.circle(665,267,85,0x8df5ff,.09).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:machineLight,scale:1.28,alpha:.27,duration:1450,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    this.events.on(Phaser.Scenes.Events.UPDATE,()=>{
      const t=this.time.now*.001;
      conduit.clear();
      for(let k=0;k<3;k++){
        conduit.lineStyle(k===0?4:2,k===0?0x8ef8fa:k===1?0xe3a6ff:0xffdba0,.28+Math.sin(t*3+k)*.16);
        conduit.beginPath();
        const y=267+k*14;
        conduit.moveTo(585,y);
        for(let x=595;x<=740;x+=12)conduit.lineTo(x,y+Math.sin(x*.06+t*4+k)*8);
        conduit.strokePath();
      }
    });
    // Subtle foreground shadows anchor the scene.
    const vignette=this.add.graphics().setDepth(19);
    vignette.fillGradientStyle(0x080713,0x080713,0x080713,0x080713,.24,.24,.32,.32);
    vignette.fillRect(0,0,1200,38);
    vignette.fillRect(0,635,1200,40);
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
  private buildMachineFeedback(){
    // Use existing painted glass and control panel; no floating HUD over the image.
    const glow=this.add.ellipse(662,245,65,72,0x8deaff,.05).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    this.tweens.add({targets:glow,alpha:.18,scale:1.2,duration:1800,yoyo:true,repeat:-1});
  }
  private refreshMachineFeedback(){
    // The illustration is the source of truth; progress stays in the accessible status panel.
  }
  private buildInventory(){
    // The collection box is part of the world, not a fixed overlay.
    const x=425,y=564;
    const box=this.add.graphics().setDepth(22);
    box.fillStyle(0x251d30,.92);box.fillRoundedRect(x-75,y-25,150,62,12);
    box.lineStyle(6,0xc89b65,.92);box.strokeRoundedRect(x-75,y-25,150,62,12);
    box.lineStyle(2,0xffdfaa,.55);box.lineBetween(x-66,y-12,x+66,y-12);
    for(let i=0;i<3;i++){
      const slot=this.add.circle(x-44+i*44,y+5,13,0x111a28,.9).setStrokeStyle(2,0xc79d6b,.8).setDepth(23);
      const gem=this.add.circle(slot.x,slot.y,9,[0x8cefe8,0xc5a1ff,0xffc783][i],.95).setStrokeStyle(2,0xf4f9ec,.9).setDepth(24);
      gem.setVisible(false);
      this.inventoryGems.push(gem);
    }
  }
  private refreshInventory(){
    this.inventoryGems.forEach((gem,i)=>gem.setVisible(i<this.save.found.length));
  }
  private animatePickup(id:Item,onComplete:()=>void){
    const origin=id==='book'?{x:312,y:438}:id==='drawer'?{x:280,y:550}:{x:this.robot.x,y:this.robot.y};
    const slot=this.inventoryGems[this.save.found.length-1];
    if(!slot){onComplete();return;}
    this.collecting=true;
    const pickupId=this.sequenceId;
    const gem=this.add.circle(origin.x,origin.y,14,id==='book'?0x8cefe8:id==='drawer'?0xc5a1ff:0xffc783,.98)
      .setStrokeStyle(3,0xf9ffff,1).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
    const halo=this.add.circle(origin.x,origin.y,32,0x8cefff,.16).setDepth(79).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:halo,scale:1.8,alpha:0,duration:380,onComplete:()=>halo.destroy()});
    this.tweens.add({targets:gem,y:origin.y-52,scale:1.28,duration:310,ease:'Sine.easeOut',onComplete:()=>{
      this.tweens.add({targets:gem,x:slot.x,y:slot.y,scale:.6,duration:680,ease:'Cubic.easeInOut',onUpdate:()=>{if(Math.random()<.15)this.robotTrailAt(gem.x,gem.y);},onComplete:()=>{
        gem.destroy();slot.setVisible(true);slot.setScale(.3);
        this.tweens.add({targets:slot,scale:1,duration:300,ease:'Back.easeOut'});
        this.collecting=false;if(pickupId===this.sequenceId)onComplete();
      }});
    }});
  }
  private robotTrailAt(x:number,y:number){
    const p=this.add.circle(x,y,Phaser.Math.Between(2,5),0xc7faff,.7).setDepth(78);
    this.tweens.add({targets:p,y:y+15,alpha:0,scale:0,duration:330,onComplete:()=>p.destroy()});
  }
  private hotspot(x:number,y:number,r:number,label:string,action:()=>void){
    // Invisible hit target: the artwork itself remains a single seamless image.
    const hit=this.add.zone(x,y,r*2,r*2).setDepth(17).setInteractive({useHandCursor:true});
    hit.on('pointerdown',action);
    hit.setData('accessibleLabel',label);
    this.markers.push(hit);
    return hit;
  }
  private clearMarkers(){for(const m of this.markers)m.destroy();this.markers=[];}
  private drawHotspots(){
    this.clearMarkers();
    const stage=this.save.stage;
    if(stage==='intro'){this.hotspot(720,385,43,'🔴 כפתור אדום',()=>this.start());return;}
    if(stage==='search'||stage==='robot'){
      if(!this.save.found.includes('book'))this.hotspot(312,438,47,'📚 ספר סודי',()=>this.inspectObject('book'));
      if(!this.save.found.includes('drawer'))this.hotspot(280,550,44,'🗄 מגירה',()=>this.inspectObject('drawer'));
      // The robot itself is clickable and its hit area moves with the chase.
      return;
    }
    if(stage==='calibrate'){
      this.hotspot(390,247,65,'📜 רמז נסתר',()=>this.revealClue());
      [0,1,2].forEach((i)=>{
        const x=589+i*77;
        this.hotspot(x,416,27,'⚙ '+(this.save.dials[i]+1),()=>this.turnDial(i));
      });
      this.hotspot(720,385,40,'⚡ הפעלה',()=>this.activate());
    }
  }
  start(){
    if(this.save.stage!=='intro')return;
    this.save.stage='search';this.focus('machine');
    this.report('המכונה מתחילה לרעוד...');
    this.cinematicShot(1150,()=>{
      if(this.save.stage!=='search')return;
      this.cameras.main.shake(900,.012);this.cameras.main.flash(550,170,105,230);
      this.scatter(665,270,45);
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
  private closeBook(){
    for(const part of this.bookOverlay)part.destroy();
    this.bookOverlay=[];this.bookOpen=false;this.inspecting=false;
  }
  private openBook(){
    if(this.bookOpen||this.collecting||this.save.found.includes('book'))return;
    this.bookOpen=true;this.inspecting=true;this.bookPage=0;this.focus('wide',false);
    this.renderBook();
    this.report('יומן ההמצאות של פרופסור כאוס! דפדפו כדי לחשוף את הסוד.');
  }
  private renderBook(){
    for(const part of this.bookOverlay)part.destroy();
    this.bookOverlay=[];
    if(!this.bookOpen)return;
    const depth=180;
    // A readable, interactive storybook in the game world, with genuine page turns.
    const shade=this.add.rectangle(600,338,1200,675,0x090b15,.67).setDepth(depth).setInteractive();
    const shadow=this.add.rectangle(600,337,655,435,0x110e17,.7).setDepth(depth+1).setAngle(-1);
    const binding=this.add.rectangle(600,335,24,390,0x5b321e).setDepth(depth+4);
    const left=this.add.rectangle(435,335,324,390,0xf0dfb7).setStrokeStyle(7,0x765034).setDepth(depth+2);
    const right=this.add.rectangle(765,335,324,390,0xf5e6c4).setStrokeStyle(7,0x765034).setDepth(depth+2);
    const title=this.add.text(600,105,'יומן ההמצאות · כרך ג׳',{fontFamily:'Georgia, serif',fontSize:'32px',color:'#f5d18a',align:'center'}).setOrigin(.5).setDepth(depth+6);
    const pages=[
      ['היום שבו הכול השתבש','הפעלתי את מכונת הכאוס. שוב.\\nשלושה גבישים עפו לכל עבר.\\n\\nאולי הייתי צריך לקרוא\\nאת הוראות הבטיחות...','הערה חשובה','לא לגעת בידית האדומה\\nלפני שהגבישים במקומם!\\n\\n(אני כמובן נגעתי.)'],
      ['שלושת הגבישים','אחד מסתתר בין הדפים.\\nהשני נח במגירה הישנה.\\nהשלישי אצל הרובוט השובב.','על הרובוט','הוא אוהב לשחק מחבואים.\\nאם תתפסו אותו שלוש פעמים,\\nאולי יסכים לעזור.'],
      ['השרטוט הסודי','כדי לייצב את המכונה:👇\\n\\n  ⚙  3  ·  2  ·  4\\n\\nזכרו את סדר החוגות!','הפתעה בין הדפים','רגע... מה זה מנצנץ\\nבתוך הכריכה?\\n\\nלחצו על הגביש כדי לאסוף אותו!']
    ];
    const p=pages[this.bookPage];
    const textStyle={fontFamily:'Arial, sans-serif',fontSize:'23px',color:'#4b3020',align:'center' as const,lineSpacing:11,wordWrap:{width:275}};
    const t1=this.add.text(435,190,p[0]+'\\n\\n'+p[1],textStyle).setOrigin(.5,0).setDepth(depth+5).setScale(.88);
    const t2=this.add.text(765,190,p[2]+'\\n\\n'+p[3],textStyle).setOrigin(.5,0).setDepth(depth+5).setScale(.88);
    const next=this.add.text(880,545,this.bookPage===2?'✦ אספו את הגביש':'◀ הדף הבא',{fontFamily:'Arial',fontSize:'23px',color:'#ffe1a5',backgroundColor:'#49301e',padding:{x:16,y:10}}).setOrigin(.5).setDepth(depth+7).setInteractive({useHandCursor:true});
    const prev=this.add.text(320,545,'הקודם ▶',{fontFamily:'Arial',fontSize:'21px',color:'#ffe1a5',backgroundColor:'#49301e',padding:{x:14,y:10}}).setOrigin(.5).setDepth(depth+7).setInteractive({useHandCursor:true});
    const close=this.add.text(600,575,'✕ סגירת היומן',{fontFamily:'Arial',fontSize:'20px',color:'#fce4c7'}).setOrigin(.5).setDepth(depth+7).setInteractive({useHandCursor:true});
    this.bookOverlay=[shade,shadow,binding,left,right,title,t1,t2,next,prev,close];
    next.on('pointerdown',()=>{
      if(this.bookPage<2){
        const turning=this.add.rectangle(764,335,320,388,0xffefcb).setOrigin(0.5).setDepth(depth+8);
        this.bookOverlay.push(turning);
        this.tweens.add({targets:turning,scaleX:.015,x:602,duration:380,ease:'Sine.easeIn',onComplete:()=>{if(!this.bookOpen)return;this.bookPage++;this.renderBook();}});
      }else{
        this.closeBook();this.collect('book');
      }
    });
    prev.on('pointerdown',()=>{if(this.bookPage>0){this.bookPage--;this.renderBook();}});
    close.on('pointerdown',()=>{this.closeBook();this.focus('wide');this.report('סגרתם את היומן. אפשר לחזור ולדפדף בו.');});
  }
  private inspectObject(id:'book'|'drawer'){
    if(id==='book'){this.openBook();return;}
    if(this.inspecting||this.collecting||this.save.found.includes(id)||!['search','robot'].includes(this.save.stage))return;
    this.inspecting=true;
    const inspectionId=this.sequenceId;
    this.focus('desk');
    const target={x:280,y:550};
    const object=this.add.container(target.x,target.y).setDepth(12);
    const cavity=this.add.rectangle(0,0,84,35,0x241727,.95).setStrokeStyle(3,0x8c6041);
    const front=this.add.rectangle(0,4,90,30,0x765038,.95).setStrokeStyle(3,0xb58a5a);
    const handle=this.add.circle(0,5,5,0xe3b96f,.95);
    object.add([cavity,front,handle]);
    this.tweens.add({targets:[front,handle],y:'+=25',duration:520,ease:'Cubic.easeOut'});
    object.setAlpha(0);
    this.tweens.add({targets:object,alpha:.92,duration:150});
    this.report('המגירה נשלפת... יש בתוכה משהו נוצץ!');
    this.time.delayedCall(740,()=>{
      if(inspectionId!==this.sequenceId){object.destroy();return;}
      this.tweens.add({targets:object,alpha:0,duration:180,onComplete:()=>object.destroy()});
      this.inspecting=false;
      if(!this.save.found.includes(id))this.collect(id);
    });
  }
  private collect(id:Item){
    if(this.cinematicBusy||this.collecting||this.save.found.includes(id)||this.save.stage==='intro')return;
    this.save.found.push(id);
    this.drawHotspots();
    this.report('הגביש נמצא! הוא בדרך לתיבת האיסוף...');
    this.animatePickup(id,()=>{
      this.refreshMachineFeedback();
      if(this.save.found.length===3){
        this.save.stage='calibrate';this.drawHotspots();this.focus('machine');
        this.report('שלושת הגבישים נאספו! חפשו את השרטוט שעל הלוח כדי לגלות את הקוד למכונה.');
      }else{
        this.report('הגביש נכנס לתיבת האיסוף! '+this.save.found.length+' מתוך 3.');
      }
    });
  }
  private tapRobot(){
    if(this.bookOpen||this.cinematicBusy||this.collecting||this.robotRunning||this.save.found.includes('robot')||!['search','robot'].includes(this.save.stage))return;
    this.save.stage='robot';
    this.save.robotHits++;
    this.robotMotion?.stop();

    this.scatter(this.robot.x,this.robot.y,7);
    if(this.save.robotHits>=3){
      this.robotRunning=false;(this.robot.list[2] as Phaser.GameObjects.Arc).setVisible(false);
      this.collect('robot');
      return;
    }
    this.robotRunning=true;
    (this.robot.list[2] as Phaser.GameObjects.Arc).setVisible(true);
    this.focus('robots');
    const positions=[{x:1060,y:330},{x:900,y:455},{x:1080,y:205},{x:930,y:260}];
    const next=positions[(this.save.robotHits-1)%positions.length];
    this.robotMotion=this.tweens.add({targets:this.robot,x:next.x,y:next.y,duration:1150,ease:'Sine.easeInOut',onStart:()=>this.tweens.add({targets:this.robot,angle:next.x<this.robot.x?-13:13,duration:220,yoyo:true}),onUpdate:()=>{if(Math.random()<.28)this.robotTrail();},onComplete:()=>{this.robotRunning=false;this.tweens.add({targets:this.robot,angle:0,duration:200});}});
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
    this.refreshMachineFeedback();
    this.scatter(589+i*77,416,5);this.drawHotspots();
    this.report('חוגות: '+this.save.dials.map(n=>n+1).join(' · ')+'. '+(this.clueVisible?'הקוד מהשרטוט: 3 · 2 · 4':'אפשר לחזור לשרטוט כדי לבדוק את הקוד.'));
  }
  activate(){
    if(this.save.stage!=='calibrate')return;
    if(!this.save.dials.every((n,i)=>n===DIAL_TARGET[i])){
      this.cameras.main.shake(220,.004);
      this.report('ביפ! משהו לא מכוון. חפשו את השרטוט בלוח המעבדה כדי למצוא את הסדר.');
      return;
    }
    this.save.stage='finale';this.clearClue();this.drawHotspots();this.refreshMachineFeedback();this.focus('machine');
    this.report('המערכת נטענת...');
    this.tweens.add({targets:this.machineGlow,scale:4,alpha:.8,duration:1250,yoyo:true});
    this.cinematicShot(1650,()=>{
      if(this.save.stage!=='finale')return;
      this.cameras.main.shake(1200,.014);this.cameras.main.flash(950,210,165,255);
      this.scatter(665,270,90);
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
    const outer=this.add.ellipse(665,270,270,365,0x271a56,.6).setStrokeStyle(11,0x7de9f0,.85).setDepth(28);
    const inner=this.add.ellipse(665,270,215,315,0x132f58,.85).setStrokeStyle(7,0xc7a2ff,.75).setDepth(29);
    const core=this.add.ellipse(665,270,135,240,0x9cecf3,.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
    const halo=this.add.ellipse(665,270,330,420,0x8a7aff,.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(27);
    this.finaleArt=[halo,outer,inner,core];
    for(const part of this.finaleArt){(part as Phaser.GameObjects.Arc).setAlpha(0).setScale(.08);}
    this.tweens.add({targets:this.finaleArt,alpha:1,scale:1,duration:1200,ease:'Back.easeOut'});
    this.tweens.add({targets:outer,angle:3,duration:1200,yoyo:true,repeat:-1});
    this.tweens.add({targets:inner,angle:-5,duration:1400,yoyo:true,repeat:-1});
    this.tweens.add({targets:core,alpha:.8,scaleX:1.12,duration:750,yoyo:true,repeat:-1});
    this.scatter(665,270,85);
  }
  focus(zone:Zone,animate=true){
    this.zone=zone;const t=VIEWS[zone];
    if(animate){this.cameras.main.pan(t.x,t.y,600,'Cubic.easeInOut');this.cameras.main.zoomTo(t.zoom,600,'Cubic.easeInOut');}
    else{this.cameras.main.centerOn(t.x,t.y);this.cameras.main.setZoom(t.zoom);}
  }
  interact(item:'book'|'drawer'|'robot'){
    if(item==='robot')this.tapRobot();
    else if(this.save.stage==='search'||this.save.stage==='robot')this.inspectObject(item);
  }
  dial(i:number){this.turnDial(i);}
  clue(){this.revealClue();}
  hint(){
    const stage=this.save.stage;
    if(stage==='intro')this.report('הפרופסור השאיר כפתור אדום ענק. מה כבר יכול להשתבש?');
    else if(stage==='search'||stage==='robot')this.report('בדקו את הספר והמגירה שבתמונה. הרובוט מתחמק — צריך לתפוס אותו שלוש פעמים.');
    else if(stage==='calibrate')this.report('הרמז מוסתר בשרטוט שעל לוח המעבדה, בצד השמאלי של המכונה.');
    else this.report('ניצחתם! אפשר להתחיל משחק חדש.');
  }
  restart(){
    this.closeBook();this.sequenceId++;this.cinematicBusy=false;this.cinematic?.setVisible(false);
    this.robotMotion?.stop();this.robotRunning=false;this.collecting=false;this.inspecting=false;this.clearClue();
    
    for(const part of this.finaleArt)part.destroy();this.finaleArt=[];
    this.save={stage:'intro',found:[],dials:[0,0,0],robotHits:0};
    this.robot.setPosition(1030,295);this.robot.setAngle(0);(this.robot.list[2] as Phaser.GameObjects.Arc).setVisible(false);
    this.tweens.killTweensOf(this.machineGlow);this.machineGlow.setScale(1).setAlpha(.2);
    this.tweens.add({targets:this.machineGlow,alpha:.4,scale:1.35,duration:1150,yoyo:true,repeat:-1});
    this.drawHotspots();this.refreshMachineFeedback();this.refreshInventory();this.focus('wide');this.report('המעבדה מוכנה להרפתקה חדשה. לחצו על הכפתור האדום!');
  }
}
@Component({
  selector:'app-root',standalone:true,
  template:`<main class="shell">
    <header class="masthead"><div><span class="eyebrow">THE CHAOS LAB · EPISODE 01</span><h1>⚡ פרופסור כאוס</h1><p>המעבדה יצאה משליטה — האם תצליחו להציל את ההמצאה?</p></div></header>
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
    <p class="help">חקרו את החפצים שבתוך המעבדה · Esc לחזרה למבט הכללי · מקשים 1–3 למעבר אזורים · H לרמז</p>
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
