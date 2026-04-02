import { useGameStore } from '../../game/store';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { LOCATIONS, ENEMIES, NPCS } from '../../game/constants';
import { T } from '../../game/translations';

export default function QuestsPanel() {
  const { quests, settings, chooseEventQuestBranch, acceptQuest, turnInQuest, worldEconomy } = useGameStore();
  const l = settings.language;
  
  const offeredEventQuests = quests.filter(
    (q) => !q.isCompleted && q.isEventQuest && (q.offerState || 'active') === 'offered' && (!q.expiresAtTick || q.expiresAtTick > worldEconomy.tick),
  );
  const activeQuests = quests.filter(
    (q) => !q.isCompleted && (q.offerState || 'active') === 'active',
  );
  const completedQuests = quests.filter(q => q.isCompleted);
  const resolvedEventQuests = completedQuests
    .filter((q) => q.isEventQuest && q.eventQuest)
    .slice(-6)
    .reverse();
  const warContextQuest = [...activeQuests, ...offeredEventQuests, ...resolvedEventQuests].find(
    (q) => q.isEventQuest && q.eventQuest?.originType === 'war' && q.eventQuest.opponentHubId,
  );
  const warA = warContextQuest?.eventQuest?.targetHubId;
  const warB = warContextQuest?.eventQuest?.opponentHubId;
  const warRelation = warA && warB
    ? worldEconomy.hubRelations[`${warA}__${warB}`] || worldEconomy.hubRelations[`${warB}__${warA}`]
    : null;

  return (
    <div className="p-4 space-y-6">
      {offeredEventQuests.length > 0 && (
        <div>
          <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-4 border-b border-border/50 pb-2">
            {l === 'ru' ? 'Экономические предложения' : 'Economic Offers'}
          </h3>
          <div className="space-y-4">
            {offeredEventQuests.map((quest) => (
              <div key={quest.id} className="bg-black/35 border border-primary/20 rounded p-4 text-sm space-y-3">
                <h4 className="font-serif text-lg text-white">{quest.name[l]}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{quest.description[l]}</p>

                {quest.eventQuest?.branch === 'unselected' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-primary/90">
                      {l === 'ru'
                        ? 'Выберите ветку перед принятием квеста:'
                        : 'Choose a branch before accepting this quest:'}
                    </p>
                    {quest.eventQuest?.originType === 'war' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="rounded border border-emerald-500/25 bg-emerald-500/5 p-2 space-y-1">
                          <button
                            onClick={() => chooseEventQuestBranch(quest.id, 'support_a')}
                            className="w-full rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-xs py-2 hover:bg-emerald-500/20 transition-colors"
                          >
                            {l === 'ru' ? 'Поддержать сторону A' : 'Support side A'}
                          </button>
                          <p className="text-[10px] text-emerald-200/90">
                            {l === 'ru' ? '+репутация A / -репутация B' : '+rep A / -rep B'}
                          </p>
                        </div>
                        <div className="rounded border border-sky-500/25 bg-sky-500/5 p-2 space-y-1">
                          <button
                            onClick={() => chooseEventQuestBranch(quest.id, 'support_b')}
                            className="w-full rounded border border-sky-500/35 bg-sky-500/10 text-sky-300 text-xs py-2 hover:bg-sky-500/20 transition-colors"
                          >
                            {l === 'ru' ? 'Поддержать сторону B' : 'Support side B'}
                          </button>
                          <p className="text-[10px] text-sky-200/90">
                            {l === 'ru' ? '+репутация B / -репутация A' : '+rep B / -rep A'}
                          </p>
                        </div>
                        <div className="rounded border border-white/15 bg-white/5 p-2 space-y-1">
                          <button
                            onClick={() => chooseEventQuestBranch(quest.id, 'neutral')}
                            className="w-full rounded border border-white/20 bg-white/5 text-white text-xs py-2 hover:bg-white/10 transition-colors"
                          >
                            {l === 'ru' ? 'Не вмешиваться' : 'Stay neutral'}
                          </button>
                          <p className="text-[10px] text-muted-foreground">
                            {l === 'ru' ? '-малая репутация у обеих сторон' : '-small reputation with both sides'}
                          </p>
                        </div>
                      </div>
                    ) : quest.eventQuest?.originType === 'caravan_attack' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="rounded border border-destructive/25 bg-destructive/5 p-2 space-y-1">
                          <button
                            onClick={() => chooseEventQuestBranch(quest.id, 'punish')}
                            className="w-full rounded border border-destructive/35 bg-destructive/10 text-destructive text-xs py-2 hover:bg-destructive/20 transition-colors"
                          >
                            {l === 'ru' ? 'Атаковать караван' : 'Attack caravan'}
                          </button>
                          <p className="text-[10px] text-destructive/90">
                            {l === 'ru' ? '3–6 боёв, высокая добыча, больше риск' : '3–6 fights, higher loot, higher risk'}
                          </p>
                        </div>
                        <div className="rounded border border-emerald-500/25 bg-emerald-500/5 p-2 space-y-1">
                          <button
                            onClick={() => chooseEventQuestBranch(quest.id, 'support')}
                            className="w-full rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-xs py-2 hover:bg-emerald-500/20 transition-colors"
                          >
                            {l === 'ru' ? 'Сопроводить караван' : 'Escort caravan'}
                          </button>
                          <p className="text-[10px] text-emerald-200/90">
                            {l === 'ru' ? '3–6 боёв, стабильная награда, рост доверия' : '3–6 fights, stable rewards, trust gain'}
                          </p>
                        </div>
                        <div className="rounded border border-white/15 bg-white/5 p-2 space-y-1">
                          <button
                            onClick={() => chooseEventQuestBranch(quest.id, 'neutral')}
                            className="w-full rounded border border-white/20 bg-white/5 text-white text-xs py-2 hover:bg-white/10 transition-colors"
                          >
                            {l === 'ru' ? 'Не трогать караван' : 'Leave convoy alone'}
                          </button>
                          <p className="text-[10px] text-muted-foreground">
                            {l === 'ru' ? 'Без боёв, минимальная награда' : 'No fight chain, minimal reward'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={() => chooseEventQuestBranch(quest.id, 'support')}
                          className="rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-xs py-2 hover:bg-emerald-500/20 transition-colors"
                        >
                          {l === 'ru' ? 'Поддержать / Вознаградить' : 'Support / Reward'}
                        </button>
                        <button
                          onClick={() => chooseEventQuestBranch(quest.id, 'punish')}
                          className="rounded border border-destructive/35 bg-destructive/10 text-destructive text-xs py-2 hover:bg-destructive/20 transition-colors"
                        >
                          {l === 'ru' ? 'Наказать / Дестабилизировать' : 'Punish / Destabilize'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-primary/90">
                      {l === 'ru' ? 'Выбранная ветка:' : 'Selected branch:'}{' '}
                      {quest.eventQuest?.originType === 'war'
                        ? (
                          quest.eventQuest?.branch === 'support' || quest.eventQuest?.branch === 'support_a'
                            ? (l === 'ru' ? 'Поддержка стороны A' : 'Support side A')
                            : quest.eventQuest?.branch === 'support_b'
                              ? (l === 'ru' ? 'Поддержка стороны B' : 'Support side B')
                              : quest.eventQuest?.branch === 'neutral'
                                ? (l === 'ru' ? 'Нейтралитет' : 'Neutral')
                                : (l === 'ru' ? 'Наказание' : 'Punish')
                        )
                        : quest.eventQuest?.originType === 'caravan_attack'
                          ? (
                            quest.eventQuest?.branch === 'support'
                              ? (l === 'ru' ? 'Сопровождение' : 'Escort')
                              : quest.eventQuest?.branch === 'punish'
                                ? (l === 'ru' ? 'Атака' : 'Attack')
                                : (l === 'ru' ? 'Невмешательство' : 'Non-intervention')
                          )
                          : (
                            quest.eventQuest?.branch === 'support'
                              ? (l === 'ru' ? 'Поддержка' : 'Support')
                              : quest.eventQuest?.branch === 'neutral'
                                ? (l === 'ru' ? 'Нейтралитет' : 'Neutral')
                                : (l === 'ru' ? 'Наказание' : 'Punish')
                          )}
                    </p>
                    <button
                      onClick={() => acceptQuest(quest.id)}
                      className="rounded border border-primary/35 bg-primary/10 text-primary text-xs py-2 px-3 hover:bg-primary/20 transition-colors"
                    >
                      {l === 'ru' ? 'Принять контракт' : 'Accept contract'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {warA && warB && (
        <div className="bg-black/25 border border-white/10 rounded p-3 space-y-2">
          <h3 className="font-serif text-primary uppercase tracking-widest text-xs">
            {l === 'ru' ? 'Баланс сторон войны' : 'War Sides Balance'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5">
              <p className="text-emerald-300">{LOCATIONS[warA]?.name[l] || warA}</p>
              <p className="text-muted-foreground">
                {l === 'ru'
                  ? `Отношение к вам: ${worldEconomy.hubs[warA]?.playerRelation ?? 0}`
                  : `Relation to you: ${worldEconomy.hubs[warA]?.playerRelation ?? 0}`}
              </p>
            </div>
            <div className="rounded border border-sky-500/25 bg-sky-500/5 px-2 py-1.5">
              <p className="text-sky-300">{LOCATIONS[warB]?.name[l] || warB}</p>
              <p className="text-muted-foreground">
                {l === 'ru'
                  ? `Отношение к вам: ${worldEconomy.hubs[warB]?.playerRelation ?? 0}`
                  : `Relation to you: ${worldEconomy.hubs[warB]?.playerRelation ?? 0}`}
              </p>
            </div>
          </div>
          {warRelation && (
            <p className="text-[11px] text-muted-foreground">
              {l === 'ru'
                ? `Связь между сторонами: ${warRelation.status} (${warRelation.strength}).`
                : `Inter-side status: ${warRelation.status} (${warRelation.strength}).`}
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-4 border-b border-border/50 pb-2">
          {T.quests_active[l]}
        </h3>
        
        {activeQuests.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">{T.quests_empty[l]}</p>
        ) : (
          <div className="space-y-4">
            {activeQuests.map(quest => (
              <div key={quest.id} className="bg-black/30 border border-white/5 rounded p-4 text-sm relative overflow-hidden">
                {/* Location highlight strip */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50"></div>
                
                <h4 className="font-serif text-lg text-white mb-1 pl-2">{quest.name[l]}</h4>
                <p className="text-xs text-primary/70 mb-3 pl-2 italic">{T.quest_in[l]} {LOCATIONS[quest.locationId]?.name[l] || quest.locationId}</p>
                <p className="text-xs text-muted-foreground mb-2 pl-2 leading-relaxed">{quest.description[l]}</p>
                {quest.isTurnInReady ? (
                  <p className="text-[11px] text-primary mb-3 pl-2 font-semibold">
                    {quest.isEventQuest
                      ? (l === 'ru' ? 'Готово к завершению.' : 'Ready to resolve.')
                      : (
                        <>
                          {l === 'ru' ? 'Готово к сдаче у: ' : 'Ready to turn in at: '}
                          {NPCS[quest.turnInNpcId || quest.giverNpcId || '']?.name[l] || (l === 'ru' ? 'квестодатель' : 'quest giver')}
                        </>
                      )}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mb-3 pl-2">
                    {l === 'ru' ? 'Статус: в процессе' : 'Status: in progress'}
                  </p>
                )}
                
                <div className="space-y-2 pl-2 bg-black/40 p-2 rounded">
                  {quest.goals.map((goal, idx) => {
                      const targetName = goal.type === 'kill' && ENEMIES[goal.targetId] 
                      ? ENEMIES[goal.targetId].name[l] 
                      : goal.targetId;
                    const goalVerb =
                      goal.type === 'kill'
                        ? T.quest_defeat[l]
                        : goal.type === 'collect'
                        ? (l === 'ru' ? 'Собрать' : 'Collect')
                        : (l === 'ru' ? 'Исследовать' : 'Explore');
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2 text-gray-300">
                            {goal.currentCount >= goal.targetCount ? 
                              <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
                              <CircleDashed className="w-4 h-4 text-muted-foreground" />
                            }
                            {goalVerb} {targetName}
                        </span>
                        <span className="font-mono text-muted-foreground bg-black px-1.5 py-0.5 rounded">
                          {Math.min(goal.currentCount, goal.targetCount)}/{goal.targetCount}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {quest.isEventQuest && quest.isTurnInReady && (
                  <div className="pl-2 mt-3">
                    <button
                      onClick={() => turnInQuest(quest.id)}
                      className="rounded border border-primary/35 bg-primary/10 text-primary text-xs py-2 px-3 hover:bg-primary/20 transition-colors"
                    >
                      {l === 'ru' ? 'Завершить выбор' : 'Resolve choice'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {completedQuests.length > 0 && (
        <div>
          <h3 className="font-serif text-muted-foreground uppercase tracking-widest text-xs mb-3 border-b border-border/30 pb-2">
            {T.quests_completed[l]}
          </h3>
          <div className="space-y-2">
             {completedQuests.map(quest => (
               <div key={quest.id} className="flex items-center gap-2 text-xs text-muted-foreground opacity-50 bg-black/20 p-2 rounded">
                 <CheckCircle2 className="w-3 h-3" />
                 <span className="line-through">{quest.name[l]}</span>
               </div>
             ))}
          </div>
        </div>
      )}

      {resolvedEventQuests.length > 0 && (
        <div>
          <h3 className="font-serif text-primary uppercase tracking-widest text-xs mb-3 border-b border-border/30 pb-2">
            {l === 'ru' ? 'Почему изменились цены' : 'Why Prices Changed'}
          </h3>
          <div className="space-y-2">
            {resolvedEventQuests.map((quest) => (
              <div key={`impact_${quest.id}`} className="text-[11px] text-muted-foreground bg-black/25 border border-white/5 rounded px-3 py-2">
                <p className="text-white/90">{quest.name[l]}</p>
                <p>
                  {quest.eventQuest?.branch === 'support' || quest.eventQuest?.branch === 'support_a' || quest.eventQuest?.branch === 'support_b'
                    ? (l === 'ru' ? 'Эффект: цены ближе к стабильным, риски маршрутов ниже.' : 'Effect: prices trend toward stable, route risks lower.')
                    : quest.eventQuest?.branch === 'neutral'
                      ? (l === 'ru' ? 'Эффект: умеренное давление на цены, без резких сдвигов.' : 'Effect: moderate pressure on prices, no extreme shifts.')
                      : (l === 'ru' ? 'Эффект: дефицит и волатильность растут, цены выше.' : 'Effect: scarcity and volatility rise, prices go up.')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
