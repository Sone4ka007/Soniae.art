(() => {
  async function compress(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare photo')), 'image/jpeg', 0.82));
  }

  async function upload(file, artworkId) {
    const blob = await compress(file);
    if (blob.size > 3 * 1024 * 1024) throw new Error('Фото слишком большое после сжатия');
    const response = await fetch('/.netlify/functions/wg-upload-photo?artworkId=' + encodeURIComponent(artworkId), {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: blob
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось загрузить фото');
    return data;
  }

  window.WGPhotos = { upload };
})();
