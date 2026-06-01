/**
 * FitTrack Personal — OCR Image Preprocessor
 */

/**
 * Reads an image file and returns an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image file into element.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Preprocesses a raw food label image file:
 * 1. Resizes down to max 800px width (saves memory & processing time).
 * 2. Converts to Grayscale.
 * 3. Enhances contrast using a pixel-level factor.
 * 4. Applies a standard binarization threshold (black & white binarization).
 *
 * Returns a high-contrast processed Blob ready to feed to Tesseract.js.
 */
export async function preprocessImageForOcr(file: File): Promise<Blob> {
  const img = await loadImage(file);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
  }

  // 1. Resize down (maintain aspect ratio, max width 800px)
  const maxDim = 800;
  let w = img.width;
  let h = img.height;

  if (w > maxDim) {
    h = Math.round((h * maxDim) / w);
    w = maxDim;
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  // 2. Extract pixel data for grayscale, contrast, and thresholding
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Contrast enhancement factor
  const contrast = 40; // Scale from -255 to 255
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Grayscale conversion (Luminance formula)
    let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Contrast enhancement
    gray = Math.round(factor * (gray - 128) + 128);

    // Binarization Threshold (Threshold at 128)
    // Converts gray shades directly to stark black or stark white
    const finalVal = gray > 128 ? 255 : 0;

    data[i] = finalVal;     // Red
    data[i + 1] = finalVal; // Green
    data[i + 2] = finalVal; // Blue
    // data[i+3] (Alpha) remains untouched
  }

  // Draw cleaned pixels back to canvas
  ctx.putImageData(imgData, 0, 0);

  // 3. Export as a high-quality JPEG Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to Blob.'));
        }
      },
      'image/jpeg',
      0.85
    );
  });
}
