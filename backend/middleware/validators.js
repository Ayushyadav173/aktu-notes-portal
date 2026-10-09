const { body, param, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Turns express-validator results into our standard 400 error.
const handleValidation = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => e.msg);
  next(new AppError(400, errors[0], errors));
};

const text = (field, label, min, max) =>
  body(field)
    .isString().withMessage(`${label} is required.`)
    .trim()
    .isLength({ min, max }).withMessage(`${label} must be ${min}-${max} characters.`);

const hierarchy = [
  body('year').isInt({ min: 1, max: 4 }).withMessage('Year must be 1 to 4.'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be 1 to 8.'),
  text('branch', 'Branch', 1, 60),
  text('subject', 'Subject', 1, 100),
  text('unit', 'Unit', 1, 60),
];

const tags = body('tags')
  .optional({ values: 'falsy' })
  .isString()
  .isLength({ max: 300 })
  .withMessage('Tags are too long.');

const login = [
  body('email').isString().trim().toLowerCase().isEmail().withMessage('Enter a valid email address.'),
  body('password').isString().isLength({ min: 1, max: 200 }).withMessage('Password is required.'),
  handleValidation,
];

const adminNote = [
  text('title', 'Title', 3, 150),
  body('description').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }).withMessage('Description is too long.'),
  ...hierarchy,
  tags,
  body('status').optional().isIn(['approved', 'draft']).withMessage('Status must be approved or draft.'),
  handleValidation,
];

const submission = [
  text('studentName', 'Name', 2, 80),
  body('email').isString().trim().toLowerCase().isEmail().withMessage('Enter a valid email address.'),
  text('title', 'Note title', 3, 150),
  text('description', 'Description', 10, 2000),
  ...hierarchy,
  tags,
  handleValidation,
];

const category = [
  body('type').optional().isIn(['branch', 'subject', 'noteType']).withMessage('Invalid category type.'),
  text('name', 'Name', 1, 100),
  body('branch').optional({ values: 'falsy' }).isString().trim().isLength({ max: 60 }),
  body('semester').optional({ values: 'falsy' }).isInt({ min: 1, max: 8 }).withMessage('Semester must be 1 to 8.'),
  handleValidation,
];

const reject = [
  body('reason').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }).withMessage('Reason must be 500 characters or fewer.'),
  handleValidation,
];

const mongoId = [param('id').isMongoId().withMessage('Invalid id.'), handleValidation];

module.exports = { login, adminNote, submission, category, reject, mongoId };
