import { useMemo } from 'react';
import { useGameStore } from '../../game/store';
import { LOCATIONS } from '../../game/constants';
import { Handshake, ShieldAlert, ShieldCheck } from 'lucide-react';

type StandingTier = {
  min: number;
  max: number;
  label: { en: string; ru: string };
  tone: 'good' | 'neutral' | 'bad';
};

const STANDING_TIERS: StandingTier[] = [
  {
    min: 60,
    max: 100,
    label: { en: 'Trusted Ally', ru: 'Надёжный союзник' },
    tone: 'good',
  },
  {
    min: 25,
    max: 59,
    label: { en: 'Friendly', ru: 'Дружественный' },
    tone: 'good',
  },
  {
    min: -24,
    max: 24,
    label: { en: 'Neutral', ru: 'Нейтралитет' },
    tone: 'neutral',
  },
  {
    min: -59,
    max: -25,
    label: { en: 'Unfriendly', ru: 'Недружественный' },
    tone: 'bad',
  },
  {
    min: -100,
    max: -60,
    label: { en: 'Hostile', ru: 'Враждебный' },
    tone: 'bad',
  },
];

function resolveTier(relation: number): StandingTier {
  return STANDING_TIERS.find((tier) => relation >= tier.min && relation <= tier.max) || STANDING_TIERS[2];
}

function buyRelationMultiplier(relation: number): number {
  return Math.max(0.82, 1 - relation * 0.0015);
}

function sellRelationMultiplier(relation: number): number {
  return 1 + Math.max(0, relation) * 0.0012;
}

export function tierEffectText(l: 'en' | 'ru', tier: StandingTier): string {
  const mid = Math.floor((tier.min + tier.max) / 2);
  const buyPct = Math.round((buyRelationMultiplier(mid) - 1) * 100);
  const sellPct = Math.round((sellRelationMultiplier(mid) - 1) * 100);
  if (l === 'ru') {
    return `По текущим формулам: модификатор покупки ~${buyPct >= 0 ? '+' : ''}${buyPct}%, продажи ~+${Math.max(0, sellPct)}%, вклад в дрейф богатства через relation × 0.08.`;
  }
  return `Current formulas: buy modifier ~${buyPct >= 0 ? '+' : ''}${buyPct}%, sell modifier ~+${Math.max(0, sellPct)}%, plus relation × 0.08 contribution to wealth drift.`;
}

export function localizeConsequenceKind(l: 'en' | 'ru', kind: string): string {
  const map: Record<string, { en: string; ru: string }> = {
    retaliation: { en: 'Retaliation', ru: 'Ответные меры' },
    aid_arrival: { en: 'Aid Arrival', ru: 'Прибытие помощи' },
    tariff_relief: { en: 'Tariff Relief', ru: 'Снижение тарифов' },
    smuggler_crackdown: { en: 'Smuggler Crackdown', ru: 'Жёсткий разгон контрабанды' },
  };
  return map[kind]?.[l] || kind;
}

export function localizeOriginType(l: 'en' | 'ru', originType: string): string {
  const map: Record<string, { en: string; ru: string }> = {
    war: { en: 'War', ru: 'Война' },
    caravan_attack: { en: 'Caravan conflict', ru: 'Караванный конфликт' },
    crisis: { en: 'Crisis', ru: 'Кризис' },
    prosperity: { en: 'Prosperity', ru: 'Процветание' },
    black_market_opened: { en: 'Black market', ru: 'Чёрный рынок' },
    hub_destroyed: { en: 'Hub collapse', ru: 'Крах хаба' },
    hub_founded: { en: 'Hub founding', ru: 'Основание хаба' },
  };
  return map[originType]?.[l] || originType;
}

