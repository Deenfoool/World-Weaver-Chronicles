import { useGameStore } from '../../game/store';
import { Location, WorldEconomyEvent } from '../../game/types';
import { LOCATIONS, NPCS, ITEMS } from '../../game/constants';
import { Map, Footprints, ShieldAlert, MessageCircle, Shield, FlaskConical, Compass, Hammer, ScrollText, Crown, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import NPCPanel from './NPCPanel';
import WorldMapModal from './WorldMapModal';
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
  npc_marshal_thorne: { accent: '#d07b52', role: { en: 'Ironhold Marshal', ru: 'Маршал Айронхолда' }, Icon: Shield },
  npc_quartermaster_ilda: { accent: '#e0b35d', role: { en: 'Quartermaster', ru: 'Квартирмейстер' }, Icon: Crown },
  npc_smith_varr: { accent: '#c8734c', role: { en: 'Heavy Smith', ru: 'Тяжёлый кузнец' }, Icon: Hammer },
  npc_envoy_sera: { accent: '#7aa8df', role: { en: 'Alliance Envoy', ru: 'Посол содружества' }, Icon: ScrollText },
  npc_apothecary_nox: { accent: '#53b3a4', role: { en: 'Senior Apothecary', ru: 'Старший аптекарь' }, Icon: FlaskConical },
  npc_factor_brom: { accent: '#9aa96d', role: { en: 'Trade Factor', ru: 'Торговый фактор' }, Icon: Compass },
  npc_warden_rook: { accent: '#8caf66', role: { en: 'Marsh Warden', ru: 'Болотный хранитель' }, Icon: Shield },
  npc_herbalist_vesk: { accent: '#6ebc79', role: { en: 'Union Herbalist', ru: 'Травник союза' }, Icon: FlaskConical },
  npc_tinker_juno: { accent: '#8f93d2', role: { en: 'Field Tinker', ru: 'Полевой техник' }, Icon: Hammer },
  npc_prefect_aurelia: { accent: '#d9b67a', role: { en: 'Forum Prefect', ru: 'Префект форума' }, Icon: Crown },
  npc_artificer_kael: { accent: '#c98357', role: { en: 'Chief Artificer', ru: 'Главный артификер' }, Icon: Hammer },
  npc_medic_selene: { accent: '#6eb9a1', role: { en: 'Field Medic', ru: 'Полевой медик' }, Icon: FlaskConical },
  npc_pathfinder_orin: { accent: '#7ca4d9', role: { en: 'Route Pathfinder', ru: 'Проводник маршрутов' }, Icon: Compass },
};

function formatEconomyEvent(
  event: WorldEconomyEvent,
  lang: 'en' | 'ru',
  resolveHubName: (hubId: string) => string,
): string {
  const hubName = resolveHubName(event.hubId);
  const targetName = event.targetHubId ? resolveHubName(event.targetHubId) : null;
  switch (event.type) {
    case 'war':
      return lang === 'ru' ? `Война в ${hubName}: производство просело.` : `War in ${hubName}: production disrupted.`;
    case 'caravan_attack':
      return lang === 'ru' ? `Налёты на караваны у ${hubName}: риски маршрутов выросли.` : `Caravan attacks near ${hubName}: route risk increased.`;
    case 'crisis':
      return lang === 'ru' ? `Кризис в ${hubName}: рынок ушёл в дефицит.` : `Crisis in ${hubName}: market shifted to scarcity.`;
    case 'prosperity':
      return lang === 'ru' ? `${hubName} переживает подъём и расширяет торговлю.` : `${hubName} is in prosperity and expanding trade.`;
    case 'black_market_opened':
      return lang === 'ru' ? `В ${hubName} открылось окно чёрного рынка.` : `A black-market window opened in ${hubName}.`;
    case 'hub_destroyed':
      return lang === 'ru' ? `Хаб ${hubName} разрушен из-за длительной деградации.` : `Hub ${hubName} collapsed after sustained degradation.`;
    case 'hub_founded':
      return lang === 'ru' ? `Основан новый хаб: ${hubName}.` : `A new hub has been founded: ${hubName}.`;
    case 'player_raid':
      return lang === 'ru'
        ? `Вы провели рейд на караваны ${hubName}${targetName ? ` (из ${targetName})` : ''}.`
        : `You raided caravans of ${hubName}${targetName ? ` (from ${targetName})` : ''}.`;
    case 'player_investment':
      return lang === 'ru' ? `Вы инвестировали в ${hubName} и укрепили экономику.` : `You invested in ${hubName} and strengthened its economy.`;
    case 'player_diplomacy':
      return lang === 'ru'
        ? `Вы провели дипломатию с ${hubName}${targetName ? ` и ${targetName}` : ''}.`
        : `You ran diplomacy with ${hubName}${targetName ? ` and ${targetName}` : ''}.`;
    case 'player_sabotage':
      return lang === 'ru' ? `Вы устроили саботаж в ${hubName}.` : `You sabotaged production in ${hubName}.`;
    default:
      return lang === 'ru' ? `Событие в ${hubName}.` : `Event in ${hubName}.`;
  }
}

