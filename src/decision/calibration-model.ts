import type { CalibrationState } from '@/types/domain';

export const MIN_SAMPLES = 10;
const MAX_SAMPLES = 500;
const LEARNING_RATE = 0.1;
const EPOCHS = 500;
const L2_REGULARIZATION = 0.0001;
const STORAGE_KEY = 'terminal-calibration-v1';

export interface CalibrationSample {
  features: number[];
  score: number;
  outcome: 1 | 0;
}

interface TrainingResult {
  weights: number[];
  bias: number;
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export class CalibrationModel {
  private weights: number[];
  private bias: number;
  private samples: CalibrationSample[] = [];
  private featureCount: number;
  private restoredSampleCount = 0;

  constructor(featureCount: number) {
    this.featureCount = featureCount;
    this.weights = new Array<number>(featureCount).fill(0);
    this.bias = 0;
  }

  isReady(): boolean {
    return this.getSampleCount() >= MIN_SAMPLES;
  }

  getSampleCount(): number {
    return Math.max(this.samples.length, this.restoredSampleCount);
  }

  addSample(sample: CalibrationSample): void {
    if (sample.features.length !== this.featureCount) return;
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift();
    }
  }

  predict(features: number[]): number {
    if (features.length !== this.featureCount) return sigmoid(0);
    let z = this.bias;
    for (let i = 0; i < this.featureCount; i++) {
      z += this.weights[i] * features[i];
    }
    return sigmoid(z);
  }

  retrain(): void {
    if (this.samples.length < MIN_SAMPLES) return;
    const result = this.trainLogisticRegression(this.samples);
    this.weights = result.weights;
    this.bias = result.bias;
  }

  private trainLogisticRegression(samples: CalibrationSample[]): TrainingResult {
    const n = samples.length;
    const w = new Array<number>(this.featureCount).fill(0);
    let b = 0;

    for (let epoch = 0; epoch < EPOCHS; epoch++) {
      const gradW = new Array<number>(this.featureCount).fill(0);
      let gradB = 0;

      for (const s of samples) {
        let z = b;
        for (let i = 0; i < this.featureCount; i++) {
          z += w[i] * s.features[i];
        }
        const pred = sigmoid(z);
        const err = pred - s.outcome;
        for (let i = 0; i < this.featureCount; i++) {
          gradW[i] += err * s.features[i];
        }
        gradB += err;
      }

      for (let i = 0; i < this.featureCount; i++) {
        gradW[i] = gradW[i] / n + L2_REGULARIZATION * w[i];
        w[i] -= LEARNING_RATE * gradW[i];
      }
      b -= LEARNING_RATE * (gradB / n);
    }

    return { weights: w, bias: b };
  }

  exportState(): CalibrationState {
    return {
      weights: [...this.weights],
      bias: this.bias,
      sampleCount: this.getSampleCount(),
    };
  }

  loadState(state: CalibrationState): void {
    if (state.weights.length !== this.featureCount) return;
    this.weights = [...state.weights];
    this.bias = state.bias;
    this.restoredSampleCount = state.sampleCount;
  }

  loadSamples(samples: CalibrationSample[]): void {
    this.samples = samples.slice(-MAX_SAMPLES);
  }

  getSamples(): CalibrationSample[] {
    return [...this.samples];
  }
}

export function loadCalibrationState(featureCount: number): CalibrationModel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state: CalibrationState; samples: CalibrationSample[] };
    if (!parsed.state || parsed.state.weights.length !== featureCount) return null;
    const model = new CalibrationModel(featureCount);
    model.loadState(parsed.state);
    if (Array.isArray(parsed.samples)) {
      model.loadSamples(parsed.samples);
    }
    return model;
  } catch {
    return null;
  }
}

export function persistCalibrationState(model: CalibrationModel): void {
  try {
    const data = JSON.stringify({
      state: model.exportState(),
      samples: model.getSamples(),
    });
    localStorage.setItem(STORAGE_KEY, data);
  } catch {
    // localStorage may be unavailable — non-fatal
  }
}
