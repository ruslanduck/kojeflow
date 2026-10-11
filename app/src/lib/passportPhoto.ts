'use client';

/**
 * Cuts the portrait out of a passport data page: the photo sits in the left third, below
 * the header. A fixed-region crop (ported from the prototype) rather than face detection —
 * good enough for standard EU/UA passport scans and instant, with nothing sent anywhere.
 */
export function extractPortrait(scan: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(scan);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const sw = img.width * 0.3;
      const sh = sw * 1.28;
      const sx = img.width * 0.045;
      const sy = img.height * 0.22;
      const canvas = document.createElement('canvas');
      canvas.width = 420;
      canvas.height = Math.round(420 * 1.28);
      const g = canvas.getContext('2d');
      if (!g) return reject(new Error('Canvas is not available'));
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, sx, sy, sw, Math.min(sh, img.height - sy), 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not crop the photo'))), 'image/jpeg', 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The scan is not an image'));
    };
    img.src = url;
  });
}