export function localizeReason(
  l: 'en' | 'ru',
  key?: string,
  fallback?: string,
): string {
  const map: Record<string, { en: string; ru: string }> = {
    quest_support: {
      en: 'You supported local economy and governance.',
      ru: 'Вы поддержали локальную экономику и управление.',
    },
    quest_punish: {
      en: 'You weakened local infrastructure and economic trust.',
      ru: 'Вы ослабили местную инфраструктуру и экономическое доверие.',
    },
    quest_neutral: {
      en: 'You stayed neutral during conflict escalation.',
      ru: 'Вы сохранили нейтралитет при эскалации конфликта.',
    },
    quest_side_choice: {
      en: 'You chose a side in active inter-hub conflict.',
      ru: 'Вы выбрали сторону в активном межхабовом конфликте.',
    },
    delay_retaliation: {
      en: 'Delayed retaliation reached this hub.',
      ru: 'Отложенные ответные меры дошли до этого хаба.',
    },
    delay_aid_arrival: {
      en: 'Aid convoys and reconstruction support arrived.',
      ru: 'Прибыли караваны помощи и поддержка восстановления.',
    },
    delay_tariff_relief: {
      en: 'Tariff pressure eased through delayed diplomacy.',
      ru: 'Тарифное давление ослабло из-за отложенной дипломатии.',
    },
    delay_smuggler_backlash: {
      en: 'Smuggler network backlash destabilized local trust.',
      ru: 'Ответ контрабандной сети ухудшил локальное доверие.',
    },
    player_investment: {
      en: 'You invested in treasury and local growth.',
      ru: 'Вы вложились в казну и локальный рост.',
    },
    player_diplomacy: {
      en: 'You negotiated diplomatic improvements.',
      ru: 'Вы провели дипломатические улучшения.',
    },
    player_raid: {
      en: 'You raided caravan routes linked to this hub.',
      ru: 'Вы атаковали караванные маршруты, связанные с этим хабом.',
    },
    player_sabotage: {
      en: 'You sabotaged logistics and production.',
      ru: 'Вы саботировали логистику и производство.',
    },
  };
  if (key && map[key]) return map[key][l];
  return fallback || (l === 'ru' ? 'Изменение репутации.' : 'Reputation changed.');
}

