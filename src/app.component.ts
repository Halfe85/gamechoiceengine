import { Component, OnInit, computed, signal } from '@angular/core';

type View = 'journey' | 'quests' | 'chronicle' | 'library';
type Tone = 'supports' | 'conflicts' | 'unknown';
interface Game { id:string; title:string; developer:string; adapter:string; description:string; }
interface Episode { id:string; game_id:string; number:number; title:string; coverage:string; }
interface Scene { id:string; episode_id:string; number:number; title:string; protagonist:string|null; coverage:string; }
interface Node { id:string; scene_id:string; position:number; kind:string; title:string; description:string; coverage:string; spoiler_level:number; }
interface Option { id:string; node_id:string; position:number; label:string; response_kind:string; verified:number; }
interface Effect { id:string; option_id:string; variable_id:string; value:string; verification:string; }
interface Goal { id:string; game_id:string; name:string; description:string; coverage:string; }
interface Rule { id:string; goal_id:string; variable_id:string; expected_value:string; confidence:string; }
interface Quest { id:string; episode_id:string|null; title:string; description:string; coverage:string; }
interface QuestObjective { id:string; quest_id:string; title:string; variable_id:string|null; expected_value:string|null; }
interface NodeQuestLink { node_id:string; objective_id:string; }
interface Data {
 schemaVersion:number; notice:string; games:Game[]; episodes:Episode[]; scenes:Scene[];
 nodes:Node[]; options:Option[]; effects:Effect[]; goals:Goal[]; goal_rules:Rule[];
 quests:Quest[]; quest_objectives:QuestObjective[]; node_quest_links:NodeQuestLink[];
}
interface SavedPosition { episode:string; scene:string; index:number; }
@Component({selector:'app-root',standalone:true,templateUrl:'./app.component.html',styleUrl:'./app.component.css'})
export class AppComponent implements OnInit {
 readonly view=signal<View>('journey');
 readonly dataset=signal<Data|null>(null);
 readonly error=signal('');
 readonly loading=signal(true);
 readonly goalId=signal('keep-bowen');
 readonly episodeId=signal('got-e1');
 readonly sceneId=signal('got-e1-c1');
 readonly index=signal(0);
 readonly progress=signal<Record<string,string>>({});
 readonly resetConfirm=signal(false);
 readonly chapters=computed(()=>this.dataset()?.scenes.filter(s=>s.episode_id===this.episodeId()) ?? []);
 readonly episodes=computed(()=>this.dataset()?.episodes ?? []);
 readonly goals=computed(()=>this.dataset()?.goals ?? []);
 readonly nodes=computed(()=>(this.dataset()?.nodes.filter(n=>n.scene_id===this.sceneId()) ?? []).sort((a,b)=>a.position-b.position));
 readonly activeNode=computed(()=>this.nodes()[this.index()] ?? null);
 readonly currentEpisode=computed(()=>this.episodes().find(e=>e.id===this.episodeId()));
 readonly currentScene=computed(()=>this.chapters().find(s=>s.id===this.sceneId()));
 readonly selectedGoal=computed(()=>this.goals().find(g=>g.id===this.goalId()));
 readonly completed=computed(()=>this.nodes().filter(n=>!!this.progress()[n.id]).length);
 readonly completion=computed(()=>this.nodes().length?Math.round(100*this.completed()/this.nodes().length):0);
 readonly records=computed(()=>this.dataset()?.nodes.filter(n=>!!this.progress()[n.id]) ?? []);
 readonly toneLabels:Record<Tone,string>={supports:'Supports goal',conflicts:'Conflicts',unknown:'Unverified'};
 constructor(){
   try{
     const history=localStorage.getItem('gce-got-progress-v1');
     if(history)this.progress.set(JSON.parse(history));
     const saved=localStorage.getItem('gce-got-position-v1');
     if(saved){
       const position=JSON.parse(saved) as SavedPosition;
       this.episodeId.set(position.episode);
       this.sceneId.set(position.scene);
       this.index.set(position.index);
     }
     const goal=localStorage.getItem('gce-got-goal-v1');
     if(goal)this.goalId.set(goal);
   }catch{/* Storage may be disabled; a volatile demo still works. */}
 }
 async ngOnInit(){
   try{
     const response=await fetch('data/game-of-thrones.json',{cache:'no-cache'});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const data=await response.json() as Data;
     if(data.schemaVersion!==1)throw new Error('Unsupported game database version');
     this.dataset.set(data);
     if(!data.episodes.some(e=>e.id===this.episodeId()))this.episodeId.set(data.episodes[0]?.id ?? '');
     if(!data.scenes.some(s=>s.id===this.sceneId()&&s.episode_id===this.episodeId()))this.sceneId.set(data.scenes.find(s=>s.episode_id===this.episodeId())?.id ?? '');
     if(!data.goals.some(g=>g.id===this.goalId()))this.goalId.set(data.goals[0]?.id ?? '');
     this.index.update(i=>Math.max(0,Math.min(this.nodes().length-1,i)));
   }catch(err){this.error.set(err instanceof Error?err.message:String(err));}
   finally{this.loading.set(false);}
 }
 optionsFor(node:Node):Option[]{return this.dataset()?.options.filter(o=>o.node_id===node.id).sort((a,b)=>a.position-b.position)??[];}
 goalTone(option:Option):Tone{
   const d=this.dataset();if(!d)return 'unknown';
   const goal=this.selectedGoal();if(!goal||goal.coverage==='unmapped')return 'unknown';
   const verified=d.effects.filter(e=>e.option_id===option.id && e.verification==='verified');
   const rules=d.goal_rules.filter(r=>r.goal_id===goal.id&&r.confidence==='verified');
   for(const effect of verified){
     for(const rule of rules){
       if(rule.variable_id===effect.variable_id)
         return rule.expected_value===effect.value?'supports':'conflicts';
     }
   }
   return 'unknown';
 }
 chosen(node:Node):string{return this.progress()[node.id]??'';}
 pick(node:Node,option:Option){this.progress.update(p=>({...p,[node.id]:option.id}));this.saveProgress();this.next();}
 mark(node:Node){this.progress.update(p=>({...p,[node.id]:'done'}));this.saveProgress();this.next();}
 next(){this.index.update(i=>Math.min(this.nodes().length-1,i+1));this.savePosition();}
 previous(){this.index.update(i=>Math.max(0,i-1));this.savePosition();}
 selectEpisode(id:string){
   this.episodeId.set(id);
   this.sceneId.set(this.dataset()?.scenes.find(s=>s.episode_id===id)?.id ?? '');
   this.index.set(0);this.savePosition();
 }
 selectScene(id:string){this.sceneId.set(id);this.index.set(0);this.savePosition();}
 selectGoal(id:string){this.goalId.set(id);try{localStorage.setItem('gce-got-goal-v1',id);}catch{}}
 labelFor(node:Node):string{
   const id=this.chosen(node);
   if(id==='done')return 'Completed';
   return this.dataset()?.options.find(o=>o.id===id)?.label ?? '';
 }
 questCompleted(q:Quest):boolean {
   const d=this.dataset();if(!d)return false;
   const objectives=d.quest_objectives.filter(x=>x.quest_id===q.id);
   return objectives.length>0&&objectives.every(o=>{
     const associated=d.node_quest_links.filter(l=>l.objective_id===o.id);
     return associated.some(l=>!!this.progress()[l.node_id]);
   });
 }
 reset(){
   if(!this.resetConfirm()){this.resetConfirm.set(true);return;}
   this.progress.set({});this.index.set(0);this.resetConfirm.set(false);this.saveProgress();this.savePosition();
 }
 cancelReset(){this.resetConfirm.set(false);}
 private saveProgress(){try{localStorage.setItem('gce-got-progress-v1',JSON.stringify(this.progress()));}catch{}}
 private savePosition(){try{localStorage.setItem('gce-got-position-v1',JSON.stringify({episode:this.episodeId(),scene:this.sceneId(),index:this.index()}));}catch{}}
}
