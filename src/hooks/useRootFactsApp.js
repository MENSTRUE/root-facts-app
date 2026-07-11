import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppState } from './useAppState.js';
import { CameraService } from '../services/CameraService.js';
import { DetectionService } from '../services/DetectionService.js';
import { RootFactsService } from '../services/RootFactsService.js';
import { APP_CONFIG } from '../utils/config.js';
import { logError } from '../utils/common.js';

/**
 * useRootFactsApp
 * Central hook that owns the three service instances (camera, TF.js
 * detector, Transformers.js generator) and drives the requestAnimationFrame
 * detection loop with FPS throttling, an inference lock, stability-based
 * generation triggering, and full cleanup on unmount.
 */
export function useRootFactsApp() {
  const { state, actions } = useAppState();
  const [retryCount, setRetryCount] = useState(0);

  const cameraServiceRef = useRef(null);
  const detectionServiceRef = useRef(null);
  const rootFactsServiceRef = useRef(null);

  const isMountedRef = useRef(true);
  const rafIdRef = useRef(null);
  const isPredictingRef = useRef(false);
  const lastTickTimeRef = useRef(0);
  const fpsRef = useRef(state.fps);

  const stableLabelRef = useRef(null);
  const stableCountRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const lastGeneratedLabelRef = useRef(null);
  const lastGenerationTimeRef = useRef(0);

  const copyResetTimerRef = useRef(null);

  // Keep the FPS ref in sync so the rAF loop never reads a stale closure value.
  useEffect(() => {
    fpsRef.current = state.fps;
  }, [state.fps]);

  // ---- Online / offline awareness -----------------------------------
  useEffect(() => {
    const handleOnline = () => actions.setOffline(false);
    const handleOffline = () => actions.setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [actions]);

  // ---- Fun-fact generation --------------------------------------------
  const runGeneration = useCallback(async (label, { forced = false } = {}) => {
    const generator = rootFactsServiceRef.current;
    if (!generator || !generator.isReady()) return;
    if (isGeneratingRef.current) return;

    const now = Date.now();
    const sameAsLastGenerated = label === lastGeneratedLabelRef.current;
    const cooldownElapsed = now - lastGenerationTimeRef.current >= APP_CONFIG.generationCooldownMs;

    if (!forced && sameAsLastGenerated) return;
    if (!forced && !cooldownElapsed) return;

    isGeneratingRef.current = true;
    lastGeneratedLabelRef.current = label;
    lastGenerationTimeRef.current = now;
    actions.setFunFactData(null);

    try {
      const fact = await generator.generateFacts(label);
      if (!isMountedRef.current) return;
      actions.setFunFactData(fact);
    } catch (error) {
      logError('generateFacts', error);
      if (!isMountedRef.current) return;
      actions.setFunFactData('error');
    } finally {
      isGeneratingRef.current = false;
    }
  }, [actions]);

  // ---- Detection loop ---------------------------------------------------
  const processDetection = useCallback((result) => {
    const threshold = APP_CONFIG.detectionConfidenceThreshold;

    if (result.isValid && result.confidence >= threshold) {
      if (result.className === stableLabelRef.current) {
        stableCountRef.current += 1;
      } else {
        stableLabelRef.current = result.className;
        stableCountRef.current = 1;
      }
    } else {
      stableLabelRef.current = null;
      stableCountRef.current = 0;
    }

    actions.setDetectionResult(result);

    const isStable = stableCountRef.current >= APP_CONFIG.stableFramesRequired;

    if (isStable) {
      actions.setAppState('result');
      runGeneration(result.className);
    } else {
      actions.setAppState('analyzing');
    }
  }, [actions, runGeneration]);

  const tick = useCallback(async () => {
    const camera = cameraServiceRef.current;
    const detector = detectionServiceRef.current;
    if (!camera || !detector) return;
    if (!camera.isReady() || !detector.isLoaded()) return;

    try {
      const result = await detector.predict(camera.video);
      if (!isMountedRef.current) return;
      processDetection(result);
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('detection tick', error);
    }
  }, [processDetection]);

  const loop = useCallback((timestamp) => {
    rafIdRef.current = requestAnimationFrame(loop);

    const interval = 1000 / (fpsRef.current || 1);
    if (timestamp - lastTickTimeRef.current < interval) return;
    lastTickTimeRef.current = timestamp;

    if (isPredictingRef.current) return;
    isPredictingRef.current = true;
    tick().finally(() => {
      isPredictingRef.current = false;
    });
  }, [tick]);

  // ---- Camera controls ----------------------------------------------
  const startScanning = useCallback(async () => {
    const camera = cameraServiceRef.current;
    if (!camera) return;
    try {
      actions.setError(null);
      await camera.startCamera(state.cameraFacing);
      if (!isMountedRef.current) return;

      stableLabelRef.current = null;
      stableCountRef.current = 0;
      lastTickTimeRef.current = 0;

      actions.setRunning(true);
      actions.setAppState('analyzing');

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(loop);
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('startScanning', error);
      actions.setError(error.message || 'Gagal memulai kamera.');
    }
  }, [actions, loop, state.cameraFacing]);

  const stopScanning = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isPredictingRef.current = false;
    cameraServiceRef.current?.stopCamera();
    actions.setRunning(false);
    actions.resetResults();
  }, [actions]);

  const toggleCamera = useCallback(() => {
    if (state.isRunning) {
      stopScanning();
    } else {
      startScanning();
    }
  }, [state.isRunning, startScanning, stopScanning]);

  const changeCameraFacing = useCallback((facing) => {
    actions.setCameraFacing(facing);
    if (state.isRunning && cameraServiceRef.current) {
      cameraServiceRef.current.startCamera(facing).catch((error) => {
        logError('changeCameraFacing', error);
        actions.setError(error.message || 'Gagal mengganti kamera.');
      });
    }
  }, [actions, state.isRunning]);

  const changeFps = useCallback((fps) => {
    actions.setFps(fps);
    cameraServiceRef.current?.setFPS(fps);
  }, [actions]);

  const changePersona = useCallback((persona) => {
    actions.setPersona(persona);
    rootFactsServiceRef.current?.setTone(persona);
  }, [actions]);

  const regenerateFact = useCallback(() => {
    if (!state.detectionResult) return;
    runGeneration(state.detectionResult.className, { forced: true });
  }, [runGeneration, state.detectionResult]);

  const copyFact = useCallback(async () => {
    if (!state.funFactData || state.funFactData === 'error') return;

    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API tidak tersedia di browser ini.');
      }
      await navigator.clipboard.writeText(state.funFactData);
      if (!isMountedRef.current) return;
      actions.setCopyStatus('success');
    } catch (error) {
      logError('copyFact', error);
      if (!isMountedRef.current) return;
      actions.setCopyStatus('error');
    } finally {
      copyResetTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) actions.setCopyStatus(null);
      }, 2000);
    }
  }, [actions, state.funFactData]);

  const retryLoadModels = useCallback(() => {
    actions.setLoadError(null);
    setRetryCount((count) => count + 1);
  }, [actions]);

  // ---- Service instantiation + model loading -------------------------
  useEffect(() => {
    isMountedRef.current = true;

    const cameraService = new CameraService();
    const detectionService = new DetectionService();
    const rootFactsService = new RootFactsService();

    cameraServiceRef.current = cameraService;
    detectionServiceRef.current = detectionService;
    rootFactsServiceRef.current = rootFactsService;

    cameraService.setFPS(state.fps);
    rootFactsService.setTone(state.persona);

    actions.setServices({
      detector: detectionService,
      camera: cameraService,
      generator: rootFactsService,
    });
    actions.setServicesReady(false);
    actions.setLoadError(null);
    actions.setLoadProgress(null);

    (async () => {
      try {
        actions.setModelStatus('Menyiapkan backend AI...');

        actions.setModelStatus('Memuat model deteksi...');
        const detectionInfo = await detectionService.loadModel({
          onProgress: ({ progress }) => {
            if (!isMountedRef.current) return;
            if (typeof progress === 'number') {
              actions.setLoadProgress(Math.round(Math.min(progress, 1) * 100));
            }
          },
        });
        if (!isMountedRef.current) return;
        actions.setDetectionBackend(detectionInfo.backend);

        actions.setModelStatus('Memuat model generatif...');
        actions.setLoadProgress(null);
        const generationBackend = await rootFactsService.loadModel({
          onProgress: (data) => {
            if (!isMountedRef.current) return;
            if (typeof data.progress === 'number') {
              actions.setLoadProgress(Math.round(Math.min(data.progress, 100)));
            }
          },
        });
        if (!isMountedRef.current) return;
        actions.setGenerationBackend(generationBackend);

        actions.setModelStatus('Model AI Siap');
        actions.setLoadProgress(100);
        actions.setServicesReady(true);
      } catch (error) {
        logError('model initialization', error);
        if (!isMountedRef.current) return;
        actions.setModelStatus('Gagal memuat model');
        actions.setLoadError(error.message || 'Terjadi kesalahan saat memuat model AI.');
      }
    })();

    return () => {
      isMountedRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
      cameraService.stopCamera();
      detectionService.dispose();
    };
    // Services are (re)created only on mount and on explicit retry.
  }, [retryCount]);

  return {
    state,
    actions,
    handlers: {
      toggleCamera,
      changeCameraFacing,
      changeFps,
      changePersona,
      regenerateFact,
      copyFact,
      retryLoadModels,
    },
  };
}
