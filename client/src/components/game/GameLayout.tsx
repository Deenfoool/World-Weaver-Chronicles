import { useEffect, useState } from 'react';
import { useGameStore } from '../../game/store';
import { LOCATIONS, WEATHER, ITEMS, CLASSES, SKILLS } from '../../game/constants';
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Save, Shield, Sword, Heart, Coins, User, Backpack, Map as MapIcon, Settings as SettingsIcon, Swords, Star, Hammer, Tent, Cloud, Sun, CloudRain, CloudLightning, Snowflake, Zap, Weight, BookMarked, Sparkles } from 'lucide-react';
import CombatScreen from './CombatScreen';
import LocationScreen from './LocationScreen';
import InventoryPanel from './InventoryPanel';
import QuestsPanel from './QuestsPanel';
import SettingsPanel from './SettingsPanel';
import SkillsPanel from './SkillsPanel';
import CraftingPanel from './CraftingPanel';
import BestiaryPanel from './BestiaryPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { T } from '../../game/translations';
import { CharacterCreationBonuses } from '../../game/store';

type CreationOption = {
  id: string;
  title: { en: string; ru: string };
  description: { en: string; ru: string };
  effectHint?: { en: string; ru: string };
  bonuses?: CharacterCreationBonuses;
  classId?: 'warrior' | 'ranger' | 'alchemist';
};

type CreationQuestion = {
  id: string;
  title: { en: string; ru: string };
  options: CreationOption[];
};

