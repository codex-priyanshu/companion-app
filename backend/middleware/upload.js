const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
];

const DANGEROUS_EXTENSIONS = /\.(exe|sh|php|pl|py|cgi|asp|aspx|jsp|svg|html|htm|js|bat|cmd|vbs)$/i;

const fileFilter = (req, file, cb) => {
    // Block dangerous file extensions
    if (DANGEROUS_EXTENSIONS.test(file.originalname)) {
        return cb(new Error('Security Alert: Executable or dangerous file types are strictly prohibited!'), false);
    }

    // Validate MIME type
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only JPEG, PNG, WEBP, GIF, MP4, MOV, and standard audio recordings are allowed.'), false);
    }
};

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'rentgf_uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'mp3', 'ogg', 'wav'],
        resource_type: 'auto'
    }
});

// Hardened Multer with 10MB limit and strict file filter
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max limit
        files: 5 // Max 5 files per request
    },
    fileFilter: fileFilter
});

module.exports = upload;