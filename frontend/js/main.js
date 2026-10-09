/* Public site: shared header/footer and the home page. */
(function layout() {
  const nav = document.body.dataset.nav || '';
  const link = (key, href, label) => `<a href="${href}" ${nav === key ? 'aria-current="page"' : ''}>${label}</a>`;

  const header = $('#site-header');
  if (header) {
    header.className = 'site-header';
    header.innerHTML = `<div class="container nav">
      <a class="brand" href="/index.html"><span class="brand-mark" aria-hidden="true"></span>AKTU Notes</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navLinks">Menu</button>
      <nav class="nav-links" id="navLinks" aria-label="Main">
        ${link('browse', '/browse.html', 'Browse')}
        ${link('submit', '/submit.html', 'Submit notes')}
        ${link('about', '/about.html', 'About')}
        ${link('contact', '/contact.html', 'Contact')}
        <form class="nav-search" id="navSearch" role="search">
          <label class="sr-only" for="navQ">Search notes</label>
          <input id="navQ" name="q" type="search" placeholder="Search notes" autocomplete="off">
          <button type="submit">Search</button>
        </form>
      </nav>
    </div>`;
    const toggle = $('.nav-toggle', header);
    toggle.addEventListener('click', () => {
      const open = $('#navLinks').classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $('#navSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      if (q) location.href = `/notes.html?q=${encodeURIComponent(q)}`;
    });
  }

  const footer = $('#site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `<div class="container">
      <div class="footer-grid">
        <div><h3>AKTU Notes Portal</h3><p>Study notes for AKTU students, shared by students and reviewed before they go live.</p></div>
        <div><h3>Explore</h3><ul><li><a href="/browse.html">Browse notes</a></li><li><a href="/submit.html">Submit notes</a></li><li><a href="/notes.html">All notes</a></li></ul></div>
        <div><h3>About</h3><ul><li><a href="/about.html">About</a></li><li><a href="/contact.html">Contact</a></li><li><a href="/admin/login">Admin</a></li></ul></div>
      </div>
      <p class="footer-bottom">&copy; ${new Date().getFullYear()} AKTU Notes Portal. Not affiliated with Dr. A.P.J. Abdul Kalam Technical University.</p>
    </div>`;
  }
})();

async function initHome() {
  $('#heroSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    location.href = q ? `/notes.html?q=${encodeURIComponent(q)}` : '/notes.html';
  });

  const fillList = async (selector, loader, render, empty) => {
    const el = $(selector);
    showLoading(el, 3);
    try {
      const html = await loader();
      if (!html) return showState(el, empty);
      el.removeAttribute('aria-busy');
      el.innerHTML = html;
    } catch (err) {
      showState(el, { title: 'Could not load this section', text: err.message });
    }
  };
  const noteGrid = (notes) => (notes.length ? notes.map(noteCard).join('') : '');
  const emptyNotes = { title: 'No notes yet', text: 'Be the first to share notes for your subject.', action: { label: 'Submit notes', href: '/submit.html' } };

  fillList('#popularSubjects', async () => {
    const { subjects } = await Api.notes.popularSubjects();
    return subjects.length
      ? `<div class="chip-row">${subjects.map((s) => `<a class="chip" href="/notes.html?${qs({ subject: s.subject, branch: s.branch, year: s.year, semester: s.semester }).slice(1)}">${esc(s.subject)} <small>${esc(s.branch)} &middot; ${s.notes} ${s.notes === 1 ? 'note' : 'notes'}</small></a>`).join('')}</div>`
      : '';
  }, null, { title: 'No subjects yet', text: 'Popular subjects appear once notes are published.' });

  fillList('#recentNotes', async () => noteGrid((await Api.notes.list({ sort: 'latest', limit: 6 })).notes), null, emptyNotes);
  fillList('#topNotes', async () => noteGrid((await Api.notes.list({ sort: 'downloads', limit: 6 })).notes), null, emptyNotes);

  const branchBox = $('#branchCards');
  try {
    const cats = await Taxonomy.load();
    const branches = cats.filter((c) => c.type === 'branch');
    branchBox.innerHTML = branches.length
      ? branches.map((b) => `<a class="card" href="/browse.html?branch=${encodeURIComponent(b.name)}"><h3>${esc(b.name)}</h3><p class="tile-meta">Browse ${esc(b.name)} notes</p></a>`).join('')
      : '';
    if (!branches.length) showState(branchBox, { title: 'No branches yet', text: 'The admin has not added any branches.' });
  } catch (err) {
    showState(branchBox, { title: 'Could not load branches', text: err.message });
  }
}

if (document.body.dataset.page === 'home') initHome();
