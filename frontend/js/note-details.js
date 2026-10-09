(async function noteDetails() {
  const root = $('#detailRoot');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showState(root, { title: 'No note selected', text: 'Open a note from the browse page.', action: { label: 'Browse notes', href: '/browse.html' } });

  showLoading(root, 2);
  let note;
  try {
    ({ note } = await Api.notes.get(id));
  } catch (err) {
    return showState(root, {
      title: err.status === 404 ? 'Note not found' : 'Could not load this note',
      text: err.status === 404 ? 'It may have been removed or is not published.' : err.message,
      action: { label: 'Browse notes', href: '/browse.html' },
    });
  }

  document.title = `${note.title} | AKTU Notes Portal`;
  const filters = { year: note.year, branch: note.branch, semester: note.semester, subject: note.subject };
  $('#crumbs').innerHTML = `<li><a href="/index.html">Home</a></li><li><a href="/browse.html">Browse</a></li>
    <li><a href="/browse.html${qs({ year: note.year })}">${esc(yearLabel(note.year))}</a></li>
    <li><a href="/browse.html${qs({ year: note.year, branch: note.branch })}">${esc(note.branch)}</a></li>
    <li><a href="/browse.html${qs(filters)}">${esc(note.subject)}</a></li><li aria-current="page">${esc(note.title)}</li>`;

  const downloads = (n) => `Downloaded ${n} ${n === 1 ? 'time' : 'times'}`;
  const isDraft = note.status !== 'approved';
  root.removeAttribute('aria-busy');
  root.innerHTML = `<div class="detail-grid">
    <div>
      <h1>${esc(note.title)}</h1>
      <p class="muted">${esc(note.subject)} &middot; ${esc(note.unit)}</p>
      ${isDraft ? '<p class="alert alert-error">This note is a draft and only visible to you as admin.</p>' : ''}
      ${note.coverImage ? `<img class="note-cover" src="${esc(safeUrl(note.coverImage))}" alt="Cover for ${esc(note.title)}">` : ''}
      <h2 style="margin-top:1.5rem">About these notes</h2>
      <p class="prose">${note.description ? esc(note.description) : 'No description was added.'}</p>
      ${note.tags.length ? `<div class="tags">${note.tags.map((t) => `<a class="tag" href="/notes.html?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
    </div>
    <aside class="card download-box">
      <dl class="details">
        <dt>Year</dt><dd>${esc(yearLabel(note.year))}</dd>
        <dt>Branch</dt><dd>${esc(note.branch)}</dd>
        <dt>Semester</dt><dd>${note.semester}</dd>
        <dt>Unit</dt><dd>${esc(note.unit)}</dd>
        <dt>File</dt><dd>${esc(note.fileType || 'PDF')}, ${fmtBytes(note.fileSize)}</dd>
        <dt>Shared by</dt><dd>${esc(note.uploadedBy)}</dd>
        <dt>Added</dt><dd>${fmtDate(note.createdAt)}</dd>
      </dl>
      <p style="margin-top:1.25rem"><a class="btn btn-ghost btn-block" href="${esc(safeUrl(note.fileUrl))}" target="_blank" rel="noopener">View in browser</a></p>
      ${isDraft ? '' : `<button class="btn btn-primary btn-block" type="button" data-download="${esc(note._id)}">Download PDF</button>
      <p class="download-count" id="downloadCount">${downloads(note.downloadCount)}</p>`}
    </aside>
  </div>`;

  document.addEventListener('note-downloaded', (e) => {
    const el = $('#downloadCount');
    if (el) el.textContent = downloads(e.detail.downloadCount);
  });

  // More notes from the same subject
  try {
    const { notes } = await Api.notes.list({ ...filters, limit: 4, sort: 'downloads' });
    const related = notes.filter((n) => n._id !== note._id).slice(0, 3);
    if (related.length) {
      $('#relatedWrap').classList.remove('hidden');
      $('#related').innerHTML = related.map(noteCard).join('');
    }
  } catch { /* related notes are optional */ }
})();
