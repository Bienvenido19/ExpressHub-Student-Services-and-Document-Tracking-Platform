(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // Everything that comes from the database goes through esc() before touching innerHTML.
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) =>
    iso
      ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
  const show = (el, on = true) => el.classList.toggle('hidden-view', !on);

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') {
      showLogin();
      throw new Error('Your session expired. Sign in again.');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function flash(el, msg, ok = true) {
    el.textContent = msg;
    el.className = 'font-body-sm rounded-lg p-space-sm ' + (ok ? 'bg-surface-container-low text-on-surface' : 'bg-error-container text-on-error-container');
  }

  const STATUS = {
    new: { label: 'New', badge: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-secondary' },
    processing: { label: 'Processing', badge: 'bg-secondary-fixed text-on-secondary-fixed-variant', dot: 'bg-on-secondary-fixed-variant' },
    ready: { label: 'Ready', badge: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', dot: 'bg-on-tertiary-container' },
    completed: { label: 'Completed', badge: 'bg-surface-container text-on-surface-variant', dot: 'bg-outline' },
  };
  const badge = (cls, dot, text) =>
    `<span class="inline-flex items-center gap-space-xs px-space-sm py-0.5 rounded-lg font-label-sm text-label-sm ${cls}"><span class="h-1.5 w-1.5 rounded-full ${dot}"></span>${esc(text)}</span>`;
  const statusBadge = (r) =>
    badge(STATUS[r.status].badge, STATUS[r.status].dot, STATUS[r.status].label) +
    (r.flagged && r.status !== 'completed' ? ' ' + badge('bg-error-container text-on-error-container', 'bg-error', 'Action Needed') : '');

  /* ---------- state ---------- */
  let me = null;
  let view = 'queue';
  let filter = 'all';
  let query = '';
  let selectedId = null;
  let detail = null;
  let editingAnn = null;
  let refreshTimer = null;
  let searchTimer = null;

  /* ---------- auth / shell ---------- */
  function showLogin() {
    clearInterval(refreshTimer);
    me = null;
    show($('#app'), false);
    show($('#login'), true);
    $('#loginPassword').value = '';
  }

  function showApp() {
    show($('#login'), false);
    show($('#app'), true);
    $('#hdrName').textContent = me.name;
    $('#hdrDept').textContent = me.department || (me.role === 'admin' ? 'Administrator' : 'Staff');
    $('#sideEmail').textContent = me.email;
    go('queue');
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (view === 'queue') loadQueue(true).catch(() => {});
    }, 60000);
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError');
    show(err, false);
    try {
      const data = await api('/login', { method: 'POST', body: { email: $('#loginEmail').value, password: $('#loginPassword').value } });
      me = data.staff;
      showApp();
    } catch (ex) {
      err.textContent = ex.message;
      show(err, true);
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  /* ---------- navigation ---------- */
  const SIDE_ACTIVE = ['bg-surface-variant', 'text-on-surface', 'font-bold', 'shadow-sm'];
  const TOP_ACTIVE = ['bg-surface-container-high', 'text-on-surface', 'font-bold'];

  function go(v) {
    view = v;
    ['queue', 'announcements', 'settings', 'logs', 'telemetry'].forEach((n) => {
      const el = $('#view-' + n);
      show(el, n === v);
    });
    $$('.nav-side').forEach((a) => {
      const on = a.dataset.view === v;
      SIDE_ACTIVE.forEach((c) => a.classList.toggle(c, on));
      a.classList.toggle('text-surface', !on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $$('.nav-top').forEach((a) => {
      const on = a.dataset.view === v;
      TOP_ACTIVE.forEach((c) => a.classList.toggle(c, on));
      a.classList.toggle('text-on-surface-variant', !on);
    });
    const loaders = { queue: loadQueue, announcements: loadAnnouncements, settings: renderSettings, logs: loadLogs, telemetry: loadTelemetry };
    Promise.resolve(loaders[v]()).catch((e) => console.error(e));
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-view]');
    if (a && a.tagName === 'A') {
      e.preventDefault();
      go(a.dataset.view);
    }
  });

  const search = $('#globalSearch');
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = search.value.trim();
      if (view !== 'queue') go('queue'); else loadQueue(true).catch(() => {});
    }, 250);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && me) {
      e.preventDefault();
      search.focus();
    }
  });

  /* ---------- queue ---------- */
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
  function shift() {
    const h = new Date().getHours();
    return h < 12 ? 'Morning Session' : h < 18 ? 'Afternoon Session' : 'Evening Session';
  }

  function paintChips() {
    $$('.chip').forEach((b) => {
      const on = b.dataset.filter === filter;
      b.className =
        'chip px-space-md py-space-xs rounded-lg font-label-md text-label-md transition-colors ' +
        (on
          ? 'bg-primary-container text-surface hover:opacity-90'
          : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high');
      b.setAttribute('aria-pressed', on);
    });
  }

  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    filter = b.dataset.filter;
    loadQueue(true).catch((ex) => console.error(ex));
  });

  async function loadQueue(keepSelection = false) {
    paintChips();
    const params = new URLSearchParams({ status: filter });
    if (query) params.set('q', query);
    const [summary, list] = await Promise.all([api('/summary'), api('/requests?' + params)]);

    $('#greet').textContent = `${greeting()}, ${me.name}.`;
    $('#openCount').textContent = summary.openCount;
    $('#mNew').textContent = summary.newCount;
    $('#mProc').textContent = summary.processingCount;
    $('#mDone').textContent = summary.completedToday;
    $('#totalEntries').textContent = list.requests.length;
    $('#updated').textContent = `Queue updated: ${new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} | Shift: ${shift()}`;

    renderRows(list.requests);

    if (keepSelection && selectedId && list.requests.some((r) => r.id === selectedId)) {
      // keep the panel as it is
    } else if (!keepSelection || !list.requests.some((r) => r.id === selectedId)) {
      selectedId = null;
      detail = null;
      renderPanel();
    }
  }

  function renderRows(rows) {
    const tb = $('#rows');
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="6" class="py-space-xl px-space-md text-center text-on-surface-variant">No requests match this view.</td></tr>`;
      return;
    }
    tb.innerHTML = rows
      .map((r) => {
        const sel = r.id === selectedId;
        const btnLabel = r.status === 'new' ? 'Process Request' : r.status === 'processing' ? 'Reviewing' : 'Review';
        const btnCls =
          r.status === 'processing'
            ? 'bg-primary-container text-surface shadow-xs'
            : 'bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors';
        return `<tr data-id="${r.id}" data-status="${esc(r.status)}" class="cursor-pointer transition-colors ${sel ? 'bg-surface-container-high hover:bg-surface-container-highest' : 'hover:bg-surface-container-low'}">
          <td class="py-space-md px-space-md font-code-md text-code-md font-semibold">${esc(r.request_no)}</td>
          <td class="py-space-md px-space-md"><div class="flex flex-col min-w-0">
            <span class="font-label-md text-label-md font-bold truncate">${esc(r.student_name)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">${esc(r.student_no)}</span></div></td>
          <td class="py-space-md px-space-md">${esc(r.document_type)}</td>
          <td class="py-space-md px-space-md font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">${esc(fmtDate(r.submitted_at))}</td>
          <td class="py-space-md px-space-md whitespace-nowrap">${statusBadge(r)}</td>
          <td class="py-space-md px-space-md text-right whitespace-nowrap">
            <button type="button" class="inline-flex items-center justify-center px-space-md py-space-xs rounded-lg font-label-md text-label-md ${btnCls}">${btnLabel}</button></td>
        </tr>`;
      })
      .join('');
  }

  $('#rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const preset = e.target.closest('button') && tr.dataset.status === 'new' ? 'processing' : null;
    selectRequest(Number(tr.dataset.id), preset).catch((ex) => alert(ex.message));
  });

  async function selectRequest(id, preset = null) {
    selectedId = id;
    const data = await api('/requests/' + id);
    detail = data.request;
    $$('#rows tr[data-id]').forEach((tr) => {
      const on = Number(tr.dataset.id) === id;
      tr.classList.toggle('bg-surface-container-high', on);
    });
    renderPanel(preset);
  }

  /* ---------- action panel ---------- */
  const STAGES = [
    ['new', '1. Received / New'],
    ['processing', '2. In Review & Document Preparation'],
    ['ready', '3. Ready for Claiming / Digital Dispatch'],
    ['completed', '4. Completed & Archived'],
  ];

  function renderPanel(preset = null) {
    const p = $('#panel');
    if (!detail) {
      p.innerHTML = `<div class="flex flex-col items-center text-center gap-space-sm py-space-xl text-on-surface-variant">
        <span class="material-symbols-outlined text-[32px]">touch_app</span>
        <p class="font-label-lg text-label-lg text-on-surface">Select a request</p>
        <p class="font-body-md">Choose a row to review student details and update its status.</p></div>`;
      return;
    }
    const d = detail;
    const chosen = preset || d.status;
    p.innerHTML = `
      <div class="flex flex-col pb-space-xs">
        <div class="flex items-center justify-between">
          <span class="font-label-sm text-label-sm text-on-secondary-fixed-variant uppercase tracking-wider font-bold">Action View</span>
          <span>${statusBadge(d)}</span>
        </div>
        <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold mt-space-xs">Process Request: ${esc(d.request_no)}</h2>
        <p class="font-label-sm text-label-sm text-on-surface-variant">Document Workflow &amp; Verification</p>
      </div>
      <div class="bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-xs">
        <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Student Details</span>
        <dl class="grid grid-cols-3 gap-y-1 font-body-sm text-body-sm mt-space-xs">
          <dt class="text-on-surface-variant font-medium">Name:</dt><dd class="col-span-2 text-on-surface font-semibold">${esc(d.student_name)}</dd>
          <dt class="text-on-surface-variant font-medium">ID:</dt><dd class="col-span-2 font-code-md text-code-md">${esc(d.student_no)}</dd>
          <dt class="text-on-surface-variant font-medium">Department:</dt><dd class="col-span-2">${esc(d.department || 'Not on record')}</dd>
        </dl>
      </div>
      <div class="bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-xs">
        <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Request Info</span>
        <dl class="flex flex-col gap-space-xs font-body-sm text-body-sm mt-space-xs">
          <div><dt class="text-on-surface-variant font-medium">Document Requested:</dt><dd class="font-semibold">${esc(d.document_type)}</dd></div>
          <div><dt class="text-on-surface-variant font-medium">Purpose of Request:</dt><dd>${esc(d.purpose || 'Not stated')}</dd></div>
          <div><dt class="text-on-surface-variant font-medium">Additional Notes:</dt><dd class="text-on-surface-variant italic">${esc(d.notes || 'None')}</dd></div>
        </dl>
      </div>
      <div class="flex flex-col gap-space-xs">
        <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Workflow Status Selector</span>
        <fieldset aria-label="Select Processing Stage" class="flex flex-col gap-space-xs mt-space-xs">
          ${STAGES.map(
            ([val, label]) => `<label class="flex items-center gap-space-sm p-space-sm rounded-lg cursor-pointer transition-colors ${val === chosen ? 'bg-surface-container-high' : 'bg-surface-container-lowest hover:bg-surface-container-low'}">
              <input class="h-4 w-4 text-primary focus:ring-0" name="workflow_status" type="radio" value="${val}" ${val === chosen ? 'checked' : ''}/>
              <span class="font-label-md text-label-md text-on-surface ${val === chosen ? 'font-bold' : ''}">${esc(label)}</span></label>`
          ).join('')}
        </fieldset>
      </div>
      <div class="flex flex-col gap-space-md pt-space-xs">
        <label class="flex items-start gap-space-sm cursor-pointer select-none">
          <input id="notifyChk" class="h-4 w-4 mt-0.5 rounded text-primary focus:ring-0" type="checkbox" checked/>
          <span class="font-body-sm text-body-sm text-on-surface">Send automated status update to student email (<span class="font-code-md text-code-md text-on-surface-variant font-medium">${esc(d.student_email)}</span>)</span>
        </label>
        <div class="flex flex-col gap-space-xs">
          <button id="updateBtn" type="button" class="w-full py-space-sm px-space-md rounded-lg font-label-lg text-label-lg bg-primary-container text-surface hover:opacity-95 shadow-sm transition-opacity flex items-center justify-center gap-space-xs">
            <span class="material-symbols-outlined text-[18px]">sync</span><span>Update Status</span></button>
          <div class="grid grid-cols-2 gap-space-xs">
            <button id="slipBtn" type="button" class="w-full py-space-xs px-space-sm rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors">Print Routing Slip</button>
            <button id="flagBtn" type="button" class="w-full py-space-xs px-space-sm rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors">${d.flagged ? 'Clear Flag' : 'Flag for Review'}</button>
          </div>
        </div>
        <p id="toast" class="hidden-view" role="status"></p>
      </div>`;

    $('#updateBtn').addEventListener('click', updateStatus);
    $('#slipBtn').addEventListener('click', () => printSlip(d));
    $('#flagBtn').addEventListener('click', toggleFlag);
    $$('input[name="workflow_status"]').forEach((r) =>
      r.addEventListener('change', () => {
        $$('input[name="workflow_status"]').forEach((x) => {
          const on = x.checked;
          x.closest('label').className = `flex items-center gap-space-sm p-space-sm rounded-lg cursor-pointer transition-colors ${on ? 'bg-surface-container-high' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`;
          x.nextElementSibling.classList.toggle('font-bold', on);
        });
      })
    );
  }

  function toast(msg, ok = true) {
    const t = $('#toast');
    if (!t) return;
    t.className = 'rounded-lg p-space-sm flex items-center gap-space-sm font-body-sm text-body-sm ' + (ok ? 'bg-surface-container-low text-on-surface' : 'bg-error-container text-on-error-container');
    t.innerHTML = `<span class="material-symbols-outlined ${ok ? 'text-on-tertiary-container' : ''} text-[20px]">${ok ? 'check_circle' : 'error'}</span><span>${esc(msg)}</span>`;
  }

  async function updateStatus() {
    const status = ($('input[name="workflow_status"]:checked') || {}).value;
    const btn = $('#updateBtn');
    btn.disabled = true;
    try {
      const res = await api(`/requests/${detail.id}/status`, { method: 'PATCH', body: { status, notify: $('#notifyChk').checked } });
      await loadQueue(true);
      await selectRequest(detail.id);
      const note =
        res.email === 'sent' ? 'The student has been notified.' :
        res.email === 'logged_only' ? 'Email is not configured, so the notice was only logged.' :
        res.email === 'failed' ? 'Status saved, but the email could not be sent.' : 'No email sent.';
      toast(`Status updated successfully. ${note}`, res.email !== 'failed');
    } catch (e) {
      toast(e.message, false);
    } finally {
      const b = $('#updateBtn');
      if (b) b.disabled = false;
    }
  }

  async function toggleFlag() {
    try {
      await api(`/requests/${detail.id}/flag`, { method: 'PATCH', body: { flagged: !detail.flagged } });
      await loadQueue(true);
      await selectRequest(detail.id);
      toast(detail.flagged ? 'Request flagged for review.' : 'Flag cleared.');
    } catch (e) {
      toast(e.message, false);
    }
  }

  function printSlip(d) {
    const w = window.open('', '_blank', 'width=640,height=720');
    if (!w) return toast('Allow pop-ups to print the routing slip.', false);
    const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Routing Slip ${esc(d.request_no)}</title>
      <style>body{font:14px/1.5 Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0 0 4px}
      table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #999;padding:8px;text-align:left;vertical-align:top}th{width:32%;background:#f1f1f1}
      .sign{margin-top:48px;display:flex;gap:32px}.sign div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:12px}</style></head><body>
      <h1>Document Request Routing Slip</h1><div>${esc(d.request_no)}</div>
      <table>${row('Student', d.student_name)}${row('Student No.', d.student_no)}${row('Department', d.department || '')}
      ${row('Document', d.document_type)}${row('Purpose', d.purpose || '')}${row('Notes', d.notes || '')}
      ${row('Submitted', fmtDate(d.submitted_at))}${row('Current status', STATUS[d.status].label)}
      ${row('Printed by', me.name + ' on ' + fmtDate(new Date().toISOString()))}</table>
      <div class="sign"><div>Prepared by</div><div>Verified by</div><div>Released by</div></div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  /* ---------- announcements ---------- */
  async function loadAnnouncements() {
    const { announcements } = await api('/announcements');
    const list = $('#annList');
    if (!announcements.length) {
      list.innerHTML = '<p class="text-on-surface-variant py-space-md">No announcements yet. Write the first one using the form.</p>';
      return;
    }
    list.innerHTML = announcements
      .map(
        (a) => `<article class="bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-xs" data-id="${a.id}">
        <div class="flex items-start justify-between gap-space-sm">
          <h3 class="font-label-lg text-label-lg font-bold">${esc(a.title)}</h3>
          ${badge(a.is_published ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant', a.is_published ? 'bg-on-tertiary-container' : 'bg-outline', a.is_published ? 'Published' : 'Hidden')}
        </div>
        <p class="font-label-sm text-label-sm text-on-surface-variant">${esc(a.category)} - ${esc(fmtDate(a.created_at))}${a.author ? ' - ' + esc(a.author) : ''}</p>
        <p class="font-body-md whitespace-pre-line">${esc(a.body)}</p>
        <div class="flex gap-space-xs pt-space-xs">
          <button type="button" data-act="edit" class="px-space-md py-space-xs rounded-lg font-label-md bg-surface-container hover:bg-surface-container-high transition-colors">Edit</button>
          <button type="button" data-act="delete" class="px-space-md py-space-xs rounded-lg font-label-md bg-error-container text-on-error-container hover:opacity-90">Delete</button>
        </div></article>`
      )
      .join('');
    list._data = announcements;
  }

  $('#annList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('article').dataset.id);
    const a = ($('#annList')._data || []).find((x) => x.id === id);
    if (btn.dataset.act === 'edit' && a) {
      editingAnn = id;
      $('#annTitle').value = a.title;
      $('#annCategory').value = a.category;
      $('#annBody').value = a.body;
      $('#annPublished').checked = !!a.is_published;
      $('#annFormTitle').textContent = 'Edit announcement';
      $('#annSave').textContent = 'Save changes';
      show($('#annCancel'), true);
      $('#annTitle').focus();
    }
    if (btn.dataset.act === 'delete' && confirm('Delete this announcement? Students will no longer see it.')) {
      try {
        await api('/announcements/' + id, { method: 'DELETE' });
        if (editingAnn === id) resetAnnForm();
        await loadAnnouncements();
      } catch (ex) {
        alert(ex.message);
      }
    }
  });

  function resetAnnForm() {
    editingAnn = null;
    $('#annForm').reset();
    $('#annPublished').checked = true;
    $('#annFormTitle').textContent = 'New announcement';
    $('#annSave').textContent = 'Publish announcement';
    show($('#annCancel'), false);
  }
  $('#annCancel').addEventListener('click', resetAnnForm);

  $('#annForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#annMsg');
    const body = { title: $('#annTitle').value, category: $('#annCategory').value, body: $('#annBody').value, is_published: $('#annPublished').checked };
    try {
      if (editingAnn) await api('/announcements/' + editingAnn, { method: 'PUT', body });
      else await api('/announcements', { method: 'POST', body });
      const wasEdit = !!editingAnn;
      resetAnnForm();
      await loadAnnouncements();
      show(msg, true);
      flash(msg, wasEdit ? 'Changes saved.' : 'Announcement published.');
    } catch (ex) {
      show(msg, true);
      flash(msg, ex.message, false);
    }
  });

  /* ---------- settings ---------- */
  function renderSettings() {
    $('#profile').innerHTML = [
      ['Name', me.name],
      ['Email', me.email],
      ['Role', me.role === 'admin' ? 'Administrator' : 'Staff'],
      ['Office', me.department || 'Not set'],
    ]
      .map(([k, v]) => `<dt class="text-on-surface-variant font-medium">${esc(k)}</dt><dd class="col-span-2 font-semibold">${esc(v)}</dd>`)
      .join('');
    show($('#pwMsg'), false);
  }

  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#pwMsg');
    try {
      await api('/me/password', { method: 'PUT', body: { current: $('#pwCurrent').value, next: $('#pwNext').value } });
      $('#pwForm').reset();
      show(msg, true);
      flash(msg, 'Password updated.');
    } catch (ex) {
      show(msg, true);
      flash(msg, ex.message, false);
    }
  });

  /* ---------- logs ---------- */
  async function loadLogs() {
    const { logs } = await api('/logs');
    const label = (s) => (s && STATUS[s] ? STATUS[s].label : s || '');
    $('#logRows').innerHTML = logs.length
      ? logs
          .map((l) => {
            const what =
              l.action === 'status_change' ? `Status changed: ${label(l.old_status)} to ${label(l.new_status)}` :
              l.action === 'flagged' ? 'Flagged for review' : 'Flag cleared';
            return `<tr class="hover:bg-surface-container-low transition-colors">
              <td class="py-space-md px-space-md font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">${esc(fmtDate(l.created_at))}</td>
              <td class="py-space-md px-space-md font-code-md text-code-md font-semibold">${esc(l.request_no)}</td>
              <td class="py-space-md px-space-md">${esc(what)}</td>
              <td class="py-space-md px-space-md">${esc(l.staff_name || 'Unknown')}</td></tr>`;
          })
          .join('')
      : `<tr><td colspan="4" class="py-space-xl px-space-md text-center text-on-surface-variant">No activity recorded yet.</td></tr>`;
  }

  /* ---------- telemetry ---------- */
  async function loadTelemetry() {
    const t = await api('/telemetry');
    const h = (v) => (v === null ? 'No data yet' : v + ' h');
    const card = (title, value, sub) => `<div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-xs">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase">${esc(title)}</span>
      <span class="font-headline-lg text-headline-lg font-bold">${esc(value)}</span>
      <span class="font-body-sm text-body-sm text-on-surface-variant">${esc(sub)}</span></div>`;
    const met = t.last30Days.avgHours !== null && t.last30Days.avgHours <= t.targetHours;
    $('#telCards').innerHTML =
      card('Avg turnaround, last 30 days', h(t.last30Days.avgHours), `${t.last30Days.count} requests - target ${t.targetHours} h`) +
      card('Avg turnaround, all time', h(t.allTime.avgHours), `${t.allTime.count} requests - baseline ${t.baselineHours} h`) +
      card('Objective status', t.last30Days.avgHours === null ? 'Not measurable yet' : met ? 'On target' : 'Above target', `Goal: ${t.baselineHours} h down to ${t.targetHours} h`);
    $('#telRows').innerHTML = t.byType.length
      ? t.byType
          .map(
            (r) => `<tr class="hover:bg-surface-container-low transition-colors"><td class="py-space-md px-space-md">${esc(r.documentType)}</td>
            <td class="py-space-md px-space-md">${esc(r.count)}</td><td class="py-space-md px-space-md font-semibold">${esc(r.avgHours)} h</td></tr>`
          )
          .join('')
      : `<tr><td colspan="3" class="py-space-xl px-space-md text-center text-on-surface-variant">Turnaround appears here once requests reach Ready.</td></tr>`;
  }

  /* ---------- boot ---------- */
  (async () => {
    try {
      me = (await api('/me')).staff;
      showApp();
    } catch {
      showLogin();
    }
  })();
})();
