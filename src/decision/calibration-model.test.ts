import { describe, it, expect } from 'vitest';
import { CalibrationModel, MIN_SAMPLES, persistCalibrationState, loadCalibrationState } from './calibration-model';

describe('CalibrationModel', () => {
  it('starts not ready with 0 samples', () => {
    const model = new CalibrationModel(3);
    expect(model.isReady()).toBe(false);
    expect(model.getSampleCount()).toBe(0);
  });

  it('becomes ready after MIN_SAMPLES', () => {
    const model = new CalibrationModel(2);
    for (let i = 0; i < MIN_SAMPLES; i++) {
      model.addSample({ features: [0.5, 0.3], score: 3, outcome: i % 2 === 0 ? 1 : 0 });
    }
    expect(model.isReady()).toBe(true);
    expect(model.getSampleCount()).toBe(MIN_SAMPLES);
  });

  it('predicts a value in [0, 1] after training', () => {
    const model = new CalibrationModel(2);
    for (let i = 0; i < 20; i++) {
      model.addSample({
        features: [0.8, 0.6],
        score: 4,
        outcome: 1,
      });
    }
    for (let i = 0; i < 20; i++) {
      model.addSample({
        features: [0.2, 0.1],
        score: 1,
        outcome: 0,
      });
    }
    model.retrain();
    const predHigh = model.predict([0.8, 0.6]);
    const predLow = model.predict([0.2, 0.1]);
    expect(predHigh).toBeGreaterThan(predLow);
    expect(predHigh).toBeGreaterThan(0.5);
    expect(predLow).toBeLessThan(0.5);
  });

  it('caps samples at 500', () => {
    const model = new CalibrationModel(1);
    for (let i = 0; i < 600; i++) {
      model.addSample({ features: [i / 600], score: 1, outcome: 1 });
    }
    expect(model.getSampleCount()).toBe(500);
  });

  it('exportState and loadState round-trip', () => {
    const model = new CalibrationModel(2);
    for (let i = 0; i < 15; i++) {
      model.addSample({ features: [0.5, 0.3], score: 3, outcome: i % 2 === 0 ? 1 : 0 });
    }
    model.retrain();
    const state = model.exportState();

    const model2 = new CalibrationModel(2);
    model2.loadState(state);
    const state2 = model2.exportState();
    expect(state2.weights).toEqual(state.weights);
    expect(state2.bias).toBe(state.bias);
    expect(model2.getSampleCount()).toBe(state.sampleCount);
  });

  it('persists and loads from localStorage', () => {
    const model = new CalibrationModel(2);
    for (let i = 0; i < 12; i++) {
      model.addSample({ features: [0.5, 0.3], score: 3, outcome: 1 });
    }
    model.retrain();
    persistCalibrationState(model);

    const loaded = loadCalibrationState(2);
    expect(loaded).not.toBeNull();
    expect(loaded!.getSampleCount()).toBe(12);
    expect(loaded!.isReady()).toBe(true);
  });

  it('returns null for wrong feature count on load', () => {
    const model = new CalibrationModel(2);
    model.addSample({ features: [0.5, 0.3], score: 3, outcome: 1 });
    persistCalibrationState(model);
    expect(loadCalibrationState(3)).toBeNull();
  });
});
