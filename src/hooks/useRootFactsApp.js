import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

import { useAppState } from './useAppState.js';
import { CameraService } from '../services/CameraService.js';
import { DetectionService } from '../services/DetectionService.js';
import { RootFactsService } from '../services/RootFactsService.js';
import { APP_CONFIG } from '../utils/config.js';
import { logError } from '../utils/common.js';

/**
 * Central application hook.
 *
 * Detection uses a one-shot workflow:
 *
 * 1. User starts the camera.
 * 2. TensorFlow.js searches for a stable vegetable label.
 * 3. Once stable, the detection loop and webcam are stopped.
 * 4. Transformers.js generates exactly one fun fact.
 * 5. The result remains visible until the user starts another scan.
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
  const isCompletingScanRef = useRef(false);

  const lastTickTimeRef = useRef(0);
  const fpsRef = useRef(state.fps);

  const stableLabelRef = useRef(null);
  const stableCountRef = useRef(0);

  const isGeneratingRef = useRef(false);
  const lastGeneratedLabelRef = useRef(null);
  const lastGenerationTimeRef = useRef(0);

  const copyResetTimerRef = useRef(null);

  useEffect(() => {
    fpsRef.current = state.fps;
  }, [state.fps]);

  // ------------------------------------------------------------
  // Online and offline state
  // ------------------------------------------------------------

  useEffect(() => {
    const handleOnline = () => {
      actions.setOffline(false);
    };

    const handleOffline = () => {
      actions.setOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [actions]);

  // ------------------------------------------------------------
  // Detection-loop controls
  // ------------------------------------------------------------

  const stopDetectionLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    isPredictingRef.current = false;
  }, []);

  /**
   * Stops camera and prediction without clearing the detected result.
   * Used immediately before Generative AI inference.
   */
  const finishCameraPhase = useCallback(async () => {
    stopDetectionLoop();

    const camera = cameraServiceRef.current;

    if (camera) {
      try {
        await Promise.resolve(camera.stopCamera());
      } catch (error) {
        logError('finishCameraPhase', error);
      }
    }

    if (isMountedRef.current) {
      actions.setRunning(false);
    }
  }, [actions, stopDetectionLoop]);

  // ------------------------------------------------------------
  // Fun-fact generation
  // ------------------------------------------------------------

  const runGeneration = useCallback(
    async (label, { forced = false } = {}) => {
      const generator = rootFactsServiceRef.current;

      if (!generator || !generator.isReady()) {
        if (isMountedRef.current) {
          actions.setFunFactData('error');
        }

        return;
      }

      if (isGeneratingRef.current) {
        return;
      }

      const now = Date.now();

      const sameAsLastGenerated = (
        label === lastGeneratedLabelRef.current
      );

      const cooldownElapsed = (
        now - lastGenerationTimeRef.current
        >= APP_CONFIG.generationCooldownMs
      );

      if (!forced && sameAsLastGenerated) {
        return;
      }

      if (!forced && !cooldownElapsed) {
        return;
      }

      isGeneratingRef.current = true;
      lastGeneratedLabelRef.current = label;
      lastGenerationTimeRef.current = now;

      // Null tells the UI that Generative AI is currently loading.
      actions.setFunFactData(null);

      try {
        const fact = await generator.generateFacts(label);

        if (!isMountedRef.current) {
          return;
        }

        actions.setFunFactData(fact);
        actions.setAppState('result');
      } catch (error) {
        logError('generateFacts', error);

        if (!isMountedRef.current) {
          return;
        }

        actions.setFunFactData('error');
        actions.setAppState('result');
      } finally {
        isGeneratingRef.current = false;
      }
    },
    [actions],
  );

  // ------------------------------------------------------------
  // Detection processing
  // ------------------------------------------------------------

  const processDetection = useCallback(
    async (result) => {
      if (isCompletingScanRef.current) {
        return;
      }

      const threshold = (
        APP_CONFIG.detectionConfidenceThreshold
      );

      const isValidResult = (
        result
        && result.isValid
        && result.confidence >= threshold
      );

      if (isValidResult) {
        if (
          result.className
          === stableLabelRef.current
        ) {
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

      const isStable = (
        isValidResult
        && stableCountRef.current
          >= APP_CONFIG.stableFramesRequired
      );

      if (!isStable) {
        actions.setAppState('analyzing');
        return;
      }

      // Prevent another camera frame from starting a second generation.
      isCompletingScanRef.current = true;

      actions.setAppState('result');

      // Reviewer-requested behavior:
      // stop detection and webcam before Transformers.js inference.
      await finishCameraPhase();

      if (!isMountedRef.current) {
        return;
      }

      // One user scan should always generate one result, even when
      // the same vegetable was scanned previously.
      await runGeneration(
        result.className,
        { forced: true },
      );
    },
    [
      actions,
      finishCameraPhase,
      runGeneration,
    ],
  );

  const tick = useCallback(async () => {
    const camera = cameraServiceRef.current;
    const detector = detectionServiceRef.current;

    if (!camera || !detector) {
      return;
    }

    if (
      !camera.isReady()
      || !detector.isLoaded()
      || isCompletingScanRef.current
    ) {
      return;
    }

    try {
      const result = await detector.predict(
        camera.video,
      );

      if (!isMountedRef.current) {
        return;
      }

      await processDetection(result);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      logError('detection tick', error);
    }
  }, [processDetection]);

  const loop = useCallback(
    (timestamp) => {
      if (
        !isMountedRef.current
        || isCompletingScanRef.current
      ) {
        rafIdRef.current = null;
        return;
      }

      rafIdRef.current = requestAnimationFrame(loop);

      const interval = (
        1000 / (fpsRef.current || 1)
      );

      if (
        timestamp - lastTickTimeRef.current
        < interval
      ) {
        return;
      }

      lastTickTimeRef.current = timestamp;

      if (isPredictingRef.current) {
        return;
      }

      isPredictingRef.current = true;

      tick()
        .catch((error) => {
          logError('detection loop', error);
        })
        .finally(() => {
          isPredictingRef.current = false;
        });
    },
    [tick],
  );

  // ------------------------------------------------------------
  // Camera controls
  // ------------------------------------------------------------

  const startScanning = useCallback(async () => {
    const camera = cameraServiceRef.current;

    if (!camera) {
      return;
    }

    try {
      actions.setError(null);

      // Clear the previous result only when the user explicitly
      // starts a new scan.
      actions.resetResults();

      stableLabelRef.current = null;
      stableCountRef.current = 0;

      isCompletingScanRef.current = false;
      isGeneratingRef.current = false;
      isPredictingRef.current = false;

      lastGeneratedLabelRef.current = null;
      lastGenerationTimeRef.current = 0;
      lastTickTimeRef.current = 0;

      await camera.startCamera(
        state.cameraFacing,
      );

      if (!isMountedRef.current) {
        return;
      }

      actions.setRunning(true);
      actions.setAppState('analyzing');

      stopDetectionLoop();

      rafIdRef.current = requestAnimationFrame(
        loop,
      );
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      logError('startScanning', error);

      actions.setError(
        error.message
        || 'Gagal memulai kamera.',
      );

      actions.setRunning(false);
    }
  }, [
    actions,
    loop,
    state.cameraFacing,
    stopDetectionLoop,
  ]);

  /**
   * Manual stop initiated by the user.
   * Unlike automatic completion, this clears the current result.
   */
  const stopScanning = useCallback(() => {
    stopDetectionLoop();

    isCompletingScanRef.current = false;
    stableLabelRef.current = null;
    stableCountRef.current = 0;

    cameraServiceRef.current?.stopCamera();

    actions.setRunning(false);
    actions.resetResults();
  }, [actions, stopDetectionLoop]);

  const toggleCamera = useCallback(() => {
    if (state.isRunning) {
      stopScanning();
      return;
    }

    startScanning();
  }, [
    state.isRunning,
    startScanning,
    stopScanning,
  ]);

  const changeCameraFacing = useCallback(
    (facing) => {
      actions.setCameraFacing(facing);

      if (
        state.isRunning
        && cameraServiceRef.current
        && !isCompletingScanRef.current
      ) {
        cameraServiceRef.current
          .startCamera(facing)
          .catch((error) => {
            logError(
              'changeCameraFacing',
              error,
            );

            actions.setError(
              error.message
              || 'Gagal mengganti kamera.',
            );
          });
      }
    },
    [actions, state.isRunning],
  );

  const changeFps = useCallback(
    (fps) => {
      actions.setFps(fps);
      fpsRef.current = fps;

      cameraServiceRef.current?.setFPS(fps);
    },
    [actions],
  );

  const changePersona = useCallback(
    (persona) => {
      actions.setPersona(persona);

      rootFactsServiceRef.current?.setTone(
        persona,
      );
    },
    [actions],
  );

  const regenerateFact = useCallback(() => {
    if (!state.detectionResult) {
      return;
    }

    runGeneration(
      state.detectionResult.className,
      { forced: true },
    );
  }, [
    runGeneration,
    state.detectionResult,
  ]);

  // ------------------------------------------------------------
  // Clipboard
  // ------------------------------------------------------------

  const copyFact = useCallback(async () => {
    if (
      !state.funFactData
      || state.funFactData === 'error'
    ) {
      return;
    }

    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }

    try {
      if (!navigator.clipboard) {
        throw new Error(
          'Clipboard API tidak tersedia di browser ini.',
        );
      }

      await navigator.clipboard.writeText(
        state.funFactData,
      );

      if (!isMountedRef.current) {
        return;
      }

      actions.setCopyStatus('success');
    } catch (error) {
      logError('copyFact', error);

      if (!isMountedRef.current) {
        return;
      }

      actions.setCopyStatus('error');
    } finally {
      copyResetTimerRef.current = setTimeout(
        () => {
          if (isMountedRef.current) {
            actions.setCopyStatus(null);
          }
        },
        2000,
      );
    }
  }, [actions, state.funFactData]);

  const retryLoadModels = useCallback(() => {
    actions.setLoadError(null);

    setRetryCount((count) => count + 1);
  }, [actions]);

  // ------------------------------------------------------------
  // Service initialization
  // ------------------------------------------------------------

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

    const initializeModels = async () => {
      try {
        actions.setModelStatus(
          'Menyiapkan backend AI...',
        );

        actions.setModelStatus(
          'Memuat model deteksi...',
        );

        const detectionInfo = (
          await detectionService.loadModel({
            onProgress: ({ progress }) => {
              if (!isMountedRef.current) {
                return;
              }

              if (
                typeof progress === 'number'
              ) {
                actions.setLoadProgress(
                  Math.round(
                    Math.min(progress, 1) * 100,
                  ),
                );
              }
            },
          })
        );

        if (!isMountedRef.current) {
          return;
        }

        actions.setDetectionBackend(
          detectionInfo.backend,
        );

        actions.setModelStatus(
          'Memuat model generatif...',
        );

        actions.setLoadProgress(null);

        const generationBackend = (
          await rootFactsService.loadModel({
            onProgress: (data) => {
              if (!isMountedRef.current) {
                return;
              }

              if (
                typeof data.progress === 'number'
              ) {
                actions.setLoadProgress(
                  Math.round(
                    Math.min(
                      data.progress,
                      100,
                    ),
                  ),
                );
              }
            },
          })
        );

        if (!isMountedRef.current) {
          return;
        }

        actions.setGenerationBackend(
          generationBackend,
        );

        actions.setModelStatus(
          'Model AI Siap',
        );

        actions.setLoadProgress(100);
        actions.setServicesReady(true);
      } catch (error) {
        logError(
          'model initialization',
          error,
        );

        if (!isMountedRef.current) {
          return;
        }

        actions.setModelStatus(
          'Gagal memuat model',
        );

        actions.setLoadError(
          error.message
          || 'Terjadi kesalahan saat memuat model AI.',
        );
      }
    };

    initializeModels();

    return () => {
      isMountedRef.current = false;

      stopDetectionLoop();

      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }

      cameraService.stopCamera();
      detectionService.dispose();

      if (
        typeof rootFactsService.dispose
        === 'function'
      ) {
        rootFactsService.dispose();
      }
    };
  }, [
    retryCount,
    stopDetectionLoop,
  ]);

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