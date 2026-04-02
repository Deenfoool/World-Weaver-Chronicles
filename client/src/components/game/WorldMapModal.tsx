import { LOCATIONS } from '../../game/constants';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: 'en' | 'ru';
  currentLocationId: string;
  discoveredLocations: string[];
  onTravel: (locationId: string) => void;
};

type Point = { x: number; y: number };

const FIXED_NODE_POSITIONS: Record<string, Point> = {
  town_oakhaven: { x: 20, y: 44 },
  road_south: { x: 33, y: 50 },
  forest_whispering: { x: 16, y: 30 },
  ruins_ancient: { x: 47, y: 55 },
  mountain_pass: { x: 50, y: 34 },
  cave_deep: { x: 65, y: 28 },
  swamp_murky: { x: 22, y: 67 },
  forgotten_forge: { x: 62, y: 52 },
  sunken_sanctum: { x: 79, y: 34 },
  road_ironway: { x: 40, y: 23 },
  road_concord: { x: 31, y: 17 },
  road_marshlane: { x: 34, y: 69 },
  hub_ironhold: { x: 56, y: 14 },
  hub_sky_consort: { x: 42, y: 8 },
  hub_mire_union: { x: 47, y: 78 },
};

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function fallbackNodePosition(id: string): Point {
  const hash = stableHash(id);
  return {
    x: 12 + (hash % 74),
    y: 10 + (Math.floor(hash / 97) % 78),
  };
}

function getNodePosition(id: string): Point {
  return FIXED_NODE_POSITIONS[id] || fallbackNodePosition(id);
}

export default function WorldMapModal({
  open,
  onOpenChange,
  language,
  currentLocationId,
  discoveredLocations,
  onTravel,
}: Props) {
  const discoveredSet = new Set(discoveredLocations || []);
  const allLocations = Object.values(LOCATIONS);
  const currentLocation = LOCATIONS[currentLocationId];
  const reachable = new Set(currentLocation?.connectedLocations || []);

  const edges = new Set<string>();
  const edgeRows: Array<{ from: string; to: string }> = [];
  allLocations.forEach((loc) => {
    (loc.connectedLocations || []).forEach((to) => {
      const key = [loc.id, to].sort().join('__');
      if (edges.has(key)) return;
      edges.add(key);
      edgeRows.push({ from: loc.id, to });
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] md:max-w-6xl p-0 border-primary/35 bg-black/95 overflow-hidden">
        <div className="p-4 md:p-5 border-b border-primary/20 bg-gradient-to-r from-black via-black/90 to-black/70">
          <DialogTitle className="font-serif uppercase tracking-widest text-primary text-lg md:text-2xl">
            {language === 'ru' ? 'Карта мира' : 'World Map'}
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm text-muted-foreground mt-1">
            {language === 'ru'
              ? 'Все места отображены на карте. Неисследованные области скрыты туманом войны.'
              : 'All places are shown on the map. Undiscovered areas are hidden by fog of war.'}
          </DialogDescription>
        </div>

        <div className="relative h-[76vh] md:h-[78vh] bg-[radial-gradient(circle_at_20%_20%,rgba(214,170,80,0.12),transparent_50%),radial-gradient(circle_at_80%_65%,rgba(80,110,170,0.12),transparent_48%),linear-gradient(180deg,rgba(12,17,28,0.95),rgba(4,6,12,0.98))]">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {edgeRows.map((edge) => {
              const fromPos = getNodePosition(edge.from);
              const toPos = getNodePosition(edge.to);
              const fromKnown = discoveredSet.has(edge.from);
              const toKnown = discoveredSet.has(edge.to);
              const visible = fromKnown || toKnown || edge.from === currentLocationId || edge.to === currentLocationId;
              return (
                <line
                  key={`${edge.from}_${edge.to}`}
                  x1={`${fromPos.x}%`}
                  y1={`${fromPos.y}%`}
                  x2={`${toPos.x}%`}
                  y2={`${toPos.y}%`}
                  stroke={visible ? 'rgba(214,170,80,0.5)' : 'rgba(120,130,150,0.18)'}
                  strokeWidth={visible ? 2 : 1}
                  strokeDasharray={visible ? '0' : '4 6'}
                />
              );
            })}
          </svg>

          {allLocations.map((loc) => {
            const pos = getNodePosition(loc.id);
            const isCurrent = loc.id === currentLocationId;
            const isKnown = discoveredSet.has(loc.id);
            const canTravel = !isCurrent && reachable.has(loc.id);
            const visibleName = isKnown || isCurrent;
            const label = visibleName ? loc.name[language] : (language === 'ru' ? 'Неизвестно' : 'Unknown');
            const typeLabel =
              loc.type === 'hub'
                ? (language === 'ru' ? 'Хаб' : 'Hub')
                : loc.type === 'road'
                  ? (language === 'ru' ? 'Дорога' : 'Road')
                  : (language === 'ru' ? 'Локация' : 'Area');

            return (
              <button
                key={loc.id}
                onClick={() => {
                  if (!canTravel) return;
                  onTravel(loc.id);
                  onOpenChange(false);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group text-left ${
                  canTravel ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div
                  className={`relative min-w-[106px] md:min-w-[132px] rounded-lg border px-2.5 py-2 md:px-3 md:py-2.5 transition-all ${
                    isCurrent
                      ? 'border-emerald-400/70 bg-emerald-900/35 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                      : canTravel
                        ? 'border-primary/55 bg-black/70 hover:bg-black/88 hover:border-primary'
                        : 'border-white/15 bg-black/55'
                  }`}
                >
                  {!isKnown && !isCurrent && (
                    <div className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_30%_35%,rgba(255,255,255,0.12),rgba(0,0,0,0.92)_60%)] backdrop-blur-[2px] pointer-events-none" />
                  )}
                  <p className={`text-[9px] md:text-[10px] uppercase tracking-[0.16em] ${isCurrent ? 'text-emerald-200' : 'text-primary/80'}`}>
                    {isCurrent
                      ? (language === 'ru' ? 'Текущая позиция' : 'Current Position')
                      : typeLabel}
                  </p>
                  <p className={`relative text-[11px] md:text-[13px] font-serif uppercase leading-tight ${visibleName ? 'text-white' : 'text-white/80'}`}>
                    {label}
                  </p>
                  {canTravel && (
                    <p className="relative mt-1 text-[10px] text-primary">
                      {language === 'ru' ? 'Нажмите для перехода' : 'Tap to travel'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

