const mongoose = require('mongoose');

// One collection holds the configurable parts of the hierarchy:
//   branch   -> { name: "CSE" }
//   noteType -> { name: "Unit 1" }  (Unit 1..5, Previous Year Questions, ...)
//   subject  -> { name: "Data Structures", branch: "CSE", semester: 3 }  (year is derived)
const categorySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['branch', 'subject', 'noteType'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    branch: { type: String, trim: true, maxlength: 60 },
    semester: { type: Number, min: 1, max: 8 },
    year: { type: Number, min: 1, max: 4 },
    order: { type: Number, default: 100 },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function setYear(next) {
  if (this.type === 'subject') {
    if (!this.branch) this.invalidate('branch', 'Subjects need a branch.');
    if (!this.semester) this.invalidate('semester', 'Subjects need a semester.');
    else this.year = Math.ceil(this.semester / 2);
  } else {
    this.branch = undefined;
    this.semester = undefined;
    this.year = undefined;
  }
  next();
});

categorySchema.index({ type: 1, name: 1, branch: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
