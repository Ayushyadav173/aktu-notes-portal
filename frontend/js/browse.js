/* Browse: Year > Branch > Semester > Subject > units, driven by URL query parameters. */
(async function browse() {
  const root = $('#browseRoot');
  const params = new URLSearchParams(location.search);
  const year = Number(params.get('year')) || 0;
  const branch = params.get('branch') || '';
  const semester = Number(params.get('semester')) || 0;
  const subject = params.get('subject') || '';

  const href = (o) => `/browse.html${qs(o)}`;
  const tile = (url, title, meta) => `<a class="card" href="${url}"><h3>${esc(title)}</h3><p class="tile-meta">${esc(meta)}</p></a>`;
  const setHead = (title, sub, trail) => {
    $('#browseTitle').textContent = title;
    $('#browseSub').textContent = sub;
    document.title = `${title} | AKTU Notes Portal`;
    $('#crumbs').innerHTML = [['Home', '/index.html'], ['Browse', '/browse.html'], ...trail]
      .map(([label, url], i, all) => (i === all.length - 1 ? `<li aria-current="page">${esc(label)}</li>` : `<li><a href="${url}">${esc(label)}</a></li>`))
      .join('');
  };

  let cats;
  showLoading(root, 4);
  try {
    cats = await Taxonomy.load();
  } catch (err) {
    return showState(root, { title: 'Could not load the catalog', text: err.message, action: { label: 'Try again', onClick: () => location.reload() } });
  }
  const subjects = cats.filter((c) => c.type === 'subject');
  const noteTypes = cats.filter((c) => c.type === 'noteType');
  const grid = (html, cols = 'grid-4') => { root.removeAttribute('aria-busy'); root.innerHTML = `<div class="grid ${cols}">${html}</div>`; };
  const empty = (title, text) => showState(root, { title, text, action: { label: 'Back to browse', href: '/browse.html' } });

  // 1. Pick a year (optionally already narrowed to a branch from the home page).
  if (!year) {
    const years = [1, 2, 3, 4].filter((y) => !branch || subjects.some((s) => s.year === y && s.branch === branch));
    setHead(branch ? `${branch} notes` : 'Browse notes', 'Start with your year.', branch ? [[branch, '#']] : []);
    if (!years.length) return empty('Nothing here yet', `No subjects have been added for ${branch}.`);
    return grid(years.map((y) => tile(href({ year: y, branch }), yearLabel(y), `Semesters ${2 * y - 1} and ${2 * y}`)).join(''));
  }

  const yearCrumb = [yearLabel(year), href({ year })];

  // 2. Pick a branch.
  if (!branch) {
    const names = [...new Set(subjects.filter((s) => s.year === year).map((s) => s.branch))];
    const ordered = cats.filter((c) => c.type === 'branch' && names.includes(c.name));
    setHead(yearLabel(year), 'Choose your branch.', [[yearLabel(year), '#']]);
    if (!ordered.length) return empty('No branches yet', `No subjects have been added for ${yearLabel(year)}.`);
    return grid(ordered.map((b) => tile(href({ year, branch: b.name }), b.name, `${subjects.filter((s) => s.year === year && s.branch === b.name).length} subjects`)).join(''));
  }

  const branchCrumb = [branch, href({ year, branch })];

  // 3. Pick a semester.
  if (!semester) {
    setHead(`${yearLabel(year)}, ${branch}`, 'Choose your semester.', [yearCrumb, [branch, '#']]);
    return grid([2 * year - 1, 2 * year].map((s) => tile(href({ year, branch, semester: s }), `Semester ${s}`, `${subjects.filter((x) => x.branch === branch && x.semester === s).length} subjects`)).join(''), 'grid-3');
  }

  const semesterCrumb = [`Semester ${semester}`, href({ year, branch, semester })];

  // 4. Pick a subject.
  if (!subject) {
    const list = subjects.filter((s) => s.branch === branch && s.semester === semester);
    setHead(`${branch}, Semester ${semester}`, 'Choose a subject.', [yearCrumb, branchCrumb, [`Semester ${semester}`, '#']]);
    if (!list.length) return empty('No subjects yet', 'The admin has not added subjects for this semester.');
    return grid(list.map((s) => tile(href({ year, branch, semester, subject: s.name }), s.name, `${branch} \u00b7 Semester ${semester}`)).join(''), 'grid-3');
  }

  // 5. Subject page: every unit / note type with its note count.
  setHead(`${subject} notes`, `${yearLabel(year)}, ${branch}, Semester ${semester}`, [yearCrumb, branchCrumb, semesterCrumb, [subject, '#']]);
  try {
    const { counts } = await Api.notes.unitCounts({ year, branch, semester, subject });
    const filters = { year, branch, semester, subject };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const tiles = noteTypes.map((t) => {
      const n = counts[t.name] || 0;
      return tile(`/notes.html${qs({ ...filters, unit: t.name })}`, t.name, n ? `${n} ${n === 1 ? 'note' : 'notes'}` : 'No notes yet');
    });
    grid(tiles.join(''), 'grid-3');
    root.insertAdjacentHTML('afterbegin', `<p><a class="btn btn-secondary" href="/notes.html${qs(filters)}">View all ${total} notes for ${esc(subject)}</a></p>`);
    if (!total) root.insertAdjacentHTML('beforeend', `<p class="muted">Nothing published yet for this subject. <a href="/submit.html">Submit your notes</a> to get it started.</p>`);
  } catch (err) {
    showState(root, { title: 'Could not load notes', text: err.message, action: { label: 'Try again', onClick: () => location.reload() } });
  }
})();
