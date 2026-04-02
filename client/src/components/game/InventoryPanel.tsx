import { useGameStore } from '../../game/store';
import { ITEMS } from '../../game/constants';
import { Package, Shield, Sword, Beaker, CircleDollarSign, Hammer } from 'lucide-react';
import { ItemType } from '../../game/types';
import { T } from '../../game/translations';
import { useMemo, useState } from 'react';
import CraftingPanel from './CraftingPanel';

export default function InventoryPanel() {
  const { player, equipItem, useItem, settings } = useGameStore();
  const l = settings.language;
  const [section, setSection] = useState<'inventory' | 'crafting'>('inventory');
  const [filter, setFilter] = useState<'all' | ItemType>('all');
  const [sort, setSort] = useState<'name' | 'weight' | 'rarity'>('name');
  const totalWeight = player.inventory.reduce((sum, invItem) => {
    const item = ITEMS[invItem.itemId];
    return item ? sum + item.weight * invItem.quantity : sum;
  }, 0);

  const getIcon = (type: ItemType) => {
    switch(type) {
      case 'weapon': return <Sword className="w-4 h-4" />;
      case 'armor': return <Shield className="w-4 h-4" />;
      case 'consumable': return <Beaker className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const equippedSet = new Set([player.equipment.weapon, player.equipment.armor].filter(Boolean));
  const slotUsage = player.inventory.reduce(
    (acc, inv) => {
      const item = ITEMS[inv.itemId];
      if (!item) return acc;
      if (item.slotCategory === 'potion') acc.potion += inv.quantity;
      if (item.slotCategory === 'material') acc.material += inv.quantity;
      return acc;
    },
    { potion: 0, material: 0 },
  );
  const overload = Math.max(0, totalWeight - player.carryCapacity);
  const rows = useMemo(
    () =>
      player.inventory
        .filter((inv) => {
          const item = ITEMS[inv.itemId];
          return item && (filter === 'all' || item.type === filter);
        })
        .sort((a, b) => {
          const ia = ITEMS[a.itemId];
          const ib = ITEMS[b.itemId];
          if (!ia || !ib) return 0;
          if (sort === 'weight') return ib.weight * b.quantity - ia.weight * a.quantity;
          if (sort === 'rarity') {
            const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 } as Record<string, number>;
            return (order[ib.rarity || 'common'] || 0) - (order[ia.rarity || 'common'] || 0);
          }
          return ia.name[l].localeCompare(ib.name[l]);
        }),
    [player.inventory, filter, sort, l],
  );

  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setSection('inventory')}
          className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-wider border transition-colors ${
            section === 'inventory'
              ? 'border-primary/40 text-primary bg-primary/15'
              : 'border-white/10 text-muted-foreground bg-black/35 hover:text-white'
          }`}
        >
          {l === 'ru' ? 'Инвентарь' : 'Inventory'}
        </button>
        <button
          onClick={() => setSection('crafting')}
          className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-wider border transition-colors flex items-center gap-1 ${
            section === 'crafting'
              ? 'border-primary/40 text-primary bg-primary/15'
              : 'border-white/10 text-muted-foreground bg-black/35 hover:text-white'
          }`}
        >
          <Hammer className="w-3 h-3" />
          {l === 'ru' ? 'Ремесло' : 'Crafting'}
        </button>
      </div>

      {section === 'crafting' ? (
        <div className="-mx-4">
          <CraftingPanel />
        </div>
      ) : (
        <>
      <div className="mb-3 text-xs text-muted-foreground font-mono bg-black/40 border border-white/10 rounded px-3 py-2">
        {T.stat_weight[l]}: {totalWeight.toFixed(1)} / {player.carryCapacity.toFixed(1)} ({T.stat_capacity[l]})
        {overload > 0 && <span className="text-destructive ml-2">Overload +{overload.toFixed(1)}</span>}
        <div className="mt-1">Potions: {slotUsage.potion}/{player.backpackSlots?.potion || 12} | Materials: {slotUsage.material}/{player.backpackSlots?.material || 24}</div>
      </div>
      <div className="mb-3 flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs">
          <option value="all">All</option>
          <option value="weapon">Weapon</option>
          <option value="armor">Armor</option>
          <option value="consumable">Consumable</option>
          <option value="material">Material</option>
          <option value="recipe">Recipe</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs">
          <option value="name">Sort: Name</option>
          <option value="weight">Sort: Weight</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
      </div>
      {player.inventory.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-8">{T.inv_empty[l]}</p>
      ) : (
        <div className="space-y-3">
          {rows.map(invItem => {
            const item = ITEMS[invItem.itemId];
            if (!item) return null;
            const isEquipped = equippedSet.has(invItem.itemId);

            return (
              <div key={invItem.itemId} className="bg-black/30 border border-white/5 rounded p-3 text-sm transition-colors hover:bg-black/50">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 font-medium text-white">
                    {getIcon(item.type)} 
                    <span className={isEquipped ? 'text-primary' : ''}>
                      {item.name[l]} {invItem.quantity > 1 && <span className="text-muted-foreground font-mono ml-1">x{invItem.quantity}</span>}
                    </span>
                  </div>
                  {isEquipped && <span className="text-[10px] uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30">{T.equipped[l]}</span>}
                </div>
                
                <p className="text-xs text-muted-foreground mb-3 mt-2">{item.description[l]}</p>
                {(item.rarity || item.affixes?.length || item.setId || item.uniqueLegendary) && (
                  <p className="text-[10px] text-primary/80 mb-2">
                    {item.rarity || 'common'}
                    {item.uniqueLegendary ? ' • unique' : ''}
                    {item.setId ? ` • set:${item.setId}` : ''}
                    {item.affixes?.length ? ` • ${item.affixes.join(', ')}` : ''}
                  </p>
                )}
                
                <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs flex items-center gap-1 text-yellow-500/70 font-mono">
                      <CircleDollarSign className="w-3 h-3"/> {item.value}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {T.stat_weight[l]}: {(item.weight * invItem.quantity).toFixed(1)}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {item.type === 'recipe' && (
                      <button onClick={() => useItem(item.id)} className="text-[10px] uppercase bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/50 px-3 py-1.5 rounded transition-colors font-bold tracking-wider">
                        {T.btn_learn ? T.btn_learn[l] : 'Learn'}
                      </button>
                    )}
                    {item.type === 'consumable' && (
                      <button onClick={() => useItem(item.id)} className="text-[10px] uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors font-bold tracking-wider">
                        {T.btn_use[l]}
                      </button>
                    )}
                    {(item.type === 'weapon' || item.type === 'armor') && (
                      <button 
                        onClick={() => equipItem(isEquipped ? '' : item.id, item.type as 'weapon' | 'armor')}
                        className={`text-[10px] uppercase px-3 py-1.5 rounded transition-colors font-bold tracking-wider ${isEquipped ? 'bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/40' : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/40'}`}
                      >
                        {isEquipped ? T.btn_unequip[l] : T.btn_equip[l]}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
