const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  year: { type: Number, required: true, min: 1, max: 4 },
  branch: { type: String, required: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  subject: { type: String, required: true, trim: true },
  unit: { type: String, required: true, trim: true },
  tags: { type: [String], default: [] },
  fileUrl: { type: String, required: true },
  filePublicId: { type: String },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  coverImage: { type: String, default: '' },
  coverPublicId: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: '' },
  note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' }, // set when approved
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
});

submissionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
