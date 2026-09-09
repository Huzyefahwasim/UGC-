export async function preparePhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10_000_000
  )
    throw new Error('Choose a JPG, PNG or WebP photo smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error('Choose a smaller reference photo.');
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 704;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the photo.');
    context.fillStyle = '#181b13';
    context.fillRect(0, 0, 480, 704);
    const scale = Math.max(480 / bitmap.width, 704 / bitmap.height);
    context.drawImage(
      bitmap,
      (480 - bitmap.width * scale) / 2,
      (704 - bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    bitmap.close();
  }
}
