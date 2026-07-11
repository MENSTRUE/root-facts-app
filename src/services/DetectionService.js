import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { validateModelMetadata } from '../utils/common.js';

const MODEL_URL = `${import.meta.env.BASE_URL}model/model.json`;
const METADATA_URL = `${import.meta.env.BASE_URL}model/metadata.json`;

/**
 * DetectionService
 * Loads the local Teachable Machine (MobileNet-based) TF.js model and runs
 * vegetable classification against video frames, with adaptive backend
 * selection (WebGPU -> WebGL -> CPU) and strict tensor memory hygiene.
 */
export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.imageSize = 224;
    this.config = null;
    this.backend = null;
  }

  /**
   * Attempt WebGPU first, gracefully fall back to WebGL, then CPU as a last
   * resort. Never throws - always resolves to the backend that ended up
   * active so the UI can display it.
   */
  async _setupBackend() {
    // 1) WebGPU
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        await tf.setBackend('webgpu');
        await tf.ready();
        this.backend = 'webgpu';
        return this.backend;
      } catch (error) {
        console.error('❌ DetectionService WebGPU init failed, falling back to WebGL:', error);
      }
    }

    // 2) WebGL (principal fallback)
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      this.backend = 'webgl';
      return this.backend;
    } catch (error) {
      console.error('❌ DetectionService WebGL init failed, falling back to CPU:', error);
    }

    // 3) CPU (final safe fallback)
    await tf.setBackend('cpu');
    await tf.ready();
    this.backend = 'cpu';
    return this.backend;
  }

  /**
   * Load the model and metadata concurrently, then set up the best
   * available backend before the graph is executed.
   */
  async loadModel({ onProgress } = {}) {
    await this._setupBackend();

    onProgress?.({ status: 'model', progress: 0.1 });

    const [model, metadata] = await Promise.all([
      tf.loadLayersModel(MODEL_URL, {
        onProgress: (fraction) => {
          onProgress?.({ status: 'model', progress: 0.1 + fraction * 0.8 });
        },
      }),
      fetch(METADATA_URL).then((res) => {
        if (!res.ok) {
          throw new Error(`Gagal memuat metadata.json (status ${res.status})`);
        }
        return res.json();
      }),
    ]);

    if (!validateModelMetadata(metadata)) {
      throw new Error('metadata.json tidak valid atau field labels hilang.');
    }

    this.model = model;
    this.labels = metadata.labels;

    // Determine expected spatial input size from the model itself instead
    // of hardcoding it, falling back to the Teachable Machine default (224).
    const inputShape = model.inputs?.[0]?.shape;
    if (Array.isArray(inputShape) && inputShape.length === 4 && inputShape[1]) {
      this.imageSize = inputShape[1];
    }

    onProgress?.({ status: 'ready', progress: 1 });

    return { backend: this.backend, labels: this.labels, imageSize: this.imageSize };
  }

  /**
   * Run a single prediction against a <video> or <img>/<canvas> element.
   * All synchronous tensor allocation happens inside tf.tidy(); only the
   * resolved JS values escape, and the async-produced output tensor is
   * disposed explicitly right after extracting its data.
   */
  async predict(imageElement) {
    if (!this.isLoaded()) {
      throw new Error('Model deteksi belum dimuat.');
    }
    if (!imageElement || imageElement.readyState < 2) {
      throw new Error('Frame video belum siap untuk diprediksi.');
    }

    const outputTensor = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(imageElement);
      const resized = tf.image.resizeBilinear(pixels, [this.imageSize, this.imageSize]);
      // Teachable Machine / MobileNet preprocessing: scale to [-1, 1]
      const normalized = resized.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));
      const batched = normalized.expandDims(0);
      return this.model.predict(batched);
    });

    let data;
    try {
      data = await outputTensor.data();
    } finally {
      outputTensor.dispose();
    }

    if (!data || data.length === 0) {
      throw new Error('Model mengembalikan hasil prediksi kosong.');
    }

    let bestIndex = 0;
    for (let i = 1; i < data.length; i += 1) {
      if (data[i] > data[bestIndex]) {
        bestIndex = i;
      }
    }

    const className = this.labels[bestIndex] ?? 'Tidak diketahui';
    const score = data[bestIndex];

    return {
      className,
      score,
      confidence: Math.round(score * 100),
      isValid: Boolean(this.labels[bestIndex]) && Number.isFinite(score),
      allScores: Array.from(data),
    };
  }

  isLoaded() {
    return Boolean(this.model) && Array.isArray(this.labels) && this.labels.length > 0;
  }

  getBackend() {
    return this.backend;
  }

  dispose() {
    if (this.model) {
      try {
        this.model.dispose();
      } catch (error) {
        console.error('❌ DetectionService.dispose:', error);
      }
      this.model = null;
    }
  }
}
