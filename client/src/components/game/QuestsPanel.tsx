import { useGameStore } from '../../game/store';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { LOCATIONS, ENEMIES, NPCS } from '../../game/constants';
import { T } from '../../game/translations';

export default function QuestsPanel() {
  const { quests, settings } = useGameStore();
  const l = settings.language;
  
  const activeQuests = quests.filter(q => !q.isCompleted);
  const completedQuests = quests.filter(q => q.isCompleted);

  return (
    <div className="p-4 space-y-6">
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
                    {l === 'ru' ? 'Готово к сдаче у: ' : 'Ready to turn in at: '}
                    {NPCS[quest.turnInNpcId || quest.giverNpcId || '']?.name[l] || (l === 'ru' ? 'квестодатель' : 'quest giver')}
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
    </div>
  );
}
