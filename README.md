# AKTU Notes Portal

A study-notes website for AKTU students. Students browse, search, download and submit notes. One admin owns the site, reviews submissions and manages notes and categories.

## Features

- Browse by Year → Branch → Semester → Subject → Unit, or search and filter from the API
- Student submissions (PDF + optional cover image) that stay **pending** until the admin approves or rejects them
- Single admin account, JWT in an HTTP-only cookie, bcrypt password hash
- Admin dashboard: stats, notes CRUD, pending queue, editable categories (branches, subjects, note types)
- Download counter, file validation (MIME type, extension, real file contents, size), rate limiting, Helmet, CORS, NoSQL-injection protection
- Files in Cloudinary, only the URL and metadata in MongoDB

## Technology

| Part | Tools |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript, Fetch API |
| Backend | Node.js (18+), Express 4, Mongoose |
| Database | MongoDB (Atlas) |
| Auth | JWT, bcryptjs, cookie-parser |
| Uploads | Multer (memory) → Cloudinary |
| Security | helmet, cors, express-rate-limit, express-validator, express-mongo-sanitize |
| Tests | Jest, Supertest, mongodb-memory-server |

## Architecture

```
Browser (HTML/CSS/JS) ──fetch /api/*──▶ Express API ──▶ MongoDB Atlas
                                            └────────▶ Cloudinary (PDFs, covers)
```

Request flow: `route → middleware (rate limit, auth, upload, validation) → controller → model`. Every error goes through one error handler and leaves as `{ "success": false, "message": "..." }`.

Hierarchy: year (1–4) and semester (1–8) are fixed; semester 1–2 belongs to year 1, 3–4 to year 2, and so on. Branches, subjects and note types (Unit 1, Previous Year Questions, ...) are `Category` documents the admin can edit. Notes store those names as text, validated against Categories when saved.

## Folder structure

```
aktu-notes-portal/
├── backend/
│   ├── server.js
│   ├── config/        db.js, cloudinary.js
│   ├── models/        User, Note, Submission, Category
│   ├── controllers/   auth, note, submission, category
│   ├── routes/        auth, note, submission, category, admin
│   ├── middleware/    authMiddleware, errorMiddleware, uploadMiddleware, rateLimiters, validators
│   ├── utils/         generateToken, fileStorage, hierarchy, AppError, asyncHandler
│   ├── scripts/       seedAdmin.js, seedCategories.js
│   ├── tests/         api.test.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── *.html         index, browse, notes (also search results), note-details, submit, about, contact, login
│   ├── admin/         dashboard, notes, add-note, edit-note, submissions, categories
│   ├── css/           style.css, responsive.css, admin.css
│   ├── js/            api.js, main.js, browse.js, notes.js, note-details.js, submit.js, auth.js, admin.js
│   └── vercel.json
├── README.md
└── .gitignore
```

## Installation

You need Node.js 18+ and a MongoDB database.

```bash
cd backend
npm install
cp .env.example .env      # then edit .env
```

### MongoDB setup

Easiest is MongoDB Atlas (see Deployment). For a local database install MongoDB Community and use `MONGODB_URI=mongodb://127.0.0.1:27017/aktu-notes`.

### Environment variables

