PRAGMA foreign_keys=ON;
-- Game Choice Engine: reusable event graph schema, v1.
CREATE TABLE games (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, developer TEXT NOT NULL,
  adapter TEXT NOT NULL, description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE episodes (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id),
  number INTEGER NOT NULL CHECK(number>0), title TEXT NOT NULL,
  coverage TEXT NOT NULL CHECK(coverage IN ('metadata','partial','complete')),
  UNIQUE(game_id,number)
);
CREATE TABLE scenes (
  id TEXT PRIMARY KEY, episode_id TEXT NOT NULL REFERENCES episodes(id),
  number INTEGER NOT NULL, title TEXT NOT NULL, protagonist TEXT,
  coverage TEXT NOT NULL CHECK(coverage IN ('outline','partial','complete')),
  UNIQUE(episode_id,number)
);
CREATE TABLE nodes (
  id TEXT PRIMARY KEY, scene_id TEXT NOT NULL REFERENCES scenes(id),
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('story','dialogue','action','decision','qte','check','inventory','quest','transition')),
  title TEXT NOT NULL, description TEXT NOT NULL,
  coverage TEXT NOT NULL CHECK(coverage IN ('outline','partial','complete')),
  spoiler_level INTEGER NOT NULL DEFAULT 0,
  UNIQUE(scene_id,position)
);
CREATE TABLE options (
  id TEXT PRIMARY KEY, node_id TEXT NOT NULL REFERENCES nodes(id),
  position INTEGER NOT NULL, label TEXT NOT NULL,
  response_kind TEXT NOT NULL CHECK(response_kind IN ('say','do','silent','success','failure','skip')),
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  UNIQUE(node_id,position)
);
CREATE TABLE variables (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id),
  label TEXT NOT NULL, value_type TEXT NOT NULL CHECK(value_type IN ('boolean','number','text')),
  default_value TEXT
);
CREATE TABLE effects (
  id TEXT PRIMARY KEY, option_id TEXT NOT NULL REFERENCES options(id),
  variable_id TEXT NOT NULL REFERENCES variables(id),
  operation TEXT NOT NULL CHECK(operation IN ('set','increment')),
  value TEXT NOT NULL, verification TEXT NOT NULL CHECK(verification IN ('verified','inferred','unknown')),
  source_id TEXT REFERENCES sources(id)
);
CREATE TABLE goals (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id),
  name TEXT NOT NULL, description TEXT NOT NULL,
  coverage TEXT NOT NULL CHECK(coverage IN ('verified','partial','unmapped'))
);
CREATE TABLE goal_rules (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id),
  variable_id TEXT NOT NULL REFERENCES variables(id),
  expected_value TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 1,
  confidence TEXT NOT NULL CHECK(confidence IN ('verified','inferred','unknown'))
);
CREATE TABLE quests (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id),
  episode_id TEXT REFERENCES episodes(id), title TEXT NOT NULL,
  description TEXT NOT NULL, coverage TEXT NOT NULL CHECK(coverage IN ('outline','partial','complete'))
);
CREATE TABLE quest_objectives (
  id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id),
  position INTEGER NOT NULL, title TEXT NOT NULL, variable_id TEXT REFERENCES variables(id),
  expected_value TEXT, UNIQUE(quest_id,position)
);
CREATE TABLE node_quest_links (
  node_id TEXT NOT NULL REFERENCES nodes(id), objective_id TEXT NOT NULL REFERENCES quest_objectives(id),
  PRIMARY KEY(node_id,objective_id)
);
CREATE TABLE sources (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE
);
CREATE TABLE evidence (
  source_id TEXT NOT NULL REFERENCES sources(id),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', PRIMARY KEY(source_id,entity_type,entity_id)
);
CREATE INDEX idx_nodes_scene ON nodes(scene_id,position);
CREATE INDEX idx_options_node ON options(node_id,position);
CREATE INDEX idx_effects_option ON effects(option_id);
CREATE INDEX idx_rules_goal ON goal_rules(goal_id);
CREATE INDEX idx_scenes_episode ON scenes(episode_id,number);


-- Extensions for true branching stories. Not all tables are populated by the initial seed.
CREATE TABLE dialogue_turns (
  id TEXT PRIMARY KEY, node_id TEXT NOT NULL REFERENCES nodes(id),
  turn_index INTEGER NOT NULL, speaker TEXT, paraphrase TEXT NOT NULL,
  exhaustive INTEGER NOT NULL DEFAULT 0 CHECK(exhaustive IN (0,1)),
  UNIQUE(node_id,turn_index)
);
CREATE TABLE condition_groups (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id),
  logic TEXT NOT NULL CHECK(logic IN ('all','any'))
);
CREATE TABLE condition_terms (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES condition_groups(id),
  variable_id TEXT NOT NULL REFERENCES variables(id),
  comparison TEXT NOT NULL CHECK(comparison IN ('eq','neq','gt','gte','lt','lte','exists')),
  expected_value TEXT
);
CREATE TABLE event_transitions (
  id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL REFERENCES nodes(id),
  via_option_id TEXT REFERENCES options(id),
  to_node_id TEXT NOT NULL REFERENCES nodes(id),
  condition_group_id TEXT REFERENCES condition_groups(id),
  priority INTEGER NOT NULL DEFAULT 0,
  verification TEXT NOT NULL CHECK(verification IN ('verified','inferred','unknown'))
);
CREATE TABLE mechanic_checks (
  id TEXT PRIMARY KEY, node_id TEXT NOT NULL REFERENCES nodes(id),
  mechanic_key TEXT NOT NULL, config_json TEXT NOT NULL CHECK(json_valid(config_json)),
  success_option_id TEXT REFERENCES options(id),
  failure_option_id TEXT REFERENCES options(id)
);
CREATE INDEX idx_turns_node ON dialogue_turns(node_id,turn_index);
CREATE INDEX idx_edges_source ON event_transitions(from_node_id,priority);
CREATE INDEX idx_conditions_group ON condition_terms(group_id);

-- Publishing feed for the Home screen; sort_order determines newest first.
CREATE TABLE news_items (
  id TEXT PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  kind TEXT NOT NULL CHECK(kind IN ('game_added','content_update','announcement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  published_on TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);
CREATE INDEX idx_news_order ON news_items(sort_order DESC);
