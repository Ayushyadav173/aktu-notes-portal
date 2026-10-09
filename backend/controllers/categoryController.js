const Category = require('../models/Category');
const Note = require('../models/Note');
const Submission = require('../models/Submission');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// How many notes/submissions use this category? Used to protect against deleting things in use.
async function usageCount(cat) {
  const field = { branch: 'branch', subject: 'subject', noteType: 'unit' }[cat.type];
  const match = { [field]: cat.name };
  if (cat.type === 'subject') Object.assign(match, { branch: cat.branch, semester: cat.semester });
  const [notes, subs] = await Promise.all([Note.countDocuments(match), Submission.countDocuments(match)]);
  return notes + subs;
}

// GET /api/categories?type=&branch=&semester=   (public)
exports.listCategories = asyncHandler(async (req, res) => {
  const filter = {};
  if (['branch', 'subject', 'noteType'].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.branch) filter.branch = String(req.query.branch);
  if (req.query.semester) filter.semester = Number(req.query.semester);
  const categories = await Category.find(filter).sort({ type: 1, order: 1, name: 1 }).lean();
  res.json({ success: true, message: 'Categories fetched.', data: categories });
});

// POST /api/categories (admin)
exports.createCategory = asyncHandler(async (req, res) => {
  const { type, name, branch, semester } = req.body;
  if (!type) throw new AppError(400, 'Category type is required.');
  if (type === 'subject') {
    if (!(await Category.exists({ type: 'branch', name: branch }))) {
      throw new AppError(400, 'Pick an existing branch for this subject.');
    }
  }
  const category = await Category.create({ type, name, branch, semester: semester ? Number(semester) : undefined });
  res.status(201).json({ success: true, message: 'Category added.', data: category });
});

// PUT /api/categories/:id (admin). Renaming also updates notes and submissions that use the old name.
exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError(404, 'Category not found.');

  const oldName = category.name;
  const nameChanged = req.body.name && req.body.name !== oldName;
  category.name = req.body.name;
  await category.save();

  if (nameChanged) {
    if (category.type === 'branch') {
      await Promise.all([
        Note.updateMany({ branch: oldName }, { branch: category.name }),
        Submission.updateMany({ branch: oldName }, { branch: category.name }),
        Category.updateMany({ type: 'subject', branch: oldName }, { branch: category.name }),
      ]);
    } else if (category.type === 'subject') {
      const match = { subject: oldName, branch: category.branch, semester: category.semester };
      await Promise.all([
        Note.updateMany(match, { subject: category.name }),
        Submission.updateMany(match, { subject: category.name }),
      ]);
    } else {
      await Promise.all([
        Note.updateMany({ unit: oldName }, { unit: category.name }),
        Submission.updateMany({ unit: oldName }, { unit: category.name }),
      ]);
    }
  }
  res.json({ success: true, message: 'Category updated.', data: category });
});

// DELETE /api/categories/:id (admin)
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError(404, 'Category not found.');

  if (category.type === 'branch') {
    const subjects = await Category.countDocuments({ type: 'subject', branch: category.name });
    if (subjects) throw new AppError(409, 'Delete this branch\u2019s subjects first.');
  }
  if (await usageCount(category)) {
    throw new AppError(409, 'This category is used by existing notes or submissions, so it cannot be deleted.');
  }
  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted.', data: {} });
});
