/**
 * FitTrack Personal — Tesseract OCR Worker Coordinator
 */

import { createWorker } from 'tesseract.js';

/**
 * Runs client-side optical character recognition over an image Blob.
 * Integrates progress reporting callbacks and ensures proper worker termination.
 */
export async function scanImageWithOcr(
  imageBlob: Blob,
  onProgress?: (progressPercent: number) => void
): Promise<{ text: string; confidence: number }> {
  let worker: any = null;
  try {
    // Instantiate Tesseract worker with active logging callbacks
    worker = await createWorker('eng', 1, {
      logger: (message: any) => {
        if (message.status === 'recognizing' && onProgress) {
          onProgress(Math.round(message.progress * 100));
        }
      },
    });

    // Recognize text from image Blob
    const result = await worker.recognize(imageBlob);

    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } catch (err) {
    console.error('Tesseract OCR scanner failed:', err);
    throw err;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        console.error('Failed to terminate Tesseract worker:', err);
      }
    }
  }
}
