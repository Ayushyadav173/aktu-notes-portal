// Creates the one and only admin account. Run once:  npm run seed:admin
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
    if (ADMIN_PASSWORD.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters.');

    await connectDB();
    if (await User.exists({ role: 'admin' })) {
      console.log('An admin already exists. Nothing to do. (There can only be one admin.)');
    } else {
      const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await User.create({ name: ADMIN_NAME || 'Admin', email: ADMIN_EMAIL, password, role: 'admin' });
      console.log(`Admin created: ${ADMIN_EMAIL}. You can now remove ADMIN_PASSWORD from .env.`);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
