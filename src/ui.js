import {
  BALL_LIMITS,
  DEFAULT_BALL_SETTINGS,
  EXPERIMENT_LIMITS,
  createDefaultBalls,
  formatMetric,
  normalizeBallSettings,
  normalizeExperimentConfig,
} from './config.js';

const statusLabels = {
  ready: 'Ready',
  dragging: 'Dragging',
  released: 'Released',
};

export function createLabUi({ defaultConfig, onStart, onUpdate, onReset }) {
  const configScreen = document.querySelector('#config-screen');
  const configForm = document.querySelector('#config-form');
  const ballCountInput = document.querySelector('#ball-count');
  const ballCountOutput = document.querySelector('#ball-count-output');
  const initialStringLengthInput = document.querySelector('#initial-string-length');
  const initialRadiusInput = document.querySelector('#initial-radius');
  const initialMassInput = document.querySelector('#initial-mass');
  const initialGravityInput = document.querySelector('#initial-gravity');
  const materialSelect = document.querySelector('#ball-material');
  const experimentPanel = document.querySelector('#experiment-panel');
  const panelToggleButton = document.querySelector('#panel-toggle-button');
  const resetButton = document.querySelector('#reset-button');

  const panelBallCount = document.querySelector('#panel-ball-count');
  const panelStringLength = document.querySelector('#panel-string-length');
  const panelRadius = document.querySelector('#panel-radius');
  const panelMass = document.querySelector('#panel-mass');
  const panelMaterial = document.querySelector('#panel-material');
  const panelGravity = document.querySelector('#panel-gravity');
  const panelStatus = document.querySelector('#panel-status');

  const editTargetSelect = document.querySelector('#edit-target');
  const editStringLengthInput = document.querySelector('#edit-string-length');
  const editRadiusInput = document.querySelector('#edit-radius');
  const editMassInput = document.querySelector('#edit-mass');
  const editMaterialSelect = document.querySelector('#edit-material');
  const editGravityInput = document.querySelector('#edit-gravity');
  const ballCredentialList = document.querySelector('#ball-credential-list');

  let currentConfig = normalizeExperimentConfig(defaultConfig);
  let activeTarget = 'all';
  let isParameterPanelVisible = true;

  applyInputLimits();

  function readConfigFromForm() {
    const ballCount = Number(ballCountInput.value);
    const seed = normalizeBallSettings({
      stringLength: initialStringLengthInput.value,
      radius: initialRadiusInput.value,
      mass: initialMassInput.value,
    });

    return normalizeExperimentConfig({
      ballCount,
      gravityAcceleration: initialGravityInput.value,
      materialType: materialSelect.value,
      balls: createDefaultBalls(ballCount, seed),
    });
  }

  function writeConfigToForm(config) {
    const normalizedConfig = normalizeExperimentConfig(config);
    const firstBall = normalizedConfig.balls[0] ?? DEFAULT_BALL_SETTINGS;

    currentConfig = normalizedConfig;
    ballCountInput.value = String(normalizedConfig.ballCount);
    ballCountOutput.value = String(normalizedConfig.ballCount);
    initialStringLengthInput.value = formatInputNumber(firstBall.stringLength);
    initialRadiusInput.value = formatInputNumber(firstBall.radius);
    initialMassInput.value = formatInputNumber(firstBall.mass);
    initialGravityInput.value = formatInputNumber(normalizedConfig.gravityAcceleration);
    materialSelect.value = normalizedConfig.materialType;
  }

  function updateInfoPanel(config = currentConfig) {
    const balls = config.balls;

    panelBallCount.textContent = config.ballCount;
    panelStringLength.textContent = formatRange(
      balls.map((ball) => ball.stringLength),
      ' m',
    );
    panelRadius.textContent = formatRange(
      balls.map((ball) => ball.radius),
      ' m',
    );
    panelMass.textContent = formatRange(
      balls.map((ball) => ball.mass),
      ' kg',
    );
    panelMaterial.textContent = config.materialType;
    panelGravity.textContent = `${formatMetric(config.gravityAcceleration)} m/s^2`;
  }

  function setStatus(status) {
    panelStatus.textContent = statusLabels[status] ?? status;
  }

  function showConfiguration(config = defaultConfig) {
    writeConfigToForm(config);
    setStatus('ready');
    configScreen.classList.remove('is-hidden');
    experimentPanel.classList.add('is-hidden');
    panelToggleButton.classList.add('is-hidden');
  }

  function showExperiment(config) {
    currentConfig = normalizeExperimentConfig(config);
    activeTarget = 'all';
    isParameterPanelVisible = true;
    renderTargetOptions();
    renderBallCredentialRows();
    updateInfoPanel(currentConfig);
    writeEditorFields();
    syncBallCredentialRows();
    syncParameterPanelVisibility();
    setStatus('ready');
    configScreen.classList.add('is-hidden');
    panelToggleButton.classList.remove('is-hidden');
  }

  function syncParameterPanelVisibility() {
    experimentPanel.classList.toggle('is-hidden', !isParameterPanelVisible);
    panelToggleButton.textContent = isParameterPanelVisible
      ? 'Hide Parameters'
      : 'Show Parameters';
    panelToggleButton.setAttribute('aria-expanded', String(isParameterPanelVisible));
  }

  function renderTargetOptions() {
    const previousTarget = activeTarget;

    editTargetSelect.replaceChildren();
    editTargetSelect.add(new Option('All Balls', 'all'));

    currentConfig.balls.forEach((_, index) => {
      editTargetSelect.add(new Option(`Ball ${index + 1}`, `ball-${index}`));
    });

    activeTarget = isValidTarget(previousTarget) ? previousTarget : 'all';
    editTargetSelect.value = activeTarget;
  }

  function writeEditorFields({ preserveActive = false } = {}) {
    editTargetSelect.value = activeTarget;
    editMaterialSelect.value = currentConfig.materialType;

    writeGravityField(preserveActive);
    updateStringLengthMinimum(editStringLengthInput);
    writeNumberField(editStringLengthInput, 'stringLength', preserveActive);
    writeNumberField(editRadiusInput, 'radius', preserveActive);
    writeNumberField(editMassInput, 'mass', preserveActive);
  }

  function writeGravityField(preserveActive) {
    if (preserveActive && document.activeElement === editGravityInput) {
      return;
    }

    editGravityInput.value = formatInputNumber(currentConfig.gravityAcceleration);
  }

  function writeNumberField(input, property, preserveActive) {
    if (preserveActive && document.activeElement === input) {
      return;
    }

    const value = getSharedTargetValue(property);

    if (value === null) {
      input.value = '';
      input.placeholder = 'Mixed';
      return;
    }

    input.placeholder = '';
    input.value = formatInputNumber(value);
  }

  function getSharedTargetValue(property) {
    const targetBalls = getTargetBalls();
    const firstValue = targetBalls[0]?.[property];

    if (firstValue === undefined) {
      return null;
    }

    const hasMixedValues = targetBalls.some(
      (ball) => Math.abs(ball[property] - firstValue) > 0.0005,
    );

    return hasMixedValues ? null : firstValue;
  }

  function getTargetBalls() {
    if (activeTarget === 'all') {
      return currentConfig.balls;
    }

    const targetIndex = getTargetIndex();

    return currentConfig.balls[targetIndex] ? [currentConfig.balls[targetIndex]] : [];
  }

  function getTargetIndex() {
    return Number(activeTarget.replace('ball-', ''));
  }

  function isValidTarget(target) {
    if (target === 'all') {
      return true;
    }

    const targetIndex = Number(target.replace('ball-', ''));

    return Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < currentConfig.ballCount;
  }

  function applyNumberEdit(property, rawValue) {
    if (rawValue === '') {
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      return;
    }

    currentConfig = normalizeExperimentConfig({
      ...currentConfig,
      balls: currentConfig.balls.map((ball, index) => {
        if (activeTarget !== 'all' && index !== getTargetIndex()) {
          return ball;
        }

        return normalizeBallSettings({
          ...ball,
          [property]: value,
        });
      }),
    });

    emitLiveUpdate();
  }

  function applyMaterialEdit(materialType) {
    currentConfig = normalizeExperimentConfig({
      ...currentConfig,
      materialType,
    });

    emitLiveUpdate();
  }

  function applyGravityEdit(rawValue) {
    if (rawValue === '') {
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      return;
    }

    currentConfig = normalizeExperimentConfig({
      ...currentConfig,
      gravityAcceleration: value,
    });

    emitLiveUpdate();
  }

  function emitLiveUpdate() {
    onUpdate(currentConfig);
    updateInfoPanel(currentConfig);
    writeEditorFields({ preserveActive: true });
    syncBallCredentialRows({ preserveActive: true });
  }

  function renderBallCredentialRows() {
    const fragment = document.createDocumentFragment();

    currentConfig.balls.forEach((ball, index) => {
      const row = document.createElement('div');
      row.className = 'ball-credential-row';
      row.dataset.ballIndex = String(index);

      const label = document.createElement('div');
      label.className = 'ball-row-label';
      label.textContent = `Ball ${index + 1}`;

      row.append(
        label,
        createCredentialField(index, 'stringLength', 'Thread', ball),
        createCredentialField(index, 'radius', 'Radius', ball),
        createCredentialField(index, 'mass', 'Weight', ball),
      );
      fragment.append(row);
    });

    ballCredentialList.replaceChildren(fragment);
  }

  function createCredentialField(index, property, label, ball) {
    const field = document.createElement('label');
    field.className = 'micro-field';

    const fieldLabel = document.createElement('span');
    fieldLabel.textContent = label;

    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.ballIndex = String(index);
    input.dataset.credential = property;
    applyCredentialLimits(input, property, ball);
    input.value = formatInputNumber(ball[property]);

    field.append(fieldLabel, input);

    return field;
  }

  function syncBallCredentialRows({ preserveActive = false } = {}) {
    for (const input of ballCredentialList.querySelectorAll('input[data-credential]')) {
      const ball = currentConfig.balls[Number(input.dataset.ballIndex)];

      if (!ball) {
        continue;
      }

      const property = input.dataset.credential;
      applyCredentialLimits(input, property, ball);

      if (preserveActive && document.activeElement === input) {
        continue;
      }

      input.value = formatInputNumber(ball[property]);
    }
  }

  function applyCredentialLimits(input, property, ball) {
    if (property === 'stringLength') {
      input.min = formatInputNumber(Math.max(BALL_LIMITS.stringLength.min, ball.radius + 0.18));
      input.max = BALL_LIMITS.stringLength.max;
      input.step = BALL_LIMITS.stringLength.step;
      return;
    }

    setNumberLimits(input, BALL_LIMITS[property]);
  }

  function applyBallCredentialEdit(ballIndex, property, rawValue) {
    if (rawValue === '') {
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || !currentConfig.balls[ballIndex]) {
      return;
    }

    currentConfig = normalizeExperimentConfig({
      ...currentConfig,
      balls: currentConfig.balls.map((ball, index) => {
        if (index !== ballIndex) {
          return ball;
        }

        return normalizeBallSettings({
          ...ball,
          [property]: value,
        });
      }),
    });

    emitLiveUpdate();
  }

  function applyInputLimits() {
    ballCountInput.min = BALL_LIMITS.count.min;
    ballCountInput.max = BALL_LIMITS.count.max;
    ballCountInput.step = BALL_LIMITS.count.step;

    setNumberLimits(initialStringLengthInput, BALL_LIMITS.stringLength);
    setNumberLimits(initialRadiusInput, BALL_LIMITS.radius);
    setNumberLimits(initialMassInput, BALL_LIMITS.mass);
    setNumberLimits(initialGravityInput, EXPERIMENT_LIMITS.gravityAcceleration);
    setNumberLimits(editStringLengthInput, BALL_LIMITS.stringLength);
    setNumberLimits(editRadiusInput, BALL_LIMITS.radius);
    setNumberLimits(editMassInput, BALL_LIMITS.mass);
    setNumberLimits(editGravityInput, EXPERIMENT_LIMITS.gravityAcceleration);
  }

  function setNumberLimits(input, limits) {
    input.min = limits.min;
    input.max = limits.max;
    input.step = limits.step;
  }

  function updateStringLengthMinimum(input) {
    const targetRadii = getTargetBalls().map((ball) => ball.radius);
    const minimumRadius =
      targetRadii.length > 0 ? Math.max(...targetRadii) : DEFAULT_BALL_SETTINGS.radius;

    input.min = formatInputNumber(Math.max(BALL_LIMITS.stringLength.min, minimumRadius + 0.18));
  }

  ballCountInput.addEventListener('input', () => {
    ballCountOutput.value = ballCountInput.value;
  });

  configForm.addEventListener('submit', (event) => {
    event.preventDefault();
    onStart(readConfigFromForm());
  });

  editTargetSelect.addEventListener('change', () => {
    activeTarget = editTargetSelect.value;
    writeEditorFields();
  });

  editStringLengthInput.addEventListener('input', () => {
    applyNumberEdit('stringLength', editStringLengthInput.value);
  });

  editRadiusInput.addEventListener('input', () => {
    applyNumberEdit('radius', editRadiusInput.value);
  });

  editMassInput.addEventListener('input', () => {
    applyNumberEdit('mass', editMassInput.value);
  });

  editMaterialSelect.addEventListener('change', () => {
    applyMaterialEdit(editMaterialSelect.value);
  });

  editGravityInput.addEventListener('input', () => {
    applyGravityEdit(editGravityInput.value);
  });

  ballCredentialList.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-ball-index][data-credential]');

    if (!input) {
      return;
    }

    applyBallCredentialEdit(
      Number(input.dataset.ballIndex),
      input.dataset.credential,
      input.value,
    );
  });

  ballCredentialList.addEventListener('change', () => {
    syncBallCredentialRows();
    writeEditorFields();
  });

  panelToggleButton.addEventListener('click', () => {
    isParameterPanelVisible = !isParameterPanelVisible;
    syncParameterPanelVisibility();
  });

  resetButton.addEventListener('click', () => {
    onReset();
  });

  return {
    setStatus,
    showConfiguration,
    showExperiment,
  };
}

function formatInputNumber(value) {
  return String(Math.round(value * 1000) / 1000);
}

function formatRange(values, unit) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  if (Math.abs(maximum - minimum) < 0.0005) {
    return `${formatMetric(minimum)}${unit}`;
  }

  return `${formatMetric(minimum)}-${formatMetric(maximum)}${unit}`;
}
