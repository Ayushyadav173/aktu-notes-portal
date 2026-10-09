/* Admin area: sidebar, auth guard, and one function per admin page. */
(async function adminApp() {
  const page = document.body.dataset.page;
  try {
    await Auth.requireAdmin();
  } catch {
    return; // requireAdmin already redirected
  }
  document.body.classList.remove('checking');

  const statsPromise = Api.admin.stats().catch(() => null);
  buildSidebar(page, statsPromise);

  const pages = { dashboard, notes: notesPage, 'add-note': addNote, 'edit-note': editNote, submissions, categories };
  if (pages[page]) pages[page]();

  /* ---------- Layout ---------- */
  async function buildSidebar(current, statsP) {
    const items = [
      ['dashboard', '/admin/dashboard.html', 'Dashboard'],
      ['notes', '/admin/notes.html', 'Notes'],
      ['add-note', '/admin/add-note.html', 'Add Note'],
      ['submissions', '/admin/submissions.html', 'Pending Submissions'],
      ['categories', '/admin/categories.html', 'Categories'],
    ];
    const active = current === 'edit-note' ? 'notes' : current;
    const side = $('#sidebar');
    side.innerHTML = `<a class="brand" href="/admin/dashboard.html"><span class="brand-mark" aria-hidden="true"></span>Admin</a>
      <nav aria-label="Admin">
        ${items.map(([key, href, label]) => `<a href="${href}" ${key === active ? 'aria-current="page"' : ''}>${label}${key === 'submissions' ? '<span class="count hidden" id="pendingCount"></span>' : ''}</a>`).join('')}
      </nav>
      <div class="spacer"><nav><a href="/index.html" target="_blank" rel="noopener">View site</a><button class="link" type="button" id="logoutBtn">Logout</button></nav></div>`;
    $('#logoutBtn').addEventListener('click', () => Auth.logout());
    const menu = $('#menuBtn');
    if (menu) menu.addEventListener('click', () => side.classList.toggle('open'));
    const stats = await statsP;
    if (stats && stats.pending) {
      const badge = $('#pendingCount');
      badge.textContent = stats.pending;
      badge.classList.remove('hidden');
    }
  }

  const statusBadge = (status) => {
    const map = { approved: ['badge-success', 'Published'], draft: ['badge-muted', 'Draft'], pending: ['badge-warning', 'Pending'], rejected: ['badge-error', 'Rejected'] };
    const [cls, label] = map[status] || ['badge-muted', status];
    return `<span class="badge ${cls}">${label}</span>`;
  };

  /* ---------- Dashboard ---------- */
  async function dashboard() {
    const box = $('#stats');
    const stats = await statsPromise;
    if (!stats) return showState(box, { title: 'Could not load statistics', text: 'Reload the page to try again.' });
    const cards = [
      ['Total notes', stats.totalNotes], ['Published notes', stats.published], ['Pending submissions', stats.pending],
      ['Rejected submissions', stats.rejected], ['Total downloads', stats.totalDownloads],
    ];
    box.className = 'stat-grid';
    box.innerHTML = cards.map(([label, n]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');

    const wrap = $('#pendingPreview');
    try {
      const { submissions } = await Api.submissions.list({ status: 'pending', limit: 5 });
      if (!submissions.length) return showState(wrap, { title: 'Nothing waiting for review', text: 'New student submissions will show up here.' });
      wrap.innerHTML = submissionTable(submissions, false);
      bindSubmissionActions(wrap, () => submissions, dashboard);
    } catch (err) {
      showState(wrap, { title: 'Could not load submissions', text: err.message });
    }
  }

  /* ---------- Notes table ---------- */
  async function notesPage() {
    const body = $('#notesTable');
    const pager = $('#notesPager');
    const state = { q: '', status: 'all', page: 1 };

    async function load() {
      showLoading(body, 3);
      try {
        const data = await Api.notes.list({ q: state.q, status: state.status, page: state.page, limit: 15, sort: 'latest' });
        if (!data.notes.length) {
          pager.innerHTML = '';
          return showState(body, { title: 'No notes found', text: state.q || state.status !== 'all' ? 'Try clearing the search or status filter.' : 'Add your first note to get started.', action: { label: 'Add note', href: '/admin/add-note.html' } });
        }
        body.removeAttribute('aria-busy');
        body.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Year</th><th>Branch</th><th>Subject</th><th>Status</th><th>Downloads</th><th>Actions</th></tr></thead><tbody>
          ${data.notes.map((n) => `<tr>
            <td class="title-cell">${esc(n.title)}</td><td>${esc(yearLabel(n.year))}</td><td>${esc(n.branch)}</td><td>${esc(n.subject)}</td>
            <td>${statusBadge(n.status)}</td><td>${n.downloadCount}</td>
            <td><div class="row-actions">
              <a class="btn btn-ghost btn-sm" href="/note-details.html?id=${n._id}" target="_blank" rel="noopener">View</a>
              <a class="btn btn-ghost btn-sm" href="/admin/edit-note.html?id=${n._id}">Edit</a>
              <button class="btn btn-danger btn-sm" type="button" data-delete="${n._id}" data-title="${esc(n.title)}">Delete</button>
            </div></td></tr>`).join('')}</tbody></table></div>`;
        renderPagination(pager, data, (p) => { state.page = p; load(); });
      } catch (err) {
        showState(body, { title: 'Could not load notes', text: err.message, action: { label: 'Try again', onClick: load } });
      }
    }

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-delete]');
      if (!btn) return;
      const ok = await confirmDialog({ title: 'Delete this note?', message: `\u201c${btn.dataset.title}\u201d and its PDF will be permanently removed.`, confirmLabel: 'Delete note', danger: true });
      if (!ok) return;
      try {
        await Api.notes.remove(btn.dataset.delete);
        toast('Note deleted', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#noteSearch').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
    $('#statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
    load();
  }

  /* ---------- Add / edit note form ---------- */
  async function renderNoteForm(mount, note) {
    let categories;
    try {
      categories = await Taxonomy.load();
    } catch (err) {
      return showState(mount, { title: 'Could not load categories', text: err.message });
    }
    if (!categories.some((c) => c.type === 'subject')) {
      return showState(mount, { title: 'Add categories first', text: 'Notes need a branch, subject and unit. Add them on the Categories page.', action: { label: 'Open categories', href: '/admin/categories.html' } });
    }

    const editing = Boolean(note);
    mount.innerHTML = `<form id="noteForm" class="panel admin-form" novalidate><div class="panel-body">
      <div id="noteAlert" role="alert"></div>
      <div class="form-grid">
        <div class="field full"><label for="title">Title</label><input class="input" id="title" name="title" maxlength="150" required></div>
        <div class="field full"><label for="description">Description</label><textarea id="description" name="description" maxlength="2000"></textarea></div>
        <div class="field"><label for="year">Year</label><select id="year" name="year" required></select></div>
        <div class="field"><label for="semester">Semester</label><select id="semester" name="semester" required></select></div>
        <div class="field"><label for="branch">Branch</label><select id="branch" name="branch" required></select></div>
        <div class="field"><label for="subject">Subject</label><select id="subject" name="subject" required></select></div>
        <div class="field"><label for="unit">Unit / topic</label><select id="unit" name="unit" required></select></div>
        <div class="field"><label for="status">Visibility</label><select id="status" name="status"><option value="approved">Published</option><option value="draft">Draft (only you can see it)</option></select></div>
        <div class="field full"><label for="tags">Tags</label><input class="input" id="tags" name="tags" placeholder="sql, normalization, joins"><span class="hint">Separate tags with commas. Up to 10.</span></div>
        <div class="field"><label for="file">PDF file${editing ? ' (leave empty to keep the current file)' : ''}</label><input id="file" name="file" type="file" accept="application/pdf,.pdf" ${editing ? '' : 'required'}>
          ${editing ? `<span class="hint">Current: <a href="${esc(safeUrl(note.fileUrl))}" target="_blank" rel="noopener">${esc(note.fileName)}</a> (${fmtBytes(note.fileSize)})</span>` : ''}</div>
        <div class="field"><label for="coverImage">Cover image (optional)</label><input id="coverImage" name="coverImage" type="file" accept="image/png,image/jpeg"><span class="hint">JPG or PNG, up to 2 MB.</span></div>
      </div>
      <button class="btn btn-primary" type="submit">${editing ? 'Save changes' : 'Publish note'}</button>
      <a class="btn btn-ghost" href="/admin/notes.html">Cancel</a>
    </div></form>`;

    const form = $('#noteForm');
    bindHierarchy(form, { categories, values: note || {} });
    if (editing) {
      form.elements.title.value = note.title;
      form.elements.description.value = note.description || '';
      form.elements.tags.value = (note.tags || []).join(', ');
      form.elements.status.value = note.status;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertBox = $('#noteAlert');
      alertBox.className = '';
      alertBox.textContent = '';
      const data = new FormData(form);
      if (!data.get('file').size) data.delete('file');
      if (!data.get('coverImage').size) data.delete('coverImage');
      const button = $('button[type="submit"]', form);
      setBusy(button, true, editing ? 'Saving' : 'Uploading');
      try {
        if (editing) await Api.notes.update(note._id, data);
        else await Api.notes.create(data);
        toast(editing ? 'Note updated' : 'Note published', 'success');
        setTimeout(() => location.assign('/admin/notes.html'), 600);
      } catch (err) {
        alertBox.className = 'alert alert-error';
        alertBox.textContent = err.message;
        setBusy(button, false);
      }
    });
  }

  function addNote() { renderNoteForm($('#noteFormMount'), null); }

  async function editNote() {
    const mount = $('#noteFormMount');
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return showState(mount, { title: 'No note selected', text: 'Choose a note from the Notes page.', action: { label: 'Go to notes', href: '/admin/notes.html' } });
    try {
      const { note } = await Api.notes.get(id);
      renderNoteForm(mount, note);
    } catch (err) {
      showState(mount, { title: 'Could not load this note', text: err.message, action: { label: 'Go to notes', href: '/admin/notes.html' } });
    }
  }

  /* ---------- Submissions ---------- */
  function submissionTable(rows, withReason) {
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Note</th><th>Branch</th><th>Subject</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((s) => `<tr>
        <td>${esc(s.studentName)}<br><small class="muted">${esc(s.email)}</small></td>
        <td class="title-cell">${esc(s.title)}</td><td>${esc(s.branch)}</td><td>${esc(s.subject)}</td>
        <td>${statusBadge(s.status)}</td><td>${fmtDate(s.createdAt)}</td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-view="${s._id}">View</button>
          ${s.status === 'pending' ? `<button class="btn btn-primary btn-sm" type="button" data-approve="${s._id}">Approve</button><button class="btn btn-danger btn-sm" type="button" data-reject="${s._id}">Reject</button>` : ''}
        </div></td></tr>`).join('')}</tbody></table></div>`;
  }

  function viewSubmission(s) {
    const rows = [
      ['Student', s.studentName], ['Email', s.email], ['Year', yearLabel(s.year)], ['Branch', s.branch], ['Semester', s.semester],
      ['Subject', s.subject], ['Unit', s.unit], ['Tags', (s.tags || []).join(', ') || 'None'], ['Submitted', fmtDate(s.createdAt)],
      ['File', `${s.fileName} (${fmtBytes(s.fileSize)})`],
    ];
    if (s.status === 'rejected') rows.push(['Rejection reason', s.rejectionReason || 'No reason given']);
    const body = document.createElement('div');
    body.innerHTML = `<h3></h3><p class="muted"></p><dl class="details">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p style="margin-top:1rem"><a class="btn btn-secondary btn-sm" href="${esc(safeUrl(s.fileUrl))}" target="_blank" rel="noopener">Open PDF</a></p>`;
    $('h3', body).textContent = s.title;
    $('p', body).textContent = s.description;
    openModal({ title: 'Submission details', body, actions: [{ label: 'Close' }] });
  }

  function bindSubmissionActions(container, getRows, reload) {
    container.addEventListener('click', async (e) => {
      const rows = getRows();
      const view = e.target.closest('[data-view]');
      const approve = e.target.closest('[data-approve]');
      const reject = e.target.closest('[data-reject]');
      if (view) return viewSubmission(rows.find((r) => r._id === view.dataset.view));
      if (approve) {
        const s = rows.find((r) => r._id === approve.dataset.approve);
        if (!(await confirmDialog({ title: 'Approve this note?', message: `\u201c${s.title}\u201d will be published for everyone.`, confirmLabel: 'Approve and publish' }))) return;
        try { await Api.submissions.approve(s._id); toast('Approved and published', 'success'); location.reload(); } catch (err) { toast(err.message, 'error'); reload(); }
      }
      if (reject) {
        const s = rows.find((r) => r._id === reject.dataset.reject);
        openModal({
          title: 'Reject this submission',
          body: `<p>\u201c${esc(s.title)}\u201d stays on record but is never shown publicly.</p><div class="field"><label for="reason">Reason (optional)</label><textarea id="reason" class="input" maxlength="500" placeholder="For example: file is unreadable, or the notes are incomplete."></textarea></div>`,
          actions: [
            { label: 'Cancel' },
            { label: 'Reject submission', className: 'btn-danger', onClick: async (d) => { await Api.submissions.reject(s._id, $('#reason', d).value.trim()); toast('Submission rejected', 'success'); location.reload(); } },
          ],
        });
      }
    });
  }

  function submissions() {
    const body = $('#submissionsTable');
    const pager = $('#submissionsPager');
    const state = { status: 'pending', page: 1 };
    bindSubmissionActions(body, () => body._rows || [], () => load());

    async function load() {
      showLoading(body, 3);
      try {
        const data = await Api.submissions.list({ status: state.status === 'all' ? '' : state.status, page: state.page, limit: 15 });
        if (!data.submissions.length) {
          pager.innerHTML = '';
          return showState(body, { title: state.status === 'pending' ? 'Nothing waiting for review' : 'No submissions here', text: 'Student submissions will appear in this list.' });
        }
        body.removeAttribute('aria-busy');
        body.innerHTML = submissionTable(data.submissions, true);
        body._rows = data.submissions;
        renderPagination(pager, data, (p) => { state.page = p; load(); });
      } catch (err) {
        showState(body, { title: 'Could not load submissions', text: err.message, action: { label: 'Try again', onClick: load } });
      }
    }
    $$('.tabs button').forEach((tab) => tab.addEventListener('click', () => {
      $$('.tabs button').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      state.status = tab.dataset.status;
      state.page = 1;
      load();
    }));
    load();
  }

  /* ---------- Categories ---------- */
  async function categories() {
    const root = $('#categoriesRoot');
    let cats;
    const refresh = async () => {
      Taxonomy.reset();
      try { cats = await Taxonomy.load(); } catch (err) { return showState(root, { title: 'Could not load categories', text: err.message, action: { label: 'Try again', onClick: refresh } }); }
      render();
    };

    function listPanel(title, type, items, hint) {
      return `<section class="panel"><div class="panel-head"><h2>${title}</h2><span class="muted">${items.length} total</span></div><div class="panel-body">
        <p class="muted">${hint}</p>
        <ul class="cat-list">${items.map((c) => `<li><span>${esc(c.name)}</span><span class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit="${c._id}">Rename</button><button class="btn btn-danger btn-sm" type="button" data-del="${c._id}" data-name="${esc(c.name)}">Delete</button></span></li>`).join('') || '<li class="muted">Nothing here yet.</li>'}</ul>
        <form class="inline-form" data-add="${type}"><label class="sr-only" for="add-${type}">New ${title}</label><input class="input" id="add-${type}" name="name" maxlength="100" placeholder="Add new" required><button class="btn btn-primary" type="submit">Add</button></form>
      </div></section>`;
    }

    function render() {
      const branches = cats.filter((c) => c.type === 'branch');
      const types = cats.filter((c) => c.type === 'noteType');
      const subjects = cats.filter((c) => c.type === 'subject');
      root.innerHTML = `${listPanel('Branches', 'branch', branches, 'Renaming a branch updates every note and subject that uses it.')}
        ${listPanel('Units and note types', 'noteType', types, 'These are the choices in the Unit field, such as Unit 1 or Previous Year Questions.')}
        <section class="panel"><div class="panel-head"><h2>Subjects</h2><span class="muted">${subjects.length} total</span></div><div class="panel-body">
          <p class="muted">Each subject belongs to one branch and one semester. Students can only pick subjects listed here.</p>
          <div class="table-wrap"><table class="table"><thead><tr><th>Subject</th><th>Branch</th><th>Year</th><th>Semester</th><th>Actions</th></tr></thead><tbody>
            ${subjects.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.branch)}</td><td>${esc(yearLabel(c.year))}</td><td>${c.semester}</td><td><div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit="${c._id}">Rename</button><button class="btn btn-danger btn-sm" type="button" data-del="${c._id}" data-name="${esc(c.name)}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No subjects yet.</td></tr>'}
          </tbody></table></div>
          <form class="inline-form" data-add="subject">
            <input class="input" name="name" maxlength="100" placeholder="Subject name" aria-label="Subject name" required>
            <select name="branch" aria-label="Branch" required><option value="">Branch</option>${branches.map((b) => `<option>${esc(b.name)}</option>`).join('')}</select>
            <select name="semester" aria-label="Semester" required><option value="">Semester</option>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}">Semester ${n}</option>`).join('')}</select>
            <button class="btn btn-primary" type="submit">Add subject</button>
          </form>
        </div></section>`;
    }

    root.addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-add]');
      if (!form) return;
      e.preventDefault();
      const body = { type: form.dataset.add, name: form.elements.name.value.trim() };
      if (form.dataset.add === 'subject') Object.assign(body, { branch: form.elements.branch.value, semester: Number(form.elements.semester.value) });
      const btn = $('button[type="submit"]', form);
      setBusy(btn, true, 'Adding');
      try { await Api.categories.create(body); toast('Added', 'success'); await refresh(); } catch (err) { toast(err.message, 'error'); setBusy(btn, false); }
    });

    root.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-del]');
      if (edit) {
        const cat = cats.find((c) => c._id === edit.dataset.edit);
        openModal({
          title: `Rename ${cat.name}`,
          body: `<div class="field"><label for="newName">New name</label><input class="input" id="newName" maxlength="100" value="${esc(cat.name)}"></div>`,
          actions: [
            { label: 'Cancel' },
            { label: 'Save name', className: 'btn-primary', onClick: async (d) => {
              const name = $('#newName', d).value.trim();
              if (!name) { toast('Enter a name', 'error'); return false; }
              await Api.categories.update(cat._id, { name });
              toast('Renamed', 'success');
              await refresh();
            } },
          ],
        });
      }
      if (del) {
        if (!(await confirmDialog({ title: 'Delete this category?', message: `\u201c${del.dataset.name}\u201d will be removed. Categories used by notes cannot be deleted.`, confirmLabel: 'Delete', danger: true }))) return;
        try { await Api.categories.remove(del.dataset.del); toast('Deleted', 'success'); await refresh(); } catch (err) { toast(err.message, 'error'); }
      }
    });

    showLoading(root, 3);
    refresh();
  }
})();
