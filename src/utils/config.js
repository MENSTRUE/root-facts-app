export const APP_CONFIG = {
  // Minimum confidence (0-100) before a detection is considered valid.
  detectionConfidenceThreshold: 70,

  // Number of consecutive matching predictions required before a label
  // is treated as "stable" and used to trigger fun-fact generation.
  stableFramesRequired: 3,

  // Minimum time (ms) between two automatic generations, even if the
  // detected label keeps changing back and forth.
  generationCooldownMs: 4000,

  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
};

// Configurable FPS options exposed in the UI.
export const FPS_OPTIONS = [1, 2, 5, 10];
export const DEFAULT_FPS = 2;

export const TONE_CONFIG = {
  availableTones: [
    { value: 'normal', label: 'Normal' },
    { value: 'funny', label: 'Lucu' },
    { value: 'history', label: 'Sejarah' },
    { value: 'scientific', label: 'Ilmiah' },
    { value: 'kids', label: 'Anak-anak' },
  ],
  defaultTone: 'normal',
};

// English prompt instructions per persona.
// The prompt is written in English, while the generated output
// is requested in Indonesian.
export const PERSONA_PROMPTS = {
  normal:
    'Write in a clear, natural, neutral, and informative tone.',

  funny:
    'Write in a playful, humorous, and light-hearted tone, as if telling a joke to a friend.',

  history:
    'Write focusing on the historical origin or cultural background of the vegetable.',

  scientific:
    'Write in an educational, factual, and science-oriented tone, mentioning a nutritional or biological detail.',

  kids:
    'Write using very simple vocabulary suitable for a small child, short and easy to understand.',
};

export const isValidDetection = (result) => {
  const { detectionConfidenceThreshold } = APP_CONFIG;

  return (
    result
    && result.isValid
    && result.confidence >= detectionConfidenceThreshold
  );
};