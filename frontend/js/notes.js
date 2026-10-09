/* Notes listing + search results: filters live in the URL so results can be shared. */
(async function notesPage() {
  const form = $('#filterForm');
  const results = $('#results');
  const pager = $('#pager');
  const LIMIT = 12;

  let categories = [];
  try {
    categories = await Taxonomy.load();
  } catch (err) {
    toast('Filters could not be loaded: ' + err.message, 'error');
  }
  const hierarchy = bindHierarchy(form, { categories, all: true });

  const readUrl = () => Object.fromEntries(new URLSearchParams(location.search));
  const applyToForm = (p) => {
    form.elements.q.value = p.q || '';
    form.elements.sort.value = ['latest', 'downloads', 'oldest', 'title'].includes(p.sort) ? p.sort : 'latest';
    hierarchy.set(p);
  };
  const readForm = () => ({
    q: form.elements.q.value.trim(), year: form.elements.year.value, branch: form.elements.branch.value, semester: form.elements.semester.value,
    subject: form.elements.subject.value, unit: form.elements.unit.value, sort: form.elements.sort.value === 'latest' ? '' : form.elements.sort.value,
  });

  async function load(page = 1, push = true) {
    const filters = readForm();
    const url = `${location.pathname}${qs({ ...filters, page: page > 1 ? page : '' })}`;
    if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);

    $('#resultsTitle').textContent = filters.q ? `Search results for \u201c${filters.q}\u201d` : 'All notes';
    showLoading(results, 6);
    pager.innerHTML = '';
    try {
      const data = await Api.notes.list({ ...filters, page, limit: LIMIT });
      $('#resultsCount').textContent = `${data.total} ${data.total === 1 ? 'note' : 'notes'} found`;
      if (!data.notes.length) {
        return showState(results, {
          title: 'No notes match',
          text: 'Try a different word, or clear some filters.',
          action: { label: 'Clear filters', onClick: () => { form.reset(); applyToForm({}); load(1); } },
        });
      }
      results.removeAttribute('aria-busy');
      results.innerHTML = data.notes.map(noteCard).join('');
      renderPagination(pager, data, (p) => { load(p); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    } catch (err) {
      showState(results, { title: 'Could not load notes', text: err.message, action: { label: 'Try again', onClick: () => load(page, false) } });
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); load(1); });
  form.addEventListener('change', () => load(1));
  $('#clearFilters').addEventListener('click', () => { applyToForm({}); load(1); });
  window.addEventListener('popstate', () => { applyToForm(readUrl()); load(Number(readUrl().page) || 1, false); });

  const initial = readUrl();
  applyToForm(initial);
  load(Number(initial.page) || 1, false);
})();
