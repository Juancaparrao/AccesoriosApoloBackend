const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary'); 

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = 'otros';
    if (req.url.includes('producto')) folder = 'productos';
    if (req.url.includes('subcategoria')) folder = 'subcategorias';

    return {
      folder,
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    };
  }
});

const upload = multer({ storage });

module.exports = upload;
