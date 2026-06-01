/**
 * FitTrack Personal — Progress Photos Gallery & Comparative Slider
 */

import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ProgressPhoto } from '../db/database';
import Modal from './Modal';
import Toast from './Toast';

/**
 * High-quality client-side image compression using Canvas API
 */
async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas conversion to Blob failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image element.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function ProgressPhotos() {
  const photos = useLiveQuery(() => db.progressPhotos.orderBy('loggedAt').reverse().toArray());
  const latestWeightLog = useLiveQuery(() => db.weightLogs.orderBy('loggedAt').reverse().first());

  const [category, setCategory] = useState<'front' | 'side' | 'back' | 'other'>('front');
  const [caption, setCaption] = useState('');
  const [weight, setWeight] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // File selection
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comparison selection
  const [beforePhoto, setBeforePhoto] = useState<ProgressPhoto | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<ProgressPhoto | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);

  // Track generated object URLs to clean them up on unmount or file changes
  const activeUrlsRef = useRef<Set<string>>(new Set());

  const createObjectUrlSafe = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    activeUrlsRef.current.add(url);
    return url;
  };

  const revokeAllUrls = () => {
    activeUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeUrlsRef.current.clear();
  };

  useEffect(() => {
    if (latestWeightLog) {
      setWeight(String(latestWeightLog.weight));
    }
  }, [latestWeightLog]);

  // Clean up memory leaks
  useEffect(() => {
    return () => {
      revokeAllUrls();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSavePhoto = async () => {
    if (!selectedFile) return;
    try {
      setIsProcessing(true);

      // 1. Compress Image targets: Width 800px, Quality 0.7 (Size < 150KB)
      const fullBlob = await compressImage(selectedFile, 800, 0.7);

      // 2. Generate small thumbnail: Width 150px, Quality 0.5 (Size < 15KB)
      const thumbBlob = await compressImage(selectedFile, 150, 0.5);

      const loggedAt = new Date().toISOString().split('T')[0];

      await db.progressPhotos.add({
        loggedAt,
        category,
        weightKg: weight ? parseFloat(weight) : undefined,
        caption: caption.trim() || undefined,
        photoBlob: fullBlob,
        thumbnailBlob: thumbBlob,
        createdAt: new Date().toISOString(),
      });

      setToast('Progress photo added!');
      handleResetForm();
    } catch (err) {
      console.error('Failed to compress and save progress photo:', err);
      setToast('Failed to save photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetForm = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCaption('');
    setCategory('front');
    setShowAddModal(false);
  };

  const handleDeletePhoto = async (id: number) => {
    if (!window.confirm('Delete this progress photo?')) return;
    await db.progressPhotos.delete(id);
    setToast('Photo deleted.');
    
    // Reset comparison if deleted
    if (beforePhoto?.id === id) setBeforePhoto(null);
    if (afterPhoto?.id === id) setAfterPhoto(null);
  };

  // Prepares object URLs for the split before/after viewer
  const handleOpenComparison = () => {
    if (!beforePhoto || !afterPhoto) return;

    // Clear previous comparison URLs to free up browser memory
    revokeAllUrls();

    const urlBefore = createObjectUrlSafe(beforePhoto.photoBlob);
    const urlAfter = createObjectUrlSafe(afterPhoto.photoBlob);

    setBeforeUrl(urlBefore);
    setAfterUrl(urlAfter);
    setShowCompareModal(true);
  };

  // Direct mapping of generated thumbnails inside the list
  const RenderThumbnail = ({ photo }: { photo: ProgressPhoto }) => {
    const [url, setUrl] = useState<string>('');

    useEffect(() => {
      const u = URL.createObjectURL(photo.thumbnailBlob);
      setUrl(u);
      return () => {
        URL.revokeObjectURL(u);
      };
    }, [photo]);

    if (!url) return <div style={{ width: '100%', height: 110, background: '#1a1a24' }} />;

    return (
      <img
        src={url}
        alt={photo.category}
        style={{ width: '100%', height: '110%', objectFit: 'cover' }}
      />
    );
  };

  return (
    <div className="glass-card mb-md">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
        <span className="section-header__title">📸 Progress Photos</span>
        <button className="section-header__action" onClick={() => setShowAddModal(true)}>
          + Add
        </button>
      </div>

      {/* Comparative Selection Bar */}
      {photos && photos.length >= 2 && (
        <div className="glass-card mb-md" style={{ background: 'rgba(255,255,255,0.015)', padding: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Visual Comparison</span>
            {beforePhoto && afterPhoto && (
              <button className="btn btn-primary btn-sm" onClick={handleOpenComparison} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                ⚖️ Compare Slider
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', fontSize: '0.8125rem' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.6875rem' }}>Before (Older)</label>
              <select
                value={beforePhoto?.id || ''}
                onChange={(e) => setBeforePhoto(photos.find((p) => p.id === Number(e.target.value)) || null)}
                style={{ padding: '6px', fontSize: '0.75rem' }}
              >
                <option value="">Select Photo</option>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.loggedAt} ({p.category}) {p.weightKg ? `· ${p.weightKg}kg` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.6875rem' }}>After (Newer)</label>
              <select
                value={afterPhoto?.id || ''}
                onChange={(e) => setAfterPhoto(photos.find((p) => p.id === Number(e.target.value)) || null)}
                style={{ padding: '6px', fontSize: '0.75rem' }}
              >
                <option value="">Select Photo</option>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.loggedAt} ({p.category}) {p.weightKg ? `· ${p.weightKg}kg` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid Gallery */}
      {(!photos || photos.length === 0) ? (
        <div className="text-small text-muted text-center" style={{ padding: 'var(--space-md)' }}>
          No progress photos yet. Upload your first "Before" photo!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-xs)' }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                aspectRatio: '1',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <RenderThumbnail photo={photo} />
              
              {/* Overlay Metadata */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))',
                padding: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.625rem',
                color: '#fff',
              }}>
                <span>{photo.loggedAt.substring(5)}</span>
                <span style={{ textTransform: 'capitalize' }}>{photo.category}</span>
              </div>

              {/* Delete Icon */}
              <button
                onClick={() => photo.id && handleDeletePhoto(photo.id)}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: 'var(--danger)',
                  fontSize: '0.6875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Photo Modal */}
      <Modal isOpen={showAddModal} onClose={handleResetForm} title="Upload Progress Photo">
        <div className="form-group">
          <label className="form-label">Position View</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="front">Front View</option>
            <option value="side">Side View</option>
            <option value="back">Back View</option>
            <option value="other">Other / Details</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Associated Weight (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 74.2"
              step="0.1"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Caption (Optional)</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Week 4 progress"
            />
          </div>
        </div>

        {previewUrl ? (
          <div style={{ position: 'relative', width: '100%', height: 180, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-md)' }}>
            <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.6)',
                borderRadius: '50%',
                width: 28,
                height: 28,
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-lg) 0',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.005)',
              marginBottom: 'var(--space-md)',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '4px' }}>📸</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Select Photo File</div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>
        )}

        <button className="btn btn-primary btn-block" onClick={handleSavePhoto} disabled={!selectedFile || isProcessing}>
          {isProcessing ? 'Compressing Image...' : '💾 Save Progress Photo'}
        </button>
      </Modal>

      {/* Comparison Split Slider Modal */}
      {showCompareModal && beforeUrl && afterUrl && (
        <Modal isOpen={showCompareModal} onClose={() => { setShowCompareModal(false); revokeAllUrls(); }} title="Before vs. After Comparison">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
            <div>
              👈 Before: <strong style={{ color: 'var(--text-primary)' }}>{beforePhoto?.loggedAt}</strong> ({beforePhoto?.weightKg ? `${beforePhoto.weightKg}kg` : 'No weight'})
            </div>
            <div>
              After: <strong style={{ color: 'var(--accent)' }}>{afterPhoto?.loggedAt}</strong> ({afterPhoto?.weightKg ? `${afterPhoto.weightKg}kg` : 'No weight'}) 👉
            </div>
          </div>

          <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
          
          <div className="text-caption text-center mt-sm" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
            {beforePhoto?.caption && `"${beforePhoto.caption}"`} {afterPhoto?.caption && `→ "${afterPhoto.caption}"`}
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Pure React & CSS Before/After slider control
 */
function BeforeAfterSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [sliderPos, setSliderPos] = useState(50);

  return (
    <div style={{ position: 'relative', width: '100%', height: 320, overflow: 'hidden', borderRadius: 'var(--radius-md)', background: '#0a0a0f' }}>
      {/* Before Image (bottom layer) */}
      <img src={beforeUrl} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600 }}>BEFORE</div>

      {/* After Image (top layer, clipped) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
        pointerEvents: 'none',
      }}>
        <img src={afterUrl} alt="After" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 4, fontSize: '0.6875rem', border: '1px solid var(--accent)', fontWeight: 600 }}>AFTER</div>
      </div>

      {/* Center Handle Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${sliderPos}%`,
        width: 2,
        background: '#fff',
        boxShadow: '0 0 6px rgba(0,0,0,0.5)',
        cursor: 'ew-resize',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8125rem',
          color: '#111',
          fontWeight: 800,
        }}>↔</div>
      </div>

      {/* Invisible range control input layer */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={(e) => setSliderPos(Number(e.target.value))}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'ew-resize',
          zIndex: 10,
        }}
      />
    </div>
  );
}
