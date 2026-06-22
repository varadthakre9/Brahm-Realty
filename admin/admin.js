/* ============================================================================
   Estate Admin — panel behavior
   ============================================================================ */
(function () {
    const TEXT_FIELDS = ['name', 'location', 'rera_number', 'starting_price',
        'configurations', 'category', 'carpet_area', 'possession_date', 'about',
        'location_title', 'location_description', 'map_embed'];

    const $ = (id) => document.getElementById(id);
    const TOKEN_KEY = 'estate_admin_token';

    let projects = [];      // list cache
    let current = null;     // currently edited project (full), or null for new

    // ----------------------------------------------------------------- token
    const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
    const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
    const clearToken = () => localStorage.removeItem(TOKEN_KEY);

    // ------------------------------------------------------------------- http
    async function api(method, url, body) {
        const opts = { method, headers: {} };
        const token = getToken();
        if (token) opts.headers.Authorization = 'Bearer ' + token;
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(url, opts);
        if (res.status === 401) { clearToken(); showLogin(); throw new Error('Session expired — please log in again.'); }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
    }

    async function apiUpload(url, formData) {
        const token = getToken();
        const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: formData });
        if (res.status === 401) { clearToken(); showLogin(); throw new Error('Session expired — please log in again.'); }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
    }

    async function getJSON(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    // ------------------------------------------------------------------ utils
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    const imgUrl = (f) => (!f ? '' : (/^https?:\/\//i.test(f) ? f : '/uploads/' + encodeURIComponent(f)));

    let toastTimer;
    function toast(msg, type) {
        const t = $('toast');
        t.textContent = msg;
        t.className = 'toast show ' + (type || 'ok');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.className = 'toast ' + (type || 'ok'); }, 3200);
    }

    // ------------------------------------------------------------------ views
    function showLogin() { $('login-view').classList.remove('hidden'); $('app-view').classList.add('hidden'); }
    function showApp() { $('login-view').classList.add('hidden'); $('app-view').classList.remove('hidden'); }

    // ------------------------------------------------------------------ login
    $('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('lg-error');
        err.classList.add('hidden');
        try {
            const data = await api('POST', '/api/login', {
                username: $('lg-user').value.trim(),
                password: $('lg-pass').value,
            });
            setToken(data.token);
            showApp();
            await loadList();
            resetForm();
        } catch (ex) {
            err.textContent = ex.message;
            err.classList.remove('hidden');
        }
    });

    $('logout-btn').addEventListener('click', async () => {
        try { await api('POST', '/api/logout'); } catch (_) {}
        clearToken();
        showLogin();
        $('lg-pass').value = '';
    });

    // ------------------------------------------------------------------- list
    async function loadList() {
        try {
            projects = await getJSON('/api/projects');
            renderList();
        } catch (ex) {
            $('proj-list').innerHTML = '<p class="empty">Could not load projects.</p>';
        }
    }

    function renderList() {
        $('count').textContent = projects.length ? '(' + projects.length + ')' : '';
        const wrap = $('proj-list');
        if (!projects.length) { wrap.innerHTML = '<p class="empty">No projects yet. Click “New”.</p>'; return; }
        wrap.innerHTML = projects.map((p) => {
            const thumb = p.cover ? `<img src="${imgUrl(p.cover)}" alt="">` : '<div class="ph"><span class="mi">apartment</span></div>';
            return `
<div class="proj-item${current && current.id === p.id ? ' active' : ''}" data-id="${p.id}">
  ${thumb}
  <div class="info">
    <b>${esc(p.name)}</b>
    <span>${esc(p.location || '—')}${p.starting_price ? ' · ' + esc(p.starting_price) : ''}</span>
  </div>
  <span class="star mi ${p.on_homepage ? 'on' : ''}" data-star="${p.id}" title="Toggle homepage">star</span>
</div>`;
        }).join('');

        wrap.querySelectorAll('.proj-item').forEach((el) => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-star]')) return;
                edit(Number(el.dataset.id));
            });
        });
        wrap.querySelectorAll('[data-star]').forEach((el) => {
            el.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = Number(el.dataset.star);
                const p = projects.find((x) => x.id === id);
                try {
                    await api('PATCH', `/api/projects/${id}/homepage`, { on_homepage: !p.on_homepage });
                    p.on_homepage = p.on_homepage ? 0 : 1;
                    el.classList.toggle('on', !!p.on_homepage);
                    if (current && current.id === id) $('f-on_homepage').checked = !!p.on_homepage;
                    toast(p.on_homepage ? 'Added to homepage' : 'Removed from homepage');
                } catch (ex) { toast(ex.message, 'err'); }
            });
        });
    }

    // --------------------------------------------------------------- highlights
    function addHighlightRow(value) {
        const row = document.createElement('div');
        row.className = 'hl-row';
        row.innerHTML = `<input type="text" placeholder="e.g. 5-acre central park" value="${esc(value || '')}"/>
          <button type="button" class="icon-btn" title="Remove"><span class="mi">close</span></button>`;
        row.querySelector('button').addEventListener('click', () => row.remove());
        $('highlights').appendChild(row);
    }
    function getHighlights() {
        return Array.from($('highlights').querySelectorAll('input'))
            .map((i) => i.value.trim()).filter(Boolean);
    }
    $('add-hl').addEventListener('click', () => addHighlightRow(''));

    // ------------------------------------------------------------------- form
    function resetForm() {
        current = null;
        $('project-form').reset();
        $('f-id').value = '';
        $('form-title').textContent = 'Add a project';
        $('editing-id').textContent = '';
        $('save-label').textContent = 'Save project';
        $('cancel-btn').classList.add('hidden');
        $('delete-btn').classList.add('hidden');
        $('highlights').innerHTML = '';
        addHighlightRow('');
        renderGallery(null);
        renderList();
    }

    function fillForm(p) {
        current = p;
        TEXT_FIELDS.forEach((f) => { $('f-' + f).value = p[f] != null ? p[f] : ''; });
        $('f-id').value = p.id;
        $('f-on_homepage').checked = !!p.on_homepage;
        $('form-title').textContent = 'Edit project';
        $('editing-id').textContent = '#' + p.id;
        $('save-label').textContent = 'Update project';
        $('cancel-btn').classList.remove('hidden');
        $('delete-btn').classList.remove('hidden');
        $('highlights').innerHTML = '';
        if (p.highlights && p.highlights.length) p.highlights.forEach((h) => addHighlightRow(h.text));
        else addHighlightRow('');
        renderGallery(p);
        renderList();
    }

    function readForm() {
        const body = {};
        TEXT_FIELDS.forEach((f) => { body[f] = $('f-' + f).value.trim(); });
        body.on_homepage = $('f-on_homepage').checked;
        body.highlights = getHighlights();
        return body;
    }

    async function edit(id) {
        try {
            const p = await getJSON('/api/projects/' + id);
            fillForm(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (ex) { toast('Could not open project.', 'err'); }
    }

    $('new-btn').addEventListener('click', resetForm);
    $('cancel-btn').addEventListener('click', resetForm);

    // "Show on homepage" saves immediately for an existing project (like the
    // star toggle), so it can't be lost by forgetting to click "Update project".
    // For a brand-new, unsaved project it just stays in the form until created.
    $('f-on_homepage').addEventListener('change', async (e) => {
        if (!current || !current.id) return;
        const on = e.target.checked;
        try {
            await api('PATCH', `/api/projects/${current.id}/homepage`, { on_homepage: on });
            current.on_homepage = on ? 1 : 0;
            const cached = projects.find((x) => x.id === current.id);
            if (cached) cached.on_homepage = current.on_homepage;
            renderList();
            toast(on ? 'Added to homepage' : 'Removed from homepage');
        } catch (ex) {
            e.target.checked = !on;
            toast(ex.message, 'err');
        }
    });

    $('project-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = readForm();
        if (!body.name) { toast('Project name is required.', 'err'); return; }
        const btn = $('save-btn');
        btn.disabled = true;
        try {
            let saved;
            if (current && current.id) {
                saved = await api('PUT', '/api/projects/' + current.id, body);
                toast('Project updated.');
            } else {
                saved = await api('POST', '/api/projects', body);
                toast('Project created. You can now upload images.');
            }
            await loadList();
            fillForm(saved);   // keep editing (enables gallery upload)
        } catch (ex) {
            toast(ex.message, 'err');
        } finally {
            btn.disabled = false;
        }
    });

    $('delete-btn').addEventListener('click', async () => {
        if (!current || !current.id) return;
        if (!confirm(`Delete "${current.name}" and all its images? This cannot be undone.`)) return;
        try {
            await api('DELETE', '/api/projects/' + current.id);
            toast('Project deleted.');
            resetForm();
            await loadList();
        } catch (ex) { toast(ex.message, 'err'); }
    });

    // ---------------------------------------------------------------- gallery
    function renderGallery(p) {
        const uploader = $('uploader');
        const gal = $('gallery');
        if (!p || !p.id) {
            uploader.classList.add('dim');
            uploader.innerHTML = '<span class="mi" style="font-size:30px">image</span><p style="margin:6px 0 0">Save the project first, then upload images here.</p>';
            gal.innerHTML = '';
            return;
        }
        uploader.classList.remove('dim');
        uploader.innerHTML = '<span class="mi" style="font-size:30px">cloud_upload</span><p style="margin:6px 0 0"><b>Click to upload</b> images (you can pick several)</p>';
        const images = p.images || [];
        gal.innerHTML = images.map((im, i) => `
<div class="cell">
  <img src="${imgUrl(im.filename)}" alt="">
  ${i === 0 ? '<span class="cover-badge">Cover</span>' : ''}
  <button type="button" class="del" data-img="${im.id}" title="Delete image"><span class="mi" style="font-size:16px">delete</span></button>
</div>`).join('');
        gal.querySelectorAll('[data-img]').forEach((b) => {
            b.addEventListener('click', () => deleteImage(Number(b.dataset.img)));
        });
    }

    $('uploader').addEventListener('click', () => {
        if (!current || !current.id) { toast('Save the project first.', 'err'); return; }
        $('file-input').click();
    });

    $('file-input').addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || !files.length || !current || !current.id) return;
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append('images', f));
        try {
            toast('Uploading…');
            await apiUpload('/api/projects/' + current.id + '/images', fd);
            const fresh = await getJSON('/api/projects/' + current.id);
            current = fresh;
            renderGallery(fresh);
            await loadList();
            toast('Images uploaded.');
        } catch (ex) {
            toast(ex.message, 'err');
        } finally {
            $('file-input').value = '';
        }
    });

    async function deleteImage(imageId) {
        if (!confirm('Delete this image?')) return;
        try {
            await api('DELETE', '/api/images/' + imageId);
            const fresh = await getJSON('/api/projects/' + current.id);
            current = fresh;
            renderGallery(fresh);
            await loadList();
            toast('Image deleted.');
        } catch (ex) { toast(ex.message, 'err'); }
    }

    // ------------------------------------------------------------------- boot
    if (getToken()) { showApp(); loadList().then(resetForm); }
    else showLogin();
})();
