import { useGameStore } from '../../game/store';
import { RECIPES, ITEMS, LOCATIONS } from '../../game/constants';
import { T } from '../../game/translations';
import { Hammer, Check } from 'lucide-react';
import { useState } from 'react';

export default function CraftingPanel() {
  const { player, craftItem, currentLocationId, settings } = useGameStore();
  const l = settings.language;
  const [msg, setMsg] = useState('');

  const handleCraft = (id: string) => {
    craftItem(id);
    setMsg(T.craft_success[l]);
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="p-4 space-y-4 pb-12">
      <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-4">
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm flex items-center gap-2">
          <Hammer className="w-4 h-4" /> {T.craft_title[l]}
        </h3>
        {msg && <span className="text-xs text-green-400 font-bold animate-in">{msg}</span>}
      </div>

      {player.knownRecipes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-8">{T.craft_empty[l]}</p>
      ) : (
        <div className="space-y-3">
          {player.knownRecipes.map(recipeId => {
            const recipe = RECIPES[recipeId];
            if (!recipe) return null;

            const resultItem = ITEMS[recipe.resultItemId];
            const hasStation = recipe.requiredStation
              ? LOCATIONS[currentLocationId].craftingStations?.includes(recipe.requiredStation) || false
              : true;

            // Check if can craft
            let canCraft = hasStation;
            for (const ing of recipe.ingredients) {
              const pIng = player.inventory.find(i => i.itemId === ing.itemId);
              if (!pIng || pIng.quantity < ing.quantity) {
                canCraft = false;
                break;
              }
            }

            return (
              <div key={recipeId} className="bg-black/30 border border-white/5 rounded p-3 text-sm">
                <h4 className="font-medium text-white mb-2">{resultItem.name[l]} <span className="text-xs text-muted-foreground font-mono">x{recipe.resultQuantity}</span></h4>
                
                <div className="bg-black/50 p-2 rounded mb-3">
                  {recipe.requiredStation && (
                    <p className="text-[10px] text-primary mb-1">Station: {recipe.requiredStation}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">{T.craft_req[l]}:</p>
                  {recipe.ingredients.map(ing => {
                    const iDef = ITEMS[ing.itemId];
                    const pIng = player.inventory.find(i => i.itemId === ing.itemId);
                    const pQty = pIng ? pIng.quantity : 0;
                    const hasEnough = pQty >= ing.quantity;

                    return (
                      <div key={ing.itemId} className="flex justify-between items-center text-xs">
                        <span className={hasEnough ? 'text-gray-300' : 'text-destructive'}>{iDef.name[l]}</span>
                        <span className="font-mono">
                          <span className={hasEnough ? 'text-green-400' : 'text-destructive'}>{pQty}</span> / {ing.quantity}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <button 
                  onClick={() => handleCraft(recipeId)}
                  disabled={!canCraft}
                  className={`w-full text-xs uppercase py-2 rounded transition-colors font-bold tracking-wider ${canCraft ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/40' : 'bg-black/50 text-muted-foreground border border-border cursor-not-allowed'}`}
                >
                  {T.craft_btn[l]}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
