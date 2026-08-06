import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Activity, ShieldAlert, Volume2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { clsx } from '@/lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = ['welcome', 'signals', 'risk', 'sound'] as const;
type Step = (typeof STEPS)[number];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');
  const soundNewSignal = useSettingsStore((s) => s.soundNewSignal);
  const soundPrioritySignal = useSettingsStore((s) => s.soundPrioritySignal);
  const setSoundNewSignal = useSettingsStore((s) => s.setSoundNewSignal);
  const setSoundPrioritySignal = useSettingsStore((s) => s.setSoundPrioritySignal);
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted);

  const stepIndex = STEPS.indexOf(step);

  const finish = () => {
    setOnboardingCompleted(true);
    onComplete();
  };

  const next = () => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
    else finish();
  };

  const back = () => {
    const prevStep = STEPS[stepIndex - 1];
    if (prevStep) setStep(prevStep);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-base-950">
      <div className="flex items-center gap-1.5 px-4 pt-4">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={clsx(
              'h-1 flex-1 rounded-full transition',
              i <= stepIndex ? 'bg-secondary-500' : 'bg-base-800',
            )}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center px-6">
        {step === 'welcome' && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-700/20">
              <Activity size={32} className="text-secondary-400" />
            </div>
            <h1 className="text-2xl font-bold text-base-100">Торговый терминал</h1>
            <p className="mt-2 max-w-sm text-sm text-base-400">
              Анализ свечей в реальном времени с распознаванием паттернов, конfluence индикаторов
              и генерацией сигналов с помощью ИИ. Давайте настроим всё под вас.
            </p>
          </div>
        )}

        {step === 'signals' && (
          <div>
            <h2 className="mb-1 text-lg font-bold text-base-100">Как читать сигналы</h2>
            <p className="mb-4 text-sm text-base-400">
              Каждый сигнал содержит всё необходимое для оценки сделки:
            </p>
            <div className="flex flex-col gap-3">
              <InfoRow
                title="Направление и уверенность"
                desc="Покупка или продажа с оценкой уверенности от 0 до 100%."
              />
              <InfoRow
                title="Вход, стоп-лосс, тейк-профит"
                desc="Предрассчитанные ценовые уровни на основе волатильности (ATR)."
              />
              <InfoRow
                title="Сила сигнала"
                desc="Слабый, средний или сильный — на основе конfluence индикаторов."
              />
            </div>
          </div>
        )}

        {step === 'risk' && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert size={24} className="text-accent-400" />
              <h2 className="text-lg font-bold text-base-100">Дисклеймер о рисках</h2>
            </div>
            <div className="rounded-xl border border-accent-700/40 bg-accent-700/10 p-4">
              <p className="text-sm leading-relaxed text-base-300">
                Данный инструмент предназначен исключительно для образовательных и информационных целей.
                Он не является финансовой рекомендацией или советом для торговли.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-base-300">
                Торговля связана с существенным риском потери. Никогда не рискуйте больше, чем можете
                позволить себе потерять. Всегда проводите собственное исследование и проконсультируйтесь
                с лицензированным финансовым консультантом перед принятием инвестиционных решений.
              </p>
            </div>
            <p className="mt-3 text-xs text-base-500">
              Продолжая, вы подтверждаете, что понимаете и принимаете эти риски.
            </p>
          </div>
        )}

        {step === 'sound' && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Volume2 size={24} className="text-secondary-400" />
              <h2 className="text-lg font-bold text-base-100">Звуковые уведомления</h2>
            </div>
            <p className="mb-4 text-sm text-base-400">
              Получайте уведомления при появлении сигналов. Нажмите переключатель для предпросмотра (звук разблокируется при первом взаимодействии).
            </p>
            <div className="flex flex-col gap-2">
              <ToggleRow
                label="Новый сигнал"
                desc="Короткий тон при каждом новом сигнале."
                checked={soundNewSignal}
                onToggle={() => setSoundNewSignal(!soundNewSignal)}
              />
              <ToggleRow
                label="Приоритетный сигнал (сильный)"
                desc="Тройной тон для высокоуверенных сигналов."
                checked={soundPrioritySignal}
                onToggle={() => setSoundPrioritySignal(!soundPrioritySignal)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-6 pb-6">
        <button
          onClick={back}
          disabled={stepIndex === 0}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-base-400 transition hover:text-base-100 disabled:opacity-30"
        >
          <ArrowLeft size={16} />
          Назад
        </button>
        <button
          onClick={next}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
        >
          {stepIndex === STEPS.length - 1 ? (
            <>
              <Check size={16} />
              Понятно, начать
            </>
          ) : (
            <>
              Далее
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-base-800 bg-base-900 px-4 py-3">
      <div className="text-sm font-semibold text-base-100">{title}</div>
      <div className="mt-0.5 text-xs text-base-400">{desc}</div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onToggle,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        'flex items-center justify-between rounded-lg border px-4 py-3 text-left transition',
        checked ? 'border-secondary-600 bg-secondary-700/20' : 'border-base-800 bg-base-900',
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-base-100">{label}</span>
        <span className="text-xs text-base-400">{desc}</span>
      </div>
      <div
        className={clsx(
          'relative h-5 w-9 rounded-full transition',
          checked ? 'bg-secondary-600' : 'bg-base-700',
        )}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: checked ? '1.125rem' : '0.125rem' }}
        />
      </div>
    </button>
  );
}
