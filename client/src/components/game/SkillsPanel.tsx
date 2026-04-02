import { useMemo, useState } from 'react';
import { useGameStore } from '../../game/store';
import { SKILLS } from '../../game/constants';
import { Skill, SkillBranch } from '../../game/types';
import { T } from '../../game/translations';
import {
  FlaskConical,
  Lock,
  Shield,
  Sparkles,
  Star,
  Sword,
  TreePine,
  Unlock,
  Zap,
  Orbit,
  Crosshair,
  Leaf,
  Skull,
  ShieldPlus,
  CircleDot,
} from 'lucide-react';

type SkillNode = {
  id: string;
  x: number;
  y: number;
  branch: SkillBranch;
  depth: number;
};

type SkillViewFilter = 'all' | 'combat' | 'active' | 'passive';

const BRANCHES: SkillBranch[] = ['alchemy', 'tactics', 'warfare', 'survival'];

const BRANCH_META: Record<
  SkillBranch,
  { en: string; ru: string; color: string; angleDeg: number; spreadDeg: number; hubX: number; hubY: number }
> = {
  alchemy: { en: 'Alchemy', ru: 'Алхимия', color: '#61a8ff', angleDeg: -88, spreadDeg: 62, hubX: 50, hubY: 11 },
  tactics: { en: 'Tactics', ru: 'Тактика', color: '#8f73e9', angleDeg: -16, spreadDeg: 54, hubX: 90, hubY: 38 },
  warfare: { en: 'Warfare', ru: 'Воинское дело', color: '#df5266', angleDeg: 35, spreadDeg: 56, hubX: 89, hubY: 83 },
  survival: { en: 'Survival', ru: 'Выживание', color: '#52bb73', angleDeg: 218, spreadDeg: 66, hubX: 11, hubY: 84 },
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function skillDepth(skillId: string, cache: Map<string, number>): number {
  if (cache.has(skillId)) return cache.get(skillId)!;
  const skill = SKILLS[skillId];
  if (!skill) return 0;
  const requires = skill.requires || [];
  if (requires.length === 0) {
    cache.set(skillId, 0);
    return 0;
  }
  const d = Math.max(...requires.map((req) => skillDepth(req, cache))) + 1;
  cache.set(skillId, d);
  return d;
}

function BranchIcon({ branch }: { branch: SkillBranch }) {
  if (branch === 'warfare') return <Sword className="w-4 h-4" />;
  if (branch === 'survival') return <TreePine className="w-4 h-4" />;
  if (branch === 'alchemy') return <FlaskConical className="w-4 h-4" />;
  return <Shield className="w-4 h-4" />;
}

function SkillGlyph({ skill }: { skill: Skill }) {
  if (skill.effect.type === 'active') return <Zap className="w-3.5 h-3.5" />;
  if (skill.effect.type === 'ultimate') return <Sparkles className="w-3.5 h-3.5" />;
  if (skill.effect.type === 'passive') {
    if (skill.id.includes('defense') || skill.id.includes('guard')) return <ShieldPlus className="w-3.5 h-3.5" />;
    if (skill.id.includes('poison') || skill.id.includes('berserk')) return <Skull className="w-3.5 h-3.5" />;
    return <Leaf className="w-3.5 h-3.5" />;
  }
  if (skill.effect.type === 'stat' && skill.effect.stat === 'damage') return <Crosshair className="w-3.5 h-3.5" />;
  return <CircleDot className="w-3.5 h-3.5" />;
}

function skillMatchesFilter(skill: Skill, filter: SkillViewFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'combat') return skill.effect.type === 'active' || skill.effect.type === 'ultimate' || skill.effect.type === 'passive';
  if (filter === 'active') return skill.effect.type === 'active' || skill.effect.type === 'ultimate';
  return skill.effect.type === 'passive';
}