| Variable | Meaning |
|---|---|
| `PORT` | API port (default 5000) |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_URL` | Comma-separated frontend origins allowed by CORS (only needed if the frontend runs on a different origin) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token lifetime, default `1d` |
| `COOKIE_SAMESITE` | `lax` (default) for same-origin setups, `none` only for cross-domain HTTPS setups |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `npm run seed:admin` |
| `STORAGE_DRIVER` | `cloudinary` (default) or `local` (development only, refused in production) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard |
| `MAX_PDF_MB` | PDF size limit, default 20 |

Never commit `.env`. It is already in `.gitignore`.

### Admin setup

```bash
npm run seed:admin        # creates the one admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run seed:categories   # starter branches, note types and a few SAMPLE subjects
```

The seed script refuses to create a second admin, and there is no public registration route. After seeding you can delete `ADMIN_PASSWORD` from `.env`. The sample subjects are only examples: open **Admin → Categories** and make them match the current AKTU syllabus. Students can only submit notes for subjects listed there.

### File upload configuration

1. Create a free Cloudinary account and copy cloud name, API key and API secret into `.env`.
2. In Cloudinary, open Settings → Security and check that **PDF and ZIP files delivery** is allowed. Newer accounts may have it off, which makes PDF links fail with a 401 error. (Settings change over time; check the current Cloudinary docs if you cannot find it.)
3. To test without Cloudinary, set `STORAGE_DRIVER=local`. Files go to `backend/uploads/` and are served at `/uploads/...`. Use this only on your own machine.

## Running

The backend also serves the `frontend/` folder, so one command runs everything locally:

```bash
cd backend
npm run dev               # or: npm start
```

Open http://localhost:5000 (site) and http://localhost:5000/admin/login (admin).

If you prefer a separate static server for the frontend, set `CLIENT_URL` to its origin and note that cookies then cross origins (see Troubleshooting).

## API

Responses: `{ "success": true, "message": "...", "data": ... }` or `{ "success": false, "message": "..." }`. Admin routes need the login cookie and a `X-Requested-With: fetch` header on non-GET requests (the frontend sends it).

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public, rate limited | `{ email, password }` |
| POST | `/api/auth/logout` | public | clears cookie |
| GET | `/api/auth/me` | admin | current user |
| GET | `/api/notes` | public | filters: `q, year, branch, semester, subject, unit, tag, sort, page, limit`. Admin may add `status=approved|draft|all` |
| GET | `/api/notes/search?q=` | public | same as list |
| GET | `/api/notes/popular-subjects` | public | |
| GET | `/api/notes/unit-counts` | public | notes per unit for a subject |
| GET | `/api/notes/:id` | public (approved only) | admin can open drafts |
| POST | `/api/notes/:id/download` | public | increments counter, returns `fileUrl` |
| POST | `/api/notes` | admin | multipart: `title, description, year, branch, semester, subject, unit, tags, status, file, coverImage` |
| PUT | `/api/notes/:id` | admin | same fields; new files replace old ones |
| DELETE | `/api/notes/:id` | admin | also deletes stored files |
| POST | `/api/submissions` | public, rate limited | multipart: `studentName, email, title, description, year, branch, semester, subject, unit, tags, file, coverImage`; saved as `pending` |
| GET | `/api/submissions?status=` | admin | |
| GET | `/api/submissions/:id` | admin | |
| PUT | `/api/submissions/:id/approve` | admin | pending → approved, creates the public note |
| PUT | `/api/submissions/:id/reject` | admin | `{ reason }`, record is kept |
| GET | `/api/categories` | public | `?type=branch|subject|noteType` |
| POST/PUT/DELETE | `/api/categories[/:id]` | admin | delete is blocked while in use |
| GET | `/api/admin/stats` | admin | dashboard numbers |

Example requests:

```bash
# Login (saves cookie)
curl -c jar.txt -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}' http://localhost:5000/api/auth/login

# Search
curl "http://localhost:5000/api/notes/search?q=dbms"

# Student submission
curl -F studentName="Asha" -F email=asha@example.com -F title="DBMS Unit 2" \
  -F description="Normalization notes, typed" -F year=3 -F branch=CSE -F semester=5 \
  -F subject="Database Management System" -F unit="Unit 2" -F file=@dbms-unit2.pdf \
  http://localhost:5000/api/submissions

