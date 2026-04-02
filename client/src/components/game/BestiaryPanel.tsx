import { ReactNode, useMemo, useState } from 'react';
import { ENEMIES, ITEMS, LOCATIONS, NPCS } from '../../game/constants';
import { useGameStore } from '../../game/store';
import { BookMarked, MapPin, Package, Skull, Users } from 'lucide-react';

type BestiarySection = 'items' | 'locations' | 'npcs' | 'enemies';

export default function BestiaryPanel() {
  const { settings } = useGameStore();
  const l = settings.language;
  const [section, setSection] = useState<BestiarySection>('enemies');
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();

  const data = useMemo(() => {
    if (section === 'items') {
      return Object.values(ITEMS)
        .filter((it) => it.name[l].toLowerCase().includes(normalized))
        .map((it) => ({
          id: it.id,
          title: it.name[l],
          subtitle: `${l === 'ru' ? 'Тип' : 'Type'}: ${it.type} • ${l === 'ru' ? 'Редкость' : 'Rarity'}: ${it.rarity || 'common'}`,
          body: it.description[l],
        }));
    }
    if (section === 'locations') {
      return Object.values(LOCATIONS)
        .filter((loc) => loc.name[l].toLowerCase().includes(normalized))
        .map((loc) => ({
          id: loc.id,
          title: loc.name[l],
          subtitle: `${l === 'ru' ? 'Зона' : 'Zone'}: ${loc.type}`,
          body: loc.description[l],
        }));
    }
    if (section === 'npcs') {
      return Object.values(NPCS)
        .filter((npc) => npc.name[l].toLowerCase().includes(normalized))
        .map((npc) => ({
          id: npc.id,
          title: npc.name[l],
          subtitle: `${l === 'ru' ? 'Локация' : 'Location'}: ${LOCATIONS[npc.locationId]?.name[l] || npc.locationId}`,
          body:
            l === 'ru'
              ? 'Носитель квестов, диалогов и лора. С ним можно развивать сюжетную линию региона.'
              : 'Quest, dialogue, and lore holder. Interact to progress the regional story line.',
        }));
    }
    return Object.values(ENEMIES)
      .filter((enemy) => enemy.name[l].toLowerCase().includes(normalized))
      .map((enemy) => ({
        id: enemy.id,
        title: enemy.name[l],
        subtitle: `${l === 'ru' ? 'Уровень' : 'Level'} ${enemy.level} • HP ${enemy.maxHp} • ${l === 'ru' ? 'Роль' : 'Role'}: ${enemy.role}`,
        body:
          l === 'ru'
            ? `Урон: ${enemy.damage[0]}-${enemy.damage[1]} • Тип: ${enemy.damageType}`
            : `Damage: ${enemy.damage[0]}-${enemy.damage[1]} • Type: ${enemy.damageType}`,
      }));
  }, [section, normalized, l]);

  const tabs: { id: BestiarySection; label: string; icon: ReactNode }[] = [
    { id: 'enemies', label: l === 'ru' ? 'Мобы' : 'Mobs', icon: <Skull className="w-3.5 h-3.5" /> },
    { id: 'npcs', label: l === 'ru' ? 'NPC' : 'NPCs', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'locations', label: l === 'ru' ? 'Места' : 'Locations', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'items', label: l === 'ru' ? 'Предметы' : 'Items', icon: <Package className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm flex items-center gap-2">
          <BookMarked className="w-4 h-4" />
          {l === 'ru' ? 'Бестиарий и Кодекс' : 'Bestiary & Codex'}
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-wider border transition-colors flex items-center gap-1 ${
              section === tab.id
                ? 'border-primary/40 text-primary bg-primary/15'
                : 'border-white/10 text-muted-foreground bg-black/35 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={l === 'ru' ? 'Поиск по названию...' : 'Search by name...'}
        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-primary/40"
      />

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">
          {l === 'ru' ? 'Ничего не найдено.' : 'Nothing found.'}
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((entry) => (
            <div key={entry.id} className="rounded border border-white/10 bg-black/30 p-3">
              <p className="font-serif text-white">{entry.title}</p>
              <p className="text-[11px] text-primary/80 mb-1">{entry.subtitle}</p>
              <p className="text-xs text-muted-foreground">{entry.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
