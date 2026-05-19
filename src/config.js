export const BALL_LIMITS = {
  count: {
    min: 3,
    max: 9,
    step: 1,
  },
  radius: {
    min: 0.12,
    max: 1.4,
    step: 0.01,
  },
  stringLength: {
    min: 0.55,
    max: 5.5,
    step: 0.01,
  },
  mass: {
    min: 0.05,
    max: 150,
    step: 0.01,
  },
};

export const EXPERIMENT_LIMITS = {
  gravityAcceleration: {
    min: 0,
    max: 50,
    step: 0.01,
  },
};

export const DEFAULT_BALL_SETTINGS = {
  stringLength: 2.12,
  radius: 0.42,
  mass: 1.15,
};

export const DEFAULT_CONFIG = {
  ballCount: 5,
  gravityAcceleration: 9.82,
  materialType: 'Plastic',
  balls: createDefaultBalls(5),
};

export function createDefaultBalls(ballCount, seed = DEFAULT_BALL_SETTINGS) {
  const count = clampInteger(ballCount, BALL_LIMITS.count.min, BALL_LIMITS.count.max, 5);
  const source = normalizeBallSettings(seed);

  return Array.from({ length: count }, () => ({ ...source }));
}

export function normalizeExperimentConfig(config = DEFAULT_CONFIG) {
  const ballCount = clampInteger(
    config.ballCount,
    BALL_LIMITS.count.min,
    BALL_LIMITS.count.max,
    DEFAULT_CONFIG.ballCount,
  );
  const sourceBalls = Array.isArray(config.balls) ? config.balls : [];
  const fallbackBall = normalizeBallSettings({
    stringLength: config.stringLength,
    radius: config.radius,
    mass: config.mass,
  });
  const balls = Array.from({ length: ballCount }, (_, index) => {
    const source = sourceBalls[index] ?? sourceBalls[sourceBalls.length - 1] ?? fallbackBall;

    return normalizeBallSettings(source);
  });

  return {
    ballCount,
    gravityAcceleration: roundMetric(
      clampNumber(
        config.gravityAcceleration ?? config.gravity,
        EXPERIMENT_LIMITS.gravityAcceleration.min,
        EXPERIMENT_LIMITS.gravityAcceleration.max,
        DEFAULT_CONFIG.gravityAcceleration,
      ),
    ),
    materialType: normalizeMaterial(config.materialType),
    balls,
  };
}

export function normalizeBallSettings(settings = DEFAULT_BALL_SETTINGS) {
  const radius = roundMetric(
    clampNumber(
      settings.radius,
      BALL_LIMITS.radius.min,
      BALL_LIMITS.radius.max,
      DEFAULT_BALL_SETTINGS.radius,
    ),
  );
  const minimumLogicalLength = Math.max(BALL_LIMITS.stringLength.min, radius + 0.18);
  const stringLength = roundMetric(
    clampNumber(
      settings.stringLength,
      minimumLogicalLength,
      BALL_LIMITS.stringLength.max,
      Math.max(DEFAULT_BALL_SETTINGS.stringLength, minimumLogicalLength),
    ),
  );
  const mass = roundMetric(
    clampNumber(
      settings.mass,
      BALL_LIMITS.mass.min,
      BALL_LIMITS.mass.max,
      DEFAULT_BALL_SETTINGS.mass,
    ),
  );

  return {
    stringLength,
    radius,
    mass,
  };
}

export function formatMetric(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function normalizeMaterial(materialType) {
  const material = typeof materialType === 'string' ? materialType : DEFAULT_CONFIG.materialType;

  return ['Wood', 'Plastic', 'Metal'].includes(material) ? material : DEFAULT_CONFIG.materialType;
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}