export default function SkillsPanel() {
  const { player, learnSkill, settings } = useGameStore();
  const l = settings.language;
  const [selectedId, setSelectedId] = useState<string>(() => Object.keys(SKILLS)[0]);
  const [viewFilter, setViewFilter] = useState<SkillViewFilter>('combat');

  const { nodes, links } = useMemo(() => {
    const depthCache = new Map<string, number>();
    const branchGroups: Record<SkillBranch, string[]> = {
      warfare: [],
      survival: [],
      alchemy: [],
      tactics: [],
    };

    Object.values(SKILLS).forEach((s) => {
      if (s.branch) branchGroups[s.branch].push(s.id);
    });

    const outNodes: SkillNode[] = [];
    BRANCHES.forEach((branch) => {
      const ids = branchGroups[branch];
      const byDepth = new Map<number, string[]>();
      ids.forEach((id) => {
        const depth = Math.min(4, skillDepth(id, depthCache));
        const arr = byDepth.get(depth) || [];
        arr.push(id);
        byDepth.set(depth, arr);
      });

      const meta = BRANCH_META[branch];
      Array.from(byDepth.entries()).forEach(([depth, list]) => {
        list.sort((a: string, b: string) => SKILLS[a].name[l].localeCompare(SKILLS[b].name[l]));
        const radius = 14 + depth * 11;
        const depthSpread = Math.max(22, meta.spreadDeg - depth * 6);
        list.forEach((id: string, idx: number) => {
          const t = list.length === 1 ? 0 : idx / (list.length - 1) - 0.5;
          const angle = meta.angleDeg + t * depthSpread;
          const x = 50 + Math.cos(toRad(angle)) * radius;
          const y = 50 + Math.sin(toRad(angle)) * radius;
          outNodes.push({ id, x, y, branch, depth });
        });
      });
    });

    const nodeById = new Map(outNodes.map((n) => [n.id, n]));
    const outLinks = Object.values(SKILLS).flatMap((s) => {
      const to = nodeById.get(s.id);
      if (!to) return [];
      if (!s.requires || s.requires.length === 0) {
        return [{ x1: 50, y1: 50, x2: to.x, y2: to.y, branch: to.branch, skillId: s.id, parentId: null as string | null }];
      }
      return s.requires
        .map((req) => nodeById.get(req))
        .filter(Boolean)
        .map((from) => ({
          x1: from!.x,
          y1: from!.y,
          x2: to.x,
          y2: to.y,
          branch: to.branch,
          skillId: s.id,
          parentId: from!.id,
        }));
    });

    return { nodes: outNodes, links: outLinks };
  }, [l]);

  const selectedSkill = SKILLS[selectedId];
  const selectedLevel = player.learnedSkills[selectedId] || 0;
  const selectedReqs = selectedSkill.requires || [];
  const selectedReqsMet = selectedReqs.every((reqId) => (player.learnedSkills[reqId] || 0) > 0);
  const selectedCanLearn = selectedLevel < selectedSkill.maxLevel && selectedReqsMet && player.skillPoints >= selectedSkill.costPerLevel;

  const battleSkills = Object.values(SKILLS)
    .filter((s) => (s.effect.type === 'active' || s.effect.type === 'ultimate') && (player.learnedSkills[s.id] || 0) > 0)
    .sort((a, b) => a.name[l].localeCompare(b.name[l]));

  const passiveSkills = Object.values(SKILLS)
    .filter((s) => s.effect.type === 'passive' && (player.learnedSkills[s.id] || 0) > 0)
    .sort((a, b) => a.name[l].localeCompare(b.name[l]));

  return (
    <div className="p-4 pb-10 space-y-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm">{T.skills_title[l]}</h3>
        <div className="flex items-center gap-1.5 bg-primary/20 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/30">
          <Star className="w-3.5 h-3.5" />
          {player.skillPoints} {T.stat_sp[l]}
        </div>
      </div>

      <div className="rounded-xl border border-primary/25 bg-[radial-gradient(circle_at_center,_rgba(16,20,34,0.96),_rgba(7,9,15,0.98))] p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            ['combat', l === 'ru' ? 'Боевые' : 'Combat'],
            ['active', l === 'ru' ? 'Активные' : 'Active'],
            ['passive', l === 'ru' ? 'Пассивные' : 'Passive'],
            ['all', l === 'ru' ? 'Все' : 'All'],
          ] as [SkillViewFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setViewFilter(id)}
              className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors ${
                viewFilter === id
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-black/45 text-muted-foreground border-white/10 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full aspect-square rounded-lg border border-white/10 overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(20,30,52,0.35),_rgba(3,4,10,0.96))]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="21" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.22" />
            <circle cx="50" cy="50" r="11" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.24" />

            {links.map((ln, idx) => {
              const skill = SKILLS[ln.skillId];
              const visible = skillMatchesFilter(skill, viewFilter);
              const skillLevel = player.learnedSkills[ln.skillId] || 0;
              const parentLearned = ln.parentId ? (player.learnedSkills[ln.parentId] || 0) > 0 : true;
              const active = skillLevel > 0 && parentLearned;
              const color = BRANCH_META[ln.branch].color;
              const mx = (ln.x1 + ln.x2) / 2;
              const my = (ln.y1 + ln.y2) / 2;
              return (
                <path
                  key={idx}
                  d={`M ${ln.x1} ${ln.y1} Q ${mx} ${my} ${ln.x2} ${ln.y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? 0.52 : 0.28}
                  strokeOpacity={visible ? (active ? 0.96 : 0.35) : 0.12}
                />
              );
            })}
          </svg>

          <div
            className="absolute h-10 w-10 rounded-full border border-primary/70 bg-black/70 shadow-[0_0_18px_rgba(237,190,88,0.6)] flex items-center justify-center text-primary"
            style={{ left: 'calc(50% - 20px)', top: 'calc(50% - 20px)' }}
            title={l === 'ru' ? 'Сердце древа' : 'Tree Core'}
          >
            <Orbit className="w-4 h-4" />
          </div>

          {BRANCHES.map((branch) => {
            const hub = BRANCH_META[branch];
            return (
              <div
                key={branch}
                className="absolute h-10 w-10 rounded-full border text-white/90 flex items-center justify-center bg-black/65 shadow-[0_0_16px_rgba(0,0,0,0.6)]"
                style={{
                  left: `calc(${hub.hubX}% - 20px)`,
                  top: `calc(${hub.hubY}% - 20px)`,
                  borderColor: `${hub.color}`,
                  boxShadow: `0 0 20px ${hub.color}66`,
                }}
                title={hub[l]}
              >
                <BranchIcon branch={branch} />
              </div>
            );
          })}

          {nodes.map((node) => {
            const skill = SKILLS[node.id];
            const visible = skillMatchesFilter(skill, viewFilter);
            const level = player.learnedSkills[node.id] || 0;
            const learned = level > 0;
            const reqsMet = (skill.requires || []).every((reqId) => (player.learnedSkills[reqId] || 0) > 0);
            const isSelected = selectedId === node.id;
            const color = BRANCH_META[node.branch].color;

            return (
              <button
                key={node.id}
                onClick={() => setSelectedId(node.id)}
                className="absolute rounded-full border flex items-center justify-center transition-all"
                style={{
                  width: `${34 + node.depth * 1.5}px`,
                  height: `${34 + node.depth * 1.5}px`,
                  left: `calc(${node.x}% - ${(34 + node.depth * 1.5) / 2}px)`,
                  top: `calc(${node.y}% - ${(34 + node.depth * 1.5) / 2}px)`,
                  borderColor: isSelected ? '#f5d182' : learned ? color : reqsMet ? '#8ea0bd' : '#4f5569',
                  color: learned ? '#fff' : reqsMet ? '#d6deed' : '#77809a',
                  background: learned ? `${color}44` : '#0b0f1acc',
                  boxShadow: learned ? `0 0 16px ${color}88` : 'none',
                  transform: isSelected ? 'scale(1.14)' : 'scale(1)',
                  opacity: visible ? 1 : 0.32,
                }}
                title={skill.name[l]}
              >
                <SkillGlyph skill={skill} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/35 p-3 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 className="font-serif text-lg text-white">{selectedSkill.name[l]}</h4>
            <p className="text-xs text-muted-foreground">{selectedSkill.description[l]}</p>
          </div>
          <div className="text-[10px] font-mono bg-black/60 border border-white/10 px-2 py-1 rounded">
            {selectedLevel}/{selectedSkill.maxLevel}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded border border-white/10 bg-black/60">{selectedSkill.effect.type}</span>
          {(selectedSkill.effect.type === 'active' || selectedSkill.effect.type === 'ultimate') && (
            <span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/20 text-primary">
              CD {selectedSkill.effect.cooldownTurns || 0} | EN {selectedSkill.effect.energyCost || 0}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            {selectedReqsMet ? <Unlock className="w-3 h-3 text-green-500" /> : <Lock className="w-3 h-3 text-destructive" />}
            {selectedReqsMet
              ? l === 'ru'
                ? 'Требования выполнены'
                : 'Requirements met'
              : `${T.skill_req[l]}: ${selectedReqs.map((id) => SKILLS[id]?.name[l] || id).join(', ')}`}
          </div>
          <button
            onClick={() => learnSkill(selectedSkill.id)}
            disabled={!selectedCanLearn}
            className={`text-[10px] uppercase px-3 py-1.5 rounded transition-colors font-bold tracking-wider ${
              selectedCanLearn
                ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/40'
                : 'bg-black/50 text-muted-foreground border border-border cursor-not-allowed'
            }`}
          >
            {selectedLevel >= selectedSkill.maxLevel ? T.skill_max[l] : `${T.skill_learn[l]} (-${selectedSkill.costPerLevel} SP)`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-primary/20 bg-black/35 p-3">
          <h4 className="text-xs uppercase tracking-widest text-primary mb-2">{l === 'ru' ? 'Боевые активные умения' : 'Combat Active Skills'}</h4>
          {battleSkills.length === 0 ? (
            <p className="text-xs text-muted-foreground">{l === 'ru' ? 'Пока нет изученных активных навыков.' : 'No learned active skills yet.'}</p>
          ) : (
            <div className="space-y-1.5">
              {battleSkills.map((skill) => (
                <div key={skill.id} className="text-xs rounded border border-white/10 bg-black/45 px-2 py-1.5 flex justify-between gap-2">
                  <span className="text-white">{skill.name[l]}</span>
                  <span className="text-primary/90">CD {skill.effect.cooldownTurns || 0} / EN {skill.effect.energyCost || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <h4 className="text-xs uppercase tracking-widest text-white/90 mb-2">{l === 'ru' ? 'Пассивные эффекты' : 'Passive Effects'}</h4>
          {passiveSkills.length === 0 ? (
            <p className="text-xs text-muted-foreground">{l === 'ru' ? 'Пассивные навыки ещё не изучены.' : 'No passive skills learned yet.'}</p>
          ) : (
            <div className="space-y-1.5">
              {passiveSkills.map((skill) => (
                <div key={skill.id} className="text-xs rounded border border-white/10 bg-black/45 px-2 py-1.5 text-white">
                  {skill.name[l]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
