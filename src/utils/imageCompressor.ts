/**
 * Image compression utility using the browser's Canvas API.
 * Downscales images to a maximum width of 1200px before uploading to Firebase Storage,
 * ensuring high-quality JPEG output with reduced storage footprint and faster load times.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

/**
 * Compresses and downscales an image file to a maximum width of 1200px using the Canvas API.
 * 
 * @param file The original image file from input or file picker.
 * @param options Optional compression parameters (defaults to 1200px max width, 0.88 quality, image/jpeg).
 * @returns A Promise resolving to the compressed and downscaled File object.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.88,
    mimeType = 'image/jpeg',
  } = options;

  // Non-image files (e.g., SVG, PDF) pass through untouched
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale image to a maximum width of 1200px while maintaining the exact aspect ratio
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        // Also ensure height does not exceed maximum height bound
        if (height > maxHeight) {
          const ratio = maxHeight / height;
          height = maxHeight;
          width = Math.round(width * ratio);
        }

        // Create canvas with calculated target dimensions
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(file);
          return;
        }

        // Configure high-quality smoothing algorithms
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill white background to prevent transparent PNGs from turning black in JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw downscaled image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as high-quality JPEG Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Create compressed File with standardized .jpg filename
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], `${baseName}.jpg`, {
              type: mimeType,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          mimeType,
          quality
        );
      };

      img.onerror = (err) => {
        console.warn('Failed to load image for compression, falling back to original:', err);
        resolve(file);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => {
      console.warn('Failed to read file for compression, falling back to original:', err);
      resolve(file);
    };

    reader.readAsDataURL(file);
  });
}

export default compressImage;
