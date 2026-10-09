process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');

let mongo;
const admin = { email: 'admin@test.com', password: 'Password123!' };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.create({ name: 'Admin', email: admin.email, password: await bcrypt.hash(admin.password, 4), role: 'admin' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('public API', () => {
  test('health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('unknown API route returns JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('notes list is public and empty at first', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toEqual([]);
  });

  test('submission without a file is rejected', async () => {
    const res = await request(app).post('/api/submissions').field('title', 'x');
    expect(res.status).toBe(400);
  });
});

describe('admin protection', () => {
  test('stats require login', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('wrong password is rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('login sets an HTTP-only cookie and unlocks admin routes', async () => {
    const login = await request(app).post('/api/auth/login').send(admin);
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/i);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.data.user.role).toBe('admin');

    const stats = await request(app).get('/api/admin/stats').set('Cookie', cookie);
    expect(stats.status).toBe(200);
  });

  test('state-changing admin requests need the X-Requested-With header', async () => {
    const login = await request(app).post('/api/auth/login').send(admin);
    const cookie = login.headers['set-cookie'][0];
    const res = await request(app).post('/api/categories').set('Cookie', cookie).send({ type: 'branch', name: 'CSE' });
    expect(res.status).toBe(403);
    const ok = await request(app).post('/api/categories').set('Cookie', cookie).set('X-Requested-With', 'fetch').send({ type: 'branch', name: 'CSE' });
    expect(ok.status).toBe(201);
  });
});
