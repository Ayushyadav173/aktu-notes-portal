const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    year: { type: Number, required: true, min: 1, max: 4 },
    branch: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    subject: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    fileUrl: { type: String, required: true },
    filePublicId: { type: String, select: false }, // used only to delete the stored file
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true }, // bytes
    fileType: { type: String, default: 'PDF' },
    coverImage: { type: String, default: '' },
    coverPublicId: { type: String, select: false },
    uploadedBy: { type: String, default: 'Admin' }, // "Admin" or the student's name
    // approved = visible to everyone, draft = visible only to the admin
    status: { type: String, enum: ['approved', 'draft'], default: 'approved' },
    downloadCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

noteSchema.index({ status: 1, year: 1, branch: 1, semester: 1, subject: 1 });
noteSchema.index({ status: 1, downloadCount: -1 });
noteSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
