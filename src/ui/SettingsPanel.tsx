import { useState, lazy, Suspense } from 'react';
import { Settings as SettingsIcon, X, Volume2, VolumeX, Key, Layers, Box, BarChart3, RotateCcw, LineChart, AlertTriangle, GraduationCap } from 'lucide-react';
import { useSettingsStore, ALL_PATTERNS, ALL_INDICATOR_FEATURES } from '@/stores/settingsStore';
import { useApiKeysStore } from '@/stores/useApiKeysStore';
import { useTickStore } from '@/stores/useTickStore';
import { DERIV_DEFAULT_APP_ID } from '@/data/providers.config';
import { TIMEFRAMES } from '@/data/symbols';
import { clsx } from '@/lib/utils';
import type { IndicatorConfig } from '@/types/domain';
import type { ReactNode } from 'react';

const Education = lazy(() => import('@/ui/Education').then((m) => ({ default: m.Education })));

interface NumberField {
  key: keyof IndicatorConfig;
  label: string;
  min: number;
  max: number;
  step?: number;
}

const FIELDS: NumberField[] = [
  { key: 'rsiPeriod', label: 'RSI период', min: 2, max: 50 },
  { key: 'emaFast', label: 'EMA быстрая', min: 2, max: 100 },
  { key: 'emaSlow', label: 'EMA медленная', min: 2, max: 200 },
  { key: 'macdFast', label: 'MACD быстрая', min: 2, max: 50 },
  { key: 'macdSlow', label: 'MACD медленная', min: 2, max: 100 },
  { key: 'macdSignal', label: 'MACD сигнальная', min: 2, max: 50 },
  { key: 'atrPeriod', label: 'ATR период', min: 2, max: 50 },
  { key: 'bbPeriod', label: 'Bollinger период', min: 5, max: 100 },
  { key: 'bbStdDev', label: 'Bollinger откл.', min: 0.5, max: 4, step: 0.1 },
];

