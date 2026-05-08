const statusLabels = {
  ready: 'Ready',
  dragging: 'Dragging',
  released: 'Released',
};

export function createLabUi({ defaultConfig, onStart, onReset }) {
  const configScreen = document.querySelector('#config-screen');
  const configForm = document.querySelector('#config-form');
  const ballCountInput = document.querySelector('#ball-count');
  const ballCountOutput = document.querySelector('#ball-count-output');
  const weightSelect = document.querySelector('#ball-weight');
  const materialSelect = document.querySelector('#ball-material');
  const experimentPanel = document.querySelector('#experiment-panel');
  const resetButton = document.querySelector('#reset-button');

  const panelBallCount = document.querySelector('#panel-ball-count');
  const panelWeight = document.querySelector('#panel-weight');
  const panelMaterial = document.querySelector('#panel-material');
  const panelStatus = document.querySelector('#panel-status');

  function readConfigFromForm() {
    return {
      ballCount: Number(ballCountInput.value),
      weight: weightSelect.value,
      materialType: materialSelect.value,
    };
  }

  function writeConfigToForm(config) {
    ballCountInput.value = String(config.ballCount);
    ballCountOutput.value = String(config.ballCount);
    weightSelect.value = config.weight;
    materialSelect.value = config.materialType;
  }

  function updateInfoPanel(config) {
    panelBallCount.textContent = config.ballCount;
    panelWeight.textContent = config.weight;
    panelMaterial.textContent = config.materialType;
  }

  function setStatus(status) {
    panelStatus.textContent = statusLabels[status] ?? status;
  }

  function showConfiguration(config = defaultConfig) {
    writeConfigToForm(config);
    setStatus('ready');
    configScreen.classList.remove('is-hidden');
    experimentPanel.classList.add('is-hidden');
  }

  function showExperiment(config) {
    updateInfoPanel(config);
    setStatus('ready');
    configScreen.classList.add('is-hidden');
    experimentPanel.classList.remove('is-hidden');
  }

  ballCountInput.addEventListener('input', () => {
    ballCountOutput.value = ballCountInput.value;
  });

  configForm.addEventListener('submit', (event) => {
    event.preventDefault();
    onStart(readConfigFromForm());
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
