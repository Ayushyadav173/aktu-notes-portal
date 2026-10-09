/* API client + small helpers shared by every page. */

// All requests go to this path. Locally Express serves both the site and the API.
// On Vercel, vercel.json forwards /api/* to your backend, so this value stays the same.
const API_BASE = '/api';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, formData } = {}) {
  const options = { method, credentials: 'include', headers: { 'X-Requested-With': 'fetch' } };
  if (formData) {
    options.body = formData; // the browser sets the multipart boundary itself
  } else if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API_BASE + path, options);
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok || (payload && payload.success === false)) {
    throw new ApiError((payload && payload.message) || `Request failed (${res.status}).`, res.status);
  }
  return payload ? payload.data : null;
}

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

const Api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  notes: {
    list: (params) => request('/notes' + qs(params)),
    get: (id) => request(`/notes/${id}`),
    popularSubjects: () => request('/notes/popular-subjects'),
    unitCounts: (params) => request('/notes/unit-counts' + qs(params)),
    download: (id) => request(`/notes/${id}/download`, { method: 'POST' }),
    create: (formData) => request('/notes', { method: 'POST', formData }),
    update: (id, formData) => request(`/notes/${id}`, { method: 'PUT', formData }),
    remove: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  },
  submissions: {
    create: (formData) => request('/submissions', { method: 'POST', formData }),
    list: (params) => request('/submissions' + qs(params)),
    approve: (id) => request(`/submissions/${id}/approve`, { method: 'PUT' }),
    reject: (id, reason) => request(`/submissions/${id}/reject`, { method: 'PUT', body: { reason } }),
  },
  categories: {
    list: (params) => request('/categories' + qs(params)),
    create: (body) => request('/categories', { method: 'POST', body }),
    update: (id, body) => request(`/categories/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  admin: { stats: () => request('/admin/stats') },
};

/* ---------- Formatting ---------- */
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const YEAR_NAMES = ['', 'First Year', 'Second Year', 'Third Year', 'Fourth Year'];
const yearLabel = (n) => YEAR_NAMES[n] || `Year ${n}`;

const fmtBytes = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Only allow web links or site paths in href/src attributes.
const safeUrl = (url) => (/^(https?:\/\/|\/)/i.test(url || '') ? url : '#');
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/* ---------- Toasts, states, modals ---------- */
function toast(message, type = 'info') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), 4500);
}

function showLoading(el, count = 3) {
  el.innerHTML = Array.from({ length: count }, () => '<div class="skeleton" aria-hidden="true"></div>').join('');
  el.setAttribute('aria-busy', 'true');
}

// Empty and error states. action: { label, href } or { label, onClick }
function showState(el, { title, text = '', action }) {
  el.removeAttribute('aria-busy');
  el.innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(text)}</p>${
    action ? (action.href ? `<a class="btn btn-primary" href="${esc(action.href)}">${esc(action.label)}</a>` : `<button class="btn btn-primary" type="button">${esc(action.label)}</button>`) : ''
  }</div>`;
  if (action && action.onClick) $('button', el).addEventListener('click', action.onClick);
}

function openModal({ title, body, actions = [] }) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<div class="modal-head"><h2></h2></div><div class="modal-body"></div><div class="modal-actions"></div>`;
  $('h2', dialog).textContent = title;
  const bodyEl = $('.modal-body', dialog);
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.append(body);

  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${action.className || 'btn-ghost'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', async () => {
      if (action.onClick) {
        btn.disabled = true;
        try {
          if ((await action.onClick(dialog)) === false) { btn.disabled = false; return; }
        } catch (err) {
          btn.disabled = false;
          toast(err.message, 'error');
          return;
        }
      }
      dialog.close();
    });
    $('.modal-actions', dialog).append(btn);
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p>${esc(message)}</p>`,
      actions: [
        { label: 'Cancel', onClick: () => resolve(false) },
        { label: confirmLabel, className: danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
      ],
    }).addEventListener('close', () => resolve(false)); // Escape key
  });
}

function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label || 'Working')}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label || button.textContent;
  }
}

