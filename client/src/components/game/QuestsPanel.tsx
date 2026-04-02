import { useGameStore } from '../../game/store';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { LOCATIONS, ENEMIES, NPCS } from '../../game/constants';
import { T } from '../../game/translations';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playVoiceText } from '../../game/voice';

export default function QuestsPanel() {
  const { quests, settings, chooseEventQuestBranch, acceptQuest, contributeToQuestTreasury, turnInQuest, worldEconomy, player } = useGameStore();
  const l = settings.language;
  const [previewQuestId, setPreviewQuestId] = useState<string | null>(null);
  const spokenOfferIdsRef = useRef<Set<string>>(new Set());
  
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
  const previewQuest = useMemo(
    () => offeredEventQuests.find((q) => q.id === previewQuestId) || null,
    [offeredEventQuests, previewQuestId],
  );
  const getBranchCards = (quest: typeof offeredEventQuests[number]) => {
    const origin = quest.eventQuest?.originType;
    if (origin === 'war') {
      return [
        {
          branch: 'support_a' as const,
          title: l === 'ru' ? 'Поддержать сторону A' : 'Support Side A',
          impacts: [
            l === 'ru' ? '+12 репутации у A, -10 у B' : '+12 reputation with A, -10 with B',
            l === 'ru' ? '- риск маршрутов A, + устойчивость рынка A' : '- route risk for A, + market stability for A',
          ],
        },
        {
          branch: 'support_b' as const,
          title: l === 'ru' ? 'Поддержать сторону B' : 'Support Side B',
          impacts: [
            l === 'ru' ? '+12 репутации у B, -10 у A' : '+12 reputation with B, -10 with A',
            l === 'ru' ? '- риск маршрутов B, + устойчивость рынка B' : '- route risk for B, + market stability for B',
          ],
        },
        {
          branch: 'neutral' as const,
          title: l === 'ru' ? 'Нейтралитет' : 'Neutrality',
          impacts: [
            l === 'ru' ? '-3 репутации у обеих сторон' : '-3 reputation with both sides',
            l === 'ru' ? 'Среднее давление цен, без сильной стабилизации' : 'Moderate price pressure, no strong stabilization',
          ],
        },
      ];
    }
    if (origin === 'caravan_attack') {
      const fights = Math.max(3, Math.min(6, 2 + (quest.eventQuest?.sourceHubLevel || 3)));
      return [
        {
          branch: 'support' as const,
          title: l === 'ru' ? 'Сопроводить караван' : 'Escort Caravan',
          impacts: [
            l === 'ru' ? `${fights} последовательных боёв в засадах на маршруте` : `${fights} consecutive ambush fights on route`,
            l === 'ru' ? 'Идеальный проход: дополнительная награда при сдаче' : 'Perfect run: extra turn-in reward',
          ],
        },
        {
          branch: 'punish' as const,
          title: l === 'ru' ? 'Ограбить караван' : 'Raid Caravan',
          impacts: [
            l === 'ru' ? `${fights} боёв, высокий лут, сильнее просадка экономики хаба` : `${fights} fights, high loot, stronger hub economy hit`,
            l === 'ru' ? '- репутация и + дефицит/волатильность цен' : '- reputation and + scarcity/price volatility',
          ],
        },
        {
          branch: 'neutral' as const,
          title: l === 'ru' ? 'Не вмешиваться' : 'Do Not Interfere',
          impacts: [
            l === 'ru' ? 'Без цепочки боёв, низкая награда' : 'No battle chain, low reward',
            l === 'ru' ? 'Рынок почти без изменений' : 'Market mostly unchanged',
          ],
        },
      ];
    }
    return [
      {
        branch: 'support' as const,
        title: l === 'ru' ? 'Поддержать' : 'Support',
        impacts: [
          l === 'ru' ? '+ богатство/стабильность хаба, + отношение' : '+ hub wealth/stability, + relation',
          l === 'ru' ? 'Цены ближе к стабильным' : 'Prices trend toward stable',
        ],
      },
      {
        branch: 'punish' as const,
        title: l === 'ru' ? 'Наказать' : 'Punish',
        impacts: [
          l === 'ru' ? '- богатство/стабильность хаба, - отношение' : '- hub wealth/stability, - relation',
          l === 'ru' ? 'Больше дефицита и ценового давления' : 'Higher scarcity and price pressure',
        ],
      },
    ];
  };

  useEffect(() => {
    const fresh = offeredEventQuests.find((q) => !spokenOfferIdsRef.current.has(q.id));
    if (!fresh) return;
    spokenOfferIdsRef.current.add(fresh.id);
    playVoiceText(
      'quests',
      l === 'ru' ? `Новый контракт: ${fresh.name.ru}` : `New contract available: ${fresh.name.en}`,
      l,
      settings.voice.quests,
    );
  }, [offeredEventQuests, l, settings.voice.quests]);

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
                        ? 'Перед принятием откройте контракт и просмотрите последствия веток.'
                        : 'Open the contract board and review branch consequences before acceptance.'}
                    </p>
                    <button
                      onClick={() => setPreviewQuestId(quest.id)}
                      className="rounded border border-primary/35 bg-primary/10 text-primary text-xs py-2 px-3 hover:bg-primary/20 transition-colors"
                    >
                      {l === 'ru' ? 'Открыть контракт' : 'Open contract board'}
                    </button>
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
                    <button
                      onClick={() => setPreviewQuestId(quest.id)}
                      className="rounded border border-white/20 bg-white/5 text-white text-xs py-2 px-3 hover:bg-white/10 transition-colors ml-2"
                    >
                      {l === 'ru' ? 'Изменить выбор' : 'Change choice'}
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
                {quest.isEventQuest && quest.eventQuest?.originType === 'caravan_attack' && quest.eventQuest?.branch === 'support' && quest.eventQuest?.escort && (
                  <div className="pl-2 mb-3 rounded border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                    <p>
                      {l === 'ru'
                        ? `Маршрут: этап ${Math.min(quest.eventQuest.escort.currentLeg + 1, quest.eventQuest.escort.route.length)}/${quest.eventQuest.escort.route.length}.`
                        : `Route: stage ${Math.min(quest.eventQuest.escort.currentLeg + 1, quest.eventQuest.escort.route.length)}/${quest.eventQuest.escort.route.length}.`}
                    </p>
                    <p>
                      {l === 'ru'
                        ? `Засады: ${quest.eventQuest.escort.clearedAmbushLocations.length}/${quest.eventQuest.escort.totalAmbushes}.`
                        : `Ambushes: ${quest.eventQuest.escort.clearedAmbushLocations.length}/${quest.eventQuest.escort.totalAmbushes}.`}
                    </p>
                    <p>
                      {quest.eventQuest.escort.perfectRun
                        ? (l === 'ru' ? 'Идеальный проход: активен бонус при сдаче.' : 'Perfect run: turn-in bonus active.')
                        : (l === 'ru' ? 'Идеальный проход сорван.' : 'Perfect run lost.')}
                    </p>
                  </div>
                )}
                
                <div className="space-y-2 pl-2 bg-black/40 p-2 rounded">
                  {quest.goals.map((goal, idx) => {
                    const targetName = goal.type === 'kill' && ENEMIES[goal.targetId]
                      ? ENEMIES[goal.targetId].name[l]
                      : LOCATIONS[goal.targetId]?.name?.[l] || goal.targetId;
                    const goalVerb =
                      goal.type === 'kill'
                        ? T.quest_defeat[l]
                        : goal.type === 'deliver'
                          ? (l === 'ru' ? 'Доставить поручение в' : 'Deliver dispatch to')
                          : goal.type === 'donate'
                            ? (l === 'ru' ? 'Внести золото в казну' : 'Donate gold to treasury')
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
                {quest.goals.some((g) => g.type === 'donate' && g.currentCount < g.targetCount) && (
                  <div className="pl-2 mt-3 flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] text-muted-foreground">
                      {l === 'ru' ? `Казна: ${player.gold} золота` : `Treasury funds: ${player.gold} gold`}
                    </span>
                    <button
                      onClick={() => contributeToQuestTreasury(quest.id, 25)}
                      disabled={player.gold <= 0}
                      className="rounded border border-amber-500/35 bg-amber-500/10 text-amber-200 text-xs py-1.5 px-2 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                    >
                      {l === 'ru' ? 'Внести 25' : 'Donate 25'}
                    </button>
                    <button
                      onClick={() => contributeToQuestTreasury(quest.id, 50)}
                      disabled={player.gold <= 0}
                      className="rounded border border-amber-500/35 bg-amber-500/10 text-amber-200 text-xs py-1.5 px-2 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                    >
                      {l === 'ru' ? 'Внести 50' : 'Donate 50'}
                    </button>
                    <button
                      onClick={() => contributeToQuestTreasury(quest.id, player.gold)}
                      disabled={player.gold <= 0}
                      className="rounded border border-amber-500/35 bg-amber-500/10 text-amber-200 text-xs py-1.5 px-2 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                    >
                      {l === 'ru' ? 'Внести максимум' : 'Donate max'}
                    </button>
                  </div>
                )}
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
      {previewQuest && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded border border-primary/25 bg-zinc-950 p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl text-white">{previewQuest.name[l]}</h3>
                <p className="text-xs text-muted-foreground mt-1">{previewQuest.description[l]}</p>
              </div>
              <button
                onClick={() => setPreviewQuestId(null)}
                className="rounded border border-white/20 bg-white/5 text-white text-xs px-2 py-1 hover:bg-white/10"
              >
                {l === 'ru' ? 'Закрыть' : 'Close'}
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-primary/90">
                {l === 'ru'
                  ? 'Выберите ветку. Ниже показан прогноз последствий для экономики и репутации.'
                  : 'Select a branch. Forecasted economy and reputation consequences are shown below.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {getBranchCards(previewQuest).map((card) => (
                  <div key={`${previewQuest.id}_${card.branch}`} className="rounded border border-white/15 bg-black/35 p-3 space-y-2">
                    <p className="text-sm text-white font-semibold">{card.title}</p>
                    <div className="space-y-1">
                      {card.impacts.map((impact, idx) => (
                        <p key={idx} className="text-[11px] text-muted-foreground">• {impact}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        chooseEventQuestBranch(previewQuest.id, card.branch);
                        setPreviewQuestId(null);
                      }}
                      className="w-full rounded border border-primary/35 bg-primary/10 text-primary text-xs py-2 hover:bg-primary/20 transition-colors"
                    >
                      {l === 'ru' ? 'Выбрать ветку' : 'Choose branch'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
