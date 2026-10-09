// Adds starter branches, note types and a few SAMPLE subjects. Safe to run more than once.
// Edit the subjects to match the current AKTU syllabus from the admin Categories page.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');

const branches = ['Common', 'CSE', 'IT', 'ECE', 'EEE', 'ME', 'Civil', 'AI/ML'];
const noteTypes = [
  'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5',
  'Previous Year Questions', 'Important Questions', 'Complete Notes',
];
const subjects = [
  // [name, branch, semester]
  ['Engineering Mathematics-I', 'Common', 1],
  ['Engineering Physics', 'Common', 1],
  ['Programming for Problem Solving', 'Common', 2],
  ['Engineering Chemistry', 'Common', 2],
  ['Data Structures', 'CSE', 3],
  ['Computer Organization and Architecture', 'CSE', 3],
  ['Operating Systems', 'CSE', 4],
  ['Database Management System', 'CSE', 5],
  ['Design and Analysis of Algorithms', 'CSE', 5],
  ['Compiler Design', 'CSE', 6],
  ['Data Structures', 'IT', 3],
  ['Database Management System', 'IT', 5],
];

(async () => {
  try {
    await connectDB();
    const docs = [
      ...branches.map((name, i) => ({ type: 'branch', name, order: i })),
      ...noteTypes.map((name, i) => ({ type: 'noteType', name, order: i })),
      ...subjects.map(([name, branch, semester]) => ({ type: 'subject', name, branch, semester })),
    ];
    let added = 0;
    for (const doc of docs) {
      const filter = { type: doc.type, name: doc.name, branch: doc.branch, semester: doc.semester };
      if (!(await Category.exists(filter))) {
        await Category.create(doc);
        added += 1;
      }
    }
    console.log(`Categories ready. ${added} new entries added.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
