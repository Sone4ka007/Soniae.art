(() => {
  const MAX_EDGE = 1600;
  const MAX_BYTES = 3 * 1024 * 1024;

  async function drawable(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
      } catch {}
    }

    const url = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  }

  async function prepare(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Выберите изображение');
    const source = await drawable(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source.image, 0, 0, width, height);
    source.close();

    const qualities = [0.84, 0.76, 0.68];
    let blob = null;
    for (const quality of qualities) {
      blob = await new Promise((resolve, reject) => canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('Could not prepare photo')),
        'image/jpeg',
        quality
      ));
      if (blob.size <= MAX_BYTES) break;
    }
    if (!blob || blob.size > MAX_BYTES) throw new Error('Фото слишком большое после сжатия');
    return blob;
  }

  window.WGPhotos = { prepare };
})();
