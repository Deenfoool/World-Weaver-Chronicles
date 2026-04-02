import { useMemo } from 'react';
import { useGameStore } from '../../game/store';
import { LOCATIONS } from '../../game/constants';
import { Handshake, ShieldAlert, ShieldCheck } from 'lucide-react';

type StandingTier = {
  min: number;
  max: number;
  label: { en: string; ru: string };
  effect: { en: string; ru: string };
  tone: 'good' | 'neutral' | 'bad';
};

const STANDING_TIERS: StandingTier[] = [
  {
    min: 60,
    max: 100,
    label: { en: 'Trusted Ally', ru: 'Надёжный союзник' },
    effect: { en: 'Best prices, priority contracts, lower route risk.', ru: 'Лучшие цены, приоритетные контракты, ниже риск маршрутов.' },
    tone: 'good',
  },
  {
    min: 25,
    max: 59,
    label: { en: 'Friendly', ru: 'Дружественный' },
    effect: { en: 'Moderate discounts and steady market behavior.', ru: 'Умеренные скидки и более стабильный рынок.' },
    tone: 'good',
  },
  {
    min: -24,
    max: 24,
    label: { en: 'Neutral', ru: 'Нейтралитет' },
    effect: { en: 'Standard prices and standard event pressure.', ru: 'Стандартные цены и обычное давление событий.' },
    tone: 'neutral',
  },
  {
    min: -59,
    max: -25,
    label: { en: 'Unfriendly', ru: 'Недружественный' },
    effect: { en: 'Higher prices, less favorable event outcomes.', ru: 'Повышенные цены и менее выгодные последствия событий.' },
    tone: 'bad',
  },
  {
    min: -100,
    max: -60,
    label: { en: 'Hostile', ru: 'Враждебный' },
    effect: { en: 'Trade penalties, retaliation risk, hostile contracts.', ru: 'Торговые штрафы, риск ответных мер, враждебные контракты.' },
    tone: 'bad',
  },
];

function resolveTier(relation: number): StandingTier {
  return STANDING_TIERS.find((tier) => relation >= tier.min && relation <= tier.max) || STANDING_TIERS[2];
}

function localizeReason(
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
        <h3 className="font-serif text-primary uppercase tracking-widest text-xs mb-2">
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
              <p className="text-muted-foreground">{tier.effect[l]}</p>
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
                  {l === 'ru' ? 'Тип' : 'Kind'}: {item.kind} · {l === 'ru' ? 'Интенсивность' : 'Intensity'}: {item.intensity}
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
              <p className="mt-1 text-[11px] text-muted-foreground">{tier.effect[l]}</p>
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
