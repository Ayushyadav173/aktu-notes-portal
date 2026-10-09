const AppError = require('./AppError');
const Category = require('../models/Category');

// Year 1 = semesters 1-2, year 2 = semesters 3-4, and so on.
const yearOfSemester = (semester) => Math.ceil(Number(semester) / 2);

// Makes sure year/branch/semester/subject/unit are a real combination from the Category table.
async function validateHierarchy({ year, branch, semester, subject, unit }) {
  year = Number(year);
  semester = Number(semester);

  if (yearOfSemester(semester) !== year) {
    throw new AppError(400, 'The semester does not belong to the selected year.');
  }
  const [branchOk, subjectOk, unitOk] = await Promise.all([
    Category.exists({ type: 'branch', name: String(branch) }),
    Category.exists({ type: 'subject', name: String(subject), branch: String(branch), semester }),
    Category.exists({ type: 'noteType', name: String(unit) }),
  ]);
  if (!branchOk) throw new AppError(400, 'Unknown branch. Pick one from the list.');
  if (!subjectOk) throw new AppError(400, 'That subject is not listed for this branch and semester.');
  if (!unitOk) throw new AppError(400, 'Unknown unit or note type.');
}

module.exports = { validateHierarchy, yearOfSemester };
