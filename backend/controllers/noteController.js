const path = require('path');
const Note = require('../models/Note');
const Submission = require('../models/Submission');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validateHierarchy } = require('../utils/hierarchy');
const { saveFile, deleteFile } = require('../utils/fileStorage');

const SORTS = {
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  downloads: { downloadCount: -1, createdAt: -1 },
  title: { title: 1 },
};
const YEAR_WORDS = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4 };
const FILLER_WORDS = ['year', 'semester', 'sem', 'note', 'notes'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// "a, b, c" -> ['a','b','c'] (lowercase, unique, max 10)
const parseTags = (raw) =>
  [...new Set(String(raw || '').split(',').map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);

// Only these fields can be set from a request. Anything else (role, downloadCount...) is ignored.
const pickNoteFields = (b) => ({
  title: b.title,
  description: b.description || '',
  year: Number(b.year),
  branch: b.branch,
  semester: Number(b.semester),
  subject: b.subject,
  unit: b.unit,
  tags: parseTags(b.tags),
});

function buildFilter(q, isAdmin) {
  const filter = {};
  // Public visitors only ever see approved notes. Admins may ask for drafts or everything.
  const status = isAdmin && q.status ? String(q.status) : 'approved';
  if (status === 'draft') filter.status = 'draft';
  else if (status !== 'all') filter.status = 'approved';

  ['branch', 'subject', 'unit'].forEach((key) => {
    if (q[key]) filter[key] = String(q[key]);
  });
  const year = toInt(q.year, 1, 4);
  const semester = toInt(q.semester, 1, 8);
  if (year) filter.year = year;
  if (semester) filter.semester = semester;
  if (q.tag) filter.tags = String(q.tag).toLowerCase();

  if (q.q) {
    const words = String(q.q).trim().slice(0, 100).split(/\s+/)
      .filter((w) => w && !FILLER_WORDS.includes(w.toLowerCase())).slice(0, 6);
    // Every word must match at least one searchable field.
    const clauses = words.map((word) => {
      const rx = new RegExp(escapeRegex(word), 'i');
      const or = [{ title: rx }, { subject: rx }, { unit: rx }, { branch: rx }, { description: rx }, { tags: rx }];
      const yearFromWord = YEAR_WORDS[word.toLowerCase()];
      if (yearFromWord) or.push({ year: yearFromWord });
      return { $or: or };
    });
    if (clauses.length) filter.$and = clauses;
  }
  return filter;
}

// GET /api/notes  and  GET /api/notes/search
exports.listNotes = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query, req.isAdmin);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const sort = SORTS[req.query.sort] || SORTS.latest;

  const [notes, total] = await Promise.all([
    Note.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Note.countDocuments(filter),
  ]);
  res.json({
    success: true,
    message: 'Notes fetched.',
    data: { notes, total, page, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

// GET /api/notes/popular-subjects
exports.popularSubjects = asyncHandler(async (req, res) => {
  const subjects = await Note.aggregate([
    { $match: { status: 'approved' } },
    {
      $group: {
        _id: { subject: '$subject', branch: '$branch', year: '$year', semester: '$semester' },
        notes: { $sum: 1 },
        downloads: { $sum: '$downloadCount' },
      },
    },
    { $sort: { downloads: -1, notes: -1 } },
    { $limit: 8 },
    { $project: { _id: 0, subject: '$_id.subject', branch: '$_id.branch', year: '$_id.year', semester: '$_id.semester', notes: 1, downloads: 1 } },
  ]);
  res.json({ success: true, message: 'Popular subjects fetched.', data: { subjects } });
});

// GET /api/notes/unit-counts?year&branch&semester&subject  -> how many notes per unit
exports.unitCounts = asyncHandler(async (req, res) => {
  const filter = buildFilter({ ...req.query, q: '', unit: '' }, false);
  const rows = await Note.aggregate([{ $match: filter }, { $group: { _id: '$unit', count: { $sum: 1 } } }]);
  const counts = {};
  rows.forEach((r) => { counts[r._id] = r.count; });
  res.json({ success: true, message: 'Counts fetched.', data: { counts } });
});

// GET /api/notes/:id
exports.getNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id).lean();
  if (!note || (note.status !== 'approved' && !req.isAdmin)) throw new AppError(404, 'Note not found.');
  res.json({ success: true, message: 'Note fetched.', data: { note } });
});

// POST /api/notes/:id/download  -> counts the download and returns the file URL
exports.downloadNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, status: 'approved' },
    { $inc: { downloadCount: 1 } },
    { new: true }
  ).lean();
  if (!note) throw new AppError(404, 'Note not found or not published.');
  res.json({
    success: true,
    message: 'Download ready.',
    data: { fileUrl: note.fileUrl, fileName: note.fileName, downloadCount: note.downloadCount },
  });
});

