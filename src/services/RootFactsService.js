import {
  env,
  pipeline,
} from '@huggingface/transformers';

import {
  TONE_CONFIG,
  PERSONA_PROMPTS,
} from '../utils/config.js';

import {
  sanitizeLabelForPrompt,
  cleanGeneratedText,
} from '../utils/common.js';

const MODEL_ID = 'Xenova/LaMini-Flan-T5-77M';

const GENERATION_PARAMS = {
  temperature: 0.7,
  max_new_tokens: 80,
  top_p: 0.9,
  do_sample: true,
};

// Membantu kompatibilitas WASM pada browser HP.
env.backends.onnx.wasm.numThreads = 1;

const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent,
  );
};

const supportsUsableWebGPU = async () => {
  if (
    typeof navigator === 'undefined'
    || !navigator.gpu
    || typeof navigator.gpu.requestAdapter !== 'function'
  ) {
    return false;
  }

  // Di HP lebih aman langsung memakai WASM.
  if (isMobileDevice()) {
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    return Boolean(adapter);
  } catch (error) {
    console.warn(
      'WebGPU tidak dapat digunakan. Beralih ke WASM.',
      error,
    );

    return false;
  }
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = GENERATION_PARAMS;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async _loadPipeline(device, dtype, onProgress) {
    return pipeline(
      'text2text-generation',
      MODEL_ID,
      {
        device,
        dtype,
        progress_callback: (data) => {
          onProgress?.({
            device,
            ...data,
          });
        },
      },
    );
  }

  async loadModel({ onProgress } = {}) {
    this.generator = null;
    this.isModelLoaded = false;
    this.currentBackend = null;

    const canUseWebGPU = await supportsUsableWebGPU();

    if (canUseWebGPU) {
      try {
        this.generator = await this._loadPipeline(
          'webgpu',
          'q4',
          onProgress,
        );

        this.currentBackend = 'webgpu';
        this.isModelLoaded = true;

        return this.currentBackend;
      } catch (error) {
        console.warn(
          'WebGPU gagal dimuat. Mencoba WASM.',
          error,
        );

        this.generator = null;
      }
    }

    try {
      this.generator = await this._loadPipeline(
        'wasm',
        'q8',
        onProgress,
      );

      this.currentBackend = 'wasm';
      this.isModelLoaded = true;

      return this.currentBackend;
    } catch (error) {
      this.generator = null;
      this.currentBackend = null;
      this.isModelLoaded = false;

      const message = error instanceof Error
        ? error.message
        : String(error);

      throw new Error(
        `Model generatif gagal dimuat dengan WASM: ${message}`,
      );
    }
  }

  setTone(tone) {
    if (
      Object.prototype.hasOwnProperty.call(
        PERSONA_PROMPTS,
        tone,
      )
    ) {
      this.currentTone = tone;
    }
  }

  _buildPrompt(vegetableName) {
    const safeLabel = (
      sanitizeLabelForPrompt(vegetableName)
      || 'vegetable'
    );

    const styleInstruction = (
      PERSONA_PROMPTS[this.currentTone]
      || PERSONA_PROMPTS[TONE_CONFIG.defaultTone]
    );

    return (
      `Write one short and accurate fun fact about the vegetable "${safeLabel}". `
      + `${styleInstruction} `
      + 'Respond in Indonesian language only, in 1-2 sentences. '
      + 'Do not repeat these instructions. '
      + 'Do not use English. '
      + 'Do not add quotation marks.'
    );
  }

  async generateFacts(vegetableName) {
    if (!this.isReady()) {
      throw new Error('Model generatif belum siap.');
    }

    if (this.isGenerating) {
      throw new Error(
        'Sedang menghasilkan fakta, harap tunggu.',
      );
    }

    this.isGenerating = true;

    try {
      const prompt = this._buildPrompt(
        vegetableName,
      );

      const output = await this.generator(
        prompt,
        {
          ...this.config,
        },
      );

      const rawText = (
        output?.[0]?.generated_text
        ?? ''
      );

      const cleaned = cleanGeneratedText(
        rawText,
      );

      if (!cleaned) {
        throw new Error(
          'Model menghasilkan teks kosong.',
        );
      }

      return cleaned;
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return Boolean(
      this.generator
      && this.isModelLoaded,
    );
  }

  getBackend() {
    return this.currentBackend;
  }

  async dispose() {
    if (
      this.generator
      && typeof this.generator.dispose === 'function'
    ) {
      try {
        await this.generator.dispose();
      } catch (error) {
        console.warn(
          'Gagal membersihkan model generatif.',
          error,
        );
      }
    }

    this.generator = null;
    this.isModelLoaded = false;
    this.currentBackend = null;
  }
}