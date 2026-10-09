import { Component, OnInit, computed, signal } from '@angular/core';

type View = 'home' | 'games' | 'ending' | 'chapters' | 'journey' | 'quests' | 'chronicle';
type EndingPreference = 'best' | 'bad' | 'balanced' | 'own';
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
interface DialogueTurn {
 id:string; node_id:string; turn_index:number; speaker:string|null; prompt_text:string|null;
 language_code:string; verification:'pending'|'verified'; source_id:string|null; exhaustive:number;
}
interface DialogueOption {
 id:string; turn_id:string; option_id:string; position:number; screen_text:string;
 language_code:string; verification:'pending'|'verified'; source_id:string|null;
}
interface DialogueReply {
 id:string; dialogue_option_id:string; position:number; speaker:string|null;
 spoken_text:string; language_code:string; verification:'pending'|'verified'; source_id:string|null;
}
interface Data {
 schemaVersion:number; notice:string; games:Game[]; news_items:NewsItem[]; episodes:Episode[]; scenes:Scene[];
 nodes:Node[]; options:Option[]; dialogue_turns:DialogueTurn[]; dialogue_options:DialogueOption[]; dialogue_replies:DialogueReply[]; effects:Effect[]; goals:Goal[]; goal_rules:Rule[];
 quests:Quest[]; quest_objectives:QuestObjective[]; node_quest_links:NodeQuestLink[];
}
interface SavedPosition { episode:string; scene:string; index:number; nodeId?:string|null; turnIndex?:number; turnId?:string|null; }
@Component({selector:'app-root',standalone:true,templateUrl:'./app.component.html',styleUrl:'./app.component.css'})
export class AppComponent implements OnInit {
 readonly view=signal<View>('home');
 readonly gameId=signal('got-telltale');
 readonly dataset=signal<Data|null>(null);
 readonly error=signal('');
 readonly loading=signal(true);
 readonly endingPreference=signal<EndingPreference|null>(null);
 readonly endingDraft=signal<EndingPreference|null>(null);
 readonly endingChoices:ReadonlyArray<{id:EndingPreference;title:string;description:string;symbol:string}>=[
   {id:'best',title:'Best Ending',description:'Aim for the most favorable outcome.',symbol:'✧'},
   {id:'bad',title:'Bad Ending',description:'Explore a darker path through the story.',symbol:'◆'},
   {id:'balanced',title:'Balanced Ending',description:'Look for a middle ground between extremes.',symbol:'⚖'},
   {id:'own',title:'My Own Story',description:'Track your decisions without aiming for an ending.',symbol:'✦'}
 ];
 readonly episodeId=signal('got-e1');
 readonly sceneId=signal('got-e1-c1');
 readonly browseEpisodeId=signal('got-e1');
 readonly index=signal(0);
 readonly dialogueIndex=signal(0);
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
 readonly browseChapters=computed(()=>this.dataset()?.scenes.filter(s=>s.episode_id===this.browseEpisodeId()) ?? []);
 readonly episodes=computed(()=>this.dataset()?.episodes.filter(e=>e.game_id===this.gameId()) ?? []);
 readonly endingLabel=computed(()=>this.endingChoices.find(choice=>choice.id===this.endingPreference())?.title ?? 'Choose an ending');
 // Spoiler-free ending preferences are separate from evidence-backed story goals.
 // Do not recommend story choices unless a specific game goal is explicitly mapped.
 readonly mappedGoal=computed(()=>{
   const pref=this.endingPreference();
   const game=this.gameId();
   if(!pref||pref==='own')return null;
   return this.dataset()?.goals.find(g=>g.game_id===game && g.id===game+'-'+pref+'-ending' && g.coverage!=='unmapped') ?? null;
 });
 readonly quests=computed(()=>this.dataset()?.quests.filter(q=>q.game_id===this.gameId()) ?? []);
 readonly nodes=computed(()=>(this.dataset()?.nodes.filter(n=>n.scene_id===this.sceneId()) ?? []).sort((a,b)=>a.position-b.position));