export default function GameLayout() {
  const { player, loadSave, chooseClass, currentLocationId, currentWeather, status, settings } = useGameStore();
  const [activeTab, setActiveTab] = useState('world'); 
  const [introStep, setIntroStep] = useState(0);
  const [creationStep, setCreationStep] = useState(0);
  const [creationAnswers, setCreationAnswers] = useState<Record<string, string>>({});
  const l = settings.language;

  useEffect(() => {
    loadSave();
  }, []);

  const location = LOCATIONS[currentLocationId];
  
  const bgStyle = {
    backgroundImage: `linear-gradient(to bottom, rgba(15, 18, 25, 0.6), rgba(15, 18, 25, 0.95)), url(${location.image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  const renderWorld = () => (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {status === 'combat' ? <CombatScreen /> : <LocationScreen location={location} status={status} />}
    </div>
  );

  const introLore = [
    {
      title: l === 'ru' ? 'Когда небо треснуло' : 'When The Sky Cracked',
      text:
        l === 'ru'
          ? 'Сначала это называли просто бурей. Потом — Рунным Расколом. Башни рассыпались в пепел, реки сменили русла, а дороги начали вести не туда, куда помнили карты.\n\nОкхейвен выжил чудом: крепостные стены держатся на старой клятве стражей, а рынки — на упрямстве тех, кто не согласился исчезнуть.'
          : 'At first they called it a storm. Later, the Runebreak. Towers turned to ash, rivers changed their beds, and roads stopped leading where maps remembered.\n\nOakhaven survived by miracle: its walls stand on old warden oaths, and its markets on the stubbornness of people who refused to vanish.',
    },
    {
      title: l === 'ru' ? 'Кто ты среди обломков' : 'Who You Are Among Ruins',
      text:
        l === 'ru'
          ? 'Ты не избранный из песен и не наследник трона. Ты тот, кто остаётся на ногах после последнего удара.\n\nДля караванов ты — тень у костра на перевале. Для чудовищ — имя, которое звучит перед тем, как гаснет факел.'
          : 'You are no chosen hero from songs, no heir to a throne. You are the one still standing after the last blow.\n\nFor caravans, you are a shadow by the passfire. For monsters, your name is what they hear before the torch dies.',
    },
    {
      title: l === 'ru' ? 'Что поставлено на кон' : 'What Is At Stake',
      text:
        l === 'ru'
          ? 'Каждый сорванный заказ — это пустые амбары. Каждый незащищённый путь — это ещё один погребальный костёр.\n\nТы воюешь не за славу. Ты воюешь, чтобы дети в Окхейвене снова различали тишину и страх.'
          : 'Every failed contract means empty granaries. Every unguarded road means another funeral pyre.\n\nYou do not fight for glory. You fight so children in Oakhaven can once again tell silence from fear.',
    },
    {
      title: l === 'ru' ? 'Память о старом ордене' : 'Memory Of The Old Order',
      text:
        l === 'ru'
          ? 'До королей и гербов были Хранители — воины, следопыты и алхимики, державшие равновесие между дикой магией и человеком.\n\nИх руны давно стерлись, но их ремесло живёт в тех, кто выбирает путь клинка, пути следа или пути колбы.'
          : 'Before kings and heraldry, there were Wardens — warriors, scouts, and alchemists who kept balance between wild magic and humankind.\n\nTheir runes are gone, but their craft remains in those who choose blade, trail, or flask.',
    },
    {
      title: l === 'ru' ? 'Твоя клятва начинается сейчас' : 'Your Oath Begins Now',
      text:
        l === 'ru'
          ? 'С этого шага твоя история перестаёт быть слухом и становится следом в летописи.\n\nТвои ответы определят не только числа в листе героя, но и то, как о тебе будут говорить у ворот, в кузнице и у походного огня.'
          : 'From this step on, your story stops being rumor and becomes a mark in the chronicle.\n\nYour answers will shape not just numbers on a hero sheet, but how people speak of you at the gate, in the forge, and by campfire.',
    },
  ];

  const creationQuestions: CreationQuestion[] = [
    {
      id: 'parents',
      title: { en: 'Who were your parents?', ru: 'Кем были ваши родители?' },
      options: [
        {
          id: 'parents_soldier',
          title: { en: 'Frontier veterans', ru: 'Ветераны пограничья' },
          description: {
            en: 'You were raised by people who slept in armor and taught you that fear is managed, not defeated.',
            ru: 'Тебя растили люди, спавшие в доспехе и учившие: страх не побеждают, им управляют.',
          },
          effectHint: { en: 'Legacy: stronger body and guard stance.', ru: 'Наследие: крепкое тело и стойка защитника.' },
          bonuses: { maxHp: 8, baseDefense: 1 },
        },
        {
          id: 'parents_hunters',
          title: { en: 'Forest hunters', ru: 'Лесные охотники' },
          description: {
            en: 'You learned to read bent grass, broken branches, and when to strike before dusk swallows the trail.',
            ru: 'Ты учился читать примятую траву, сломанные ветви и бить первым, пока сумрак не съел след.',
          },
          effectHint: { en: 'Legacy: sharper damage and field carrying craft.', ru: 'Наследие: более острый урон и походная сноровка.' },
          bonuses: { baseDamageMin: 1, baseDamageMax: 1, carryCapacity: 4 },
        },
        {
          id: 'parents_alchemists',
          title: { en: 'Traveling alchemists', ru: 'Странствующие алхимики' },
          description: {
            en: 'Your cradle smelled of herbs and embers. You learned that every poison has a rhythm, every cure a price.',
            ru: 'Твоя колыбель пахла травами и углями. Ты рано понял: у каждого яда свой ритм, у каждого лекарства своя цена.',
          },
          effectHint: { en: 'Legacy: broader energy reserve and trader coin.', ru: 'Наследие: больше энергии и купеческая монета.' },
          bonuses: { maxEnergy: 7, gold: 20 },
        },
        {
          id: 'parents_nobles',
          title: { en: 'Fallen minor nobles', ru: 'Обедневшие дворяне' },
          description: {
            en: 'You inherited discipline, old manuscripts, and the habit of planning three moves ahead in every dispute.',
            ru: 'Тебе достались дисциплина, старые рукописи и привычка просчитывать спор на три хода вперёд.',
          },
          effectHint: { en: 'Legacy: tactical talent and a hidden reserve fund.', ru: 'Наследие: тактический талант и скрытый резерв золота.' },
          bonuses: { skillPoints: 1, gold: 25 },
        },
      ],
    },
    {
      id: 'upbringing',
      title: { en: 'Where did you grow up?', ru: 'Где вы росли?' },
      options: [
        {
          id: 'up_village',
          title: { en: 'Remote village', ru: 'Глухая деревня' },
          description: {
            en: 'Long winters forged patience. Work began before sunrise, and everyone carried more than they should.',
            ru: 'Долгие зимы выковали терпение. Работа начиналась до рассвета, и каждый нёс больше, чем должен.',
          },
          effectHint: { en: 'Path trait: endurance and pack discipline.', ru: 'Черта пути: выносливость и дисциплина ноши.' },
          bonuses: { maxHp: 6, carryCapacity: 5 },
        },
        {
          id: 'up_city',
          title: { en: 'Crowded city', ru: 'Шумный город' },
          description: {
            en: 'In tight alleys and market noise, you learned speed, bargaining, and how to survive on little rest.',
            ru: 'В тесных переулках и рыночном гуле ты научился скорости, торгу и жизни почти без отдыха.',
          },
          effectHint: { en: 'Path trait: greater energy flow and coin sense.', ru: 'Черта пути: больший запас энергии и чувство цены.' },
          bonuses: { maxEnergy: 6, gold: 18 },
        },
        {
          id: 'up_estate',
          title: { en: 'Old estate', ru: 'Старое поместье' },
          description: {
            en: 'Behind cracked marble and quiet tutors, you studied dueling forms and the weight of responsibility.',
            ru: 'Среди треснувшего мрамора и молчаливых наставников ты изучал формы дуэли и цену ответственности.',
          },
          effectHint: { en: 'Path trait: disciplined defense and learned focus.', ru: 'Черта пути: дисциплинированная защита и обученная концентрация.' },
          bonuses: { baseDefense: 1, skillPoints: 1 },
        },
        {
          id: 'up_camp',
          title: { en: 'Mercenary camp', ru: 'Лагерь наёмников' },
          description: {
            en: 'Steel songs, rough jokes, and drills in mud. You grew where hesitation was the only unforgivable sin.',
            ru: 'Песни стали, грубые шутки и тренировки в грязи. Ты вырос там, где промедление считалось главным грехом.',
          },
          effectHint: { en: 'Path trait: higher striking pressure.', ru: 'Черта пути: усиленное давление в атаке.' },
          bonuses: { baseDamageMin: 1, baseDamageMax: 2 },
        },
      ],
    },
    {
      id: 'path',
      title: { en: 'Who did you become?', ru: 'Кем вы стали?' },
      options: [
        {
          id: 'path_blade',
          title: { en: 'Shieldblade trainee', ru: 'Ученик щитоносца' },
          description: {
            en: 'You stood on the training circle until your shoulders burned, learning to hold a line when others break.',
            ru: 'Ты стоял в учебном круге, пока плечи не горели, и учился держать строй там, где другие ломаются.',
          },
          effectHint: { en: 'Calling: Warrior. Skills favor guard and front-line survival.', ru: 'Призвание: Воин. Навыки тяготеют к защите и линии фронта.' },
          classId: 'warrior',
          bonuses: { baseDefense: 1, maxHp: 4 },
        },
        {
          id: 'path_scout',
          title: { en: 'Trail scout', ru: 'Следопыт-разведчик' },
          description: {
            en: 'You became the first to move and the last to be seen, mapping danger before danger maps you.',
            ru: 'Ты стал тем, кто выходит первым и исчезает последним, отмечая опасность раньше, чем она отметит тебя.',
          },
          effectHint: { en: 'Calling: Ranger. Skills favor mobility, tempo, and utility.', ru: 'Призвание: Следопыт. Навыки тяготеют к мобильности и темпу.' },
          classId: 'ranger',
          bonuses: { maxEnergy: 5, carryCapacity: 3 },
        },
        {
          id: 'path_brewer',
          title: { en: 'Apprentice brewer', ru: 'Ученик алхимика' },
          description: {
            en: 'You learned to turn shards, venom, and ash into solutions no blade could ever provide.',
            ru: 'Ты научился превращать осколки, яд и пепел в решения, на которые не способен ни один клинок.',
          },
          effectHint: { en: 'Calling: Alchemist. Skills favor mixtures, statuses, and resource play.', ru: 'Призвание: Алхимик. Навыки тяготеют к смесям, эффектам и ресурсу.' },
          classId: 'alchemist',
          bonuses: { maxEnergy: 4, skillPoints: 1 },
        },
      ],
    },
    {
      id: 'vow',
      title: { en: 'What oath drives you now?', ru: 'Какая клятва ведёт вас?' },
      options: [
        {
          id: 'vow_people',
          title: { en: 'Protect the common folk', ru: 'Защищать простой народ' },
          description: {
            en: 'You put your name between homes and the dark, even when no bard will ever sing of it.',
            ru: 'Ты ставишь своё имя между домами и тьмой, даже если об этом никто не сложит балладу.',
          },
          effectHint: { en: 'Oath mark: sturdier body and steadier defense.', ru: 'Печать клятвы: крепче тело и надёжнее защита.' },
          bonuses: { maxHp: 7, baseDefense: 1 },
        },
        {
          id: 'vow_knowledge',
          title: { en: 'Recover lost knowledge', ru: 'Вернуть утраченные знания' },
          description: {
            en: 'You chase forbidden archives and buried runes, believing understanding can end the cycle.',
            ru: 'Ты ищешь запретные архивы и погребённые руны, веря, что понимание способно разорвать круг.',
          },
          effectHint: { en: 'Oath mark: sharper mind and deeper energy control.', ru: 'Печать клятвы: острее разум и глубже контроль энергии.' },
          bonuses: { skillPoints: 1, maxEnergy: 5 },
        },
        {
          id: 'vow_wealth',
          title: { en: 'Build your fortune', ru: 'Собрать состояние' },
          description: {
            en: 'You swore never again to be powerless in trade, supply, or bargaining with desperate nobles.',
            ru: 'Ты поклялся больше не быть бессильным в торге, снабжении и переговорах с отчаявшимися лордами.',
          },
          effectHint: { en: 'Oath mark: stronger logistics and starting capital.', ru: 'Печать клятвы: лучше логистика и стартовый капитал.' },
          bonuses: { gold: 35, carryCapacity: 4 },
        },
        {
          id: 'vow_vengeance',
          title: { en: 'Avenge the fallen', ru: 'Отомстить за павших' },
          description: {
            en: 'You carry names carved on steel. Every strike is a promise kept in blood and ash.',
            ru: 'Ты носишь имена, вырезанные на стали. Каждый удар — обещание, сдержанное в крови и пепле.',
          },
          effectHint: { en: 'Oath mark: heavier offensive pressure.', ru: 'Печать клятвы: более тяжёлый напор в атаке.' },
          bonuses: { baseDamageMin: 1, baseDamageMax: 2 },
        },
      ],
    },
  ];

  if (!player.classId) {
    const loreFinished = introStep >= introLore.length;
    const currentQuestion = creationQuestions[creationStep];
    const selectedOptions = creationQuestions
      .map((q) => q.options.find((opt) => opt.id === creationAnswers[q.id]))
      .filter(Boolean) as CreationOption[];
    const selectedPath = selectedOptions.find((opt) => opt.classId)?.classId || 'warrior';
    const accumulatedBonuses = selectedOptions.reduce<CharacterCreationBonuses>(
      (acc, opt) => ({
        maxHp: (acc.maxHp || 0) + (opt.bonuses?.maxHp || 0),
        maxEnergy: (acc.maxEnergy || 0) + (opt.bonuses?.maxEnergy || 0),
        baseDamageMin: (acc.baseDamageMin || 0) + (opt.bonuses?.baseDamageMin || 0),
        baseDamageMax: (acc.baseDamageMax || 0) + (opt.bonuses?.baseDamageMax || 0),
        baseDefense: (acc.baseDefense || 0) + (opt.bonuses?.baseDefense || 0),
        carryCapacity: (acc.carryCapacity || 0) + (opt.bonuses?.carryCapacity || 0),
        gold: (acc.gold || 0) + (opt.bonuses?.gold || 0),
        skillPoints: (acc.skillPoints || 0) + (opt.bonuses?.skillPoints || 0),
      }),
      {},
    );
    const classPreview = CLASSES[selectedPath];

    const chooseAnswer = (questionId: string, optionId: string) => {
      setCreationAnswers((prev) => ({ ...prev, [questionId]: optionId }));
      setCreationStep((prev) => prev + 1);
    };

    return (
      <div className="h-[100dvh] w-full text-foreground font-sans flex overflow-hidden fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(130,90,40,0.25),_rgba(10,10,15,0.95))]">
        <div className="m-auto w-full max-w-5xl p-4 md:p-8">
          <div className="rpg-panel p-6 md:p-8">
            {!loreFinished ? (
              <div className="max-w-3xl mx-auto">
                <p className="text-center text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">
                  {l === 'ru' ? 'Вступление' : 'Prologue'}
                </p>
                <h1 className="text-3xl md:text-5xl font-serif text-primary mb-3 uppercase tracking-widest text-center">
                  {introLore[introStep].title}
                </h1>
                <p className="text-center text-sm md:text-base text-muted-foreground mb-8 leading-relaxed whitespace-pre-line">
                  {introLore[introStep].text}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIntroStep((v) => v + 1)}
                    className="rpg-button px-6 py-3"
                  >
                    {T.intro_next[l]}
                  </button>
                  <button
                    onClick={() => setIntroStep(introLore.length)}
                    className="rpg-button px-6 py-3 border-white/30 text-white hover:bg-white/10"
                  >
                    {T.intro_skip[l]}
                  </button>
                </div>
              </div>
            ) : creationStep < creationQuestions.length ? (
              <div className="max-w-4xl mx-auto">
                <p className="text-center text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">
                  {l === 'ru'
                    ? `Создание персонажа ${creationStep + 1}/${creationQuestions.length}`
                    : `Character Creation ${creationStep + 1}/${creationQuestions.length}`}
                </p>
                <h1 className="text-2xl md:text-4xl font-serif text-primary mb-6 uppercase tracking-widest text-center">
                  {currentQuestion.title[l]}
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentQuestion.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => chooseAnswer(currentQuestion.id, opt.id)}
                      className="text-left p-4 rounded border border-primary/30 bg-black/40 hover:bg-black/60 hover:border-primary transition-all"
                    >
                      <h3 className="font-serif text-lg text-white mb-1">{opt.title[l]}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{opt.description[l]}</p>
                      {opt.effectHint && (
                        <p className="text-[11px] text-primary/80 mt-2 italic">
                          {l === 'ru' ? 'Отголосок судьбы: ' : 'Fate echo: '}
                          {opt.effectHint[l]}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
                {creationStep > 0 && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => setCreationStep((v) => Math.max(0, v - 1))}
                      className="rpg-button px-6 py-2 border-white/30 text-white hover:bg-white/10"
                    >
                      {l === 'ru' ? 'Назад' : 'Back'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl md:text-5xl font-serif text-primary mb-2 uppercase tracking-widest text-center">
                  {l === 'ru' ? 'Итог биографии' : 'Biography Result'}
                </h1>
                <p className="text-center text-sm text-muted-foreground mb-5">
                  {l === 'ru'
                    ? 'Ваши ответы определили стартовый класс и модификаторы персонажа.'
                    : 'Your answers determined your starting class and stat modifiers.'}
                </p>
                <div className="rounded border border-primary/30 bg-black/40 p-4 mb-4">
                  <h3 className="font-serif text-xl text-white mb-1">{classPreview.name[l]}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{classPreview.description[l]}</p>
                  <div className="mb-3 space-y-1">
                    {selectedOptions.map((opt) => (
                      <p key={opt.id} className="text-[11px] text-primary/85 italic">
                        • {opt.title[l]} — {opt.effectHint?.[l] || opt.description[l]}
                      </p>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-primary/90">
                    <p>HP: {classPreview.baseStats.maxHp + (accumulatedBonuses.maxHp || 0)}</p>
                    <p>{T.combat_energy[l]}: {classPreview.baseStats.maxEnergy + (accumulatedBonuses.maxEnergy || 0)}</p>
                    <p>{T.stat_dmg[l]}: {classPreview.baseStats.baseDamage[0] + (accumulatedBonuses.baseDamageMin || 0)}-{classPreview.baseStats.baseDamage[1] + (accumulatedBonuses.baseDamageMax || 0)}</p>
                    <p>{T.stat_def[l]}: {classPreview.baseStats.baseDefense + (accumulatedBonuses.baseDefense || 0)}</p>
                    <p>{T.stat_capacity[l]}: {classPreview.baseStats.carryCapacity + (accumulatedBonuses.carryCapacity || 0)}</p>
                    <p>{l === 'ru' ? 'Стартовое золото' : 'Starting gold'}: {25 + (accumulatedBonuses.gold || 0)}</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setCreationStep(creationQuestions.length - 1)}
                    className="rpg-button px-6 py-3 border-white/30 text-white hover:bg-white/10"
                  >
                    {l === 'ru' ? 'Изменить выбор' : 'Adjust choices'}
                  </button>
                  <button
                    onClick={() => chooseClass(selectedPath, accumulatedBonuses)}
                    className="rpg-button px-6 py-3"
                  >
                    {l === 'ru' ? 'Создать персонажа' : 'Create Character'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full text-foreground font-sans flex overflow-hidden fixed inset-0" style={bgStyle}>
      {/* Desktop Left Panel (Hidden on mobile) */}
      <aside className="hidden md:flex w-[400px] bg-card/90 backdrop-blur-xl border-r border-border flex-col shrink-0 h-full z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="p-4 border-b border-border bg-black/40 flex justify-between items-center shrink-0">
          <h1 className="text-2xl font-serif text-primary tracking-widest font-bold uppercase drop-shadow-md">
            Eternal Quest
          </h1>
          <div className="flex items-center gap-2 text-primary font-bold bg-black/40 px-3 py-1 rounded-full border border-primary/20">
            <Coins className="w-4 h-4" /> {player.gold}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="character" className="flex-1 flex flex-col min-h-0 mt-2">
          <div className="px-4 shrink-0">
            <TabsList className="grid w-full grid-cols-7 bg-black/50 border border-white/5 h-12">
              <TabsTrigger value="character" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><User className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="skills" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><Star className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="inventory" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><Backpack className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="quests" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><MapIcon className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="crafting" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><Hammer className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="bestiary" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><BookMarked className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><SettingsIcon className="w-4 h-4"/></TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="flex-1 mt-2">
            <TabsContent value="character" className="m-0"><CharacterPanel player={player} l={l} /></TabsContent>
            <TabsContent value="skills" className="m-0"><SkillsPanel /></TabsContent>
            <TabsContent value="inventory" className="m-0"><InventoryPanel /></TabsContent>
            <TabsContent value="quests" className="m-0"><QuestsPanel /></TabsContent>
            <TabsContent value="crafting" className="m-0"><CraftingPanel /></TabsContent>
            <TabsContent value="bestiary" className="m-0"><BestiaryPanel /></TabsContent>
            <TabsContent value="settings" className="m-0"><SettingsPanel /></TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full bg-black/20 min-w-0">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/40 to-black/90 z-0"></div>
        
        {/* Mobile Top Bar */}
        <div className="md:hidden p-3 border-b border-border bg-black/80 flex justify-between items-center shrink-0 relative z-10 backdrop-blur-xl">
           <div className="flex flex-col flex-1 max-w-[60%]">
             <div className="flex items-center gap-2">
               <Heart className="w-3.5 h-3.5 text-destructive shrink-0" />
               <Progress value={(player.hp / player.maxHp) * 100} className="w-full max-w-[100px] h-1.5 bg-black/50" />
               <span className="text-[10px] text-white font-mono">{player.hp}/{player.maxHp}</span>
             </div>
             <div className="flex items-center gap-2 mt-1.5">
               <span className="text-[9px] text-accent-foreground font-bold shrink-0 w-3.5 text-center">XP</span>
               <Progress value={(player.xp / player.xpToNext) * 100} className="w-full max-w-[100px] h-1 bg-black/50" />
             </div>
             <div className="flex items-center gap-2 mt-1.5">
               <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
               <Progress value={(player.energy / player.maxEnergy) * 100} className="w-full max-w-[100px] h-1 bg-black/50 [&>div]:bg-blue-500" />
             </div>
           </div>
           <div className="flex flex-col items-end gap-1">
             <div className="flex items-center gap-2">
               <div className="flex items-center gap-1.5 text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-xs">
                 <Coins className="w-3.5 h-3.5" /> {player.gold}
               </div>
               <div className="w-6 h-6 rounded bg-black/60 border border-white/10 flex items-center justify-center">
                  {currentWeather === 'clear' && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
                  {currentWeather === 'rain' && <CloudRain className="w-3.5 h-3.5 text-blue-400" />}
                  {currentWeather === 'storm' && <CloudLightning className="w-3.5 h-3.5 text-purple-400" />}
                  {currentWeather === 'snow' && <Snowflake className="w-3.5 h-3.5 text-white" />}
                  {currentWeather === 'fog' && <Cloud className="w-3.5 h-3.5 text-gray-400" />}
               </div>
             </div>
             <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{T.stat_level[l]} {player.level}</div>
           </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 relative z-10 overflow-hidden flex flex-col">
           {/* Desktop Top Weather */}
           <div className="hidden md:flex absolute top-0 right-0 p-4 z-50 items-center gap-4">
             <div className="flex items-center gap-2 group relative cursor-help">
                <div className="w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center backdrop-blur-md">
                   {currentWeather === 'clear' && <Sun className="w-5 h-5 text-yellow-400" />}
                   {currentWeather === 'rain' && <CloudRain className="w-5 h-5 text-blue-400" />}
                   {currentWeather === 'storm' && <CloudLightning className="w-5 h-5 text-purple-400" />}
                   {currentWeather === 'snow' && <Snowflake className="w-5 h-5 text-white" />}
                   {currentWeather === 'fog' && <Cloud className="w-5 h-5 text-gray-400" />}
                </div>
                {WEATHER[currentWeather] && (
                  <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-black border border-white/20 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-sm">
                    <p className="font-bold text-primary mb-1">{WEATHER[currentWeather].name[l]}</p>
                    <p className="text-muted-foreground">{WEATHER[currentWeather].description[l]}</p>
                  </div>
                )}
             </div>
           </div>

           {/* Desktop always shows world. Mobile shows based on activeTab. */}
           <div className="hidden md:flex flex-1 h-full overflow-hidden p-8">
             {renderWorld()}
           </div>
           
           <div className="md:hidden flex-1 h-full overflow-hidden">
             {activeTab === 'world' && renderWorld()}
             {activeTab === 'character' && <ScrollArea className="h-full"><CharacterPanel player={player} l={l} /></ScrollArea>}
             {activeTab === 'skills' && <ScrollArea className="h-full"><SkillsPanel /></ScrollArea>}
             {activeTab === 'inventory' && <ScrollArea className="h-full"><InventoryPanel /></ScrollArea>}
             {activeTab === 'crafting' && <ScrollArea className="h-full"><CraftingPanel /></ScrollArea>}
             {activeTab === 'quests' && <ScrollArea className="h-full"><QuestsPanel /></ScrollArea>}
             {activeTab === 'bestiary' && <ScrollArea className="h-full"><BestiaryPanel /></ScrollArea>}
             {activeTab === 'settings' && <ScrollArea className="h-full"><SettingsPanel /></ScrollArea>}
           </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden shrink-0 bg-card/95 backdrop-blur-xl border-t border-border flex justify-between px-2 relative z-20 pb-2 pt-1 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] overflow-x-auto gap-1">
           <NavBtn icon={<Swords className="w-4 h-4"/>} label={T.action_explore[l].split(' ')[0]} isActive={activeTab === 'world'} onClick={() => setActiveTab('world')} />
           <NavBtn icon={<User className="w-4 h-4"/>} label={T.nav_character[l]} isActive={activeTab === 'character'} onClick={() => setActiveTab('character')} />
           <NavBtn icon={<Star className="w-4 h-4"/>} label={T.nav_skills[l]} isActive={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
           <NavBtn icon={<Backpack className="w-4 h-4"/>} label={T.nav_inventory[l]} isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
           <NavBtn icon={<Hammer className="w-4 h-4"/>} label={T.nav_crafting[l]} isActive={activeTab === 'crafting'} onClick={() => setActiveTab('crafting')} />
           <NavBtn icon={<MapIcon className="w-4 h-4"/>} label={T.nav_quests[l]} isActive={activeTab === 'quests'} onClick={() => setActiveTab('quests')} />
           <NavBtn icon={<BookMarked className="w-4 h-4"/>} label={l === 'ru' ? 'бестиарий' : 'bestiary'} isActive={activeTab === 'bestiary'} onClick={() => setActiveTab('bestiary')} />
           <NavBtn icon={<SettingsIcon className="w-4 h-4"/>} label={T.nav_settings[l]} isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </main>
    </div>
  );
}

function NavBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${isActive ? 'text-primary scale-110' : 'text-muted-foreground hover:text-white'}`}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-wider font-bold truncate w-full px-1">{label}</span>
    </button>
  );
}

