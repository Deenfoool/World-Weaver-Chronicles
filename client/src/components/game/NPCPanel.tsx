import { useEffect, useState } from 'react';
import { useGameStore } from '../../game/store';
import { NPC } from '../../game/types';
import { LOCATIONS, MERCHANTS } from '../../game/constants';
import { MessageSquareText, X } from 'lucide-react';
import { playVoiceText, stopVoicePlayback } from '../../game/voice';
import MerchantPanel from './MerchantPanel';

interface Props {
  npc: NPC;
  onClose: () => void;
}

export default function NPCPanel({ npc, onClose }: Props) {
  const { settings, acceptQuest, turnInQuest, unlockCodexEntry, quests, worldEconomy, player, raidCaravan, investInHub, runDiplomacy, sabotageHub } = useGameStore();
  const [currentNodeId, setCurrentNodeId] = useState<string>(npc.defaultNode);
  const [showHubControl, setShowHubControl] = useState(false);
  const [selectedHubTarget, setSelectedHubTarget] = useState<string>(npc.locationId);
  const [investGoldInput, setInvestGoldInput] = useState('50');
  const [hubActionMessage, setHubActionMessage] = useState('');
  const [activeMerchantId, setActiveMerchantId] = useState<string | null>(null);
  
  const l = settings.language;
  const node = npc.dialogueTree[currentNodeId];
  const fullNpcImage = `/images/npcs/${npc.id}.png`;
  const miniNpcImage = `/images/npcs/mini/${npc.id}_mini.png`;
  const locationFallback = LOCATIONS[npc.locationId]?.image || '/images/ruined-castle.png';
  const turnInReadyQuests = quests.filter(
    (q) => !q.isCompleted && q.isTurnInReady && (q.turnInNpcId || q.giverNpcId) === npc.id,
  );
  const canManageHub = npc.id === 'npc_elder_bran';
  const npcMerchantId = npc.id.replace(/^npc_/, 'merchant_');
  const npcMerchant = MERCHANTS[npcMerchantId];
  const availableHubTargets = Object.values(worldEconomy.hubs || {}).filter((hub) => !hub.destroyed);
  const selectedHubInfo = worldEconomy.hubs[selectedHubTarget];

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

  useEffect(() => {
    const exists = availableHubTargets.some((hub) => hub.hubId === selectedHubTarget);
    if (!exists) setSelectedHubTarget(npc.locationId);
  }, [availableHubTargets, selectedHubTarget, npc.locationId]);

  if (activeMerchantId && MERCHANTS[activeMerchantId]) {
    return <MerchantPanel merchant={MERCHANTS[activeMerchantId]} onClose={() => setActiveMerchantId(null)} />;
  }

  const handleOptionClick = (option: { action?: string; actionPayload?: string; nextNodeId: string | null }) => {
    if (option.action === 'give_quest' && option.actionPayload) {
      acceptQuest(option.actionPayload, npc.id);
    }

    if (option.action === 'turn_in_quest' && option.actionPayload) {
      turnInQuest(option.actionPayload, npc.id);
    }

    if (option.action === 'open_merchant') {
      const merchantId = option.actionPayload || npcMerchant?.id;
      if (merchantId && MERCHANTS[merchantId]) {
        setActiveMerchantId(merchantId);
      }
      return;
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

          {canManageHub && (
            <button
              onClick={() => {
                setHubActionMessage('');
                setShowHubControl(true);
              }}
              className="rpg-button !text-left px-6 py-3 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/35 rounded"
            >
              {l === 'ru' ? 'Управление хабом' : 'Hub Control'}
            </button>
          )}

          {npcMerchant && (
            <button
              onClick={() => setActiveMerchantId(npcMerchant.id)}
              className="rpg-button !text-left px-6 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 rounded"
            >
              {l === 'ru' ? 'Открыть лавку' : 'Open Shop'}
            </button>
          )}

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

      {showHubControl && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-lg border border-primary/30 bg-card/95 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <h3 className="text-lg font-serif text-primary">
                {l === 'ru' ? 'Совет Окхейвена: управление хабом' : 'Oakhaven Council: Hub Control'}
              </h3>
              <button
                onClick={() => setShowHubControl(false)}
                className="p-2 rounded hover:bg-white/10 transition-colors"
                aria-label={l === 'ru' ? 'Закрыть' : 'Close'}
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={selectedHubTarget}
                  onChange={(e) => setSelectedHubTarget(e.target.value)}
                  className="sm:col-span-2 bg-black/45 border border-white/15 rounded px-2 py-2 text-xs text-white"
                >
                  {availableHubTargets.map((hub) => (
                    <option key={hub.hubId} value={hub.hubId}>
                      {(LOCATIONS[hub.hubId]?.name?.[l] || hub.hubId)} · Lv {hub.level}
                    </option>
                  ))}
                </select>
                <input
                  value={investGoldInput}
                  onChange={(e) => setInvestGoldInput(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                  placeholder={l === 'ru' ? 'Золото' : 'Gold'}
                  className="bg-black/45 border border-white/15 rounded px-2 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    const amount = Math.max(0, Number.parseInt(investGoldInput || '0', 10) || 0);
                    if (amount <= 0) {
                      setHubActionMessage(l === 'ru' ? 'Укажите сумму инвестиций.' : 'Set investment amount first.');
                      return;
                    }
                    if (amount > player.gold) {
                      setHubActionMessage(l === 'ru' ? 'Недостаточно золота для инвестиции.' : 'Not enough gold for this investment.');
                      return;
                    }
                    investInHub(selectedHubTarget, amount);
                    setHubActionMessage(
                      l === 'ru'
                        ? `Инвестиция ${amount} золота направлена в ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`
                        : `Invested ${amount} gold into ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`,
                    );
                  }}
                  className="rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-[11px] py-2 hover:bg-emerald-500/20 transition-colors"
                >
                  {l === 'ru' ? 'Инвест.' : 'Invest'}
                </button>
                <button
                  onClick={() => {
                    runDiplomacy(selectedHubTarget);
                    setHubActionMessage(
                      l === 'ru'
                        ? `Дипломатическая миссия отправлена в ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`
                        : `Diplomatic mission sent to ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`,
                    );
                  }}
                  className="rounded border border-sky-500/35 bg-sky-500/10 text-sky-300 text-[11px] py-2 hover:bg-sky-500/20 transition-colors"
                >
                  {l === 'ru' ? 'Диплом.' : 'Diplomacy'}
                </button>
                <button
                  onClick={() => {
                    raidCaravan(selectedHubTarget);
                    setHubActionMessage(
                      l === 'ru'
                        ? `Караванный рейд проведён против ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`
                        : `Caravan raid executed against ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`,
                    );
                  }}
                  className="rounded border border-amber-500/35 bg-amber-500/10 text-amber-300 text-[11px] py-2 hover:bg-amber-500/20 transition-colors"
                >
                  {l === 'ru' ? 'Рейд' : 'Raid'}
                </button>
                <button
                  onClick={() => {
                    sabotageHub(selectedHubTarget);
                    setHubActionMessage(
                      l === 'ru'
                        ? `Саботаж произведён в ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`
                        : `Sabotage carried out in ${LOCATIONS[selectedHubTarget]?.name?.[l] || selectedHubTarget}.`,
                    );
                  }}
                  className="rounded border border-destructive/35 bg-destructive/10 text-destructive text-[11px] py-2 hover:bg-destructive/20 transition-colors"
                >
                  {l === 'ru' ? 'Саботаж' : 'Sabotage'}
                </button>
              </div>

              {selectedHubInfo && (
                <p className="text-[11px] text-muted-foreground">
                  {l === 'ru'
                    ? `Цель: ур. ${selectedHubInfo.level}, богатство ${selectedHubInfo.wealth}, отношение ${selectedHubInfo.playerRelation}, режим ${selectedHubInfo.marketMode}`
                    : `Target: lv ${selectedHubInfo.level}, wealth ${selectedHubInfo.wealth}, relation ${selectedHubInfo.playerRelation}, mode ${selectedHubInfo.marketMode}`}
                </p>
              )}
              {hubActionMessage && <p className="text-[11px] text-primary/90">{hubActionMessage}</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