 readonly activeNode=computed(()=>this.nodes()[this.index()] ?? null);
 readonly activeDialogueTurns=computed(()=>{
   const node=this.activeNode();
   return node?.kind==='dialogue'
     ? (this.dataset()?.dialogue_turns ?? []).filter(t=>t.node_id===node.id)
         .sort((a,b)=>a.turn_index-b.turn_index)
     : [];
 });
 readonly activeDialogueTurn=computed(()=>this.activeDialogueTurns()[this.dialogueIndex()] ?? null);
 readonly activeDialogueOptions=computed(()=>{
   const turn=this.activeDialogueTurn();
   return turn ? (this.dataset()?.dialogue_options ?? [])
     .filter(o=>o.turn_id===turn.id).sort((a,b)=>a.position-b.position) : [];
 });
 readonly dialogueVerified=computed(()=>{
   const turn=this.activeDialogueTurn(), items=this.activeDialogueOptions(), data=this.dataset();
   return !!data && !!turn && turn.verification==='verified' &&
     !!turn.source_id && !!turn.prompt_text?.trim() && turn.exhaustive===1 &&
     items.length>0 && items.every(o=>o.verification==='verified' &&
       !!o.source_id && !!o.screen_text.trim() &&
       data.options.some(engineOption=>engineOption.id===o.option_id&&engineOption.node_id===turn.node_id));
 });
 readonly currentEpisode=computed(()=>this.episodes().find(e=>e.id===this.episodeId()));
 readonly currentScene=computed(()=>this.chapters().find(s=>s.id===this.sceneId()));
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
 chooseEnding(choice:EndingPreference){this.endingDraft.set(choice);}
 openEndingSelection(){this.endingDraft.set(this.endingPreference());this.view.set('ending');}
 confirmEnding(){
   const chosen=this.endingDraft();
   if(!chosen)return;
   this.endingPreference.set(chosen);
   try{localStorage.setItem('gce-'+this.gameId()+'-ending-preference-v1',chosen);}catch{}
   this.view.set('journey');
 }
 openTracker(){
   if(!this.endingPreference()){this.openEndingSelection();return;}
   this.view.set('journey');
 }
 openChapters(){this.browseEpisodeId.set(this.episodeId());this.view.set('chapters');}
 selectBrowseEpisode(id:string){
   if(this.episodes().some(e=>e.id===id))this.browseEpisodeId.set(id);
 }
 goToChapter(id:string){
   const episode=this.browseEpisodeId();
   if(!this.dataset()?.scenes.some(scene=>scene.id===id&&scene.episode_id===episode))return;
   this.episodeId.set(episode);
   this.sceneId.set(id);
   this.index.set(0);
   this.dialogueIndex.set(0);
   this.savePosition();
   this.openTracker();
 }
 episodeCount(gameId:string):number{return this.dataset()?.episodes.filter(e=>e.game_id===gameId).length??0;}
 hasEpisodes(gameId:string):boolean{return this.episodeCount(gameId)>0;}
 selectGame(id:string){
   if(!this.games().some(g=>g.id===id))return;
   this.gameId.set(id);
   this.loadForGame(id);
   this.resetConfirm.set(false);
   // Existing players resume their exact last recorded location.
   // Only first-time players need to choose a spoiler-free ending.
   this.view.set(this.endingPreference() ? 'journey' : 'ending');
   try{localStorage.setItem('gce-selected-game-v1',id);}catch{}
 }
 private loadForGame(id:string){
   const d=this.dataset();if(!d)return;
   let progress:Record<string,string>={};
   let position:SavedPosition|null=null;
   let preference:EndingPreference|null=null;
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
     const value=localStorage.getItem('gce-'+id+'-ending-preference-v1');
     if(value==='best'||value==='bad'||value==='balanced'||value==='own')preference=value;
   }catch{/* Saved data may be invalid or unavailable. */}
   this.progress.set(progress);
   const episodes=d.episodes.filter(e=>e.game_id===id);
   const episode=episodes.find(e=>e.id===position?.episode)?.id ?? episodes[0]?.id ?? '';
   this.episodeId.set(episode);
   const scenes=d.scenes.filter(scene=>scene.episode_id===episode);
   this.sceneId.set(scenes.find(scene=>scene.id===position?.scene)?.id ?? scenes[0]?.id ?? '');
   this.endingPreference.set(preference);
   this.endingDraft.set(preference);
   const sceneNodes=d.nodes.filter(node=>node.scene_id===this.sceneId()).sort((a,b)=>a.position-b.position);
   const storedNodeIndex=position?.nodeId?sceneNodes.findIndex(node=>node.id===position.nodeId):-1;
   const storedIndex=position&&Number.isInteger(position.index)?position.index:0;
   const resumeIndex=storedNodeIndex>=0?storedNodeIndex:storedIndex;
   this.index.set(Math.max(0,Math.min(sceneNodes.length-1,resumeIndex)));
   const currentNode=sceneNodes[this.index()];
   const turns=currentNode?.kind==='dialogue'
     ? (d.dialogue_turns ?? []).filter(t=>t.node_id===currentNode.id).sort((a,b)=>a.turn_index-b.turn_index)
     : [];
   const storedTurnIndex=position?.turnId?turns.findIndex(turn=>turn.id===position?.turnId):-1;
   const fallbackTurn=position && typeof position.turnIndex==='number' &&
     Number.isInteger(position.turnIndex) ? position.turnIndex : 0;
   this.dialogueIndex.set(Math.max(0,Math.min(turns.length-1,storedTurnIndex>=0?storedTurnIndex:fallbackTurn)));
 }

 optionsFor(node:Node):Option[]{
   if(node.kind==='dialogue')return [];
   return this.dataset()?.options.filter(o=>o.node_id===node.id).sort((a,b)=>a.position-b.position)??[];
 }
 repliesFor(option:DialogueOption):DialogueReply[]{
   return (this.dataset()?.dialogue_replies ?? [])
     .filter(r=>r.dialogue_option_id===option.id && r.verification==='verified' && !!r.source_id)
     .sort((a,b)=>a.position-b.position);
 }
 selectedDialogueOption(turn:DialogueTurn):DialogueOption|null{
   const selected=this.progress()[turn.id];
   return this.dataset()?.dialogue_options.find(o=>o.turn_id===turn.id && o.option_id===selected &&
     o.verification==='verified' && !!o.source_id) ?? null;
 }
 pickDialogue(option:DialogueOption){
   const node=this.activeNode(), turn=this.activeDialogueTurn();
   if(!node||!turn||!this.dialogueVerified()||option.turn_id!==turn.id)return;
   if(!this.activeDialogueOptions().some(o=>o.id===option.id))return;
   this.progress.update(progress=>{
     const updated={...progress,[turn.id]:option.option_id};
     const allTurns=this.activeDialogueTurns();
     if(allTurns.length>0 && allTurns.every(t=>!!updated[t.id]))updated[node.id]='done';
     return updated;
   });
   this.saveProgress();
   // Stay on the selected line so exact follow-up dialogue remains visible.
   // The player advances deliberately with the Next arrow.
   this.savePosition();
 }
 goalTone(option:Option):Tone{
   const d=this.dataset();if(!d)return 'unknown';
   const goal=this.mappedGoal();if(!goal)return 'unknown';
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

 next(){
   if(this.activeNode()?.kind==='dialogue' && this.dialogueIndex()<this.activeDialogueTurns().length-1){
     this.dialogueIndex.update(i=>i+1);
   }else{
     this.index.update(i=>Math.min(this.nodes().length-1,i+1));
     this.dialogueIndex.set(0);
   }
   this.savePosition();
 }
 previous(){
   if(this.activeNode()?.kind==='dialogue' && this.dialogueIndex()>0){
     this.dialogueIndex.update(i=>i-1);
   }else{
     this.index.update(i=>Math.max(0,i-1));
     const node=this.activeNode();
     const turns=node?.kind==='dialogue'
       ? (this.dataset()?.dialogue_turns ?? []).filter(t=>t.node_id===node.id):[];
     this.dialogueIndex.set(Math.max(0,turns.length-1));
   }
   this.savePosition();
 }
 labelFor(node:Node):string{
   const id=this.chosen(node);
   if(node.kind==='dialogue'){
     return (this.dataset()?.dialogue_turns ?? []).filter(t=>t.node_id===node.id)
       .sort((a,b)=>a.turn_index-b.turn_index)
       .map(t=>this.selectedDialogueOption(t)?.screen_text)
       .filter((label):label is string=>!!label).join(' · ') || 'Dialogue not transcribed';
   }
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
   this.progress.set({});this.index.set(0);this.dialogueIndex.set(0);this.resetConfirm.set(false);this.saveProgress();this.savePosition();
 }
 cancelReset(){this.resetConfirm.set(false);}
 private saveProgress(){
   const latest=this.progress();
   this.savedProgressByGame.update(old=>({...old,[this.gameId()]:latest}));
   try{localStorage.setItem('gce-'+this.gameId()+'-progress-v1',JSON.stringify(latest));}catch{}
 }
 private savePosition(){
   const position:SavedPosition={
     episode:this.episodeId(),scene:this.sceneId(),index:this.index(),
     nodeId:this.activeNode()?.id ?? null,
     turnIndex:this.dialogueIndex(),turnId:this.activeDialogueTurn()?.id ?? null
   };
   try{localStorage.setItem('gce-'+this.gameId()+'-position-v1',JSON.stringify(position));}catch{}
 }
}
