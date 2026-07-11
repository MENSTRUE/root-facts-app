import { Sparkles, Search, CheckCircle, Lightbulb, Copy, Share2, RefreshCw, AlertTriangle } from 'lucide-react';
import { TONE_CONFIG } from '../utils/config';

function InfoPanel({
  appState,
  detectionResult,
  funFactData,
  error,
  persona,
  onCopyFact,
  onRegenerate,
  copyStatus,
  loadError,
  loadProgress,
  modelStatus,
  onRetryLoad,
}) {
  const isIdle = appState === 'idle';
  const isAnalyzing = appState === 'analyzing';
  const isResult = appState === 'result';
  const isModelReady = modelStatus === 'Model AI Siap';

  const personaLabel = TONE_CONFIG.availableTones.find((t) => t.value === persona)?.label;

  const renderLoadFailure = () => (
    <div id="state-load-error" className="result-card idle-card">
      <div className="idle-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
        <AlertTriangle size={36} />
      </div>
      <h2>Gagal Memuat Model AI</h2>
      <p>{loadError}</p>
      <button type="button" className="retry-btn" onClick={onRetryLoad}>
        Coba Lagi
      </button>
    </div>
  );

  const renderModelLoading = () => (
    <div id="state-model-loading" className="result-card loading-card">
      <div className="loading-animation">
        <div className="loading-ring"></div>
        <div className="loading-icon">
          <Sparkles size={24} />
        </div>
      </div>
      <h2>{modelStatus}</h2>
      <div className="progress-track" role="progressbar" aria-valuenow={loadProgress ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`progress-fill ${loadProgress === null ? 'indeterminate' : ''}`}
          style={loadProgress !== null ? { width: `${loadProgress}%` } : undefined}
        ></div>
      </div>
      {loadProgress !== null && (
        <p style={{ marginTop: '0.5rem' }}>{loadProgress}%</p>
      )}
    </div>
  );

  const renderIdleState = () => (
    <div id="state-idle" className="result-card idle-card">
      <div className="idle-icon">
        <Sparkles size={40} />
      </div>
      <h2>Scan Sayuran</h2>
      <p>Ketuk tombol di bawah untuk memulai dan temukan fakta menarik tentang sayuran!</p>
      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '1rem' }}>
          {error}
        </p>
      )}
    </div>
  );

  const renderAnalyzingState = () => (
    <div id="state-loading" className="result-card loading-card">
      <div className="loading-animation">
        <div className="loading-ring"></div>
        <div className="loading-icon">
          <Search size={24} />
        </div>
      </div>
      <h2>Mencari...</h2>
      <p>Sedang mengidentifikasi sayuran Anda</p>
    </div>
  );

  const renderResultState = () => {
    if (!detectionResult) return null;

    const confidence = Math.round(detectionResult.score * 100);

    const renderFunFactContent = () => {
      if (funFactData === null) {
        return (
          <div id="fun-fact-loading" className="fun-fact-loading">
            <div className="fun-fact-loading-spinner"></div>
            <span>Memuat fakta menarik...</span>
          </div>
        );
      }

      if (funFactData === 'error') {
        return (
          <div style={{
            padding: '0.75rem',
            background: '#fef3c7',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            color: '#92400e'
          }}>
            Gagal menghasilkan fakta menarik. Mode offline atau layanan tidak tersedia.
          </div>
        );
      }

      return funFactData;
    };

    return (
      <div id="state-result" className="result-card result-main">
        <div className="detected-badge">
          <CheckCircle size={14} />
          <span id="detected-name">{detectionResult.className}</span>
        </div>

        {personaLabel && (
          <span className="persona-badge">Persona: {personaLabel}</span>
        )}

        <div className="fun-fact-card">
          <div className="fun-fact-icon">
            <Lightbulb size={28} />
          </div>
          <div id="fun-fact-content">
            <div id="fun-fact-text" className="fun-fact-text">
              {renderFunFactContent()}
            </div>
            {funFactData && funFactData !== 'error' && (
              <button
                id="btn-copy"
                className={`copy-btn ${copyStatus === 'success' ? 'copied' : ''}`}
                onClick={onCopyFact}
                title="Salin fakta"
                aria-label="Salin fakta ke clipboard"
              >
                <Copy size={18} />
              </button>
            )}
          </div>
          {copyStatus && (
            <p className="copy-feedback" role="status" aria-live="polite">
              {copyStatus === 'success' ? 'Berhasil disalin' : 'Gagal menyalin, coba manual'}
            </p>
          )}
        </div>

        {funFactData && funFactData !== 'error' && (
          <button
            type="button"
            className="regenerate-btn"
            onClick={onRegenerate}
            disabled={funFactData === null}
          >
            <RefreshCw size={14} />
            Buat Fakta Lain
          </button>
        )}

        <div className="confidence-bar">
          <span className="confidence-label">Kepercayaan</span>
          <div className="confidence-track">
            <div
              id="confidence-fill"
              className="confidence-fill"
              style={{ width: `${confidence}%` }}
            ></div>
          </div>
          <span id="detected-confidence" className="confidence-value">{confidence}%</span>
        </div>

        <div className="share-hint">
          <Share2 size={14} />
          <span>Salin dan bagikan ke teman!</span>
        </div>
      </div>
    );
  };

  return (
    <section className="results-section" aria-live="polite">
      {loadError && renderLoadFailure()}
      {!loadError && !isModelReady && renderModelLoading()}
      {!loadError && isModelReady && isIdle && renderIdleState()}
      {!loadError && isModelReady && isAnalyzing && renderAnalyzingState()}
      {!loadError && isModelReady && isResult && renderResultState()}
    </section>
  );
}

export default InfoPanel;