# Approve (admin)
curl -b jar.txt -H "X-Requested-With: fetch" -X PUT http://localhost:5000/api/submissions/<id>/approve
```

## Tests

```bash
cd backend
npm test
```

Uses an in-memory MongoDB (downloaded on first run, so it needs internet once).

## Deployment

Suggested free-tier setup: **MongoDB Atlas** (database), **Cloudinary** (files), **Render** (backend), **Vercel** (frontend). Free-tier limits and availability change, so check each provider's current pricing page. Free Render services sleep when idle, so the first request after a pause can take a while.

### 1. MongoDB Atlas
1. Create an Atlas account and a free cluster.
2. Database Access → add a database user with a strong password.
3. Network Access → allow access from anywhere (`0.0.0.0/0`) because Render's IPs change. Your user and password protect the database.
4. Connect → Drivers → copy the connection string, put your password in it and add a database name (for example `.../aktu-notes?...`). This is `MONGODB_URI`.

### 2. Cloud storage
Create the Cloudinary account and copy the three credentials (see File upload configuration above).

### 3. Backend on Render
1. Push the project to GitHub.
2. Render → New → Web Service → connect the repo.
3. Root directory `backend`, build command `npm install`, start command `npm start`.
4. Add environment variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `CLIENT_URL` (your Vercel URL), `COOKIE_SAMESITE=lax`.
5. After the first deploy, open the service **Shell** (or run locally with the production `MONGODB_URI`) and run `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed` once. Simplest is running it on your own computer with a `.env` pointing at Atlas.
6. Check `https://YOUR-BACKEND.onrender.com/api/health`.

### 4. Frontend on Vercel
1. Edit `frontend/vercel.json` and replace `YOUR-BACKEND.onrender.com` with your Render hostname.
2. Vercel → New Project → import the repo, set **Root Directory** to `frontend`, framework preset **Other**, no build command.
3. Deploy.

### 5. Connecting frontend and backend
The frontend always calls `/api/...` on its own domain. `vercel.json` forwards those calls to Render, so the browser sees one origin. That keeps the HTTP-only login cookie working in all browsers, including those that block cross-site cookies. Because of this you do not need a different API URL in the code.

### 6. CORS
With the Vercel proxy, requests are same-origin and CORS is not involved. `CLIENT_URL` is still worth setting to your Vercel URL so a direct cross-origin call (for example a preview deployment) is allowed. If you skip the proxy and call Render directly from the browser, set `COOKIE_SAMESITE=none`, use HTTPS everywhere, and change `API_BASE` in `frontend/js/api.js` to the full Render URL. Some browsers will still block the cookie, which is why the proxy is recommended.

### 7. Custom domain
Vercel → Project → Settings → Domains → add your domain and create the DNS records Vercel shows. Add the new domain to `CLIENT_URL` on Render (comma-separated). Custom domains on free plans may have restrictions; check current terms.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `JWT_SECRET is missing` / `MONGODB_URI is missing` | `.env` is missing or not in `backend/`. Run `cp .env.example .env`. |
| Cannot connect to MongoDB | Wrong password, special characters in the password not URL-encoded, or Atlas Network Access blocks your IP. |
| Login works but admin pages bounce back to login | Cookie not saved. Use the same origin for site and API, or set `COOKIE_SAMESITE` correctly (see CORS). |
| 403 "Missing required request header" | A non-GET admin request without `X-Requested-With: fetch` (curl users must add it). |
| "That subject is not listed for this branch and semester" | Add the subject on Admin → Categories first. |
| "File storage is not configured" | Cloudinary variables missing, or set `STORAGE_DRIVER=local` for local testing. |
| PDF link gives 401 on Cloudinary | Enable PDF delivery in Cloudinary security settings. |
| 413 "File is too large" | PDF over `MAX_PDF_MB` (default 20) or cover image over 2 MB. |
| 429 too many attempts | Login limit is 10 per 15 minutes; submissions 10 per hour per IP. |
| First request is slow on Render | Free instances sleep when idle. |

## Contact page

`frontend/contact.html` shows a placeholder email address (`you@example.com`). Replace it with your own.
