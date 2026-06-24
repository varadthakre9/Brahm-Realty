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

    // ================================================================
    //   Tab switcher
    // ================================================================
    const loaded = { projects: true, hero: false, testimonials: false, media: false, careers: false };

    function switchTab(name) {
        document.querySelectorAll('.tab').forEach((t) => {
            t.classList.toggle('is-active', t.dataset.tab === name);
        });
        document.querySelectorAll('.tab-section').forEach((s) => {
            const match = s.dataset.tabSection === name;
            s.toggleAttribute('hidden', !match);
            s.classList.toggle('is-active', match);
        });
        if (!loaded[name]) {
            loaded[name] = true;
            if (name === 'hero') loadHero();
            if (name === 'testimonials') loadTestimonials();
            if (name === 'media') loadMedia();
            if (name === 'careers') loadCareers();
        }
    }
    document.querySelectorAll('.tab').forEach((t) => {
        t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    // ================================================================
    //   HERO TAB
    // ================================================================
    let heroState = { url: '', publicId: '', type: '' };

    async function loadHero() {
        const wrap = $('hero-current');
        wrap.innerHTML = '<p class="empty">Loading…</p>';
        try {
            const s = await getJSON('/api/site-settings?keys=hero_media_url,hero_media_public_id,hero_media_type');
            heroState = {
                url: s.hero_media_url || '',
                publicId: s.hero_media_public_id || '',
                type: s.hero_media_type || '',
            };
            renderHeroPreview();
        } catch (ex) {
            wrap.innerHTML = '<p class="empty">Could not load hero settings.</p>';
        }
    }

    function renderHeroPreview() {
        const wrap = $('hero-current');
        const removeBtn = $('hero-remove');
        if (!heroState.url) {
            wrap.innerHTML = '<p class="empty">No custom hero uploaded. The homepage is using the built-in image.</p>';
            removeBtn.classList.add('hidden');
            return;
        }
        const url = imgUrl(heroState.url);
        const isVideo = heroState.type === 'video';
        wrap.innerHTML = `
            ${isVideo
                ? `<video src="${esc(url)}" autoplay muted loop playsinline></video>`
                : `<img src="${esc(url)}" alt="Hero preview"/>`}
            <div class="hero-preview-meta">
                <span class="pill">${isVideo ? 'Video' : 'Image'}</span>
                <span style="word-break:break-all">${esc(heroState.url)}</span>
            </div>`;
        removeBtn.classList.remove('hidden');
    }

    $('hero-uploader').addEventListener('click', () => $('hero-file').click());
    $('hero-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('media', file);
        $('hero-uploader').classList.add('busy');
        try {
            toast('Uploading hero…');
            const r = await apiUpload('/api/site-settings/hero-media', fd);
            heroState = { url: r.url, publicId: r.public_id, type: r.type };
            renderHeroPreview();
            toast(r.type === 'video' ? 'Hero video updated.' : 'Hero image updated.');
        } catch (ex) {
            toast(ex.message, 'err');
        } finally {
            $('hero-uploader').classList.remove('busy');
            $('hero-file').value = '';
        }
    });

    $('hero-remove').addEventListener('click', async () => {
        if (!confirm('Remove the custom hero and revert to the built-in image?')) return;
        try {
            await api('DELETE', '/api/site-settings/hero-media');
            heroState = { url: '', publicId: '', type: '' };
            renderHeroPreview();
            toast('Hero reverted to default.');
        } catch (ex) { toast(ex.message, 'err'); }
    });

    // ================================================================
    //   TESTIMONIALS TAB
    // ================================================================
    let testimonials = [];
    let tCurrent = null;
    const T_FIELDS = ['name', 'role', 'content'];

    async function loadTestimonials() {
        try {
            testimonials = await getJSON('/api/testimonials');
            renderTestimonialList();
            resetTestimonialForm();
        } catch (ex) {
            $('t-list').innerHTML = '<p class="empty">Could not load testimonials.</p>';
        }
    }

    function renderTestimonialList() {
        $('t-count').textContent = testimonials.length ? '(' + testimonials.length + ')' : '';
        const wrap = $('t-list');
        if (!testimonials.length) { wrap.innerHTML = '<p class="empty">No testimonials yet. Click "New".</p>'; return; }
        wrap.innerHTML = testimonials.map((t) => {
            const thumb = t.photo
                ? `<img src="${imgUrl(t.photo)}" alt="">`
                : '<div class="ph"><span class="mi">person</span></div>';
            return `
<div class="proj-item${tCurrent && tCurrent.id === t.id ? ' active' : ''}" data-id="${t.id}">
  ${thumb}
  <div class="info">
    <b>${esc(t.name)}${t.visible ? '' : '<span class="hide-flag">hidden</span>'}</b>
    <span>${esc(t.role || '—')}</span>
  </div>
</div>`;
        }).join('');
        wrap.querySelectorAll('.proj-item').forEach((el) => {
            el.addEventListener('click', () => editTestimonial(Number(el.dataset.id)));
        });
    }

    function resetTestimonialForm() {
        tCurrent = null;
        $('t-form').reset();
        $('t-id').value = '';
        $('t-visible').checked = true;
        $('t-form-title').textContent = 'Add a testimonial';
        $('t-editing-id').textContent = '';
        $('t-save-label').textContent = 'Save testimonial';
        $('t-cancel').classList.add('hidden');
        $('t-delete').classList.add('hidden');
        dimTestimonialPhoto(true);
        $('t-photo-preview').innerHTML = '';
        renderTestimonialList();
    }

    function dimTestimonialPhoto(dim) {
        const u = $('t-photo-uploader');
        if (dim) {
            u.classList.add('dim');
            u.innerHTML = '<span class="mi" style="font-size:30px">person</span><p style="margin:6px 0 0">Save the testimonial first, then add a photo here.</p>';
        } else {
            u.classList.remove('dim');
            u.innerHTML = '<span class="mi" style="font-size:30px">cloud_upload</span><p style="margin:6px 0 0"><b>Click to upload</b> a profile photo</p>';
        }
    }

    function fillTestimonialForm(t) {
        tCurrent = t;
        T_FIELDS.forEach((f) => { $('t-' + f).value = t[f] != null ? t[f] : ''; });
        $('t-id').value = t.id;
        $('t-visible').checked = !!t.visible;
        $('t-form-title').textContent = 'Edit testimonial';
        $('t-editing-id').textContent = '#' + t.id;
        $('t-save-label').textContent = 'Update testimonial';
        $('t-cancel').classList.remove('hidden');
        $('t-delete').classList.remove('hidden');
        dimTestimonialPhoto(false);
        $('t-photo-preview').innerHTML = t.photo
            ? `<img src="${esc(imgUrl(t.photo))}" alt=""/>`
            : '';
        renderTestimonialList();
    }

    async function editTestimonial(id) {
        const t = testimonials.find((x) => x.id === id);
        if (t) { fillTestimonialForm(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }

    $('t-new').addEventListener('click', resetTestimonialForm);
    $('t-cancel').addEventListener('click', resetTestimonialForm);

    $('t-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {};
        T_FIELDS.forEach((f) => { body[f] = $('t-' + f).value.trim(); });
        body.visible = $('t-visible').checked ? 1 : 0;
        if (!body.name) { toast('Name is required.', 'err'); return; }
        if (!body.content) { toast('Testimonial content is required.', 'err'); return; }
        const btn = $('t-save');
        btn.disabled = true;
        try {
            let saved;
            if (tCurrent && tCurrent.id) {
                saved = await api('PUT', '/api/testimonials/' + tCurrent.id, body);
                toast('Testimonial updated.');
            } else {
                saved = await api('POST', '/api/testimonials', body);
                toast('Testimonial saved. You can now add a photo.');
            }
            await loadTestimonials();
            fillTestimonialForm(saved);
        } catch (ex) {
            toast(ex.message, 'err');
        } finally { btn.disabled = false; }
    });

    $('t-delete').addEventListener('click', async () => {
        if (!tCurrent || !tCurrent.id) return;
        if (!confirm(`Delete the testimonial from "${tCurrent.name}"?`)) return;
        try {
            await api('DELETE', '/api/testimonials/' + tCurrent.id);
            toast('Testimonial deleted.');
            await loadTestimonials();
        } catch (ex) { toast(ex.message, 'err'); }
    });

    $('t-photo-uploader').addEventListener('click', () => {
        if (!tCurrent || !tCurrent.id) { toast('Save the testimonial first.', 'err'); return; }
        $('t-photo-file').click();
    });

    $('t-photo-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !tCurrent || !tCurrent.id) return;
        const fd = new FormData();
        fd.append('photo', file);
        $('t-photo-uploader').classList.add('busy');
        try {
            toast('Uploading photo…');
            const updated = await apiUpload('/api/testimonials/' + tCurrent.id + '/photo', fd);
            tCurrent = updated;
            await loadTestimonials();
            fillTestimonialForm(updated);
            toast('Photo updated.');
        } catch (ex) {
            toast(ex.message, 'err');
        } finally {
            $('t-photo-uploader').classList.remove('busy');
            $('t-photo-file').value = '';
        }
    });

    // ================================================================
    //   MEDIA TAB
    // ================================================================
    let mediaItems = [];
    let mCurrent = null;
    let mFilter = '';
    const M_TEXT = ['title', 'subtitle', 'video_url'];
    const KIND_LABEL = {
        video_testimonial: 'Video testimonial',
        brand_film: 'Brand film',
        gallery_photo: 'Photo',
    };

    async function loadMedia() {
        try {
            mediaItems = await getJSON('/api/media');
            renderMediaList();
            resetMediaForm();
        } catch (ex) {
            $('m-list').innerHTML = '<p class="empty">Could not load media.</p>';
        }
    }

    function renderMediaList() {
        const items = mFilter ? mediaItems.filter((x) => x.kind === mFilter) : mediaItems;
        $('m-count').textContent = items.length ? '(' + items.length + ')' : '';
        const wrap = $('m-list');
        if (!items.length) {
            wrap.innerHTML = '<p class="empty">No items here yet.</p>';
            return;
        }
        wrap.innerHTML = items.map((m) => {
            const thumb = m.thumbnail
                ? `<img src="${imgUrl(m.thumbnail)}" alt="">`
                : `<div class="ph"><span class="mi">${m.kind === 'gallery_photo' ? 'image' : 'movie'}</span></div>`;
            const sub = m.subtitle || (m.kind === 'gallery_photo' ? 'Photo' : (m.video_url ? 'Video' : 'No video URL'));
            return `
<div class="proj-item${mCurrent && mCurrent.id === m.id ? ' active' : ''}" data-id="${m.id}">
  ${thumb}
  <div class="info">
    <b>${esc(m.title || (m.kind === 'gallery_photo' ? 'Untitled photo' : 'Untitled video'))}<span class="kind">${esc(KIND_LABEL[m.kind] || m.kind)}</span>${m.visible ? '' : '<span class="hide-flag">hidden</span>'}</b>
    <span>${esc(sub)}</span>
  </div>
</div>`;
        }).join('');
        wrap.querySelectorAll('.proj-item').forEach((el) => {
            el.addEventListener('click', () => editMedia(Number(el.dataset.id)));
        });
    }

    document.querySelectorAll('#m-filter .chip').forEach((c) => {
        c.addEventListener('click', () => {
            mFilter = c.dataset.kind || '';
            document.querySelectorAll('#m-filter .chip').forEach((x) => x.classList.toggle('is-active', x === c));
            renderMediaList();
        });
    });

    function applyMediaKindUi(kind) {
        const isPhoto = kind === 'gallery_photo';
        document.querySelectorAll('[data-mk-video]').forEach((el) => el.toggleAttribute('hidden', isPhoto));
        document.querySelectorAll('[data-mk-photo]').forEach((el) => el.toggleAttribute('hidden', !isPhoto));
        $('m-thumb-label').textContent = isPhoto ? 'Photo' : 'Thumbnail';
        $('m-thumb-hint').textContent = isPhoto
            ? 'The image shown in the photo gallery.'
            : 'Used as the play-button preview for the video.';
        $('m-kind-hint').textContent = isPhoto
            ? 'Photo gallery items show only an image — no video.'
            : 'Video testimonials and brand films appear in their respective rows on the Media page.';
    }

    $('m-kind').addEventListener('change', (e) => applyMediaKindUi(e.target.value));

    function dimMediaThumb(dim) {
        const u = $('m-thumb-uploader');
        if (dim) {
            u.classList.add('dim');
            u.innerHTML = '<span class="mi" style="font-size:30px">image</span><p style="margin:6px 0 0">Save the item first, then upload an image here.</p>';
        } else {
            u.classList.remove('dim');
            u.innerHTML = '<span class="mi" style="font-size:30px">cloud_upload</span><p style="margin:6px 0 0"><b>Click to upload</b> an image</p>';
        }
    }

    function resetMediaForm() {
        mCurrent = null;
        $('m-form').reset();
        $('m-id').value = '';
        $('m-kind').value = 'video_testimonial';
        $('m-visible').checked = true;
        applyMediaKindUi('video_testimonial');
        $('m-form-title').textContent = 'Add a media item';
        $('m-editing-id').textContent = '';
        $('m-save-label').textContent = 'Save media item';
        $('m-cancel').classList.add('hidden');
        $('m-delete').classList.add('hidden');
        dimMediaThumb(true);
        $('m-thumb-preview').innerHTML = '';
        renderMediaList();
    }

    function fillMediaForm(m) {
        mCurrent = m;
        $('m-id').value = m.id;
        $('m-kind').value = m.kind;
        $('m-title').value = m.title || '';
        $('m-subtitle').value = m.subtitle || '';
        $('m-video_url').value = m.video_url || '';
        $('m-photo-title').value = m.kind === 'gallery_photo' ? (m.title || '') : '';
        $('m-visible').checked = !!m.visible;
        applyMediaKindUi(m.kind);
        $('m-form-title').textContent = 'Edit media item';
        $('m-editing-id').textContent = '#' + m.id;
        $('m-save-label').textContent = 'Update media item';
        $('m-cancel').classList.remove('hidden');
        $('m-delete').classList.remove('hidden');
        dimMediaThumb(false);
        $('m-thumb-preview').innerHTML = m.thumbnail
            ? `<img src="${esc(imgUrl(m.thumbnail))}" alt=""/>`
            : '';
        renderMediaList();
    }

    function editMedia(id) {
        const m = mediaItems.find((x) => x.id === id);
        if (m) { fillMediaForm(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }

    $('m-new').addEventListener('click', resetMediaForm);
    $('m-cancel').addEventListener('click', resetMediaForm);

    $('m-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const kind = $('m-kind').value;
        const body = { kind };
        if (kind === 'gallery_photo') {
            body.title = $('m-photo-title').value.trim();
            body.subtitle = '';
            body.video_url = '';
        } else {
            M_TEXT.forEach((f) => { body[f] = $('m-' + f).value.trim(); });
            // video_url is intentionally optional — items without a URL still
            // render as a decorative card and can have a URL added later.
        }
        body.visible = $('m-visible').checked ? 1 : 0;
        const btn = $('m-save');
        btn.disabled = true;
        try {
            let saved;
            if (mCurrent && mCurrent.id) {
                saved = await api('PUT', '/api/media/' + mCurrent.id, body);
                toast('Media item updated.');
            } else {
                saved = await api('POST', '/api/media', body);
                toast(kind === 'gallery_photo' ? 'Item created. Upload the photo now.' : 'Item created. Add a thumbnail now.');
            }
            await loadMedia();
            fillMediaForm(saved);
        } catch (ex) {
            toast(ex.message, 'err');
        } finally { btn.disabled = false; }
    });

    $('m-delete').addEventListener('click', async () => {
        if (!mCurrent || !mCurrent.id) return;
        if (!confirm('Delete this media item?')) return;
        try {
            await api('DELETE', '/api/media/' + mCurrent.id);
            toast('Item deleted.');
            await loadMedia();
        } catch (ex) { toast(ex.message, 'err'); }
    });

    $('m-thumb-uploader').addEventListener('click', () => {
        if (!mCurrent || !mCurrent.id) { toast('Save the item first.', 'err'); return; }
        $('m-thumb-file').click();
    });

    $('m-thumb-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !mCurrent || !mCurrent.id) return;
        const fd = new FormData();
        fd.append('thumbnail', file);
        $('m-thumb-uploader').classList.add('busy');
        try {
            toast('Uploading…');
            const updated = await apiUpload('/api/media/' + mCurrent.id + '/thumbnail', fd);
            mCurrent = updated;
            await loadMedia();
            fillMediaForm(updated);
            toast('Image updated.');
        } catch (ex) {
            toast(ex.message, 'err');
        } finally {
            $('m-thumb-uploader').classList.remove('busy');
            $('m-thumb-file').value = '';
        }
    });

    // ================================================================
    //   CAREERS TAB
    // ================================================================
    let careers = [];
    let cCurrent = null;
    const C_FIELDS = ['title', 'department', 'job_type', 'location', 'experience', 'description'];

    async function loadCareers() {
        try {
            careers = await getJSON('/api/careers');
            renderCareerList();
            resetCareerForm();
        } catch (ex) {
            $('c-list').innerHTML = '<p class="empty">Could not load careers.</p>';
        }
    }

    function renderCareerList() {
        $('c-count').textContent = careers.length ? '(' + careers.length + ')' : '';
        const wrap = $('c-list');
        if (!careers.length) { wrap.innerHTML = '<p class="empty">No positions yet. Click "New".</p>'; return; }
        wrap.innerHTML = careers.map((c) => {
            const meta = [c.department, c.job_type, c.location].filter(Boolean).join(' · ') || '—';
            return `
<div class="proj-item${cCurrent && cCurrent.id === c.id ? ' active' : ''}" data-id="${c.id}">
  <div class="ph"><span class="mi">work</span></div>
  <div class="info">
    <b>${esc(c.title)}${c.visible ? '' : '<span class="hide-flag">hidden</span>'}</b>
    <span>${esc(meta)}</span>
  </div>
</div>`;
        }).join('');
        wrap.querySelectorAll('.proj-item').forEach((el) => {
            el.addEventListener('click', () => editCareer(Number(el.dataset.id)));
        });
    }

    function resetCareerForm() {
        cCurrent = null;
        $('c-form').reset();
        $('c-id').value = '';
        $('c-visible').checked = true;
        $('c-form-title').textContent = 'Add a position';
        $('c-editing-id').textContent = '';
        $('c-save-label').textContent = 'Save position';
        $('c-cancel').classList.add('hidden');
        $('c-delete').classList.add('hidden');
        renderCareerList();
    }

    function fillCareerForm(c) {
        cCurrent = c;
        C_FIELDS.forEach((f) => { $('c-' + f).value = c[f] != null ? c[f] : ''; });
        $('c-id').value = c.id;
        $('c-visible').checked = !!c.visible;
        $('c-form-title').textContent = 'Edit position';
        $('c-editing-id').textContent = '#' + c.id;
        $('c-save-label').textContent = 'Update position';
        $('c-cancel').classList.remove('hidden');
        $('c-delete').classList.remove('hidden');
        renderCareerList();
    }

    function editCareer(id) {
        const c = careers.find((x) => x.id === id);
        if (c) { fillCareerForm(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }

    $('c-new').addEventListener('click', resetCareerForm);
    $('c-cancel').addEventListener('click', resetCareerForm);

    $('c-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {};
        C_FIELDS.forEach((f) => { body[f] = $('c-' + f).value.trim(); });
        body.visible = $('c-visible').checked ? 1 : 0;
        if (!body.title) { toast('Job title is required.', 'err'); return; }
        const btn = $('c-save');
        btn.disabled = true;
        try {
            let saved;
            if (cCurrent && cCurrent.id) {
                saved = await api('PUT', '/api/careers/' + cCurrent.id, body);
                toast('Position updated.');
            } else {
                saved = await api('POST', '/api/careers', body);
                toast('Position created.');
            }
            await loadCareers();
            fillCareerForm(saved);
        } catch (ex) {
            toast(ex.message, 'err');
        } finally { btn.disabled = false; }
    });

    $('c-delete').addEventListener('click', async () => {
        if (!cCurrent || !cCurrent.id) return;
        if (!confirm(`Delete the position "${cCurrent.title}"?`)) return;
        try {
            await api('DELETE', '/api/careers/' + cCurrent.id);
            toast('Position deleted.');
            await loadCareers();
        } catch (ex) { toast(ex.message, 'err'); }
    });

    // ------------------------------------------------------------------- boot
    if (getToken()) { showApp(); loadList().then(resetForm); }
    else showLogin();
})();
