import { useGameStore } from '../../game/store';
import { Location } from '../../game/types';
import { LOCATIONS, MERCHANTS, NPCS, ITEMS } from '../../game/constants';
import { Map, Tent, Footprints, ShieldAlert, Store, MessageCircle, Shield, FlaskConical, Compass, Hammer, ScrollText, Crown, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import MerchantPanel from './MerchantPanel';
import NPCPanel from './NPCPanel';
import { T } from '../../game/translations';

interface Props {
  location: Location;
  status: string;
}

const NPC_META: Record<
  string,
  {
    accent: string;
    role: { en: string; ru: string };
    Icon: typeof Shield;
  }
> = {
  npc_guard_tom: { accent: '#c28d3a', role: { en: 'Town Guard Captain', ru: 'Капитан городской стражи' }, Icon: Shield },
  npc_elder_bran: { accent: '#a88b52', role: { en: 'Council Elder', ru: 'Старейшина совета' }, Icon: Crown },
  npc_alchemist_mira: { accent: '#4ba3a1', role: { en: 'Master Alchemist', ru: 'Мастер-алхимик' }, Icon: FlaskConical },
  npc_scout_lyra: { accent: '#79a85a', role: { en: 'Frontier Scout', ru: 'Пограничная разведчица' }, Icon: Compass },
  npc_blacksmith_durn: { accent: '#b26f4a', role: { en: 'Forge Master', ru: 'Мастер кузни' }, Icon: Hammer },
  npc_chronicler_vesna: { accent: '#8d7fb8', role: { en: 'Chronicler of Oaths', ru: 'Летописец клятв' }, Icon: ScrollText },
};

export default function LocationScreen({ location, status }: Props) {
  const { travelTo, explore, rest, settings } = useGameStore();
  const [showMerchant, setShowMerchant] = useState(false);
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [menuTab, setMenuTab] = useState<'actions' | 'travel'>('actions');
  const [compactMode, setCompactMode] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [sheetLevel, setSheetLevel] = useState<0 | 1 | 2>(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const npcCarouselRef = useRef<HTMLDivElement | null>(null);
  const travelCarouselRef = useRef<HTMLDivElement | null>(null);
  const [npcPage, setNpcPage] = useState(0);
  const [travelPage, setTravelPage] = useState(0);
  const [npcPages, setNpcPages] = useState(1);
  const [travelPages, setTravelPages] = useState(1);

  const l = settings.language;
  const localMerchant = Object.values(MERCHANTS).find(m => m.locationId === location.id);
  const localNpcs = location.npcs?.map(id => NPCS[id]) || [];
  const isMobile = viewportWidth < 768;
  const isNarrowMobile = viewportWidth >= 360 && viewportWidth <= 430;

  const sheetHeights = useMemo(() => {
    const open = isNarrowMobile ? Math.min(viewportHeight * 0.76, 630) : Math.min(viewportHeight * 0.7, 600);
    const peek = isNarrowMobile ? Math.min(viewportHeight * 0.42, 360) : Math.min(viewportHeight * 0.36, 320);
    const collapsed = 62;
    return [collapsed, peek, open] as const;
  }, [isNarrowMobile, viewportHeight]);

  useEffect(() => {
    const applyViewport = () => {
      if (typeof window === 'undefined') return;
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
      if (window.innerWidth < 768) {
        setCompactMode(true);
        setSheetLevel((prev) => (prev === 2 ? 2 : 1));
      } else {
        setCompactMode(false);
        setSheetLevel(2);
      }
    };
    applyViewport();
    window.addEventListener('resize', applyViewport);
    return () => window.removeEventListener('resize', applyViewport);
  }, []);

  useEffect(() => {
    setCardsVisible(false);
    const id = setTimeout(() => setCardsVisible(true), 30);
    return () => clearTimeout(id);
  }, [menuTab, compactMode, location.id]);

  useEffect(() => {
    const calcPages = () => {
      const npcEl = npcCarouselRef.current;
      if (npcEl) {
        const pages = Math.max(1, Math.ceil(npcEl.scrollWidth / Math.max(1, npcEl.clientWidth)));
        setNpcPages(pages);
      }
      const travelEl = travelCarouselRef.current;
      if (travelEl) {
        const pages = Math.max(1, Math.ceil(travelEl.scrollWidth / Math.max(1, travelEl.clientWidth)));
        setTravelPages(pages);
      }
    };
    calcPages();
    const id = setTimeout(calcPages, 80);
    return () => clearTimeout(id);
  }, [menuTab, localNpcs.length, location.connectedLocations.length, viewportWidth, compactMode]);

  const onNpcScroll = () => {
    const el = npcCarouselRef.current;
    if (!el) return;
    const page = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setNpcPage(Math.max(0, Math.min(page, npcPages - 1)));
  };

  const onTravelScroll = () => {
    const el = travelCarouselRef.current;
    if (!el) return;
    const page = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setTravelPage(Math.max(0, Math.min(page, travelPages - 1)));
  };

  const handleSheetTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    dragStartYRef.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };

  const handleSheetTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || dragStartYRef.current == null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartYRef.current;
    setDragOffset(Math.max(-120, Math.min(180, delta)));
  };

  const handleSheetTouchEnd = () => {
    if (!isMobile) return;
    const delta = dragOffset;
    if (delta > 80 && sheetLevel > 0) {
      setSheetLevel((prev) => ((prev - 1) as 0 | 1 | 2));
    } else if (delta < -80 && sheetLevel < 2) {
      setSheetLevel((prev) => ((prev + 1) as 0 | 1 | 2));
    }
    setDragOffset(0);
    setIsDraggingSheet(false);
    dragStartYRef.current = null;
  };

  if (showMerchant && localMerchant) {
    return <MerchantPanel merchant={localMerchant} onClose={() => setShowMerchant(false)} />;
  }

  if (activeNpcId && NPCS[activeNpcId]) {
    return <NPCPanel npc={NPCS[activeNpcId]} onClose={() => setActiveNpcId(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full p-2 md:p-4 gap-2 md:gap-4 overflow-hidden">
      
      <div className="text-center mb-2 md:mb-6 mt-2 md:mt-6 shrink-0">
        <div className="inline-flex items-center justify-center px-3 py-0.5 md:px-4 md:py-1 rounded-full border border-primary/30 bg-black/40 text-primary text-[9px] md:text-xs uppercase tracking-widest mb-2 md:mb-4 backdrop-blur-sm">
          {location.type === 'hub' ? T.safe_zone[l] : T.danger_zone[l]}
        </div>
        <h1 className="text-2xl md:text-6xl font-serif text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 md:mb-4 uppercase leading-tight">
          {location.name[l]}
        </h1>
        <p className="text-xs md:text-lg text-muted-foreground max-w-2xl mx-auto italic drop-shadow-md bg-black/40 p-2 md:p-4 rounded-lg backdrop-blur-sm border border-white/5 line-clamp-3 md:line-clamp-none">
          "{location.description[l]}"
        </p>
        {location.possibleLoot && location.possibleLoot.length > 0 && (
          <div className="mt-2 text-[10px] md:text-xs text-primary/80 bg-black/40 border border-primary/20 rounded px-3 py-2 inline-block">
            {l === 'ru' ? 'Лут на земле: ' : 'Ground loot: '}
            {location.possibleLoot
              .map((id) => (id === 'gold' ? (l === 'ru' ? 'Золото' : 'Gold') : ITEMS[id]?.name[l] || id))
              .join(', ')}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex items-end justify-center">
        <div className="relative w-full max-w-5xl">
          {compactMode && (
            <div className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center gap-2 px-2">
              {location.type !== 'hub' ? (
                <button
                  onClick={explore}
                  className="px-3 py-2 rounded-full border border-primary/40 bg-black/55 backdrop-blur-md text-primary text-[11px] uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {T.action_explore[l]}
                </button>
              ) : (
                <>
                  <button
                    onClick={rest}
                    className="px-3 py-2 rounded-full border border-primary/40 bg-black/55 backdrop-blur-md text-primary text-[11px] uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Tent className="w-3.5 h-3.5" />
                    {l === 'ru' ? 'Отдых' : 'Rest'}
                  </button>
                  {localNpcs[0] && (
                    <button
                      onClick={() => setActiveNpcId(localNpcs[0].id)}
                      className="px-3 py-2 rounded-full border border-white/20 bg-black/55 backdrop-blur-md text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                      {l === 'ru' ? 'Общаться' : 'Talk'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="absolute -inset-x-8 -top-10 h-24 bg-[radial-gradient(circle,rgba(210,162,74,0.18),transparent_70%)] pointer-events-none" />
          <div
            className={`relative rounded-2xl border border-primary/25 bg-[linear-gradient(135deg,rgba(9,13,24,0.72),rgba(4,7,14,0.58))] backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.52)] p-2.5 md:p-3.5 overflow-hidden transition-[height,opacity,transform] duration-300 ${isDraggingSheet ? '' : 'ease-out'}`}
            style={
              isMobile
                ? {
                    height: `${sheetHeights[sheetLevel]}px`,
                    transform: `translateY(${dragOffset}px)`,
                    opacity: compactMode && sheetLevel === 0 ? 0.92 : 1,
                  }
                : undefined
            }
          >
            {isMobile && (
              <div
                className="flex justify-center mb-2 cursor-grab active:cursor-grabbing"
                onTouchStart={handleSheetTouchStart}
                onTouchMove={handleSheetTouchMove}
                onTouchEnd={handleSheetTouchEnd}
              >
                <div className="w-12 h-1.5 rounded-full bg-white/25" />
              </div>
            )}
            <div className="absolute left-3 top-3 w-12 h-12 border-l border-t border-primary/35 rounded-tl-xl opacity-70" />
            <div className="absolute right-3 bottom-3 w-12 h-12 border-r border-b border-primary/35 rounded-br-xl opacity-70" />

            <div className="flex gap-2 mb-2.5">
            <button
              onClick={() => setMenuTab('actions')}
              className={`flex-1 ${isNarrowMobile ? 'text-[9px]' : 'text-[10px] md:text-xs'} uppercase tracking-[0.18em] py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                menuTab === 'actions'
                  ? 'border-primary/50 text-primary bg-primary/18 shadow-[0_0_24px_rgba(214,170,80,0.24)]'
                  : 'border-white/10 text-muted-foreground bg-black/35 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {T.actions_title[l]}
            </button>
            <button
              onClick={() => setMenuTab('travel')}
              className={`flex-1 ${isNarrowMobile ? 'text-[9px]' : 'text-[10px] md:text-xs'} uppercase tracking-[0.18em] py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                menuTab === 'travel'
                  ? 'border-primary/50 text-primary bg-primary/18 shadow-[0_0_24px_rgba(214,170,80,0.24)]'
                  : 'border-white/10 text-muted-foreground bg-black/35 hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              {T.destinations[l]}
            </button>
            <button
              onClick={() => {
                if (isMobile) {
                  setSheetLevel((prev) => (prev === 2 ? 1 : prev === 1 ? 0 : 2));
                  return;
                }
                setCompactMode((v) => !v);
              }}
              className="px-3 rounded-lg border border-white/15 bg-black/35 text-muted-foreground hover:text-white transition-colors"
              title={
                isMobile
                  ? l === 'ru'
                    ? 'Режим листа'
                    : 'Sheet mode'
                  : compactMode
                  ? (l === 'ru' ? 'Развернуть' : 'Expand')
                  : (l === 'ru' ? 'Свернуть' : 'Collapse')
              }
            >
              {isMobile ? (
                sheetLevel === 2 ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
              ) : compactMode ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            </div>

            <div className={`overflow-y-auto pr-1 md:pr-2 custom-scrollbar transition-all duration-300 ${compactMode && isMobile && sheetLevel === 0 ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[42vh] opacity-100'}`}>
            {menuTab === 'actions' ? (
              <div className="space-y-3">
                {location.type === 'hub' ? (
                  <>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${isNarrowMobile ? 'gap-2' : 'gap-2.5'}`}>
                      <button
                        onClick={rest}
                        className={`w-full rounded-xl border border-primary/30 bg-[linear-gradient(135deg,rgba(30,22,10,0.5),rgba(10,12,20,0.75))] ${isNarrowMobile ? 'px-2.5 py-2.5' : 'px-3 py-3'} text-left hover:brightness-110 transition-all`}
                      >
                        <p className={`${isNarrowMobile ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.16em] text-primary/80 mb-1`}>
                          {l === 'ru' ? 'Убежище' : 'Safehouse'}
                        </p>
                        <p className={`font-serif text-primary ${isNarrowMobile ? 'text-base' : 'text-lg'} flex items-center gap-2`}>
                          <Tent className="w-4 h-4" /> {T.action_rest[l]}
                        </p>
                      </button>
                      {localMerchant && (
                        <button
                          onClick={() => setShowMerchant(true)}
                          className={`w-full rounded-xl border border-secondary/45 bg-[linear-gradient(135deg,rgba(24,26,16,0.5),rgba(10,12,20,0.75))] ${isNarrowMobile ? 'px-2.5 py-2.5' : 'px-3 py-3'} text-left hover:brightness-110 transition-all`}
                        >
                          <p className={`${isNarrowMobile ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.16em] text-secondary-foreground/75 mb-1`}>
                            {l === 'ru' ? 'Снабжение' : 'Supplies'}
                          </p>
                          <p className={`font-serif text-secondary-foreground ${isNarrowMobile ? 'text-base' : 'text-lg'} flex items-center gap-2`}>
                            <Store className="w-4 h-4" /> {T.action_trade[l]}
                          </p>
                        </button>
                      )}
                    </div>

                    <div ref={npcCarouselRef} onScroll={onNpcScroll} className="overflow-x-auto pb-1 custom-scrollbar snap-x snap-mandatory">
                      <div className="flex gap-2.5 min-w-max">
                        {localNpcs.map((npc, idx) => {
                      const meta = NPC_META[npc.id] || {
                        accent: '#c28d3a',
                        role: { en: 'Local Informant', ru: 'Местный информатор' },
                        Icon: MessageCircle,
                      };
                      const miniImage = `/images/npcs/mini/${npc.id}_mini.png`;
                      return (
                        <button
                          key={npc.id}
                          onClick={() => setActiveNpcId(npc.id)}
                          className="relative overflow-hidden rounded-xl border p-0 text-left transition-all duration-200 hover:scale-[1.02] hover:brightness-110 snap-start w-[280px] md:w-[320px] group"
                          style={{
                            borderColor: `${meta.accent}66`,
                            boxShadow: `0 0 0 1px ${meta.accent}22, inset 0 0 30px rgba(0,0,0,0.35)`,
                            opacity: cardsVisible ? 1 : 0,
                            transform: cardsVisible ? 'translateY(0)' : 'translateY(10px)',
                            transition: `opacity 320ms ease, transform 320ms ease, filter 220ms ease`,
                            transitionDelay: `${idx * 55}ms`,
                          }}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `linear-gradient(95deg, rgba(5,7,12,0.88) 15%, rgba(6,10,17,0.64) 48%, rgba(6,8,14,0.88) 100%), radial-gradient(circle at 20% 35%, ${meta.accent}33, transparent 45%), url(${miniImage}), url(${location.image})`,
                              backgroundSize: 'cover, cover, 100% auto, cover',
                              backgroundPosition: 'center, center, 50% 35%, center',
                            }}
                          />
                          <div
                            className="absolute top-0 left-0 h-[2px] w-20 opacity-80 pointer-events-none group-hover:translate-x-[420%] transition-transform duration-700"
                            style={{ background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)`, transform: 'translateX(-120%)' }}
                          />
                          <div
                            className="absolute bottom-0 right-0 h-[2px] w-16 opacity-60 pointer-events-none group-hover:-translate-x-[500%] transition-transform duration-700"
                            style={{ background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)`, transform: 'translateX(120%)' }}
                          />
                          <div className="relative z-10 px-3 md:px-4 py-3 md:py-3.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center border"
                                style={{ borderColor: `${meta.accent}99`, color: meta.accent, background: 'rgba(0,0,0,0.45)' }}
                              >
                                <meta.Icon className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-white/70">
                                {meta.role[l]}
                              </p>
                            </div>
                            <p className="text-primary font-serif text-sm md:text-xl leading-tight uppercase tracking-wider">
                              {T.action_talk[l]} {npc.name[l]}
                            </p>
                          </div>
                        </button>
                      );
                        })}
                      </div>
                    </div>
                    {npcPages > 1 && (
                      <div className="flex justify-center gap-1.5 mt-1">
                        {Array.from({ length: npcPages }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 rounded-full transition-all ${npcPage === i ? 'w-5 bg-primary' : 'w-1.5 bg-white/30'}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button onClick={explore} className="w-full rounded-xl border border-primary/35 bg-[linear-gradient(135deg,rgba(22,25,40,0.55),rgba(7,10,18,0.72))] py-4 text-xs md:text-lg flex flex-col md:flex-row items-center justify-center gap-1 md:gap-3 group hover:brightness-110 transition-all">
                    <Footprints className="w-5 h-5 md:w-6 md:h-6 group-hover:animate-bounce text-primary" /> <span className="font-serif text-primary">{T.action_explore[l]}</span>
                  </button>
                )}
              </div>
            ) : (
              <div ref={travelCarouselRef} onScroll={onTravelScroll} className="overflow-x-auto pb-1 custom-scrollbar snap-x snap-mandatory">
                <div className="flex gap-2.5 min-w-max">
                {location.connectedLocations.map((destId, idx) => {
                  const dest = LOCATIONS[destId];
                  return (
                    <button
                      key={destId}
                      onClick={() => travelTo(destId)}
                      className="relative overflow-hidden rounded-xl border border-white/15 w-[250px] md:w-[300px] h-[130px] md:h-[150px] text-left group snap-start"
                      style={{
                        opacity: cardsVisible ? 1 : 0,
                        transform: cardsVisible ? 'translateY(0)' : 'translateY(10px)',
                        transition: 'opacity 320ms ease, transform 320ms ease',
                        transitionDelay: `${idx * 60}ms`,
                      }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `linear-gradient(160deg, rgba(4,8,16,0.55), rgba(4,6,12,0.82)), url(${dest.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                      <div className="absolute top-0 left-0 h-[2px] w-16 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80 -translate-x-[120%] group-hover:translate-x-[460%] transition-transform duration-700" />
                      <div className="relative z-10 h-full flex flex-col justify-between p-3 md:p-4">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
                          {dest.type === 'hub' ? T.safe_zone[l] : T.danger_zone[l]}
                        </p>
                        <p className="text-[12px] md:text-xl font-serif text-white group-hover:text-primary transition-colors leading-tight uppercase">
                          {dest.name[l]}
                        </p>
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            )}
            {menuTab === 'travel' && travelPages > 1 && (
              <div className="flex justify-center gap-1.5 mt-1">
                {Array.from({ length: travelPages }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${travelPage === i ? 'w-5 bg-primary' : 'w-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