export default function LocationScreen({ location, status }: Props) {
  const { travelTo, explore, settings, worldEconomy, player } = useGameStore();
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [menuTab, setMenuTab] = useState<'actions' | 'travel'>('actions');
  const [isMapOpen, setIsMapOpen] = useState(false);
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
  const localNpcs = location.npcs?.map(id => NPCS[id]) || [];
  const hubEconomy = worldEconomy.hubs[location.id];
  const hubRoutes = hubEconomy
    ? Object.values(worldEconomy.tradeRoutes || {}).filter((route) => route.fromHubId === location.id || route.toHubId === location.id)
    : [];
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

  const recentEconomyEvents = useMemo(() => {
    const all = worldEconomy.events || [];
    return all
      .filter((event) => event.hubId === location.id || event.targetHubId === location.id)
      .slice(-5)
      .reverse();
  }, [worldEconomy.events, location.id]);

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

  if (activeNpcId && NPCS[activeNpcId]) {
    return <NPCPanel npc={NPCS[activeNpcId]} onClose={() => setActiveNpcId(null)} />;
  }

  return (
    <>
    <div className="flex-1 flex flex-col w-full h-full p-2 md:p-4 gap-2 md:gap-4 overflow-hidden">
      
      <div className="text-center mb-2 md:mb-6 mt-2 md:mt-6 shrink-0">
        <div className="inline-flex items-center justify-center px-3 py-0.5 md:px-4 md:py-1 rounded-full border border-primary/35 bg-black/45 text-primary text-[9px] md:text-xs uppercase tracking-widest mb-2 md:mb-4 backdrop-blur-sm pulse-gold">
          {location.type === 'hub' ? T.safe_zone[l] : T.danger_zone[l]}
        </div>
        <h1 className="text-2xl md:text-6xl font-serif text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 md:mb-4 uppercase leading-tight">
          {location.name[l]}
        </h1>
        <p className="text-xs md:text-lg text-muted-foreground max-w-2xl mx-auto italic drop-shadow-md bg-black/48 p-2 md:p-4 rounded-lg backdrop-blur-sm border border-primary/20 line-clamp-3 md:line-clamp-none">
          "{location.description[l]}"
        </p>
        {location.possibleLoot && location.possibleLoot.length > 0 && (
          <div className="mt-2 text-[10px] md:text-xs text-primary/85 bg-black/45 border border-primary/25 rounded px-3 py-2 inline-block">
            {l === 'ru' ? 'Лут на земле: ' : 'Ground loot: '}
            {location.possibleLoot
              .map((id) => (id === 'gold' ? (l === 'ru' ? 'Золото' : 'Gold') : ITEMS[id]?.name[l] || id))
              .join(', ')}
          </div>
        )}
        {hubEconomy && (
          <div className="mt-2 text-[10px] md:text-xs text-primary/90 bg-black/52 border border-primary/30 rounded px-3 py-2 inline-flex gap-3 items-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <span>
              {l === 'ru'
                ? `Тип: ${hubEconomy.hubKind === 'faction' ? 'фракция' : hubEconomy.hubKind === 'alliance' ? 'содружество' : 'сообщество'}`
                : `Type: ${hubEconomy.hubKind}`}
            </span>
            <span>{l === 'ru' ? `Хаб ур. ${hubEconomy.level}` : `Hub Lv ${hubEconomy.level}`}</span>
            <span>{l === 'ru' ? `Богатство: ${hubEconomy.wealth}` : `Wealth: ${hubEconomy.wealth}`}</span>
            <span>{l === 'ru' ? `Рынок: ${hubEconomy.supply}/${hubEconomy.demand}` : `Market: ${hubEconomy.supply}/${hubEconomy.demand}`}</span>
            <span>
              {l === 'ru'
                ? `Режим: ${hubEconomy.marketMode === 'black_market' ? 'чёрный рынок' : hubEconomy.marketMode === 'scarcity' ? 'дефицит' : hubEconomy.marketMode === 'surplus' ? 'профицит' : 'стабильно'}`
                : `Mode: ${hubEconomy.marketMode === 'black_market' ? 'black market' : hubEconomy.marketMode}`}
            </span>
            <span>{l === 'ru' ? `Маршруты: ${hubRoutes.length}` : `Routes: ${hubRoutes.length}`}</span>
            {hubEconomy.destroyed && (
              <span className="text-destructive">{l === 'ru' ? 'Статус: разрушен' : 'Status: destroyed'}</span>
            )}
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => {
              setIsMapOpen(true);
              setSheetLevel((prev) => (prev === 0 ? 1 : prev));
            }}
            data-tutorial-id="travel-icon"
            className="absolute right-2 top-1 w-10 h-10 rounded-full border border-primary/45 bg-black/70 backdrop-blur-md text-primary flex items-center justify-center shadow-[0_0_22px_rgba(214,170,80,0.35)] pulse-gold hover:scale-105 transition-transform"
            aria-label={l === 'ru' ? 'Открыть путешествия' : 'Open travel'}
            title={l === 'ru' ? 'Путешествия' : 'Travel'}
          >
            <Map className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex items-end justify-center">
        <div className="relative w-full max-w-5xl">
          {compactMode && (
            <div className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center gap-2 px-2">
              {location.type !== 'hub' && (
                <button
                  onClick={explore}
                  className="px-3 py-2 rounded-full border border-primary/40 bg-black/55 backdrop-blur-md text-primary text-[11px] uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {T.action_explore[l]}
                </button>
              )}
            </div>
          )}

          <div className="absolute -inset-x-8 -top-10 h-24 bg-[radial-gradient(circle,rgba(210,162,74,0.18),transparent_70%)] pointer-events-none" />
          <div
            className={`relative rounded-2xl border border-primary/28 bg-[linear-gradient(135deg,rgba(9,13,24,0.82),rgba(4,7,14,0.72))] backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.52)] p-2.5 md:p-3.5 overflow-hidden transition-[height,opacity,transform] duration-300 ${isDraggingSheet ? '' : 'ease-out'}`}
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
            {!isMobile && (
              <button
                onClick={() => setIsMapOpen(true)}
                className={`flex-1 ${isNarrowMobile ? 'text-[9px]' : 'text-[10px] md:text-xs'} uppercase tracking-[0.18em] py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                  'border-primary/35 text-primary/90 bg-primary/10 hover:bg-primary/20'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                {l === 'ru' ? 'Карта мира' : 'World Map'}
              </button>
            )}
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
                    {hubEconomy && (
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">
                          {l === 'ru' ? 'Экономические события' : 'Economic Events'}
                        </p>
                        {recentEconomyEvents.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            {l === 'ru' ? 'Пока тишина. Мир готовит следующий ход.' : 'Quiet for now. The world is preparing its next move.'}
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {recentEconomyEvents.map((event) => (
                              <div key={event.id} className="text-[11px] text-muted-foreground border border-white/5 rounded px-2 py-1.5 bg-black/25">
                                <span className="text-primary/90 mr-2">[{event.tick}]</span>
                                {formatEconomyEvent(
                                  event,
                                  l,
                                  (hubId) => LOCATIONS[hubId]?.name?.[l] || hubId,
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
    <WorldMapModal
      open={isMapOpen}
      onOpenChange={setIsMapOpen}
      language={l}
      currentLocationId={location.id}
      discoveredLocations={player.discoveredLocations || ['town_oakhaven']}
      onTravel={travelTo}
    />
    </>
  );
}
