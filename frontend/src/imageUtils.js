// Resize + compress an image File into a base64 JPEG data URL (keeps payloads small).
export const fileToResizedDataURL = (file, maxDim = 800, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Like fileToResizedDataURL, but keeps shrinking (quality then dimensions) until
// the base64 result fits under maxChars. Guarantees the payload won't be rejected
// by the server's size cap (storefront images are ~1.5M base64 chars max).
export const fileToConstrainedDataURL = (file, maxDim = 1280, maxChars = 1_350_000) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let dim = maxDim;
        const render = (d, quality) => {
          const scale = Math.min(1, d / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', quality);
        };
        // Try decreasing quality, then decreasing dimensions, until it fits.
        for (let pass = 0; pass < 6; pass += 1) {
          for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
            const out = render(dim, q);
            if (out.length <= maxChars) { resolve(out); return; }
          }
          dim = Math.round(dim * 0.8); // shrink and retry
        }
        // Last resort: smallest sensible render. Reject if it still won't fit so
        // the UI shows a clear error instead of the server returning 413.
        const finalOut = render(Math.min(dim, 480), 0.4);
        if (finalOut.length <= maxChars) { resolve(finalOut); return; }
        reject(new Error('Image is too detailed to compress under the size limit. Please use a smaller image.'));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