export default function FactionJournalPanel() {
  const { settings, worldEconomy } = useGameStore();
  const l = settings.language;

  const standings = useMemo(
    () =>
      Object.values(worldEconomy.hubs)
        .sort((a, b) => b.playerRelation - a.playerRelation)
        .map((hub) => ({ hub, tier: resolveTier(hub.playerRelation) })),
    [worldEconomy.hubs],
  );
  const history = useMemo(
    () => [...(worldEconomy.reputationLog || [])].sort((a, b) => b.tick - a.tick).slice(0, 60),
    [worldEconomy.reputationLog],
  );
  const pendingTimeline = useMemo(
    () => [...(worldEconomy.pendingConsequences || [])].sort((a, b) => a.dueTick - b.dueTick).slice(0, 20),
    [worldEconomy.pendingConsequences],
  );

  return (
    <div className="p-4 space-y-5">
      <div className="rounded border border-primary/20 bg-black/30 p-3">
        <h3 data-tutorial-id="reputation-thresholds" className="font-serif text-primary uppercase tracking-widest text-xs mb-2">
          {l === 'ru' ? 'Пороговые эффекты репутации' : 'Reputation Threshold Effects'}
        </h3>
        <div className="grid grid-cols-1 gap-2 text-[11px]">
          {STANDING_TIERS.map((tier) => (
            <div
              key={`${tier.min}_${tier.max}`}
              className={`rounded border px-2 py-1.5 ${
                tier.tone === 'good'
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : tier.tone === 'bad'
                    ? 'border-destructive/25 bg-destructive/5'
                    : 'border-white/15 bg-white/5'
              }`}
            >
              <p className="text-white">
                {tier.label[l]} ({tier.min}..{tier.max})
              </p>
              <p className="text-muted-foreground">{tierEffectText(l, tier)}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-3 border-b border-border/40 pb-2">
          {l === 'ru' ? 'Аналитика рынка по хабам' : 'Hub Market Analytics'}
        </h3>
        <div className="space-y-2">
          {Object.values(worldEconomy.hubs).map((hub) => {
            const spread = hub.demand - hub.supply;
            const buySignal = spread >= 15 ? (l === 'ru' ? 'Покупать дорого' : 'Buy is expensive') : spread <= -12 ? (l === 'ru' ? 'Выгодно покупать' : 'Buy opportunity') : (l === 'ru' ? 'Нейтрально' : 'Neutral');
            const sellSignal = spread >= 15 ? (l === 'ru' ? 'Выгодно продавать' : 'Sell opportunity') : spread <= -12 ? (l === 'ru' ? 'Продавать невыгодно' : 'Sell is weak') : (l === 'ru' ? 'Нейтрально' : 'Neutral');
            return (
              <div key={`market_${hub.hubId}`} className="rounded border border-white/10 bg-black/25 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-white">{LOCATIONS[hub.hubId]?.name?.[l] || hub.hubId}</p>
                  <p className="text-primary/90 uppercase tracking-wider">{hub.marketMode}</p>
                </div>
                <p className="text-muted-foreground mt-1">
                  {l === 'ru' ? 'Баланс спроса/предложения' : 'Demand/Supply spread'}: {spread >= 0 ? '+' : ''}{spread}
                </p>
                <p className="text-muted-foreground">
                  {l === 'ru' ? 'Покупка' : 'Buy'}: {buySignal} · {l === 'ru' ? 'Продажа' : 'Sell'}: {sellSignal}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-3 border-b border-border/40 pb-2">
          {l === 'ru' ? 'Таймлайн отложенных последствий' : 'Delayed Consequences Timeline'}
        </h3>
        {pendingTimeline.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {l === 'ru' ? 'Отложенные последствия не запланированы.' : 'No delayed consequences scheduled.'}
          </p>
        ) : (
          <div className="space-y-2">
            {pendingTimeline.map((item) => (
              <div key={item.id} className="rounded border border-white/10 bg-black/25 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-white">{LOCATIONS[item.triggerHubId]?.name?.[l] || item.triggerHubId}</p>
                  <p className="text-primary/90">{l === 'ru' ? `тик ${item.dueTick}` : `tick ${item.dueTick}`}</p>
                </div>
                <p className="text-muted-foreground mt-1">
                  {l === 'ru' ? 'Тип' : 'Kind'}: {localizeConsequenceKind(l, item.kind)} · {l === 'ru' ? 'Интенсивность' : 'Intensity'}: {item.intensity}
                </p>
                <p className="text-muted-foreground">
                  {l === 'ru' ? 'Источник' : 'Origin'}: {localizeOriginType(l, item.originType)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-3 border-b border-border/40 pb-2">
          {l === 'ru' ? 'Текущие отношения с хабами' : 'Current Hub Relations'}
        </h3>
        <div className="space-y-3">
          {standings.map(({ hub, tier }) => (
            <div key={hub.hubId} className="rounded border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-white font-semibold">{LOCATIONS[hub.hubId]?.name?.[l] || hub.hubId}</p>
                <p className={`text-sm font-bold ${hub.playerRelation >= 0 ? 'text-emerald-300' : 'text-destructive'}`}>
                  {hub.playerRelation >= 0 ? '+' : ''}
                  {hub.playerRelation}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                {tier.tone === 'good' ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> : tier.tone === 'bad' ? <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> : <Handshake className="w-3.5 h-3.5 text-primary/80" />}
                <span>{tier.label[l]}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{tierEffectText(l, tier)}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-3 border-b border-border/40 pb-2">
          {l === 'ru' ? 'История изменений репутации' : 'Reputation Change History'}
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {l === 'ru' ? 'Пока нет зафиксированных изменений.' : 'No recorded reputation changes yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="rounded border border-white/10 bg-black/25 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white">
                    {LOCATIONS[entry.hubId]?.name?.[l] || entry.hubId}
                    {entry.relatedHubId ? ` ↔ ${LOCATIONS[entry.relatedHubId]?.name?.[l] || entry.relatedHubId}` : ''}
                  </p>
                  <p className={entry.delta >= 0 ? 'text-emerald-300 font-semibold' : 'text-destructive font-semibold'}>
                    {entry.delta >= 0 ? '+' : ''}
                    {entry.delta}
                  </p>
                </div>
                <p className="text-muted-foreground mt-1">{localizeReason(l, entry.reasonKey, entry.reason)}</p>
                <p className="text-[10px] text-muted-foreground/80 mt-1">
                  {l === 'ru' ? `Тик ${entry.tick}` : `Tick ${entry.tick}`} · {entry.source}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
