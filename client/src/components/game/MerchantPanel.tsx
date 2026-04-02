import { useGameStore } from '../../game/store';
import { ITEMS } from '../../game/constants';
import { Merchant } from '../../game/types';
import { X, Coins } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { T } from '../../game/translations';
import { playSfx } from '../../game/audio';
import { useEffect } from 'react';

interface Props {
  merchant: Merchant;
  onClose: () => void;
}

export default function MerchantPanel({ merchant, onClose }: Props) {
  const { player, buyItem, sellItem, getBuyPrice, getSellPrice, settings } = useGameStore();
  const l = settings.language;
  const rep = player.merchantReputation?.[merchant.id] || 0;
  useEffect(() => {
    void playSfx('ui_panel_open');
    return () => {
      void playSfx('ui_panel_close');
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full animate-in bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl overflow-hidden my-4 h-[600px]">
      
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border bg-black/40 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif text-primary mb-1">{merchant.name[l]}</h2>
          <p className="text-xs text-muted-foreground">Rep: {rep >= 0 ? '+' : ''}{rep}</p>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 text-lg">
            <Coins className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
            <span className="font-bold text-white">{player.gold}</span>
          </div>
          <button onClick={() => { void playSfx('ui_click_soft'); onClose(); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* BUY SECTION */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-border min-h-[50%] md:min-h-0">
          <div className="p-3 bg-black/20 text-center border-b border-border/50 shrink-0">
            <h3 className="font-serif text-sm md:text-lg tracking-widest uppercase text-white">{T.merchant_buy[l]}</h3>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {merchant.inventory.map((mItem, idx) => {
                const itemDef = ITEMS[mItem.itemId];
                const finalPrice = getBuyPrice(merchant.id, mItem.itemId, mItem.price);
                const canAfford = player.gold >= finalPrice;
                return (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5 hover:border-white/10 transition-colors">
                    <div>
                      <div className="font-medium text-white text-sm">{itemDef.name[l]}</div>
                      <div className="text-xs text-muted-foreground">{itemDef.description[l]}</div>
                    </div>
                    <button 
                      onClick={() => buyItem(mItem.itemId, finalPrice)}
                      disabled={!canAfford}
                      className={`ml-4 shrink-0 flex items-center gap-1 px-3 py-1.5 rounded text-xs md:text-sm font-bold transition-all ${
                        canAfford 
                          ? 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-primary-foreground' 
                          : 'bg-black/50 text-muted-foreground border border-border cursor-not-allowed opacity-50'
                      }`}
                    >
                      {finalPrice} <Coins className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* SELL SECTION */}
        <div className="flex-1 flex flex-col min-h-[50%] md:min-h-0">
          <div className="p-3 bg-black/20 text-center border-b border-border/50 shrink-0">
            <h3 className="font-serif text-sm md:text-lg tracking-widest uppercase text-white">{T.merchant_sell[l]}</h3>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {player.inventory.length === 0 && (
                <p className="text-center text-muted-foreground italic mt-8 text-sm">{T.merchant_nothing[l]}</p>
              )}
              {player.inventory.map((invItem, idx) => {
                const itemDef = ITEMS[invItem.itemId];
                const sellPrice = getSellPrice(merchant.id, invItem.itemId, itemDef.value);
                const isEquipped = player.equipment.weapon === invItem.itemId || player.equipment.armor === invItem.itemId;
                
                return (
                  <div key={idx} className={`flex justify-between items-center p-3 rounded border transition-colors ${isEquipped ? 'bg-primary/5 border-primary/20 opacity-75' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2 text-sm">
                        {itemDef.name[l]} 
                        <span className="text-xs text-muted-foreground font-mono">x{invItem.quantity}</span>
                        {isEquipped && <span className="text-[9px] uppercase text-primary border border-primary/30 px-1 rounded">Eq</span>}
                      </div>
                    </div>
                    <button 
                      onClick={() => sellItem(invItem.itemId, sellPrice)}
                      disabled={isEquipped && invItem.quantity === 1}
                      className="ml-4 shrink-0 flex items-center gap-1 px-3 py-1.5 rounded text-xs md:text-sm font-bold bg-white/10 hover:bg-white/20 border border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-green-400"
                    >
                      +{sellPrice} <Coins className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
      
    </div>
  );
}
