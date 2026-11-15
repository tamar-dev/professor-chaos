import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import Phaser from 'phaser';

type Zone = 'wide' | 'desk' | 'machine' | 'robots';
class Laboratory extends Phaser.Scene {
  private found = new Set<string>();
  private status!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private machineActivated = false;
  private zone: Zone = 'wide';
  private robot!: Phaser.GameObjects.Container;
  private robotCaught = false;
  private world!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Container;
  constructor(){ super('laboratory'); }
  preload(){
    this.load.image('laboratory','assets/lab-master.webp');
    this.load.on('loaderror',(file:Phaser.Loader.File)=>{ if(file.key==='laboratory') console.warn('Upload public/assets/lab-master.webp to enable the cinematic artwork.'); });
  }
  create(){
    const centerX=600,centerY=337;
    const worldObjects: Phaser.GameObjects.GameObject[]=[];
    const add=(obj:Phaser.GameObjects.GameObject)=>{worldObjects.push(obj);return obj;};
    if(this.textures.exists('laboratory')){
      add(this.add.image(centerX,centerY,'laboratory').setDisplaySize(1200,675));
    }else{
      const g=this.add.graphics();g.fillGradientStyle(0x35252d,0x35252d,0x78513e,0x78513e).fillRect(0,0,1200,675);
      g.fillStyle(0x493229).fillRect(0,490,1200,185);add(g);
      add(this.add.rectangle(175,360,330,300,0x68432f));
      add(this.add.rectangle(600,330,330,430,0x70505e));
      add(this.add.circle(600,280,120,0x3b849c).setStrokeStyle(12,0xb0e6ed));
      add(this.add.rectangle(1030,360,290,300,0x66503f));
    }
    const glow=add(this.add.circle(600,215,36,0xb8a4ff,.18).setBlendMode(Phaser.BlendModes.ADD));
    this.tweens.add({targets:glow,alpha:.42,scale:1.6,duration:1800,yoyo:true,repeat:-1});
    const robotBody=this.add.rectangle(0,0,45,40,0x9ad9cf,.8).setStrokeStyle(2,0xe4ffff);
    const robotEye1=this.add.circle(-10,-4,4,0x17394a);
    const robotEye2=this.add.circle(10,-4,4,0x17394a);
    this.robot=this.add.container(990,386,[robotBody,robotEye1,robotEye2]);
    add(this.robot);
    this.tweens.add({targets:this.robot,y:379,duration:850,yoyo:true,repeat:-1});
    this.world=this.add.container(0,0,worldObjects);
    this.world.setDepth(0);
    const hudItems: Phaser.GameObjects.GameObject[]=[];
    const label=(x:number,y:number,value:string,size=22,color='#fff2d9')=>{
      const t=this.add.text(x,y,value,{fontFamily:'Arial',fontSize:size+'px',color,align:'center',backgroundColor:'#251c29dd',padding:{x:10,y:7}}).setOrigin(.5).setDepth(100);
      hudItems.push(t);return t;
    };
    label(600,30,'⚡ פרופסור כאוס — המעבדה יצאה משליטה!',27);
    this.status=label(600,589,'חפשו שלושה גבישי אנרגיה כדי לתקן את המכונה',20);
    this.counter=label(600,635,'גבישים: 0 / 3',20,'#b9f4e8');
    const button=(x:number,y:number,title:string,callback:()=>void)=>{
      const bg=this.add.rectangle(x,y,160,43,0x263b43,.96).setStrokeStyle(2,0xafe4e0).setInteractive({useHandCursor:true}).setDepth(100);
      const t=label(x,y,title,17);
      t.setBackgroundColor('transparent');
      bg.on('pointerdown',callback);
      bg.on('pointerover',()=>bg.setFillStyle(0x517b80));
      bg.on('pointerout',()=>bg.setFillStyle(0x263b43));
      hudItems.push(bg);
    };
    const collect=(id:string)=>{
      if(this.found.has(id)){this.status.setText('כבר מצאתם את הגביש הזה!');return;}
      this.found.add(id);
      this.counter.setText('גבישים: '+this.found.size+' / 3');
      this.status.setText(this.found.size===3?'כל הגבישים נמצאו! הפעילו את המכונה':'נמצא גביש אנרגיה! ✨');
      this.cameras.main.flash(180,130,225,210);
    };
    button(160,96,'📚 ספרים',()=>{this.focus('desk');collect('book');});
    button(160,538,'🗄 מגירה',()=>{this.focus('desk');collect('drawer');});
    button(1040,505,'🤖 תפוס רובוט',()=>{
      this.focus('robots');
      if(this.robotCaught){this.status.setText('הרובוט כבר נתפס!');return;}
      this.robotCaught=true;
      this.tweens.add({targets:this.robot,x:1070,angle:25,duration:320,yoyo:true,onComplete:()=>collect('robot')});
    });
    button(600,515,'🔴 הפעל מכונה',()=>{
      this.focus('machine');
      if(this.found.size<3){this.status.setText('חסרים '+(3-this.found.size)+' גבישים');return;}
      if(this.machineActivated)return;
      this.machineActivated=true;
      this.cameras.main.shake(500,.007);this.cameras.main.flash(600,160,100,255);
      this.status.setText('🎉 המכונה פועלת! המשך יבוא...');
    });
    button(245,145,'🔎 שולחן',()=>this.focus('desk'));
    button(425,145,'🔎 מכונה',()=>this.focus('machine'));
    button(775,145,'🔎 רובוטים',()=>this.focus('robots'));
    button(955,145,'↩ כל החדר',()=>this.focus('wide'));
    this.hud=this.add.container(0,0,hudItems).setDepth(100);
    const uiCamera=this.cameras.add(0,0,1200,675);
    this.cameras.main.ignore(this.hud);
    uiCamera.ignore(this.world);
    this.input.keyboard?.on('keydown-ESC',()=>this.focus('wide'));
  }
  private focus(zone:Zone){
    this.zone=zone;
    const targets:{[K in Zone]:{x:number;y:number;zoom:number}}={
      wide:{x:600,y:337,zoom:1},
      desk:{x:270,y:360,zoom:1.65},
      machine:{x:600,y:315,zoom:1.55},
      robots:{x:990,y:350,zoom:1.65}
    };
    const target=targets[zone];
    this.cameras.main.pan(target.x,target.y,650,'Cubic.easeInOut');
    this.cameras.main.zoomTo(target.zoom,650,'Cubic.easeInOut');
  }
}
@Component({selector:'app-root',standalone:true,template:`<main><h1>פרופסור כאוס ⚡</h1><p>המעבדה יצאה משליטה — מצאו את הגבישים והצילו את ההמצאה!</p><section id="game" aria-label="מעבדת פרופסור כאוס"></section><p>לחצו על האזורים כדי להתקרב · Esc לחזרה לחדר</p></main>`})
class AppComponent implements AfterViewInit,OnDestroy {
  private game?:Phaser.Game;
  ngAfterViewInit(){this.game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1200,height:675,backgroundColor:'#231d29',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Laboratory]});}
  ngOnDestroy(){this.game?.destroy(true);}
}
bootstrapApplication(AppComponent).catch(console.error);
