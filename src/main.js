import './style.css';
import { DEFAULT_CONFIG, normalizeExperimentConfig } from './config.js';
import { createLabScene } from './cradle.js';
import { createLabUi } from './ui.js';

let experimentConfig = normalizeExperimentConfig(DEFAULT_CONFIG);
let labScene = null;
let labUi = null;

export function startExperiment(config) {
  experimentConfig = normalizeExperimentConfig(config);

  if (!labScene) {
    labScene = createLabScene({
      canvas: document.querySelector('#scene-canvas'),
      onStatusChange: (status) => labUi?.setStatus(status),
    });
  }

  labScene.createCradle(experimentConfig);
  labScene.animate();
  labUi.showExperiment(experimentConfig);

  // Physics connection point:
  // Initialize your simulation state here using experimentConfig.
}

export function updateExperimentConfig(config) {
  experimentConfig = normalizeExperimentConfig(config);
  labScene?.updateCradleConfig(experimentConfig);

  // Physics connection point:
  // Sync changed radii, thread lengths, ball masses, and gravity here.
}

export function resetExperiment() {
  experimentConfig = normalizeExperimentConfig(DEFAULT_CONFIG);
  labScene?.resetExperiment();
  labUi.showConfiguration(experimentConfig);

  // Physics connection point:
  // Clear positions, velocities, constraints, and simulation timers here.
}

labUi = createLabUi({
  defaultConfig: DEFAULT_CONFIG,
  onStart: startExperiment,
  onUpdate: updateExperimentConfig,
  onReset: resetExperiment,
});

labUi.showConfiguration(experimentConfig);
