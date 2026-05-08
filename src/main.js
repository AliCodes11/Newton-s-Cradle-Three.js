import './style.css';
import { createLabScene } from './cradle.js';
import { createLabUi } from './ui.js';

const defaultConfig = {
  ballCount: 5,
  weight: 'Medium',
  materialType: 'Plastic',
};

let experimentConfig = { ...defaultConfig };
let labScene = null;
let labUi = null;

export function startExperiment(config) {
  experimentConfig = { ...config };

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

export function resetExperiment() {
  experimentConfig = { ...defaultConfig };
  labScene?.resetExperiment();
  labUi.showConfiguration(experimentConfig);

  // Physics connection point:
  // Clear positions, velocities, constraints, and simulation timers here.
}

labUi = createLabUi({
  defaultConfig,
  onStart: startExperiment,
  onReset: resetExperiment,
});

labUi.showConfiguration(defaultConfig);
