import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG, PERSONA_PROMPTS } from '../utils/config.js';
import { sanitizeLabelForPrompt, cleanGeneratedText } from '../utils/common.js';

// Small instruction-tuned text2text model, well suited for in-browser
// generation (a few hundred MB quantized, works acceptably on WASM/CPU too).
const MODEL_ID = 'Xenova/LaMini-Flan-T5-77M';

const GENERATION_PARAMS = {
  temperature: 0.7,
  max_new_tokens: 80,
  top_p: 0.9,
  do_sample: true,
};

/**
 * RootFactsService
 * Wraps a local Transformers.js text2text-generation pipeline used to
 * produce a short vegetable fun fact in Indonesian, styled by a selected
 * persona. Runs entirely in the browser (WebGPU with WASM fallback) -
 * no external/paid API is used.
 */
export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = GENERATION_PARAMS;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  /**
   * Load and initialize the text2text-generation pipeline, preferring
   * WebGPU (quantized q4) and falling back to WASM (q8) if WebGPU is
   * unavailable or fails to initialize. Never lets a WebGPU failure
   * propagate uncaught - it is treated purely as a fallback trigger.
   */
  async loadModel({ onProgress } = {}) {
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

    const tryLoad = async (device, dtype) => {
      this.generator = await pipeline('text2text-generation', MODEL_ID, {
        device,
        dtype,
        progress_callback: (data) => {
          onProgress?.({ device, ...data });
        },
      });
      this.currentBackend = device;
    };

    if (hasWebGPU) {
      try {
        await tryLoad('webgpu', 'q4');
      } catch (error) {
        console.error('❌ RootFactsService WebGPU init failed, falling back to WASM:', error);
        await tryLoad('wasm', 'q8');
      }
    } else {
      await tryLoad('wasm', 'q8');
    }

    this.isModelLoaded = true;
    return this.currentBackend;
  }

  /**
   * Configure the writing persona used for subsequent generations.
   */
  setTone(tone) {
    if (Object.prototype.hasOwnProperty.call(PERSONA_PROMPTS, tone)) {
      this.currentTone = tone;
    }
  }

  _buildPrompt(vegetableName) {
    const safeLabel = sanitizeLabelForPrompt(vegetableName) || 'vegetable';
    const styleInstruction = PERSONA_PROMPTS[this.currentTone] || PERSONA_PROMPTS[TONE_CONFIG.defaultTone];

    return (
      `Write one short and accurate fun fact about the vegetable "${safeLabel}". ` +
      `${styleInstruction} ` +
      'Respond in Indonesian language only, in 1-2 sentences. ' +
      'Do not repeat these instructions, do not use English, do not add quotation marks.'
    );
  }

  /**
   * Generate a fun fact for the given (already-detected) vegetable label.
   * Guards against overlapping calls so rapid consecutive triggers never
   * queue up multiple simultaneous generations.
   */
  async generateFacts(vegetableName) {
    if (!this.isReady()) {
      throw new Error('Model generatif belum siap.');
    }
    if (this.isGenerating) {
      throw new Error('Sedang menghasilkan fakta, harap tunggu.');
    }

    this.isGenerating = true;
    try {
      const prompt = this._buildPrompt(vegetableName);
      const output = await this.generator(prompt, { ...this.config });
      const rawText = output?.[0]?.generated_text ?? '';
      const cleaned = cleanGeneratedText(rawText);

      if (!cleaned) {
        throw new Error('Model menghasilkan teks kosong.');
      }

      return cleaned;
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return Boolean(this.generator) && this.isModelLoaded;
  }

  getBackend() {
    return this.currentBackend;
  }
}