const API_KEYS: { key: 'derivAppId'; label: string; placeholder: string }[] = [
  { key: 'derivAppId', label: 'Deriv App ID', placeholder: '1089' },
];

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-lg bg-base-800 p-2 text-base-300 transition hover:bg-base-700 hover:text-base-100"
        aria-label="Настройки"
      >
        <SettingsIcon size={18} />
      </button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const indicators = useSettingsStore((s) => s.indicators);
  const setIndicators = useSettingsStore((s) => s.setIndicators);
  const soundNewSignal = useSettingsStore((s) => s.soundNewSignal);
  const setSoundNewSignal = useSettingsStore((s) => s.setSoundNewSignal);
  const soundPrioritySignal = useSettingsStore((s) => s.soundPrioritySignal);
  const setSoundPrioritySignal = useSettingsStore((s) => s.setSoundPrioritySignal);
  const atrMultiplier = useSettingsStore((s) => s.atrMultiplier);
  const setAtrMultiplier = useSettingsStore((s) => s.setAtrMultiplier);
  const sensitivity = useSettingsStore((s) => s.sensitivity);
  const setSensitivity = useSettingsStore((s) => s.setSensitivity);
  const apiKeys = useApiKeysStore((s) => s.keys);
  const setApiKey = useApiKeysStore((s) => s.setKey);
  const startTick = useTickStore((s) => s.start);
  const stopTick = useTickStore((s) => s.stop);
  const activeSymbolId = useTickStore((s) => s.activeSymbolId);
  const activeTimeframe = useTickStore((s) => s.activeTimeframe);

  const handleApiKeyChange = (key: 'derivAppId', value: string) => {
    setApiKey(key, value);
    if (key === 'derivAppId' && activeSymbolId && activeTimeframe) {
      stopTick();
      void startTick(activeSymbolId, activeTimeframe);
    }
  };
  const [showEducation, setShowEducation] = useState(false);
  const timeframe = useSettingsStore((s) => s.timeframe);
  const setTimeframe = useSettingsStore((s) => s.setTimeframe);
  const activePatterns = useSettingsStore((s) => s.activePatterns);
  const setActivePatterns = useSettingsStore((s) => s.setActivePatterns);
  const activeIndicators = useSettingsStore((s) => s.activeIndicators);
  const setActiveIndicators = useSettingsStore((s) => s.setActiveIndicators);
  const showBosLayer = useSettingsStore((s) => s.showBosLayer);
  const setShowBosLayer = useSettingsStore((s) => s.setShowBosLayer);
  const showOrderBlocks = useSettingsStore((s) => s.showOrderBlocks);
  const setShowOrderBlocks = useSettingsStore((s) => s.setShowOrderBlocks);
  const showImbalances = useSettingsStore((s) => s.showImbalances);
  const setShowImbalances = useSettingsStore((s) => s.setShowImbalances);
  const showSupportResistance = useSettingsStore((s) => s.showSupportResistance);
  const setShowSupportResistance = useSettingsStore((s) => s.setShowSupportResistance);
  const showEma20 = useSettingsStore((s) => s.showEma20);
  const setShowEma20 = useSettingsStore((s) => s.setShowEma20);
  const showEma50 = useSettingsStore((s) => s.showEma50);
  const setShowEma50 = useSettingsStore((s) => s.setShowEma50);
  const showEma200 = useSettingsStore((s) => s.showEma200);
  const setShowEma200 = useSettingsStore((s) => s.setShowEma200);
  const showBollinger = useSettingsStore((s) => s.showBollinger);
  const setShowBollinger = useSettingsStore((s) => s.setShowBollinger);
  const showMacd = useSettingsStore((s) => s.showMacd);
  const setShowMacd = useSettingsStore((s) => s.setShowMacd);
  const showRejectionBlocks = useSettingsStore((s) => s.showRejectionBlocks);
  const setShowRejectionBlocks = useSettingsStore((s) => s.setShowRejectionBlocks);
  const priorityThreshold = useSettingsStore((s) => s.priorityThreshold);
  const setPriorityThreshold = useSettingsStore((s) => s.setPriorityThreshold);
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-sm flex-col border-l border-base-800 bg-base-950 animate-slide-up">
        <div className="flex items-center justify-between border-b border-base-800 px-4 py-3">
          <h2 className="text-sm font-bold text-base-100">Настройки</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-base-400 transition hover:bg-base-800 hover:text-base-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <Section title="Индикаторы">
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map((f) => (
                <NumberInput
                  key={f.key}
                  label={f.label}
                  value={indicators[f.key]}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  onChange={(v) => setIndicators({ [f.key]: v })}
                />
              ))}
            </div>
          </Section>

          <Section title="Активные индикаторы">
            <div className="flex flex-wrap gap-1.5">
              {ALL_INDICATOR_FEATURES.map((ind: string) => (
                <Chip
                  key={ind}
                  label={ind.toUpperCase()}
                  active={activeIndicators.includes(ind)}
                  onToggle={() =>
                    setActiveIndicators(
                      activeIndicators.includes(ind)
                        ? activeIndicators.filter((x) => x !== ind)
                        : [...activeIndicators, ind],
                    )
                  }
                />
              ))}
            </div>
          </Section>

          <Section title="Активные паттерны">
            <div className="flex flex-wrap gap-1.5">
              {ALL_PATTERNS.map((p) => (
                <Chip
                  key={p}
                  label={p.replace(/-/g, ' ')}
                  active={activePatterns.includes(p)}
                  onToggle={() =>
                    setActivePatterns(
                      activePatterns.includes(p)
                        ? activePatterns.filter((x) => x !== p)
                        : [...activePatterns, p],
                    )
                  }
                />
              ))}
            </div>
          </Section>

          <Section title="Сигнальный движок">
            <NumberInput
              label="Множитель ATR"
              value={atrMultiplier}
              min={0.5}
              max={5}
              step={0.1}
              onChange={setAtrMultiplier}
            />
            <div className="mt-2 flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-base-200">
                <Layers size={14} className="text-secondary-400" />
                <span>Слой BOS</span>
              </div>
              <Toggle on={showBosLayer} onToggle={() => setShowBosLayer(!showBosLayer)} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-base-200">
                <Box size={14} className="text-success-400" />
                <span>Ордер-блоки</span>
              </div>
              <Toggle on={showOrderBlocks} onToggle={() => setShowOrderBlocks(!showOrderBlocks)} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-base-200">
                <BarChart3 size={14} className="text-secondary-400" />
                <span>Имбалансы (FVG)</span>
              </div>
              <Toggle on={showImbalances} onToggle={() => setShowImbalances(!showImbalances)} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-base-200">
                <LineChart size={14} className="text-primary-400" />
                <span>Поддержка / Сопротивление</span>
              </div>
              <Toggle on={showSupportResistance} onToggle={() => setShowSupportResistance(!showSupportResistance)} />
            </div>
          </Section>

          <Section title="Слои графика">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  <span className="h-2 w-2 rounded-sm bg-amber-500" />
                  <span>EMA 20</span>
                </div>
                <Toggle on={showEma20} onToggle={() => setShowEma20(!showEma20)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  <span className="h-2 w-2 rounded-sm bg-blue-500" />
                  <span>EMA 50</span>
                </div>
                <Toggle on={showEma50} onToggle={() => setShowEma50(!showEma50)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  <span className="h-2 w-2 rounded-sm bg-purple-500" />
                  <span>EMA 200</span>
                </div>
                <Toggle on={showEma200} onToggle={() => setShowEma200(!showEma200)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  <BarChart3 size={14} className="text-blue-400" />
                  <span>Bollinger Bands</span>
                </div>
                <Toggle on={showBollinger} onToggle={() => setShowBollinger(!showBollinger)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  <BarChart3 size={14} className="text-success-400" />
                  <span>MACD</span>
                </div>
                <Toggle on={showMacd} onToggle={() => setShowMacd(!showMacd)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  <Box size={14} className="text-teal-400" />
                  <span>Rejection Blocks</span>
                </div>
                <Toggle on={showRejectionBlocks} onToggle={() => setShowRejectionBlocks(!showRejectionBlocks)} />
              </div>
            </div>
          </Section>

          <Section title="Звуковые уведомления">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  {soundNewSignal ? <Volume2 size={14} className="text-secondary-400" /> : <VolumeX size={14} className="text-base-500" />}
                  <span>Новый сигнал</span>
                </div>
                <Toggle on={soundNewSignal} onToggle={() => setSoundNewSignal(!soundNewSignal)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-base-200">
                  {soundPrioritySignal ? <Volume2 size={14} className="text-secondary-400" /> : <VolumeX size={14} className="text-base-500" />}
                  <span>Приоритетный сигнал</span>
                </div>
                <Toggle on={soundPrioritySignal} onToggle={() => setSoundPrioritySignal(!soundPrioritySignal)} />
              </div>
            </div>
          </Section>

          <Section title="Чувствительность">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSensitivity('soft')}
                className={clsx(
                  'rounded-lg px-3 py-2.5 text-xs font-semibold transition',
                  sensitivity === 'soft' ? 'bg-secondary-600 text-white' : 'bg-base-800 text-base-300 hover:text-base-100',
                )}
              >
                Мягкая
              </button>
              <button
                onClick={() => setSensitivity('strict')}
                className={clsx(
                  'rounded-lg px-3 py-2.5 text-xs font-semibold transition',
                  sensitivity === 'strict' ? 'bg-secondary-600 text-white' : 'bg-base-800 text-base-300 hover:text-base-100',
                )}
              >
                Строгая
              </button>
            </div>
            <p className="mt-2 text-2xs text-base-500">
              {sensitivity === 'soft'
                ? 'Больше сигналов, ниже порог уверенности.'
                : 'Меньше сигналов, только высокоуверенные сетапы.'}
            </p>
          </Section>

          <Section title="Подключение">
            <p className="mb-2 text-2xs text-base-500">
              API-ключи для Gemini, TwelveData и Finnhub теперь хранятся на сервере и не требуются на клиенте.
            </p>
            <div className="flex flex-col gap-2">
              {API_KEYS.map((k) => (
                <div key={k.key} className="flex flex-col gap-0.5">
                  <KeyInput
                    label={k.label}
                    placeholder={k.placeholder}
                    value={apiKeys[k.key]}
                    onChange={(v) => handleApiKeyChange(k.key, v)}
                  />
                  {k.key === 'derivAppId' && apiKeys.derivAppId === DERIV_DEFAULT_APP_ID && (
                    <div className="mt-1 flex flex-col gap-1 rounded-md bg-warning-700/20 px-2 py-1.5 text-2xs text-warning-400">
                      <div className="flex items-center gap-1">
                        <AlertTriangle size={10} />
                        Используется публичный демо App ID — возможны разрывы соединения и ограничения скорости.
                      </div>
                      <span className="text-base-500">
                        Зарегистрируйте свой App ID на api.deriv.com/dashboard и введите его здесь — это снизит частоту разрывов соединения.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Приоритетные уведомления">
            <p className="mb-2 text-2xs text-base-500">
              Сильные сигналы с уверенностью выше этого порога вызывают приоритетный баннер и отдельный звук.
            </p>
            <NumberInput
              label="Порог приоритета"
              value={priorityThreshold}
              min={0.5}
              max={0.95}
              step={0.05}
              onChange={setPriorityThreshold}
            />
            <p className="mt-1 text-2xs font-mono text-base-400">
              Текущий: {(priorityThreshold * 100).toFixed(0)}%
            </p>
          </Section>

          <Section title="Таймфрейм по умолчанию">
            <div className="flex flex-wrap gap-1.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={clsx(
                    'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                    tf === timeframe ? 'bg-primary-600 text-white' : 'bg-base-800 text-base-300 hover:text-base-100',
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Обучение">
            <button
              onClick={() => setShowEducation(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-800 bg-base-900 px-3 py-2.5 text-xs font-semibold text-base-200 transition hover:bg-base-800"
            >
              <GraduationCap size={14} className="text-secondary-400" />
              Учебный курс
            </button>
          </Section>

          <Section title="Введение и сброс">
            <button
              onClick={() => {
                setOnboardingCompleted(false);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-800 bg-base-900 px-3 py-2.5 text-xs font-semibold text-base-200 transition hover:bg-base-800"
            >
              <RotateCcw size={14} className="text-secondary-400" />
              Показать введение снова
            </button>
          </Section>
        </div>
      </div>
      {showEducation && (
        <Suspense fallback={null}>
          <Education onClose={() => setShowEducation(false)} />
        </Suspense>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-2xs font-bold uppercase tracking-wider text-base-400">{title}</h3>
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-2xs text-base-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="rounded-md border border-base-800 bg-base-900 px-2 py-1.5 font-mono text-xs text-base-100 outline-none transition focus:border-secondary-600"
      />
    </label>
  );
}

function KeyInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-2xs text-base-400">
        <Key size={10} />
        {label}
      </span>
      <input
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-base-800 bg-base-900 px-2 py-1.5 text-xs text-base-100 outline-none transition focus:border-secondary-600"
      />
    </label>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        'relative h-5 w-9 rounded-full transition',
        on ? 'bg-secondary-600' : 'bg-base-700',
      )}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
        style={{ left: on ? '1.125rem' : '0.125rem' }}
      />
    </button>
  );
}

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        'rounded-md px-2.5 py-1 text-xs font-semibold transition',
        active ? 'bg-secondary-700/40 text-secondary-400' : 'bg-base-800 text-base-400 hover:text-base-200',
      )}
    >
      {label}
    </button>
  );
}
