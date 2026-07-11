import { useRef, useEffect } from 'react';
import { Camera, Mic, ScanLine } from 'lucide-react';
import { TONE_CONFIG, FPS_OPTIONS } from '../utils/config';

function CameraSection({
  isRunning,
  onToggleCamera,
  onToneChange,
  onFpsChange,
  onCameraFacingChange,
  services,
  modelStatus,
  error,
  currentTone,
  fps,
  cameraFacing,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Attach the DOM refs to the CameraService as soon as both exist. This
  // effect intentionally has no dependency array so it re-checks on every
  // render, but the guards make it a no-op once wired up (no infinite loop
  // and no duplicate stream creation).
  useEffect(() => {
    if (services.camera) {
      if (videoRef.current && services.camera.video !== videoRef.current) {
        services.camera.setVideoElement(videoRef.current);
      }
      if (canvasRef.current && services.camera.canvas !== canvasRef.current) {
        services.camera.setCanvasElement(canvasRef.current);
      }
    }
  });

  const handleCameraFacingChange = (e) => {
    const facingMode = e.target.value === 'front' ? 'user' : 'environment';
    onCameraFacingChange?.(facingMode);
  };

  const handleFpsChange = (e) => {
    onFpsChange?.(Number(e.target.value));
  };

  const handleToneChange = (e) => {
    onToneChange?.(e.target.value);
  };

  const isModelReady = modelStatus === 'Model AI Siap';
  const buttonDisabled = !isModelReady;
  const buttonText = isRunning ? 'Stop Scan' : 'Mulai Scan';

  return (
    <section className="camera-section" aria-label="Camera Feed and Controls">
      <div className="camera-container">
        <div className="camera-wrapper">
          <video
            ref={videoRef}
            id="media-video"
            autoPlay
            muted
            playsInline
            className={isRunning ? '' : 'hidden'}
          />

          <canvas
            ref={canvasRef}
            id="media-canvas"
            className="hidden"
          />

          <div className={`camera-overlay ${isRunning ? 'active' : ''}`}>
            <div className="overlay-frame"></div>
          </div>

          {!isRunning && (
            <div className="camera-placeholder">
              <Camera size={48} />
              <p>Kamera tidak aktif</p>
              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="camera-controls">
          <button
            id="btn-toggle"
            className={`capture-btn ${isRunning ? 'scanning' : ''}`}
            onClick={onToggleCamera}
            disabled={buttonDisabled}
            aria-label={buttonText}
            style={{ opacity: buttonDisabled ? 0.6 : 1 }}
          >
            <ScanLine size={24} />
          </button>
        </div>

        <div className="settings-bar">
          <div className="setting-item">
            <label htmlFor="camera-select" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <Camera size={16} />
              <span className="sr-only">Pilih kamera</span>
              <select
                id="camera-select"
                value={cameraFacing === 'user' ? 'front' : 'default'}
                onChange={handleCameraFacingChange}
                disabled={false}
              >
                <option value="default">Belakang</option>
                <option value="front">Depan</option>
              </select>
            </label>
          </div>

          <div className="setting-item fps-setting">
            <label htmlFor="fps-select" id="fps-label">FPS</label>
            <select
              id="fps-select"
              value={fps}
              onChange={handleFpsChange}
              disabled={isRunning}
              aria-label="Batas FPS deteksi"
            >
              {FPS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} FPS
                </option>
              ))}
            </select>
          </div>

          <div className="setting-item tone-setting">
            <Mic size={16} />
            <label htmlFor="tone-select" className="sr-only">Persona fakta</label>
            <select
              id="tone-select"
              value={currentTone || TONE_CONFIG.defaultTone}
              onChange={handleToneChange}
              disabled={isRunning}
              aria-label="Pilih persona fakta menarik"
            >
              {TONE_CONFIG.availableTones.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CameraSection;