// POST /api/notes (admin)
exports.createNote = asyncHandler(async (req, res) => {
  const fields = pickNoteFields(req.body);
  await validateHierarchy(fields);

  const pdf = req.files.file[0];
  const cover = req.files.coverImage && req.files.coverImage[0];
  const storedPdf = await saveFile(pdf, { folder: 'aktu-notes', kind: 'pdf' });
  let storedCover = null;
  try {
    if (cover) storedCover = await saveFile(cover, { folder: 'aktu-covers', kind: 'image' });
    const note = await Note.create({
      ...fields,
      status: req.body.status === 'draft' ? 'draft' : 'approved',
      fileUrl: storedPdf.url,
      filePublicId: storedPdf.publicId,
      fileName: path.basename(pdf.originalname).slice(0, 150),
      fileSize: pdf.size,
      coverImage: storedCover ? storedCover.url : '',
      coverPublicId: storedCover ? storedCover.publicId : undefined,
      uploadedBy: 'Admin',
    });
    res.status(201).json({ success: true, message: 'Note uploaded successfully.', data: { note } });
  } catch (err) {
    await deleteFile(storedPdf.publicId, 'pdf');
    if (storedCover) await deleteFile(storedCover.publicId, 'image');
    throw err;
  }
});

// PUT /api/notes/:id (admin). Sending a new file replaces the old one.
exports.updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id).select('+filePublicId +coverPublicId');
  if (!note) throw new AppError(404, 'Note not found.');

  const fields = pickNoteFields(req.body);
  await validateHierarchy(fields);
  Object.assign(note, fields);
  if (req.body.status) note.status = req.body.status === 'draft' ? 'draft' : 'approved';

  const oldPdf = note.filePublicId;
  const oldCover = note.coverPublicId;
  const newPdf = req.files.file && req.files.file[0];
  const newCover = req.files.coverImage && req.files.coverImage[0];
  const stored = [];

  try {
    if (newPdf) {
      const up = await saveFile(newPdf, { folder: 'aktu-notes', kind: 'pdf' });
      stored.push({ id: up.publicId, kind: 'pdf' });
      Object.assign(note, { fileUrl: up.url, filePublicId: up.publicId, fileName: path.basename(newPdf.originalname).slice(0, 150), fileSize: newPdf.size });
    }
    if (newCover) {
      const up = await saveFile(newCover, { folder: 'aktu-covers', kind: 'image' });
      stored.push({ id: up.publicId, kind: 'image' });
      Object.assign(note, { coverImage: up.url, coverPublicId: up.publicId });
    }
    await note.save();
  } catch (err) {
    await Promise.all(stored.map((s) => deleteFile(s.id, s.kind)));
    throw err;
  }
  if (newPdf) await deleteFile(oldPdf, 'pdf');
  if (newCover) await deleteFile(oldCover, 'image');

  res.json({ success: true, message: 'Note updated successfully.', data: { note } });
});

// DELETE /api/notes/:id (admin)
exports.deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id).select('+filePublicId +coverPublicId');
  if (!note) throw new AppError(404, 'Note not found.');
  await note.deleteOne();
  await deleteFile(note.filePublicId, 'pdf');
  await deleteFile(note.coverPublicId, 'image');
  res.json({ success: true, message: 'Note deleted.', data: {} });
});

// GET /api/admin/stats (admin)
exports.getStats = asyncHandler(async (req, res) => {
  const [totalNotes, published, drafts, pending, rejected, downloads] = await Promise.all([
    Note.countDocuments(),
    Note.countDocuments({ status: 'approved' }),
    Note.countDocuments({ status: 'draft' }),
    Submission.countDocuments({ status: 'pending' }),
    Submission.countDocuments({ status: 'rejected' }),
    Note.aggregate([{ $group: { _id: null, total: { $sum: '$downloadCount' } } }]),
  ]);
  res.json({
    success: true,
    message: 'Stats fetched.',
    data: { totalNotes, published, drafts, pending, rejected, totalDownloads: downloads[0] ? downloads[0].total : 0 },
  });
});

exports.parseTags = parseTags;
