import { useEffect, useState } from 'react';
import { useGameStore } from '../../game/store';
import { NPC } from '../../game/types';
import { LOCATIONS } from '../../game/constants';
import { MessageSquareText, X } from 'lucide-react';
import { playVoiceText, stopVoicePlayback } from '../../game/voice';

interface Props {
  npc: NPC;
  onClose: () => void;
}

export default function NPCPanel({ npc, onClose }: Props) {
  const { settings, acceptQuest, turnInQuest, unlockCodexEntry, quests } = useGameStore();
  const [currentNodeId, setCurrentNodeId] = useState<string>(npc.defaultNode);
  
  const l = settings.language;
  const node = npc.dialogueTree[currentNodeId];
  const fullNpcImage = `/images/npcs/${npc.id}.png`;
  const miniNpcImage = `/images/npcs/mini/${npc.id}_mini.png`;
  const locationFallback = LOCATIONS[npc.locationId]?.image || '/images/ruined-castle.png';
  const turnInReadyQuests = quests.filter(
    (q) => !q.isCompleted && q.isTurnInReady && (q.turnInNpcId || q.giverNpcId) === npc.id,
  );

  if (!node) {
    onClose();
    return null;
  }

  useEffect(() => {
    unlockCodexEntry('npcs', npc.id);
    unlockCodexEntry('locations', npc.locationId);
  }, [npc.id, npc.locationId, unlockCodexEntry]);

  useEffect(() => {
    playVoiceText('npcDialogue', node.text[l], l, settings.voice.npcDialogue);
    return () => {
      stopVoicePlayback();
    };
  }, [node.id, node.text, l, settings.voice.npcDialogue]);

  const handleOptionClick = (option: { action?: string; actionPayload?: string; nextNodeId: string | null }) => {
    if (option.action === 'give_quest' && option.actionPayload) {
      acceptQuest(option.actionPayload, npc.id);
    }

    if (option.action === 'turn_in_quest' && option.actionPayload) {
      turnInQuest(option.actionPayload, npc.id);
    }
    
    if (option.nextNodeId === null) {
      onClose();
    } else {
      setCurrentNodeId(option.nextNodeId);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full animate-in bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl overflow-hidden my-4 h-[500px]">
      
      {/* Header */}
      <div className="p-6 border-b border-border bg-black/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquareText className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-serif text-white">{npc.name[l]}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
      </div>

      <div
        className="flex-1 p-6 flex flex-col justify-end min-h-0 bg-cover bg-center relative"
        style={{
          backgroundImage: `url(${fullNpcImage}), url(${miniNpcImage}), url(${locationFallback})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"></div>
        
        <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col gap-6">
          <div className="bg-black/60 border border-white/10 p-6 rounded-lg shadow-xl">
             <p className="text-lg text-white font-serif italic leading-relaxed">
               "{node.text[l]}"
             </p>
          </div>

          <div className="flex flex-col gap-2">
             {node.options.map((opt, idx) => (
               <button 
                 key={idx}
                 onClick={() => handleOptionClick(opt)}
                 className="rpg-button !text-left px-6 py-3 bg-secondary/80 hover:bg-primary/20 text-white hover:text-primary transition-all rounded"
               >
                 {opt.text[l]}
               </button>
             ))}
          </div>

          {turnInReadyQuests.length > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
              <h4 className="text-xs uppercase tracking-widest text-primary mb-2">
                {l === 'ru' ? 'Готово к сдаче' : 'Ready to Turn In'}
              </h4>
              <div className="space-y-2">
                {turnInReadyQuests.map((quest) => (
                  <button
                    key={quest.id}
                    onClick={() => turnInQuest(quest.id, npc.id)}
                    className="w-full rpg-button !text-left px-4 py-2 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/40"
                  >
                    {l === 'ru' ? 'Сдать квест' : 'Turn In Quest'}: {quest.name[l]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
