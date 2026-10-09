const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const AppError = require('./AppError');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Local storage is a development convenience only; it is refused in production.
const useLocal = () =>
  process.env.STORAGE_DRIVER === 'local' && process.env.NODE_ENV !== 'production';

const uniqueName = () => `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

// kind: 'pdf' | 'image'. Returns { url, publicId }.
async function saveFile(file, { folder, kind }) {
  const ext = kind === 'pdf' ? '.pdf' : file.mimetype === 'image/png' ? '.png' : '.jpg';
  const name = uniqueName();

  if (useLocal()) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = name + ext;
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), file.buffer);
    return { url: `/uploads/${fileName}`, publicId: `local:${fileName}` };
  }

  if (!isCloudinaryConfigured()) {
    throw new AppError(500, 'File storage is not configured on the server.');
  }

  // PDFs are stored as Cloudinary "raw" files; the public_id keeps the .pdf extension.
  const options =
    kind === 'pdf'
      ? { resource_type: 'raw', public_id: `${folder}/${name}.pdf` }
      : { resource_type: 'image', public_id: `${folder}/${name}` };

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, res) =>
      err ? reject(err) : resolve(res)
    );
    stream.end(file.buffer);
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function deleteFile(publicId, kind) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      await fs.unlink(path.join(UPLOAD_DIR, path.basename(publicId.slice(6))));
      return;
    }
    await cloudinary.uploader.destroy(publicId, {
      resource_type: kind === 'pdf' ? 'raw' : 'image',
    });
  } catch (err) {
    console.error('Could not delete stored file:', publicId, err.message);
  }
}

module.exports = { saveFile, deleteFile, UPLOAD_DIR };
