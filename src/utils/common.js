export const logError = (context, error) => {
  console.error(`❌ ${context}:`, error);
};

export const isWebGPUSupported = () => {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
};

export const isMobileDevice = () => {
  return navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const createDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const validateModelMetadata = (metadata) => {
  return metadata && metadata.labels && Array.isArray(metadata.labels);
};

export const getCameraErrorMessage = (error) => {
  const errorMessages = {
    'NotAllowedError': 'Izin kamera ditolak. Harap izinkan akses kamera.',
    'NotFoundError': 'Tidak ada kamera ditemukan pada perangkat ini.',
    'NotReadableError': 'Kamera sedang digunakan oleh aplikasi lain.'
  };

  return errorMessages[error.name] || 'Gagal memulai kamera';
};

/**
 * Sanitize a detected label before it is interpolated into an LLM prompt.
 * - trims whitespace
 * - strips control characters
 * - keeps only letters/spaces/hyphens (expected shape of a vegetable label)
 * - clamps to a reasonable maximum length
 * This prevents a malformed/tampered label from injecting arbitrary
 * instructions into the generation prompt.
 */
export const sanitizeLabelForPrompt = (label) => {
  if (typeof label !== 'string') return '';
  const noControlChars = label.replace(/[\u0000-\u001F\u007F]/g, '');
  const onlyExpectedChars = noControlChars.replace(/[^a-zA-Z\s-]/g, '');
  const collapsedSpaces = onlyExpectedChars.replace(/\s+/g, ' ').trim();
  return collapsedSpaces.slice(0, 40);
};

/**
 * Clean common small-model generation artifacts (echoed instructions,
 * stray quotes, repeated whitespace) from generated text before display.
 */
export const cleanGeneratedText = (text) => {
  if (typeof text !== 'string') return '';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^(Answer|Jawaban|Fact|Fun fact)\s*[:\-]\s*/i, '');
  return cleaned.trim();
};