function CharacterPanel({ player, l }: { player: any; l: 'en' | 'ru' }) {
  const [section, setSection] = useState<'overview' | 'attributes' | 'skills'>('overview');
  const totalWeight = player.inventory.reduce((sum: number, inv: any) => {
    const item = ITEMS[inv.itemId];
    if (!item) return sum;
    return sum + item.weight * inv.quantity;
  }, 0);
  const learnedSkills = Object.entries(player.learnedSkills || {})
    .filter(([, lvl]) => Number(lvl) > 0)
    .map(([id, lvl]) => ({ id, lvl: Number(lvl), skill: SKILLS[id] }))
    .filter((entry) => entry.skill)
    .sort((a, b) => a.skill.name[l].localeCompare(b.skill.name[l]));
  const equippedWeapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
  const equippedArmor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border border-primary/25 bg-[linear-gradient(145deg,rgba(18,24,38,0.95),rgba(9,11,17,0.95))] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex justify-between items-start border-b border-white/10 pb-3 mb-4">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-primary/75">
              {l === 'ru' ? 'Лист героя' : 'Hero Ledger'}
            </p>
            <h2 className="text-3xl font-serif text-white">{player.name}</h2>
            <p className="text-sm text-primary uppercase tracking-wider">
              {T.stat_level[l]} {player.level}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">
              {(player.classId && CLASSES[player.classId]?.name?.[l]) || 'Unknown'} / Prestige {player.prestigeLevel || 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {l === 'ru' ? 'Очки навыков' : 'Skill Points'}
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/15 border border-primary/30 text-primary font-bold">
              <Sparkles className="w-4 h-4" />
              {player.skillPoints}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSection('overview')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
              section === 'overview'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {l === 'ru' ? 'Обзор' : 'Overview'}
          </button>
          <button
            onClick={() => setSection('attributes')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
              section === 'attributes'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {l === 'ru' ? 'Атрибуты' : 'Attributes'}
          </button>
          <button
            onClick={() => setSection('skills')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
              section === 'skills'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {l === 'ru' ? 'Навыки' : 'Skills'}
          </button>
        </div>

        {section === 'overview' && (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-destructive"><Heart className="w-3 h-3"/> HP</span>
                  <span className="text-white">{player.hp} / {player.maxHp}</span>
                </div>
                <Progress value={(player.hp / player.maxHp) * 100} className="h-2 bg-black/50" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-accent-foreground">XP</span>
                  <span className="text-white">{player.xp} / {player.xpToNext}</span>
                </div>
                <Progress value={(player.xp / player.xpToNext) * 100} className="h-1.5 bg-black/50" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-blue-300 flex items-center gap-1"><Zap className="w-3 h-3"/>{T.stat_energy[l]}</span>
                  <span className="text-white">{player.energy} / {player.maxEnergy}</span>
                </div>
                <Progress value={(player.energy / player.maxEnergy) * 100} className="h-1.5 bg-black/50 [&>div]:bg-blue-500" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-orange-300 flex items-center gap-1"><Tent className="w-3 h-3"/>{T.stat_fatigue[l]}</span>
                  <span className="text-white">{Math.floor(player.fatigue || 0)} / 100</span>
                </div>
                <Progress value={Math.floor(player.fatigue || 0)} className="h-1.5 bg-black/50 [&>div]:bg-orange-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="flex flex-col items-center justify-center p-3 bg-black/30 border border-white/5 rounded">
                <Sword className="w-5 h-5 text-primary mb-1" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_dmg[l]}</span>
                <span className="text-lg text-white font-bold">{player.stats.baseDamage[0]}-{player.stats.baseDamage[1]}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-black/30 border border-white/5 rounded">
                <Shield className="w-5 h-5 text-primary mb-1" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_def[l]}</span>
                <span className="text-lg text-white font-bold">{player.stats.baseDefense}</span>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2 p-3 bg-black/30 border border-white/5 rounded">
                <Weight className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_weight[l]}:</span>
                <span className="text-sm text-white font-bold">{totalWeight.toFixed(1)} / {player.carryCapacity.toFixed(1)}</span>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2 p-3 bg-black/30 border border-white/5 rounded">
                <MapIcon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_discovered[l]}:</span>
                <span className="text-sm text-white font-bold">{(player.discoveredLocations || ['town_oakhaven']).length}</span>
              </div>
            </div>
          </>
        )}

        {section === 'attributes' && (
          <div className="space-y-3">
            <div className="rounded border border-primary/20 bg-black/35 p-3">
              <h4 className="text-xs uppercase tracking-widest text-primary mb-2">{l === 'ru' ? 'Боевой профиль' : 'Combat Profile'}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p>{l === 'ru' ? 'Базовый урон' : 'Base damage'}: <span className="text-white font-semibold">{player.stats.baseDamage[0]}-{player.stats.baseDamage[1]}</span></p>
                <p>{l === 'ru' ? 'Базовая защита' : 'Base defense'}: <span className="text-white font-semibold">{player.stats.baseDefense}</span></p>
                <p>{l === 'ru' ? 'Макс. HP' : 'Max HP'}: <span className="text-white font-semibold">{player.maxHp}</span></p>
                <p>{l === 'ru' ? 'Макс. энергия' : 'Max energy'}: <span className="text-white font-semibold">{player.maxEnergy}</span></p>
                <p>{l === 'ru' ? 'Грузоподъёмность' : 'Carry capacity'}: <span className="text-white font-semibold">{player.carryCapacity.toFixed(1)}</span></p>
                <p>{l === 'ru' ? 'Золото' : 'Gold'}: <span className="text-white font-semibold">{player.gold}</span></p>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-black/30 p-3">
              <h4 className="text-xs uppercase tracking-widest text-white/90 mb-2">{l === 'ru' ? 'Снаряжение' : 'Equipment'}</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{l === 'ru' ? 'Оружие' : 'Weapon'}</span>
                  <span className="text-white font-semibold">{equippedWeapon?.name?.[l] || (l === 'ru' ? 'Не экипировано' : 'Not equipped')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{l === 'ru' ? 'Броня' : 'Armor'}</span>
                  <span className="text-white font-semibold">{equippedArmor?.name?.[l] || (l === 'ru' ? 'Не экипировано' : 'Not equipped')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'skills' && (
          <div className="space-y-3">
            <div className="rounded border border-primary/20 bg-black/35 p-3">
              <h4 className="text-xs uppercase tracking-widest text-primary mb-2">{l === 'ru' ? 'Изученные навыки' : 'Learned Skills'}</h4>
              {learnedSkills.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {l === 'ru' ? 'Навыки ещё не изучены. Откройте древо и вложите очки.' : 'No skills learned yet. Open the tree and spend points.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {learnedSkills.map((entry) => (
                    <div key={entry.id} className="rounded border border-white/10 bg-black/35 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-white font-serif">{entry.skill.name[l]}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 border border-primary/30 text-primary">
                          Lv {entry.lvl}/{entry.skill.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.skill.description[l]}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
