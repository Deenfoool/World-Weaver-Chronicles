import { LOCATIONS } from '../../game/constants';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useCallback, useRef, useState } from 'react';
import { getAuthSession } from '@/lib/telegram';

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
  town_oakhaven: { x: 49, y: 58 },
  road_south: { x: 68, y: 86 },
  forest_whispering: { x: 16, y: 86 },
  ruins_ancient: { x: 9, y: 65 },
  mountain_pass: { x: 20, y: 32 },
  cave_deep: { x: 11, y: 37 },
  swamp_murky: { x: 43, y: 84 },
  forgotten_forge: { x: 44, y: 37 },
  sunken_sanctum: { x: 31, y: 50 },
  road_ironway: { x: 66, y: 65 },
  road_concord: { x: 56, y: 37 },
  road_marshlane: { x: 41, y: 79 },
  hub_ironhold: { x: 85, y: 57 },
  hub_sky_consort: { x: 68, y: 20 },
  hub_mire_union: { x: 36, y: 80 },
  road_glassway: { x: 71, y: 42 },
  hub_dawnwatch: { x: 90, y: 49 },
  dunes_singed: { x: 73, y: 72 },
  quarry_sunscar: { x: 80, y: 79 },
  observatory_shards: { x: 91, y: 86 },
  catacombs_veil: { x: 94, y: 92 },
};
const WORLD_MAP_IMAGE = '/images/world-map-main.png';
const MAP_POSITIONS_STORAGE_KEY = 'wwc_admin_map_positions_v1';

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

function loadSavedNodePositions(): Record<string, Point> {
  if (typeof window === 'undefined') return { ...FIXED_NODE_POSITIONS };
  try {
    const raw = localStorage.getItem(MAP_POSITIONS_STORAGE_KEY);
    if (!raw) return { ...FIXED_NODE_POSITIONS };
    const parsed = JSON.parse(raw) as Record<string, Partial<Point>>;
    const merged: Record<string, Point> = { ...FIXED_NODE_POSITIONS };
    Object.entries(parsed || {}).forEach(([id, point]) => {
      if (!point) return;
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      merged[id] = { x, y };
    });
    return merged;
  } catch (_e) {
    return { ...FIXED_NODE_POSITIONS };
  }
}

