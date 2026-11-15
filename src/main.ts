import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import Phaser from 'phaser';

class Laboratory extends Phaser.Scene {
  private found = new Set<string>();
  private status!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;
  constructor(){super('laboratory');}
  create(){
    const g=this.add.graphics();
    g.fillGradientStyle(0x35252d,0x35252d,0x78513e,0x78513e).fillRect(0,0,1200,675);
    g.fillStyle(0x493229).fillRect(0,490,1200,185);
    for(let y=60;y<490;y+=42){g.lineStyle(1,0xd5a46f,.1).lineBetween(0,y,1200,y);}
    const txt=(x:number,y:number,s:string,size=22)=>this.add.text(x,y,s,{fontFamily:'Arial',fontSize:size+'px',color:'#fff0d5'}).setOrigin(.5);
    txt(600,42,'⚡ המעבדה של פרופסור כאוס ⚡',36);
    this.add.rectangle(170,310,280,330,0x50382e).setStrokeStyle(8,0xb88b60);
    for(const y of [210,290,370,450])this.add.rectangle(170,y,275,10,0xc39a6a);
    for(let i=0;i<24;i++)this.add.rectangle(53+i%8*32,172+Math.floor(i/8)*80,18,31,[0xb97971,0x8ac5b8,0xcbb07e,0xb7a5cf][i%4]);
    this.add.rectangle(175,510,320,25,0xb88b5c);
    this.add.rectangle(65,575,20,110,0x795037);this.add.rectangle(290,575,20,110,0x795037);
    this.add.rectangle(600,325,325,345,0x63525a).setStrokeStyle(10,0xcba472);
    this.add.circle(600,302,112,0x345a66).setStrokeStyle(11,0xa5e8e3);
    const energy=this.add.circle(600,302,70,0x9cdbed,.8);
    this.tweens.add({targets:energy,alpha:.35,scale:1.16,duration:1200,yoyo:true,repeat:-1});
    for(const x of [520,600,680])this.add.circle(x,444,20,0x30282c).setStrokeStyle(5,0xf0c48b);
    this.add.rectangle(1030,320,275,345,0x5b4338).setStrokeStyle(8,0xb78c61);
    for(const y of [230,330,430])this.add.rectangle(1030,y,270,10,0xb78c61);
    const robot=this.add.container(1030,275,[this.add.rectangle(0,0,96,82,0x91c9be).setStrokeStyle(6,0xe4f9e9),this.add.circle(-22,-8,9,0xffffff),this.add.circle(22,-8,9,0xffffff)]);
    this.tweens.add({targets:robot,y:265,duration:800,yoyo:true,repeat:-1});
    this.status=txt(600,596,'מצאו שלושה גבישי אנרגיה והפעילו את המכונה',22);
    this.count=txt(600,642,'גבישים: 0 / 3',21);
    const action=(x:number,y:number,label:string,cb:()=>void)=>{
      const b=this.add.rectangle(x,y,172,46,0x3d5860,.96).setStrokeStyle(2,0xb4e9e4).setInteractive({useHandCursor:true});
      txt(x,y,label,18);b.on('pointerdown',cb);b.on('pointerover',()=>b.setFillStyle(0x63868a));b.on('pointerout',()=>b.setFillStyle(0x3d5860));
    };
    const collect=(id:string)=>{
      if(this.found.has(id))return;
      this.found.add(id);this.count.setText('גבישים: '+this.found.size+' / 3');
      this.status.setText(this.found.size===3?'מצוין! אפשר להפעיל את המכונה':'נמצא גביש אנרגיה!');
      this.cameras.main.flash(200,150,220,220);
    };
    action(165,115,'📖 ספרים',()=>collect('book'));
    action(175,555,'🗄 מגירה',()=>collect('drawer'));
    action(1030,510,'🤖 תפוס רובוט',()=>this.tweens.add({targets:robot,x:900,duration:300,yoyo:true,onComplete:()=>collect('robot')}));
    action(600,535,'⚡ הפעל מכונה',()=>{
      if(this.found.size<3){this.status.setText('חסרים '+(3-this.found.size)+' גבישים');return;}
      this.cameras.main.shake(500,.008);this.cameras.main.flash(600,180,110,255);this.status.setText('🎉 המכונה פועלת! המשך יבוא...');
    });
    const zoom=(x:number,y:number,z:number)=>{this.cameras.main.pan(x,y,650,'Cubic.easeInOut');this.cameras.main.zoomTo(z,650,'Cubic.easeInOut');};
    action(375,95,'🔎 שולחן',()=>zoom(175,330,1.65));
    action(600,95,'🔎 מכונה',()=>zoom(600,325,1.5));
    action(825,95,'🔎 רובוטים',()=>zoom(1030,330,1.65));
    action(600,158,'↩ כל החדר',()=>zoom(600,337,1));
  }
}
@Component({selector:'app-root',standalone:true,template:`<main><h1>פרופסור כאוס ⚡</h1><p>משחק הרפתקה משפחתי — אבטיפוס ראשוני</p><section id="game" aria-label="המעבדה האינטראקטיבית"></section><p>מצאו שלושה גבישים, התקרבו לאזורים והפעילו את המכונה</p></main>`})
class AppComponent implements AfterViewInit,OnDestroy {
  private game?:Phaser.Game;
  ngAfterViewInit(){this.game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1200,height:675,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Laboratory]});}
  ngOnDestroy(){this.game?.destroy(true);}
}
bootstrapApplication(AppComponent).catch(console.error);
