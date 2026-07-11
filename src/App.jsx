import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useRootFactsApp } from './hooks/useRootFactsApp';
import { useInstallPrompt } from './hooks/useInstallPrompt';

function App() {
  const { state, actions, handlers } = useRootFactsApp();
  const { canInstall, promptInstall } = useInstallPrompt();

  return (
    <div className="app-container">
      <Header
        modelStatus={state.modelStatus}
        isOffline={state.isOffline}
        detectionBackend={state.detectionBackend}
        generationBackend={state.generationBackend}
        canInstall={canInstall}
        onInstallClick={promptInstall}
      />

      {state.isOffline && (
        <div className="offline-banner" role="status" aria-live="polite">
          Anda sedang offline. Deteksi sayuran tetap berjalan menggunakan model yang sudah tersimpan di perangkat.
        </div>
      )}

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handlers.toggleCamera}
          onToneChange={handlers.changePersona}
          onFpsChange={handlers.changeFps}
          onCameraFacingChange={handlers.changeCameraFacing}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={state.persona}
          fps={state.fps}
          cameraFacing={state.cameraFacing}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          persona={state.persona}
          onCopyFact={handlers.copyFact}
          onRegenerate={handlers.regenerateFact}
          copyStatus={state.copyStatus}
          loadError={state.loadError}
          loadProgress={state.loadProgress}
          modelStatus={state.modelStatus}
          onRetryLoad={handlers.retryLoadModels}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
