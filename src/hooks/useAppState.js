import { useReducer, useMemo } from 'react';
import { TONE_CONFIG, DEFAULT_FPS } from '../utils/config.js';

const initialState = {
  appState: 'idle', // 'idle' | 'analyzing' | 'result'
  isRunning: false,

  // Human-readable status shown in the header pill.
  modelStatus: 'Menyiapkan backend AI...',
  // 0-100 when a real progress figure is available, null for indeterminate.
  loadProgress: null,
  loadError: null,
  servicesReady: false,

  detectionBackend: null,
  generationBackend: null,

  persona: TONE_CONFIG.defaultTone,
  fps: DEFAULT_FPS,
  cameraFacing: 'environment',

  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,

  detectionResult: null,
  funFactData: null,
  error: null,
  copyStatus: null, // null | 'success' | 'error'

  services: {
    detector: null,
    camera: null,
    generator: null,
  },
};

const ActionTypes = {
  SET_MODEL_STATUS: 'SET_MODEL_STATUS',
  SET_LOAD_PROGRESS: 'SET_LOAD_PROGRESS',
  SET_LOAD_ERROR: 'SET_LOAD_ERROR',
  SET_SERVICES_READY: 'SET_SERVICES_READY',
  SET_SERVICES: 'SET_SERVICES',
  SET_RUNNING: 'SET_RUNNING',
  SET_APP_STATE: 'SET_APP_STATE',
  SET_DETECTION_RESULT: 'SET_DETECTION_RESULT',
  SET_FUN_FACT_DATA: 'SET_FUN_FACT_DATA',
  SET_ERROR: 'SET_ERROR',
  SET_DETECTION_BACKEND: 'SET_DETECTION_BACKEND',
  SET_GENERATION_BACKEND: 'SET_GENERATION_BACKEND',
  SET_PERSONA: 'SET_PERSONA',
  SET_FPS: 'SET_FPS',
  SET_CAMERA_FACING: 'SET_CAMERA_FACING',
  SET_OFFLINE: 'SET_OFFLINE',
  SET_COPY_STATUS: 'SET_COPY_STATUS',
  RESET_RESULTS: 'RESET_RESULTS',
};

function appReducer(state, action) {
  switch (action.type) {
  case ActionTypes.SET_MODEL_STATUS:
    return { ...state, modelStatus: action.payload };

  case ActionTypes.SET_LOAD_PROGRESS:
    return { ...state, loadProgress: action.payload };

  case ActionTypes.SET_LOAD_ERROR:
    return { ...state, loadError: action.payload };

  case ActionTypes.SET_SERVICES_READY:
    return { ...state, servicesReady: action.payload };

  case ActionTypes.SET_SERVICES:
    return { ...state, services: action.payload };

  case ActionTypes.SET_RUNNING:
    return { ...state, isRunning: action.payload };

  case ActionTypes.SET_APP_STATE:
    return { ...state, appState: action.payload };

  case ActionTypes.SET_DETECTION_RESULT:
    return { ...state, detectionResult: action.payload };

  case ActionTypes.SET_FUN_FACT_DATA:
    return { ...state, funFactData: action.payload };

  case ActionTypes.SET_ERROR:
    return { ...state, error: action.payload };

  case ActionTypes.SET_DETECTION_BACKEND:
    return { ...state, detectionBackend: action.payload };

  case ActionTypes.SET_GENERATION_BACKEND:
    return { ...state, generationBackend: action.payload };

  case ActionTypes.SET_PERSONA:
    return { ...state, persona: action.payload };

  case ActionTypes.SET_FPS:
    return { ...state, fps: action.payload };

  case ActionTypes.SET_CAMERA_FACING:
    return { ...state, cameraFacing: action.payload };

  case ActionTypes.SET_OFFLINE:
    return { ...state, isOffline: action.payload };

  case ActionTypes.SET_COPY_STATUS:
    return { ...state, copyStatus: action.payload };

  case ActionTypes.RESET_RESULTS:
    return {
      ...state,
      appState: 'idle',
      detectionResult: null,
      funFactData: null,
      error: null,
    };

  default:
    return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const actions = useMemo(
    () => ({
      setModelStatus: (status) =>
        dispatch({ type: ActionTypes.SET_MODEL_STATUS, payload: status }),

      setLoadProgress: (progress) =>
        dispatch({ type: ActionTypes.SET_LOAD_PROGRESS, payload: progress }),

      setLoadError: (error) =>
        dispatch({ type: ActionTypes.SET_LOAD_ERROR, payload: error }),

      setServicesReady: (ready) =>
        dispatch({ type: ActionTypes.SET_SERVICES_READY, payload: ready }),

      setServices: (services) =>
        dispatch({ type: ActionTypes.SET_SERVICES, payload: services }),

      setRunning: (isRunning) =>
        dispatch({ type: ActionTypes.SET_RUNNING, payload: isRunning }),

      setAppState: (appState) =>
        dispatch({ type: ActionTypes.SET_APP_STATE, payload: appState }),

      setDetectionResult: (result) =>
        dispatch({ type: ActionTypes.SET_DETECTION_RESULT, payload: result }),

      setFunFactData: (data) =>
        dispatch({ type: ActionTypes.SET_FUN_FACT_DATA, payload: data }),

      setError: (error) =>
        dispatch({ type: ActionTypes.SET_ERROR, payload: error }),

      setDetectionBackend: (backend) =>
        dispatch({ type: ActionTypes.SET_DETECTION_BACKEND, payload: backend }),

      setGenerationBackend: (backend) =>
        dispatch({ type: ActionTypes.SET_GENERATION_BACKEND, payload: backend }),

      setPersona: (persona) =>
        dispatch({ type: ActionTypes.SET_PERSONA, payload: persona }),

      setFps: (fps) =>
        dispatch({ type: ActionTypes.SET_FPS, payload: fps }),

      setCameraFacing: (facing) =>
        dispatch({ type: ActionTypes.SET_CAMERA_FACING, payload: facing }),

      setOffline: (isOffline) =>
        dispatch({ type: ActionTypes.SET_OFFLINE, payload: isOffline }),

      setCopyStatus: (status) =>
        dispatch({ type: ActionTypes.SET_COPY_STATUS, payload: status }),

      resetResults: () =>
        dispatch({ type: ActionTypes.RESET_RESULTS }),
    }),
    [],
  );

  return { state, actions };
}
