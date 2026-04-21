const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for images
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iltsmill/images",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1920, height: 1080, crop: "limit" }],
  },
});

// Configure Cloudinary storage for audio
const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iltsmill/audio",
    resource_type: "video", // Audio is treated as video type in Cloudinary
    allowed_formats: ["mp3", "wav", "m4a", "ogg", "flac", "aac"],
    format: "mp3", // Convert all audio to mp3 format
  },
});

// Create multer instances with size limits
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images

  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
    }
  },
});

// FIXED: Better audio file filter with expanded MIME types
const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for audio
  fileFilter: (req, file, cb) => {
    // Allowed extensions
    const allowedExtensions = /mp3|wav|m4a|ogg|flac|aac/;
    const extname = allowedExtensions.test(
      path.extname(file.originalname).toLowerCase(),
    );

    // Allowed MIME types (expanded list)
    const allowedMimeTypes = [
      "audio/mpeg", // MP3
      "audio/mp3", // MP3 alternative
      "audio/x-mp3", // MP3 alternative
      "audio/mp4", // M4A
      "audio/x-m4a", // M4A alternative
      "audio/wav", // WAV
      "audio/x-wav", // WAV alternative
      "audio/ogg", // OGG
      "audio/flac", // FLAC
      "audio/x-flac", // FLAC alternative
      "audio/aac", // AAC
      "audio/x-aac", // AAC alternative
    ];

    const mimetype = allowedMimeTypes.includes(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          `Only audio files are allowed. Received: ${file.mimetype} (${path.extname(file.originalname)})`,
        ),
      );
    }
  },
});

module.exports = {
  uploadImage,
  uploadAudio,
};
