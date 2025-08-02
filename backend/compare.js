import imageHash from 'image-hash';

export function getImagePerceptualHash(filePath) {
  return new Promise((resolve, reject) => {
    imageHash(filePath, 16, true, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}
