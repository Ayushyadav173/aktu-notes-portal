const path = require('path');
const Note = require('../models/Note');
const Submission = require('../models/Submission');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validateHierarchy } = require('../utils/hierarchy');
const { saveFile, deleteFile } = require('../utils/fileStorage');
const { parseTags } = require('./noteController');

// POST /api/submissions (public). Always saved as "pending" and never shown publicly.
exports.createSubmission = asyncHandler(async (req, res) => {
  const b = req.body;
  const fields = {
    studentName: b.studentName,
    email: b.email,
    title: b.title,
    description: b.description,
    year: Number(b.year),
    branch: b.branch,
    semester: Number(b.semester),
    subject: b.subject,
    unit: b.unit,
    tags: parseTags(b.tags),
  };
  await validateHierarchy(fields);

  const pdf = req.files.file[0];
  const cover = req.files.coverImage && req.files.coverImage[0];
  const storedPdf = await saveFile(pdf, { folder: 'aktu-submissions', kind: 'pdf' });
  let storedCover = null;
  try {
    if (cover) storedCover = await saveFile(cover, { folder: 'aktu-covers', kind: 'image' });
    await Submission.create({
      ...fields,
      status: 'pending', // set by the server, whatever the client sends
      fileUrl: storedPdf.url,
      filePublicId: storedPdf.publicId,
      fileName: path.basename(pdf.originalname).slice(0, 150),
      fileSize: pdf.size,
      coverImage: storedCover ? storedCover.url : '',
      coverPublicId: storedCover ? storedCover.publicId : undefined,
    });
  } catch (err) {
    await deleteFile(storedPdf.publicId, 'pdf');
    if (storedCover) await deleteFile(storedCover.publicId, 'image');
    throw err;
  }
  res.status(201).json({
    success: true,
    message: 'Your note has been submitted successfully and is waiting for admin approval.',
    data: {},
  });
});

// GET /api/submissions?status=pending|approved|rejected|all  (admin)
exports.listSubmissions = asyncHandler(async (req, res) => {
  const filter = {};
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const [submissions, total] = await Promise.all([
    Submission.find(filter).select('-filePublicId -coverPublicId').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Submission.countDocuments(filter),
  ]);
  res.json({ success: true, message: 'Submissions fetched.', data: { submissions, total, page, pages: Math.max(1, Math.ceil(total / limit)) } });
});

// GET /api/submissions/:id (admin)
exports.getSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id).select('-filePublicId -coverPublicId').lean();
  if (!submission) throw new AppError(404, 'Submission not found.');
  res.json({ success: true, message: 'Submission fetched.', data: { submission } });
});

// PUT /api/submissions/:id/approve (admin): pending -> approved, and the note goes live.
exports.approveSubmission = asyncHandler(async (req, res) => {
  // Claim the submission atomically so a double click cannot create two notes.
  const submission = await Submission.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'approved', reviewedAt: new Date() },
    { new: true }
  );
  if (!submission) {
    const exists = await Submission.exists({ _id: req.params.id });
    throw new AppError(exists ? 409 : 404, exists ? 'This submission was already reviewed.' : 'Submission not found.');
  }

  try {
    const note = await Note.create({
      title: submission.title,
      description: submission.description,
      year: submission.year,
      branch: submission.branch,
      semester: submission.semester,
      subject: submission.subject,
      unit: submission.unit,
      tags: submission.tags,
      fileUrl: submission.fileUrl,
      filePublicId: submission.filePublicId,
      fileName: submission.fileName,
      fileSize: submission.fileSize,
      coverImage: submission.coverImage,
      coverPublicId: submission.coverPublicId,
      uploadedBy: submission.studentName,
      status: 'approved',
    });
    submission.note = note._id;
    await submission.save();
    res.json({ success: true, message: 'Submission approved and published.', data: { note } });
  } catch (err) {
    await Submission.updateOne({ _id: submission._id }, { status: 'pending', $unset: { reviewedAt: 1 } });
    throw err;
  }
});

// PUT /api/submissions/:id/reject (admin): pending -> rejected. The record is kept.
exports.rejectSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'rejected', rejectionReason: req.body.reason || '', reviewedAt: new Date() },
    { new: true }
  );
  if (!submission) {
    const exists = await Submission.exists({ _id: req.params.id });
    throw new AppError(exists ? 409 : 404, exists ? 'This submission was already reviewed.' : 'Submission not found.');
  }
  res.json({ success: true, message: 'Submission rejected.', data: { submission } });
});
