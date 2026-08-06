import { useState } from 'react';
import { X, ChevronRight, CandlestickChart, Box, MoveDiagonal, Activity, Ruler, Shield } from 'lucide-react';
import { clsx } from '@/lib/utils';

interface EducationProps {
  onClose: () => void;
}

interface Section {
  id: string;
  title: string;
  icon: typeof CandlestickChart;
  intro: string;
  points: { heading: string; text: string }[];
}

const SECTIONS: Section[] = [
  {
    id: 'candles',
    title: 'Свечные паттерны',
    icon: CandlestickChart,
    intro: 'Свечные паттерны — это базовый язык ценового движения. Контекст важнее самой формации.',
    points: [
      { heading: 'Уровни S/R', text: 'Паттерн у ключевого уровня поддержки/сопротивления имеет больший вес, чем тот же паттерн в середине диапазона.' },
      { heading: 'Тренд', text: 'Паттерн продолжения тренда надёжнее, чем разворотный паттерн против сильного направленного движения.' },
      { heading: 'Подтверждение', text: 'Ждите следующую свечу для подтверждения. Паттерн — это сигнал, а не команда на вход.' },
    ],
  },
  {
    id: 'ob',
    title: 'Order Blocks',
    icon: Box,
    intro: 'Order Block — последняя противоположная свеча перед сильным импульсным движением. Зона, откуда инициирован крупный ордер.',
    points: [
      { heading: 'Построение', text: 'Для бычьего OB: последняя медвежья свеча перед бычьим импульсом, пробивающим её максимум. Для медвежьего — зеркально.' },
      { heading: 'Бычий / Медвежий', text: 'Бычий OB — ожидаем откуп от зоны снизу вверх. Медвежий OB — ожидаем заход цены сверху вниз.' },
      { heading: 'Mitigation', text: 'Зона считается отработанной (mitigated), когда цена возвращается и касается её границ. После mitigation зона теряет актуальность.' },
      { heading: 'Фильтрация слабых', text: 'Сильный OB: объём выше среднего, тело свечи больше соседних, последующее движение не менее 2 ATR. Слабые OB без объёма игнорируются.' },
    ],
  },
  {
    id: 'fvg',
    title: 'Fair Value Gaps',
    icon: MoveDiagonal,
    intro: 'FVG (Imbalance) — ценовой разрыв между свечами, где нет встречного интереса. Цена стремится вернуться и заполнить разрыв.',
    points: [
      { heading: 'Формирование', text: 'Бычий FVG: минимум третьей свечи выше максимума первой. Медвежий FVG: максимум третьей свечи ниже минимума первой. Зона — между ними.' },
      { heading: 'Торговля на fill', text: 'Цена часто возвращается к FVG для заполнения. Вход — при касании зоны в направлении основного тренда. Stop-loss — за противоположную границу FVG.' },
      { heading: 'Незаполненные FVG', text: 'Если разрыв не заполнен, он остаётся «магнитом» для цены. Визуально на графике такие зоны тянутся до правого края.' },
    ],
  },
  {
    id: 'smc',
    title: 'SMC / ICT',
    icon: Activity,
    intro: 'Smart Money Concepts — модель поведения крупного капитала. Ликвидность, структурные сдвиги, kill zones.',
    points: [
      { heading: 'Ликвидность', text: 'Скопления стоп-лоссов над экстремумами и под ними. Крупный капитал ищет ликвидность для исполнения крупных позиций.' },
      { heading: 'BOS (Break of Structure)', text: 'Пробой предыдущего максимума (бычий BOS) или минимума (медвежий BOS) подтверждает продолжение тренда.' },
      { heading: 'CHoCH (Change of Character)', text: 'Смена характера: первый пробой структуры против тренда. Ранний сигнал возможного разворота, но требует подтверждения.' },
      { heading: 'Kill Zones', text: 'Лондонская сессия (07:00–10:00 UTC) и Нью-Йорк (12:00–15:00 UTC) — время наибольшей волатильности и наиболее чистых SMC-сетапов.' },
    ],
  },
  {
    id: 'fib',
    title: 'Фибоначчи',
    icon: Ruler,
    intro: 'Уровни Фибоначчи — зоны коррекции и расширения на основе золотого сечения.',
    points: [
      { heading: 'Коррекции', text: 'Ключевые уровни: 0.5 (50%), 0.618 (61.8%), 0.705 (70.5%). Зона между 0.618 и 0.705 — «золотая зона» для входа по тренду.' },
      { heading: 'Расширения', text: 'Используются для целей: 1.272, 1.414, 1.618, 2.0. Расширение 1.618 — частая цель третьей волны.' },
      { heading: 'Применение', text: 'Натяните сетку от начала до конца импульса. Коррекция к 0.618 в зоне OB — высоковероятный сетап.' },
    ],
  },
  {
    id: 'risk',
    title: 'Риск-менеджмент',
    icon: Shield,
    intro: 'Без риск-менеджмента любой сигнал — лотерея. Дисциплина важнее стратегии.',
    points: [
      { heading: 'R:R ≥ 1.5', text: 'Минимальное соотношение риска к прибыли 1:1.5. При R:R ниже 1.5 даже прибыльная стратегия уходит в минус из-за комиссий.' },
      { heading: 'Stop-loss', text: 'Стоп всегда за экстремумом свечи входа или за границей OB/FVG — там, где сценарий точно invalidated.' },
      { heading: 'Position sizing', text: 'Риск на сделку — 1–2% от депозита. Объём позиции = (Баланс × % риска) / Размер стопа в деньгах.' },
      { heading: 'Консистентность', text: 'Одинаковый риск на каждую сделку. Не увеличивайте объём после проигрыша — это путь к сливу.' },
    ],
  },
];

export function Education({ onClose }: EducationProps) {
  const [openId, setOpenId] = useState<string | null>(SECTIONS[0].id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-base-800 bg-base-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-800 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-base-100">
            <CandlestickChart size={16} className="text-secondary-400" />
            Учебный курс
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-base-400 transition hover:bg-base-800 hover:text-base-100"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            {SECTIONS.map((section) => {
              const isOpen = openId === section.id;
              const Icon = section.icon;
              return (
                <div key={section.id} className="overflow-hidden rounded-xl border border-base-800 bg-base-900">
                  <button
                    onClick={() => setOpenId(isOpen ? null : section.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-base-800/50"
                  >
                    <Icon size={18} className={clsx('shrink-0 transition', isOpen ? 'text-secondary-400' : 'text-base-500')} />
                    <span className="flex-1 text-sm font-semibold text-base-100">{section.title}</span>
                    <ChevronRight
                      size={16}
                      className={clsx('text-base-500 transition-transform', isOpen && 'rotate-90')}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-base-800 px-4 py-3">
                      <p className="mb-3 text-xs leading-relaxed text-base-300">{section.intro}</p>
                      <div className="flex flex-col gap-2.5">
                        {section.points.map((point) => (
                          <div key={point.heading} className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-secondary-400">{point.heading}</span>
                            <span className="text-xs leading-relaxed text-base-300">{point.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