export default function WorldMapModal({
  open,
  onOpenChange,
  language,
  currentLocationId,
  discoveredLocations,
  onTravel,
}: Props) {
  const authSession = getAuthSession();
  const isAdmin = Boolean(authSession?.isAdmin);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const markerDragStateRef = useRef<{ locationId: string; pointerId: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [positions, setPositions] = useState<Record<string, Point>>(() => loadSavedNodePositions());
  const discoveredSet = new Set(discoveredLocations || []);
  const allLocations = Object.values(LOCATIONS);
  const currentLocation = LOCATIONS[currentLocationId];
  const reachable = new Set(currentLocation?.connectedLocations || []);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const clampPan = useCallback((nextPan: { x: number; y: number }, nextZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return nextPan;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const maxX = ((nextZoom - 1) * width) / 2;
    const maxY = ((nextZoom - 1) * height) / 2;
    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  }, []);

  const setZoomSafe = useCallback((nextZoomRaw: number) => {
    const nextZoom = clamp(Number(nextZoomRaw.toFixed(2)), 0.8, 2.4);
    setZoom((prev) => {
      const ratio = nextZoom / prev;
      setPan((prevPan) => clampPan({ x: prevPan.x * ratio, y: prevPan.y * ratio }, nextZoom));
      return nextZoom;
    });
  }, [clampPan]);

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const saveAdminPositions = useCallback((nextPositions: Record<string, Point>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MAP_POSITIONS_STORAGE_KEY, JSON.stringify(nextPositions));
  }, []);

  const resetAdminPositions = () => {
    const reset = { ...FIXED_NODE_POSITIONS };
    setPositions(reset);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MAP_POSITIONS_STORAGE_KEY);
    }
  };

  const getNodePosition = useCallback((id: string): Point => {
    return positions[id] || fallbackNodePosition(id);
  }, [positions]);

  const onViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (adminEditMode) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoomSafe(zoom + delta);
  };

  const onViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (adminEditMode) return;
    if (zoom <= 1) return;
    dragPointerIdRef.current = e.pointerId;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== e.pointerId || !dragStartRef.current || !panStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan(clampPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy }, zoom));
  };

  const onViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    dragStartRef.current = null;
    panStartRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateMarkerPositionByPointer = useCallback((locationId: string, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nextX = clamp(((clientX - rect.left) / rect.width) * 100, 1, 99);
    const nextY = clamp(((clientY - rect.top) / rect.height) * 100, 1, 99);
    const point = { x: Number(nextX.toFixed(2)), y: Number(nextY.toFixed(2)) };
    setPositions((prev) => ({
      ...prev,
      [locationId]: point,
    }));
    return point;
  }, []);

  const onMarkerPointerDown = (locationId: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isAdmin || !adminEditMode) return;
    markerDragStateRef.current = { locationId, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  const onMarkerPointerMove = (locationId: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isAdmin || !adminEditMode) return;
    const dragState = markerDragStateRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId || dragState.locationId !== locationId) return;
    updateMarkerPositionByPointer(locationId, e.clientX, e.clientY);
    e.stopPropagation();
    e.preventDefault();
  };

  const onMarkerPointerUp = (locationId: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isAdmin || !adminEditMode) return;
    const dragState = markerDragStateRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId || dragState.locationId !== locationId) return;
    markerDragStateRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const point = updateMarkerPositionByPointer(locationId, e.clientX, e.clientY) || positions[locationId] || getNodePosition(locationId);
    saveAdminPositions({
      ...positions,
      [locationId]: point,
    });
    e.stopPropagation();
    e.preventDefault();
  };

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
      <DialogContent className="max-w-[98vw] md:max-w-6xl p-0 border-primary/35 bg-black/95 overflow-hidden shadow-[0_26px_70px_rgba(0,0,0,0.75)]">
        <div className="p-4 md:p-5 border-b border-primary/20 bg-gradient-to-r from-black via-black/92 to-black/72">
          <DialogTitle className="font-serif uppercase tracking-widest text-primary text-lg md:text-2xl">
            {language === 'ru' ? 'Карта мира' : 'World Map'}
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm text-muted-foreground mt-1">
            {language === 'ru'
              ? 'Все места отображены на карте. Неисследованные области скрыты туманом войны.'
              : 'All places are shown on the map. Undiscovered areas are hidden by fog of war.'}
          </DialogDescription>
        </div>

        <div
          ref={viewportRef}
          onWheel={onViewportWheel}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
          className="relative h-[76vh] md:h-[78vh] overflow-hidden touch-none bg-[radial-gradient(circle_at_20%_20%,rgba(214,170,80,0.12),transparent_50%),radial-gradient(circle_at_80%_65%,rgba(80,110,170,0.12),transparent_48%),linear-gradient(180deg,rgba(12,17,28,0.95),rgba(4,6,12,0.98))]"
        >
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-md border border-primary/30 bg-black/70 px-2 py-1.5 backdrop-blur">
            <button
              onClick={() => setZoomSafe(zoom - 0.2)}
              className="h-7 w-7 rounded border border-white/20 text-white hover:border-primary/50 hover:text-primary transition-colors"
              aria-label={language === 'ru' ? 'Уменьшить карту' : 'Zoom out'}
            >
              -
            </button>
            <div className="text-[11px] text-primary min-w-[44px] text-center">{Math.round(zoom * 100)}%</div>
            <button
              onClick={() => setZoomSafe(zoom + 0.2)}
              className="h-7 w-7 rounded border border-white/20 text-white hover:border-primary/50 hover:text-primary transition-colors"
              aria-label={language === 'ru' ? 'Увеличить карту' : 'Zoom in'}
            >
              +
            </button>
            <button
              onClick={resetViewport}
              className="ml-1 h-7 px-2 rounded border border-primary/35 text-primary text-[10px] uppercase tracking-wider hover:bg-primary/15 transition-colors"
            >
              {language === 'ru' ? 'Сброс' : 'Reset'}
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    const next = !adminEditMode;
                    setAdminEditMode(next);
                    if (next) {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }
                  }}
                  className={`ml-1 h-7 px-2 rounded border text-[10px] uppercase tracking-wider transition-colors ${
                    adminEditMode
                      ? 'border-emerald-400/60 text-emerald-300 bg-emerald-500/15'
                      : 'border-primary/35 text-primary hover:bg-primary/15'
                  }`}
                >
                  {language === 'ru' ? 'Редактор' : 'Editor'}
                </button>
                <button
                  onClick={() => saveAdminPositions(positions)}
                  className="h-7 px-2 rounded border border-primary/35 text-primary text-[10px] uppercase tracking-wider hover:bg-primary/15 transition-colors"
                >
                  {language === 'ru' ? 'Сохранить' : 'Save'}
                </button>
                <button
                  onClick={resetAdminPositions}
                  className="h-7 px-2 rounded border border-destructive/35 text-destructive text-[10px] uppercase tracking-wider hover:bg-destructive/10 transition-colors"
                >
                  {language === 'ru' ? 'Дефолт' : 'Default'}
                </button>
              </>
            )}
          </div>

          <div
            className="absolute inset-0 origin-center"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
          <img
            src={WORLD_MAP_IMAGE}
            alt={language === 'ru' ? 'Карта мира' : 'World map'}
            className="absolute inset-0 w-full h-full object-cover opacity-92 pointer-events-none select-none"
            draggable={false}
          />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_22%_14%,rgba(255,217,150,0.10),transparent_38%),linear-gradient(180deg,rgba(7,10,16,0.18),rgba(4,6,12,0.44))]" />
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
                  stroke={visible ? 'rgba(214,170,80,0.42)' : 'rgba(120,130,150,0.07)'}
                  strokeWidth={visible ? 2 : 1}
                  strokeDasharray={visible ? '0' : '3 7'}
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
            const showLabel = isCurrent || canTravel;
            const showUnknownHint = !isKnown && !isCurrent;

            return (
              <button
                key={loc.id}
                onClick={() => {
                  if (adminEditMode) return;
                  if (!canTravel) return;
                  onTravel(loc.id);
                  onOpenChange(false);
                }}
                onPointerDown={(e) => onMarkerPointerDown(loc.id, e)}
                onPointerMove={(e) => onMarkerPointerMove(loc.id, e)}
                onPointerUp={(e) => onMarkerPointerUp(loc.id, e)}
                onPointerCancel={(e) => onMarkerPointerUp(loc.id, e)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group text-left ${
                  adminEditMode && isAdmin ? 'cursor-grab active:cursor-grabbing' : canTravel ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                title={visibleName ? `${typeLabel}: ${label}` : (language === 'ru' ? 'Неизвестная точка' : 'Unknown point')}
              >
                <div className="relative flex items-center justify-center">
                  <span
                    className={`block rounded-full border transition-all ${
                      isCurrent
                        ? 'h-4 w-4 border-emerald-300 bg-emerald-400/75 shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                        : canTravel
                          ? 'h-3.5 w-3.5 border-primary bg-primary/75 shadow-[0_0_12px_rgba(214,170,80,0.45)]'
                          : isKnown
                            ? 'h-3 w-3 border-sky-200/70 bg-sky-300/55'
                            : 'h-2.5 w-2.5 border-white/20 bg-black/65'
                    }`}
                  />
                  {showUnknownHint && (
                    <span className="absolute -top-4 text-[9px] text-white/70">?</span>
                  )}
                </div>

                {showLabel && (
                  <div
                    className={`absolute top-4 left-1/2 -translate-x-1/2 mt-1.5 min-w-[112px] rounded-md border px-2 py-1.5 bg-black/78 backdrop-blur-md ${
                      isCurrent
                        ? 'border-emerald-400/55'
                        : 'border-primary/45'
                    }`}
                  >
                    <p className={`text-[9px] uppercase tracking-[0.14em] ${isCurrent ? 'text-emerald-200' : 'text-primary/85'}`}>
                      {isCurrent
                        ? (language === 'ru' ? 'Текущая позиция' : 'Current Position')
                        : typeLabel}
                    </p>
                    <p className="text-[11px] md:text-xs font-serif leading-tight text-white uppercase">{label}</p>
                    {canTravel && (
                      <p className="text-[9px] text-primary/90 mt-0.5">
                        {language === 'ru' ? 'Нажмите для перехода' : 'Tap to travel'}
                      </p>
                    )}
                  </div>
                )}

                {!showLabel && isKnown && !isCurrent && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="rounded border border-white/20 bg-black/80 px-2 py-1">
                      <p className="text-[10px] text-white whitespace-nowrap">{label}</p>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
