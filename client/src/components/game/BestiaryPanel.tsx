import { ReactNode, useMemo, useState } from 'react';
import { ENEMIES, ITEMS, LOCATIONS, NPCS } from '../../game/constants';
import { useGameStore } from '../../game/store';
import { BookMarked, MapPin, Package, Skull, Users } from 'lucide-react';

type BestiarySection = 'items' | 'locations' | 'npcs' | 'enemies';

export default function BestiaryPanel() {
  const { settings, codexUnlocks } = useGameStore();
  const l = settings.language;
  const [section, setSection] = useState<BestiarySection>('enemies');
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();

  const data = useMemo(() => {
    const isUnlocked = (id: string) => {
      const map = {
        items: codexUnlocks.items,
        locations: codexUnlocks.locations,
        npcs: codexUnlocks.npcs,
        enemies: codexUnlocks.enemies,
      } as const;
      return map[section].includes(id);
    };

    if (section === 'items') {
      return Object.values(ITEMS)
        .filter((it) => {
          if (!isUnlocked(it.id)) return normalized.length > 0 && (l === 'ru' ? 'неизвестно' : 'unknown').includes(normalized);
          return it.name[l].toLowerCase().includes(normalized);
        })
        .map((it) => ({
          id: it.id,
          unlocked: isUnlocked(it.id),
          title: isUnlocked(it.id) ? it.name[l] : (l === 'ru' ? 'Неизвестный предмет' : 'Unknown item'),
          subtitle: isUnlocked(it.id)
            ? `${l === 'ru' ? 'Тип' : 'Type'}: ${it.type} • ${l === 'ru' ? 'Редкость' : 'Rarity'}: ${it.rarity || 'common'}`
            : (l === 'ru' ? 'Откроется после добычи, крафта или награды' : 'Unlock by looting, crafting, or quest rewards'),
          body: isUnlocked(it.id)
            ? it.description[l]
            : (l === 'ru' ? 'Сведения будут добавлены в кодекс после первого взаимодействия.' : 'Codex details appear after first interaction.'),
        }));
    }
    if (section === 'locations') {
      return Object.values(LOCATIONS)
        .filter((loc) => {
          if (!isUnlocked(loc.id)) return normalized.length > 0 && (l === 'ru' ? 'неизвестно' : 'unknown').includes(normalized);
          return loc.name[l].toLowerCase().includes(normalized);
        })
        .map((loc) => ({
          id: loc.id,
          unlocked: isUnlocked(loc.id),
          title: isUnlocked(loc.id) ? loc.name[l] : (l === 'ru' ? 'Неизвестная локация' : 'Unknown location'),
          subtitle: isUnlocked(loc.id)
            ? `${l === 'ru' ? 'Зона' : 'Zone'}: ${loc.type}`
            : (l === 'ru' ? 'Откроется после путешествия или исследования' : 'Unlock by traveling or exploring'),
          body: isUnlocked(loc.id)
            ? loc.description[l]
            : (l === 'ru' ? 'Картографические данные отсутствуют.' : 'Cartographic records are not available yet.'),
        }));
    }
    if (section === 'npcs') {
      return Object.values(NPCS)
        .filter((npc) => {
          if (!isUnlocked(npc.id)) return normalized.length > 0 && (l === 'ru' ? 'неизвестно' : 'unknown').includes(normalized);
          return npc.name[l].toLowerCase().includes(normalized);
        })
        .map((npc) => ({
          id: npc.id,
          unlocked: isUnlocked(npc.id),
          title: isUnlocked(npc.id) ? npc.name[l] : (l === 'ru' ? 'Неизвестный персонаж' : 'Unknown character'),
          subtitle: isUnlocked(npc.id)
            ? `${l === 'ru' ? 'Локация' : 'Location'}: ${LOCATIONS[npc.locationId]?.name[l] || npc.locationId}`
            : (l === 'ru' ? 'Откроется после первого диалога' : 'Unlock by speaking to this NPC'),
          body: isUnlocked(npc.id)
            ? (l === 'ru'
              ? 'Носитель квестов, диалогов и лора. С ним можно развивать сюжетную линию региона.'
              : 'Quest, dialogue, and lore holder. Interact to progress the regional story line.')
            : (l === 'ru'
              ? 'Данные о собеседнике скрыты до личного контакта.'
              : 'Speaker profile remains hidden until direct contact.'),
        }));
    }
    return Object.values(ENEMIES)
      .filter((enemy) => {
        if (!isUnlocked(enemy.id)) return normalized.length > 0 && (l === 'ru' ? 'неизвестно' : 'unknown').includes(normalized);
        return enemy.name[l].toLowerCase().includes(normalized);
      })
      .map((enemy) => ({
        id: enemy.id,
        unlocked: isUnlocked(enemy.id),
        title: isUnlocked(enemy.id) ? enemy.name[l] : (l === 'ru' ? 'Неизвестное существо' : 'Unknown creature'),
        subtitle: isUnlocked(enemy.id)
          ? `${l === 'ru' ? 'Уровень' : 'Level'} ${enemy.level} • HP ${enemy.maxHp} • ${l === 'ru' ? 'Роль' : 'Role'}: ${enemy.role}`
          : (l === 'ru' ? 'Откроется после встречи в бою' : 'Unlock by encountering this enemy in combat'),
        body: isUnlocked(enemy.id)
          ? (l === 'ru'
            ? `Урон: ${enemy.damage[0]}-${enemy.damage[1]} • Тип: ${enemy.damageType}`
            : `Damage: ${enemy.damage[0]}-${enemy.damage[1]} • Type: ${enemy.damageType}`)
          : (l === 'ru'
            ? 'Запись засекречена до первого столкновения.'
            : 'Entry is sealed until first confrontation.'),
      }));
  }, [section, normalized, l, codexUnlocks]);

  const progress = useMemo(() => {
    const bySection = {
      enemies: { unlocked: codexUnlocks.enemies.length, total: Object.keys(ENEMIES).length },
      npcs: { unlocked: codexUnlocks.npcs.length, total: Object.keys(NPCS).length },
      locations: { unlocked: codexUnlocks.locations.length, total: Object.keys(LOCATIONS).length },
      items: { unlocked: codexUnlocks.items.length, total: Object.keys(ITEMS).length },
    } as const;
    return bySection[section];
  }, [section, codexUnlocks]);

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
      <p className="text-[11px] text-muted-foreground">
        {l === 'ru'
          ? `Открыто: ${progress.unlocked}/${progress.total}`
          : `Unlocked: ${progress.unlocked}/${progress.total}`}
      </p>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">
          {l === 'ru' ? 'Ничего не найдено.' : 'Nothing found.'}
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((entry) => (
            <div
              key={entry.id}
              className={`rounded border p-3 ${entry.unlocked ? 'border-white/10 bg-black/30' : 'border-white/5 bg-black/20 opacity-85'}`}
            >
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
