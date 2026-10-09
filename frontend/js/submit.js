(async function submitPage() {
  const form = $('#submitForm');
  const alertBox = $('#formAlert');
  const MAX_PDF = 20 * 1024 * 1024;
  const MAX_COVER = 2 * 1024 * 1024;

  try {
    const categories = await Taxonomy.load();
    bindHierarchy(form, { categories });
  } catch (err) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = `The subject list could not be loaded: ${err.message}`;
  }

  const fail = (message) => {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = message;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Mirrors the server rules so mistakes are caught before a large upload starts.
  function validate() {
    const f = form.elements;
    const required = [['studentName', 'your name'], ['email', 'your email'], ['title', 'a note title'], ['description', 'a short description'], ['year', 'a year'], ['branch', 'a branch'], ['semester', 'a semester'], ['subject', 'a subject'], ['unit', 'a unit']];
    for (const [name, label] of required) if (!f[name].value.trim()) return `Please enter ${label}.`;
    if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return 'Enter a valid email address.';
    if (f.description.value.trim().length < 10) return 'The description should be at least 10 characters.';
    const pdf = f.file.files[0];
    if (!pdf) return 'Please choose a PDF file.';
    if (pdf.type !== 'application/pdf' || !/\.pdf$/i.test(pdf.name)) return 'Only PDF files are allowed.';
    if (pdf.size > MAX_PDF) return 'The PDF is larger than 20 MB.';
    const cover = f.coverImage.files[0];
    if (cover && (!/^image\/(jpeg|png)$/.test(cover.type) || cover.size > MAX_COVER)) return 'The cover image must be a JPG or PNG up to 2 MB.';
    return '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.className = '';
    alertBox.textContent = '';
    const problem = validate();
    if (problem) return fail(problem);

    const data = new FormData(form);
    if (!data.get('coverImage').size) data.delete('coverImage');
    const button = $('button[type="submit"]', form);
    setBusy(button, true, 'Uploading');
    try {
      await Api.submissions.create(data);
      form.classList.add('hidden');
      const done = $('#successBox');
      done.classList.remove('hidden');
      done.focus();
      form.reset();
    } catch (err) {
      fail(err.message);
    } finally {
      setBusy(button, false);
    }
  });

  $('#submitAnother').addEventListener('click', () => {
    $('#successBox').classList.add('hidden');
    form.classList.remove('hidden');
    alertBox.className = '';
    alertBox.textContent = '';
  });
})();
