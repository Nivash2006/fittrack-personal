/**
 * FitTrack Personal — OCR Nutrition Scanner Modal Component
 */

import { useState, useRef, useEffect } from 'react';
import { preprocessImageForOcr } from '../ocr/imagePreprocessor';
import { scanImageWithOcr } from '../ocr/ocrWorker';
import { extractAndValidateNutrition, type ParsedNutrition } from '../ocr/nutritionExtractor';

interface OCRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (nutrition: { calories?: number; protein?: number; carbs?: number; fats?: number }) => void;
}

export default function OCRScanner({ isOpen, onClose, onScanComplete }: OCRScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'preprocessing' | 'scanning' | 'complete' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ParsedNutrition | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to avoid memory leaks when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setScanResult(null);
    setScanError(null);
    setStatus('idle');

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setScanResult(null);
      setScanError(null);
      setStatus('idle');
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const runOcrScan = async () => {
    if (!selectedFile) return;

    try {
      setScanError(null);
      
      // 1. Image Preprocessing (grayscale, thresholding, sizing)
      setStatus('preprocessing');
      const processedBlob = await preprocessImageForOcr(selectedFile);
      
      // Create a preview of the high-contrast image (optional, helps diagnostic)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(processedBlob));

      // 2. OCR Scanning with Tesseract
      setStatus('scanning');
      setProgress(0);
      const { text, confidence } = await scanImageWithOcr(processedBlob, (pct) => {
        setProgress(pct);
      });

      // 3. Validation & Parsing Layer
      const validated = extractAndValidateNutrition(text, confidence);
      setScanResult(validated);
      setStatus('complete');
    } catch (err: any) {
      console.error('OCR Process failed:', err);
      setStatus('failed');
      setScanError(err.message || 'Optical scanning failed. Please try a cleaner, brighter label photo.');
    }
  };

  const handleUseScannedValues = () => {
    if (!scanResult) return;
    onScanComplete({
      calories: scanResult.calories,
      protein: scanResult.protein,
      carbs: scanResult.carbs,
      fats: scanResult.fats,
    });
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setScanResult(null);
    setScanError(null);
    setStatus('idle');
    setProgress(0);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal__handle" />
        <h2 className="modal__title">🔬 Label Nutrition Scanner</h2>

        {status === 'idle' && !selectedFile && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-xl) var(--space-md)',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.01)',
              transition: 'all 0.2s',
              marginBottom: 'var(--space-md)',
            }}
            className="glass-card--interactive"
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📸</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Take Photo or Upload Label
            </div>
            <div className="text-caption mt-xs">
              Drag & drop or tap to browse your gallery
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>
        )}

        {previewUrl && (
          <div style={{ position: 'relative', width: '100%', maxHeight: 200, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-md)' }}>
            <img
              src={previewUrl}
              alt="Label Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0a0a0f' }}
            />
            {status === 'idle' && (
              <button
                className="btn btn-ghost"
                onClick={handleReset}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  padding: 0,
                  color: '#fff',
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* OCR Status Loaders */}
        {status === 'preprocessing' && (
          <div className="text-center" style={{ padding: 'var(--space-md) 0' }}>
            <div className="spinner mb-sm" />
            <div className="text-small text-secondary">Enhancing contrast & cleaning image...</div>
          </div>
        )}

        {status === 'scanning' && (
          <div className="text-center" style={{ padding: 'var(--space-md) 0' }}>
            <div className="spinner mb-sm" />
            <div className="text-small text-secondary">Analyzing layout & reading text [{progress}%]...</div>
            <div style={{
              width: '100%',
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 2,
              marginTop: 'var(--space-sm)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: 'var(--accent)',
                transition: 'width 0.15s ease',
              }} />
            </div>
          </div>
        )}

        {/* Scan Failures */}
        {status === 'failed' && scanError && (
          <div style={{
            padding: 'var(--space-sm)',
            background: 'rgba(255, 77, 106, 0.05)',
            border: '1px solid rgba(255, 77, 106, 0.15)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.8125rem',
            marginBottom: 'var(--space-md)',
            lineHeight: 1.4,
          }}>
            {scanError}
          </div>
        )}

        {/* Scan Results Display */}
        {status === 'complete' && scanResult && (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
            
            {/* Confidence Banner */}
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: scanResult.confidenceScore >= 50 ? 'rgba(0, 230, 138, 0.05)' : 'rgba(255, 179, 71, 0.05)',
              border: `1px solid ${scanResult.confidenceScore >= 50 ? 'rgba(0, 230, 138, 0.15)' : 'rgba(255, 179, 71, 0.15)'}`,
              fontSize: '0.75rem',
              color: scanResult.confidenceScore >= 50 ? 'var(--accent)' : '#ffb347',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Confidence Rating</span>
              <strong>{scanResult.confidenceScore}%</strong>
            </div>

            {scanResult.confidenceScore < 50 && (
              <div className="text-caption text-center" style={{ color: '#ffb347', fontSize: '0.6875rem' }}>
                ⚠️ Low confidence. Please check and correct the extracted values below.
              </div>
            )}

            {/* Extracted Macros Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
              <div className="glass-card text-center" style={{ padding: 'var(--space-sm) var(--space-xs)' }}>
                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Calories</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {scanResult.calories ?? '—'}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>kcal</div>
              </div>
              <div className="glass-card text-center" style={{ padding: 'var(--space-sm) var(--space-xs)' }}>
                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Protein</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--protein-color)' }}>
                  {scanResult.protein !== undefined ? `${Math.round(scanResult.protein)}g` : '—'}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>g</div>
              </div>
              <div className="glass-card text-center" style={{ padding: 'var(--space-sm) var(--space-xs)' }}>
                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Carbs</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--carbs-color)' }}>
                  {scanResult.carbs !== undefined ? `${Math.round(scanResult.carbs)}g` : '—'}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>g</div>
              </div>
              <div className="glass-card text-center" style={{ padding: 'var(--space-sm) var(--space-xs)' }}>
                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Fats</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fats-color)' }}>
                  {scanResult.fats !== undefined ? `${Math.round(scanResult.fats)}g` : '—'}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>g</div>
              </div>
            </div>

            {/* Diagnostic raw text snippet */}
            <details style={{ marginTop: 'var(--space-xs)' }}>
              <summary className="text-caption" style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                View Raw OCR Readout
              </summary>
              <pre style={{
                marginTop: '6px',
                padding: 'var(--space-sm)',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.6875rem',
                color: 'var(--text-secondary)',
                maxHeight: 100,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
              }}>
                {scanResult.rawText || 'No readable text extracted.'}
              </pre>
            </details>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          
          {status === 'idle' && selectedFile && (
            <button className="btn btn-primary flex-1" onClick={runOcrScan}>
              🚀 Scan Label
            </button>
          )}

          {status === 'complete' && scanResult && (
            <button className="btn btn-primary flex-1" onClick={handleUseScannedValues}>
              📝 Fill Meal Log
            </button>
          )}

          {status === 'failed' && (
            <button className="btn btn-primary flex-1" onClick={handleReset}>
              🔄 Try Another
            </button>
          )}
        </div>
      </div>
    </>
  );
}
