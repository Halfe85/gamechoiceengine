import { Component, OnInit, computed, signal } from '@angular/core';

type View = 'home' | 'games' | 'journey' | 'quests' | 'chronicle';
type Tone = 'supports' | 'conflicts' | 'unknown';
interface Game { id:string; title:string; developer:string; adapter:string; description:string; }
interface NewsItem { id:string; game_id:string|null; kind:string; title:string; description:string; published_on:string; sort_order:number; }
interface Episode { id:string; game_id:string; number:number; title:string; coverage:string; }
interface Scene { id:string; episode_id:string; number:number; title:string; protagonist:string|null; coverage:string; }
interface Node { id:string; scene_id:string; position:number; kind:string; title:string; description:string; coverage:string; spoiler_level:number; }
interface Option { id:string; node_id:string; position:number; label:string; response_kind:string; verified:number; }
interface Effect { id:string; option_id:string; variable_id:string; value:string; verification:string; }
interface Goal { id:string; game_id:string; name:string; description:string; coverage:string; }
interface Rule { id:string; goal_id:string; variable_id:string; expected_value:string; confidence:string; }
interface Quest { id:string; game_id:string; episode_id:string|null; title:string; description:string; coverage:string; }
interface QuestObjective { id:string; quest_id:string; title:string; variable_id:string|null; expected_value:string|null; }
interface NodeQuestLink { node_id:string; objective_id:string; }
interface Data {
 schemaVersion:number; notice:string; games:Game[]; news_items:NewsItem[]; episodes:Episode[]; scenes:Scene[];
 nodes:Node[]; options:Option[]; effects:Effect[]; goals:Goal[]; goal_rules:Rule[];
 quests:Quest[]; quest_objectives:QuestObjective[]; node_quest_links:NodeQuestLink[];
}
interface SavedPosition { episode:string; scene:string; index:number; }
@Component({selector:'app-root',standalone:true,templateUrl:'./app.component.html',styleUrl:'./app.component.css'})
export class AppComponent implements OnInit {
 readonly view=signal<View>('home');
 readonly gameId=signal('got-telltale');
 readonly dataset=signal<Data|null>(null);
 readonly error=signal('');
 readonly loading=signal(true);
 readonly goalId=signal('keep-bowen');
 readonly episodeId=signal('got-e1');
 readonly sceneId=signal('got-e1-c1');
 readonly index=signal(0);
 readonly progress=signal<Record<string,string>>({});
 readonly resetConfirm=signal(false);
 readonly savedProgressByGame=signal<Record<string,Record<string,string>>>({});
 readonly games=computed(()=>this.dataset()?.games ?? []);
 readonly news=computed(()=>[...(this.dataset()?.news_items ?? [])].sort((a,b)=>b.sort_order-a.sort_order));
 // Percentages measure recorded events within the currently mapped story data.
 // Games without recorded steps deliberately have no percentage at all.
 readonly gameProgress=computed(()=>{
   const data=this.dataset();
   const saves=this.savedProgressByGame();
   const result:Record<string,number>={};
   if(!data)return result;
   for(const game of data.games){
     const episodes=new Set(data.episodes.filter(e=>e.game_id===game.id).map(e=>e.id));
     const scenes=new Set(data.scenes.filter(s=>episodes.has(s.episode_id)).map(s=>s.id));
     const nodes=data.nodes.filter(n=>scenes.has(n.scene_id));
     if(!nodes.length)continue;
     const recorded=saves[game.id] ?? {};
     const count=nodes.filter(n=>{
       const choice=recorded[n.id];
       return typeof choice==='string' && (
         choice==='done' ||
         data.options.some(o=>o.node_id===n.id && o.id===choice)
       );
     }).length;
     if(count>0)result[game.id]=Math.round(count/nodes.length*100);
   }
   return result;
 });
 readonly currentGame=computed(()=>this.games().find(g=>g.id===this.gameId()) ?? null);
 readonly chapters=computed(()=>this.dataset()?.scenes.filter(s=>s.episode_id===this.episodeId()) ?? []);
 readonly episodes=computed(()=>this.dataset()?.episodes.filter(e=>e.game_id===this.gameId()) ?? []);
 readonly goals=computed(()=>this.dataset()?.goals.filter(g=>g.game_id===this.gameId()) ?? []);
 readonly quests=computed(()=>this.dataset()?.quests.filter(q=>q.game_id===this.gameId()) ?? []);
 readonly nodes=computed(()=>(this.dataset()?.nodes.filter(n=>n.scene_id===this.sceneId()) ?? []).sort((a,b)=>a.position-b.position));
 readonly activeNode=computed(()=>this.nodes()[this.index()] ?? null);
 readonly currentEpisode=computed(()=>this.episodes().find(e=>e.id===this.episodeId()));
 readonly currentScene=computed(()=>this.chapters().find(s=>s.id===this.sceneId()));
 readonly selectedGoal=computed(()=>this.goals().find(g=>g.id===this.goalId()));
 readonly completed=computed(()=>this.nodes().filter(n=>!!this.progress()[n.id]).length);
 readonly completion=computed(()=>this.nodes().length?Math.round(100*this.completed()/this.nodes().length):0);
 readonly records=computed(()=>{
   const d=this.dataset();if(!d)return [];
   const episodeIds=new Set(d.episodes.filter(e=>e.game_id===this.gameId()).map(e=>e.id));
   const sceneIds=new Set(d.scenes.filter(s=>episodeIds.has(s.episode_id)).map(s=>s.id));
   return d.nodes.filter(n=>sceneIds.has(n.scene_id)&&!!this.progress()[n.id]);
 });
 readonly toneLabels:Record<Tone,string>={supports:'Supports goal',conflicts:'Conflicts',unknown:'Unverified'};
 constructor(){
   try{
     const savedGame=localStorage.getItem('gce-selected-game-v1');
     if(savedGame)this.gameId.set(savedGame);
   }catch{/* Local storage may be unavailable. */}
 }
 async ngOnInit(){
   try{
     const response=await fetch('data/game-of-thrones.json',{cache:'no-cache'});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const data=await response.json() as Data;
     if(data.schemaVersion!==1)throw new Error('Unsupported game database version');
     this.dataset.set(data);
     this.loadAllSavedProgress(data);
     const initialGame=data.games.some(g=>g.id===this.gameId())?this.gameId():data.games[0]?.id ?? '';
     this.gameId.set(initialGame);
     this.loadForGame(initialGame);
   }catch(err){this.error.set(err instanceof Error?err.message:String(err));}
   finally{this.loading.set(false);}
 }
 private loadAllSavedProgress(data:Data){
   const cache:Record<string,Record<string,string>>={};
   for(const game of data.games){
     try{
       const raw=localStorage.getItem('gce-'+game.id+'-progress-v1') ??
         (game.id==='got-telltale'?localStorage.getItem('gce-got-progress-v1'):null);
       if(!raw)continue;
       const parsed:unknown=JSON.parse(raw);
       if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){
         const valid:Record<string,string>={};
         for(const [id,value] of Object.entries(parsed)){
           if(typeof value==='string')valid[id]=value;
         }
         cache[game.id]=valid;
       }
     }catch{/* A corrupted or unavailable save must not block other games. */}
   }
   this.savedProgressByGame.set(cache);
 }
 episodeCount(gameId:string):number{return this.dataset()?.episodes.filter(e=>e.game_id===gameId).length??0;}
 hasEpisodes(gameId:string):boolean{return this.episodeCount(gameId)>0;}
 selectGame(id:string){
   if(!this.games().some(g=>g.id===id))return;
   this.gameId.set(id);
   this.loadForGame(id);
   this.resetConfirm.set(false);
   this.view.set('journey');
   try{localStorage.setItem('gce-selected-game-v1',id);}catch{}
 }
 private loadForGame(id:string){
   const d=this.dataset();if(!d)return;
   let progress:Record<string,string>={};
   let position:SavedPosition|null=null;
   let goal='';
   try{
     const priorProgress=localStorage.getItem('gce-'+id+'-progress-v1') ??
       (id==='got-telltale'?localStorage.getItem('gce-got-progress-v1'):null);
     if(priorProgress){
       const parsed:unknown=JSON.parse(priorProgress);
       if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))progress=parsed as Record<string,string>;
     }
     const priorPosition=localStorage.getItem('gce-'+id+'-position-v1') ??
       (id==='got-telltale'?localStorage.getItem('gce-got-position-v1'):null);
     if(priorPosition)position=JSON.parse(priorPosition) as SavedPosition;
     goal=localStorage.getItem('gce-'+id+'-goal-v1') ??
       (id==='got-telltale'?localStorage.getItem('gce-got-goal-v1'):'') ?? '';
   }catch{/* Saved data may be invalid or unavailable. */}
   this.progress.set(progress);
   const episodes=d.episodes.filter(e=>e.game_id===id);
   const episode=episodes.find(e=>e.id===position?.episode)?.id ?? episodes[0]?.id ?? '';
   this.episodeId.set(episode);
   const scenes=d.scenes.filter(scene=>scene.episode_id===episode);
   this.sceneId.set(scenes.find(scene=>scene.id===position?.scene)?.id ?? scenes[0]?.id ?? '');
   const goals=d.goals.filter(g=>g.game_id===id);
   this.goalId.set(goals.find(g=>g.id===goal)?.id ?? goals[0]?.id ?? '');
   const length=d.nodes.filter(node=>node.scene_id===this.sceneId()).length;
   const savedIndex=position&&Number.isInteger(position.index)?position.index:0;
   this.index.set(Math.max(0,Math.min(length-1,savedIndex)));
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
 selectGoal(id:string){this.goalId.set(id);try{localStorage.setItem('gce-'+this.gameId()+'-goal-v1',id);}catch{}}
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
 private saveProgress(){
   const latest=this.progress();
   this.savedProgressByGame.update(old=>({...old,[this.gameId()]:latest}));
   try{localStorage.setItem('gce-'+this.gameId()+'-progress-v1',JSON.stringify(latest));}catch{}
 }
 private savePosition(){try{localStorage.setItem('gce-'+this.gameId()+'-position-v1',JSON.stringify({episode:this.episodeId(),scene:this.sceneId(),index:this.index()}));}catch{}}
}