/* ---------- Note card + downloads ---------- */
function noteCard(note) {
  const details = `/note-details.html?id=${encodeURIComponent(note._id)}`;
  return `<article class="note-card">
    ${note.coverImage ? `<img class="note-cover" src="${esc(safeUrl(note.coverImage))}" alt="" loading="lazy">` : ''}
    <h3><a href="${details}">${esc(note.title)}</a></h3>
    <p class="subject">${esc(note.subject)}</p>
    <ul class="meta-list">
      <li>${esc(yearLabel(note.year))}</li><li>${esc(note.branch)}</li><li>Semester ${note.semester}</li><li>${esc(note.unit)}</li>
    </ul>
    <ul class="meta-list">
      <li>${esc(note.fileType || 'PDF')}</li><li>${fmtBytes(note.fileSize)}</li><li>Added ${fmtDate(note.createdAt)}</li>
      <li>${note.downloadCount} ${note.downloadCount === 1 ? 'download' : 'downloads'}</li>
    </ul>
    <div class="actions">
      <a class="btn btn-ghost btn-sm" href="${details}">View</a>
      <button class="btn btn-primary btn-sm" type="button" data-download="${esc(note._id)}">Download</button>
    </div>
  </article>`;
}

// One handler for every Download button on every page.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-download]');
  if (!button) return;
  setBusy(button, true, 'Preparing');
  try {
    const data = await Api.notes.download(button.dataset.download);
    const link = document.createElement('a');
    link.href = safeUrl(data.fileUrl);
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = data.fileName || 'notes.pdf';
    document.body.append(link);
    link.click();
    link.remove();
    document.dispatchEvent(new CustomEvent('note-downloaded', { detail: data }));
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBusy(button, false);
  }
});

function renderPagination(el, { page, pages }, onChange) {
  if (pages <= 1) { el.innerHTML = ''; return; }
  const items = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  items.push(`<button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Previous</button>`);
  for (let i = start; i <= end; i += 1) {
    items.push(`<button type="button" data-page="${i}" ${i === page ? 'aria-current="page"' : ''}>${i}</button>`);
  }
  items.push(`<button type="button" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>Next</button>`);
  el.innerHTML = items.join('');
  $$('button[data-page]', el).forEach((b) => b.addEventListener('click', () => onChange(Number(b.dataset.page))));
}

/* ---------- Year > Branch > Semester > Subject > Unit ---------- */
const Taxonomy = {
  _promise: null,
  load() {
    if (!this._promise) this._promise = Api.categories.list().catch((err) => { this._promise = null; throw err; });
    return this._promise;
  },
  reset() { this._promise = null; },
};

// Wires up dependent <select> elements named year, semester, branch, subject, unit inside `root`.
// all: true adds "All ..." choices (for filters). values: { year, semester, branch, subject, unit }.
function bindHierarchy(root, { categories, all = false, values = {} }) {
  const pick = (name) => root.querySelector(`[name="${name}"]`);
  const sel = { year: pick('year'), semester: pick('semester'), branch: pick('branch'), subject: pick('subject'), unit: pick('unit') };
  const branches = categories.filter((c) => c.type === 'branch');
  const subjects = categories.filter((c) => c.type === 'subject');
  const noteTypes = categories.filter((c) => c.type === 'noteType');

  const fill = (select, options, placeholder) => {
    const previous = select.value;
    select.innerHTML = '';
    select.append(new Option(placeholder, ''));
    options.forEach((o) => select.append(new Option(o.label, o.value)));
    select.value = options.some((o) => o.value === previous) ? previous : '';
  };

  function refresh() {
    const year = Number(sel.year.value) || 0;
    const semesterList = year ? [2 * year - 1, 2 * year] : all ? [1, 2, 3, 4, 5, 6, 7, 8] : [];
    fill(sel.semester, semesterList.map((n) => ({ value: String(n), label: `Semester ${n}` })), all ? 'All semesters' : 'Select semester');
    sel.semester.disabled = !all && !year;

    fill(sel.branch, branches.map((b) => ({ value: b.name, label: b.name })), all ? 'All branches' : 'Select branch');

    const branch = sel.branch.value;
    const semester = Number(sel.semester.value) || 0;
    const names = [...new Set(subjects
      .filter((s) => (!branch || s.branch === branch) && (!semester || s.semester === semester) && (!year || s.year === year))
      .map((s) => s.name))].sort();
    fill(sel.subject, names.map((n) => ({ value: n, label: n })), all ? 'All subjects' : 'Select subject');
    sel.subject.disabled = !all && !(branch && semester);

    fill(sel.unit, noteTypes.map((t) => ({ value: t.name, label: t.name })), all ? 'All units' : 'Select unit');
  }

  fill(sel.year, [1, 2, 3, 4].map((n) => ({ value: String(n), label: yearLabel(n) })), all ? 'All years' : 'Select year');
  ['year', 'semester', 'branch'].forEach((name) => sel[name].addEventListener('change', refresh));

  const set = (v) => {
    sel.year.value = v.year || '';
    refresh();
    sel.semester.value = v.semester || '';
    sel.branch.value = v.branch || '';
    refresh();
    sel.subject.value = v.subject || '';
    sel.unit.value = v.unit || '';
  };
  set(values);
  return { set };
}
