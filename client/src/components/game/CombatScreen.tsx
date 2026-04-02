import { LogOut } from 'lucide-react';
import { useGameStore } from '../../game/store';
import { Progress } from '@/components/ui/progress';
import { Sword, Shield, Activity, Skull, Zap, Backpack } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../game/translations';
import { ITEMS, SKILLS } from '../../game/constants';

export default function CombatScreen() {
  const {
    player,
    currentEnemy,
    combatLogs,
    attack,
    useSkill,
    useCombatItem,
    block,
    useSecondWind,
    flee,
    endCombat,
    settings,
    isPlayerBlocking,
    combatCombo,
    combatAdrenaline,
  } = useGameStore();

  const [showPouch, setShowPouch] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const l = settings.language;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLogs]);

  const pouchItems = useMemo(
    () =>
      player.inventory
        .filter((i) => ITEMS[i.itemId]?.type === 'consumable')
        .map((i) => ({ ...i, item: ITEMS[i.itemId] }))
        .filter((i) => i.item),
    [player.inventory],
  );
  const activeSkills = useMemo(
    () =>
      Object.entries(player.learnedSkills)
        .filter(([, lvl]) => lvl > 0)
        .map(([id]) => id)
        .filter((id) => {
          const skill = SKILLS[id];
          return skill?.effect.type === 'active' || skill?.effect.type === 'ultimate';
        }),
    [player.learnedSkills],
  );

  if (!currentEnemy) return null;

  const isEnemyDead = currentEnemy.hp <= 0;
  const isPlayerDead = player.hp <= 0;
  const combatEnded = isEnemyDead || isPlayerDead;

  return (
    <div className="flex-1 flex flex-col w-full h-full p-2 md:p-4 gap-2 md:gap-4 overflow-hidden">
      <div className="grid grid-cols-2 gap-2 md:gap-6 shrink-0">
        <div className="rpg-panel p-3 md:p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-50"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <h3 className="text-sm md:text-xl font-serif text-white mb-2 md:mb-4 truncate">
              {player.name} {isPlayerBlocking && <span className="text-[10px] text-primary ml-2">[{T.combat_block[l]}]</span>}
            </h3>
            {player.statusEffects && player.statusEffects.length > 0 && (
              <p className="text-[10px] text-destructive mb-2">{player.statusEffects.map((s) => `${s.type}(${s.duration})`).join(', ')}</p>
            )}

            <div className="space-y-1.5 md:space-y-2 mb-2 md:mb-4">
              <div className="flex justify-between text-[10px] md:text-xs font-bold">
                <span>HP</span>
                <span className={player.hp < player.maxHp * 0.3 ? 'text-destructive animate-pulse' : ''}>
                  {player.hp} / {player.maxHp}
                </span>
              </div>
              <Progress value={(player.hp / player.maxHp) * 100} className="h-1.5 md:h-2 bg-black/60" />

              <div className="flex justify-between text-[10px] md:text-xs font-bold text-blue-200">
                <span>{T.combat_energy[l]}</span>
                <span>
                  {player.energy} / {player.maxEnergy}
                </span>
              </div>
              <Progress value={(player.energy / player.maxEnergy) * 100} className="h-1.5 bg-black/60 [&>div]:bg-blue-500" />

              <div className="flex justify-between text-[10px] md:text-xs font-bold text-orange-200">
                <span>{T.combat_adrenaline[l]}</span>
                <span>{combatAdrenaline}/100</span>
              </div>
              <Progress value={combatAdrenaline} className="h-1.5 bg-black/60 [&>div]:bg-orange-500" />

              <div className="flex justify-between text-[10px] md:text-xs font-bold text-primary">
                <span>{T.combat_combo[l]}</span>
                <span>x{Math.min(5, combatCombo)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 md:gap-2 text-muted-foreground text-[10px] md:text-xs">
              <span className="flex items-center gap-1">
                <Sword className="w-3 h-3" /> {player.stats.baseDamage[0]}-{player.stats.baseDamage[1]}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" /> {player.stats.baseDefense}
              </span>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-20 md:top-32 -translate-x-1/2 z-20 w-8 h-8 md:w-12 md:h-12 bg-black border-2 border-border rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <span className="font-serif text-[10px] md:text-sm text-destructive font-bold italic">{T.combat_vs[l]}</span>
        </div>

        <div className={`rpg-panel p-3 md:p-5 relative overflow-hidden transition-all duration-500 ${isEnemyDead ? 'grayscale opacity-50' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-tl from-destructive/20 to-transparent opacity-50"></div>
          <div className="relative z-10 flex flex-col h-full justify-between items-end text-right">
            <div className="mb-2 md:mb-4">
              <h3 className="text-sm md:text-xl font-serif text-white flex items-center gap-1 md:gap-2 truncate justify-end">
                {isEnemyDead && <Skull className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />}
                {currentEnemy.name[l]}
                {currentEnemy.isBlocking && <span className="text-[10px] text-primary">[{T.combat_block[l]}]</span>}
              </h3>
              {currentEnemy.statusEffects.length > 0 && (
                <p className="text-[10px] text-orange-300">{currentEnemy.statusEffects.map((s) => `${s.type}(${s.duration})`).join(', ')}</p>
              )}
              <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider block mt-0.5">
                {T.stat_level[l]} {currentEnemy.level}
              </span>
            </div>

            <div className="space-y-1.5 md:space-y-2 mb-2 md:mb-4 w-full">
              <div className="flex justify-between text-[10px] md:text-xs font-bold flex-row-reverse">
                <span>HP</span>
                <span className="text-white">
                  {currentEnemy.hp} / {currentEnemy.maxHp}
                </span>
              </div>
              <Progress value={(currentEnemy.hp / currentEnemy.maxHp) * 100} className="h-1.5 md:h-2 bg-black/60 rotate-180" />

              <div className="flex justify-between text-[10px] md:text-xs font-bold flex-row-reverse text-blue-200">
                <span>{T.combat_energy[l]}</span>
                <span>
                  {currentEnemy.energy} / {currentEnemy.maxEnergy}
                </span>
              </div>
              <Progress value={(currentEnemy.energy / currentEnemy.maxEnergy) * 100} className="h-1.5 bg-black/60 rotate-180 [&>div]:bg-blue-500" />
            </div>

            <div className="flex gap-2 md:gap-4 text-muted-foreground text-[10px] md:text-xs justify-end w-full">
              <span className="flex items-center gap-1">
                <Sword className="w-3 h-3" /> {currentEnemy.damage[0]}-{currentEnemy.damage[1]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rpg-panel bg-black/80 backdrop-blur-md flex-1 flex flex-col overflow-hidden border-border/40 min-h-[100px]">
        <div className="bg-white/5 border-b border-white/10 px-3 py-1.5 md:px-4 md:py-2 font-serif text-[10px] md:text-xs text-primary tracking-widest uppercase shrink-0">
          {T.combat_log[l]}
        </div>
        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-1.5 md:space-y-2 font-mono text-[10px] md:text-xs custom-scrollbar">
          {combatLogs.map((log, i) => {
            const isPlayerHit = log.includes('You hit') || log.includes('Вы ударили') || log.includes('бросили');
            const isEnemyHit = log.includes('hits you') || log.includes('бьет вас');
            const isVictory =
              log.includes('defeated') ||
              log.includes('победили') ||
              log.includes('Completed') ||
              log.includes('выполнено') ||
              log.includes('LEVEL UP') ||
              log.includes('НОВЫЙ УРОВЕНЬ');

            let colorClass = 'border-muted-foreground text-muted-foreground';
            if (isPlayerHit) colorClass = 'border-primary text-white bg-primary/5';
            if (isEnemyHit) colorClass = 'border-destructive text-destructive-foreground/90 bg-destructive/5';
            if (isVictory) colorClass = 'border-accent text-accent font-bold text-[11px] md:text-sm bg-accent/5';

            return (
              <div key={i} className={`p-1.5 md:p-2.5 rounded border-l-2 ${colorClass}`}>
                {log}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 shrink-0">
        {!combatEnded ? (
          <>
            <button onClick={attack} className="rpg-button bg-destructive/20 hover:bg-destructive/40 hover:border-destructive text-white border-destructive/50 py-2 text-[10px] md:text-xs flex flex-col items-center justify-center gap-1">
              <Sword className="w-4 h-4" />
              {T.combat_attack[l]}
            </button>

            <button onClick={() => setShowPouch((v) => !v)} className="rpg-button py-2 text-[10px] md:text-xs border-blue-500/40 text-blue-200 hover:bg-blue-900/20 flex flex-col items-center justify-center gap-1">
              <Backpack className="w-4 h-4" />
              {T.combat_pouch[l]}
            </button>

            <button onClick={block} className="rpg-button py-2 text-[10px] md:text-xs border-primary/50 text-primary hover:bg-primary/20 flex flex-col items-center justify-center gap-1">
              <Shield className="w-4 h-4" />
              {T.combat_block[l]}
            </button>

            <button
              onClick={useSecondWind}
              disabled={combatAdrenaline < 50}
              className="rpg-button py-2 text-[10px] md:text-xs border-orange-500/50 text-orange-100 hover:bg-orange-900/30 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
            >
              <Zap className="w-4 h-4" />
              {T.combat_second_wind[l]}
            </button>

            <button onClick={() => useCombatItem('potion_small', 'self')} className="rpg-button py-2 text-[10px] md:text-xs bg-green-900/20 hover:bg-green-900/40 border-green-500/50 hover:border-green-500 text-green-100 flex flex-col items-center justify-center gap-1">
              <Activity className="w-4 h-4" />
              {T.combat_heal[l]}
            </button>

            <button onClick={flee} className="rpg-button py-2 text-[10px] md:text-xs border-muted-foreground hover:bg-white/10 flex flex-col items-center justify-center gap-1">
              <LogOut className="w-4 h-4" />
              {T.combat_flee[l]}
            </button>
          </>
        ) : (
          <div className="col-span-6">
            <button onClick={endCombat} className="w-full rpg-button py-3 text-sm md:text-base bg-primary/20 hover:bg-primary/40 border-primary font-bold">
              {isPlayerDead ? T.combat_return[l] : T.combat_continue[l]}
            </button>
          </div>
        )}
      </div>

      {activeSkills.length > 0 && !combatEnded && (
        <div className="grid grid-cols-3 gap-2 shrink-0">
          {activeSkills.map((skillId) => {
            const cd = player.cooldowns?.[skillId] || 0;
            return (
              <button
                key={skillId}
                disabled={cd > 0}
                onClick={() => useSkill(skillId)}
                className="rpg-button py-2 text-[10px] md:text-xs border-primary/40 disabled:opacity-50"
              >
                {SKILLS[skillId]?.name[l] || skillId} {cd > 0 ? `(CD ${cd})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {showPouch && !combatEnded && (
        <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center p-4">
          <div className="w-full max-w-md rpg-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-serif text-primary uppercase tracking-widest">{T.combat_pouch[l]}</h4>
              <button onClick={() => setShowPouch(false)} className="text-xs text-muted-foreground hover:text-white">X</button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {pouchItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No consumables</p>
              ) : (
                pouchItems.map((entry) => (
                  <div key={entry.itemId} className="p-2 bg-black/40 border border-white/10 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white">{entry.item.name[l]} x{entry.quantity}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        <Zap className="w-3 h-3 inline mr-1" />
                        {entry.item.stats?.throwDamage ? '12' : '10'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          useCombatItem(entry.itemId, 'self');
                          setShowPouch(false);
                        }}
                        className="flex-1 text-[10px] uppercase py-1.5 rounded bg-green-900/30 hover:bg-green-900/50 border border-green-500/40"
                      >
                        {T.combat_drink[l]}
                      </button>
                      <button
                        onClick={() => {
                          useCombatItem(entry.itemId, 'enemy');
                          setShowPouch(false);
                        }}
                        disabled={!entry.item.stats?.throwDamage}
                        className="flex-1 text-[10px] uppercase py-1.5 rounded bg-orange-900/30 hover:bg-orange-900/50 border border-orange-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {T.combat_throw[l]}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
