import { Sprout, WifiOff, Download } from 'lucide-react';

function backendLabel(backend) {
  if (!backend) return null;
  const labels = {
    webgpu: 'WebGPU',
    webgl: 'WebGL',
    wasm: 'WASM',
    cpu: 'CPU',
  };
  return labels[backend] || backend;
}

function Header({
  modelStatus,
  isOffline,
  detectionBackend,
  generationBackend,
  canInstall,
  onInstallClick,
}) {
  const isModelReady = modelStatus === 'Model AI Siap';

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Sprout size={20} />
          <span>RootFacts</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isOffline && (
            <span
              className="status-pill"
              role="status"
              aria-live="polite"
              style={{ color: '#b45309', background: '#fffbeb' }}
            >
              <WifiOff size={12} />
              <span>Offline</span>
            </span>
          )}

          {canInstall && (
            <button
              type="button"
              onClick={onInstallClick}
              className="status-pill"
              aria-label="Pasang aplikasi RootFacts"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              <Download size={12} />
              <span>Pasang</span>
            </button>
          )}

          <div className="status-pill" role="status" aria-live="polite">
            <span className={`status-dot ${isModelReady ? 'active' : ''}`}></span>
            <span>{modelStatus}</span>
          </div>
        </div>
      </div>

      {isModelReady && (detectionBackend || generationBackend) && (
        <div
          style={{
            marginTop: '0.375rem',
            display: 'flex',
            gap: '0.5rem',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
          }}
        >
          {detectionBackend && <span>Deteksi: {backendLabel(detectionBackend)}</span>}
          {generationBackend && <span>Generatif: {backendLabel(generationBackend)}</span>}
        </div>
      )}
    </header>
  );
}

export default Header;
