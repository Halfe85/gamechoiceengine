import { Component, signal } from '@angular/core';
type View = 'journey'|'quests'|'chronicle'|'library';
@Component({selector:'app-root',standalone:true,templateUrl:'./app.component.html',styleUrl:'./app.component.css'})
export class AppComponent {
 view=signal<View>('journey'); ending=signal('Save the Grove & Allies');
 chosen=signal(localStorage.getItem('gce-choice')||''); questDone=signal(localStorage.getItem('gce-quest')==='yes');
 chapter=signal(0);
 chapters=['The Emerald Grove','The Goblin Camp','The Shadow-Cursed Lands'];
 choices=[
 {id:'protect',name:'Stand with the tieflings',detail:'Protect the refugees and their future.',tone:'essential',label:'Crucial'},
 {id:'investigate',name:'Investigate Kagha',detail:'Find the truth before confronting the druid.',tone:'recommended',label:'Recommended'},
 {id:'explore',name:'Explore before deciding',detail:'Gather more information before you act.',tone:'optional',label:'Optional'},
 {id:'betray',name:'Turn against the grove',detail:'Side with an opposing force.',tone:'danger',label:'Against goal'}];
 setChoice(id:string){this.chosen.set(id);localStorage.setItem('gce-choice',id)}
 setQuest(){this.questDone.update(x=>!x);localStorage.setItem('gce-quest',this.questDone()?'yes':'no')}
 move(n:number){this.chapter.update(x=>Math.max(0,Math.min(this.chapters.length-1,x+n)))}
}