const BASE = 'https://mil.psy.ntu.edu.tw:5000';
const $ = (sel) => document.querySelector(sel);
const out = $('#out');
const pretty = $('#pretty');

function setOut(text) { out.textContent = text; }
function setJSON(obj, info = '') {
  setOut((info ? info + '\n' : '') + JSON.stringify(obj, null, 2));
}
function clearPretty() { pretty.innerHTML = ''; }
function card({ title, body }) {
  const div = document.createElement('div');
  div.className = 'p-4 bg-white rounded-xl shadow hover:shadow-md transition';
  div.innerHTML = `<h3 class="font-semibold mb-2">${title}</h3><div class="text-sm text-slate-700">${body}</div>`;
  return div;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms=400) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

async function request(path, { signal } = {}) {
  setOut(`Requesting: ${BASE}${path} …`);
  clearPretty();
  try {
    const resp = await fetch(`${BASE}${path}`, { signal });
    const info = `HTTP ${resp.status} ${resp.statusText}`;
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      const text = await resp.text();
      setOut(`${info}\n\n${text}`);
      return { ok: false };
    }
    if (ct.includes('application/json')) {
      const data = await resp.json();
      setJSON(data, info);
      return { ok: true, data };
    } else {
      const text = await resp.text();
      setOut(`${info}\n\n${text}`);
      return { ok: true, data: text };
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, aborted: true };
    setOut([
      `Error: ${err?.message || String(err)}`, '',
      'Common causes:',
      '1) CORS not allowed by the server',
      '2) Opening via file:// instead of a local server',
      '3) Network/server issues'
    ].join('\n'));
    return { ok: false };
  }
}

// ---------- /terms (button) ----------
$('#btn-all-terms')?.addEventListener('click', async () => {
  const res = await request('/terms');
  if (!res.ok || !Array.isArray(res.data)) return;
  clearPretty();
  res.data.slice(0, 60).forEach((t) => {
    pretty.appendChild(card({
      title: t,
      body: `<a class="text-blue-600 underline" href="#/terms/${encodeURIComponent(t)}">Open /terms/${t}</a>`
    }));
  });
});

// ---------- /terms/<t1> (live + button) ----------
let termsCtrl;
async function fetchTermLive(t) {
  if (termsCtrl) termsCtrl.abort();
  termsCtrl = new AbortController();
  const res = await request(`/terms/${encodeURIComponent(t)}`, { signal: termsCtrl.signal });
  if (!res.ok || !Array.isArray(res.data)) return;
  clearPretty();
  res.data.forEach((s) => {
    pretty.appendChild(card({
      title: s,
      body: `Associated with <span class="font-mono">${t}</span>`
    }));
  });
}
$('#input-term')?.addEventListener('input', debounce((e) => {
  const t = e.target.value.trim();
  if (!t) { setOut('Type a term…'); clearPretty(); return; }
  fetchTermLive(t);
}, 350));
$('#btn-term')?.addEventListener('click', () => {
  const t = $('#input-term').value.trim();
  if (!t) return alert('Enter a term');
  fetchTermLive(t);
});

// ---------- /query/<q>/studies (live + button) ----------
let queryCtrl;
async function fetchQueryLive(q) {
  if (queryCtrl) queryCtrl.abort();
  queryCtrl = new AbortController();
  const res = await request(`/query/${encodeURIComponent(q)}/studies`, { signal: queryCtrl.signal });
  if (!res.ok || !Array.isArray(res.data)) return;
  clearPretty();
  res.data.forEach((row, i) => {
    const title = row.title || row.name || `Study #${i + 1}`;
    const body = [
      row.id ? `<div>ID: <span class="font-mono">${row.id}</span></div>` : '',
      row.description ? `<div>${row.description}</div>` : '',
    ].join('');
    pretty.appendChild(card({ title, body }));
  });
}
$('#input-query')?.addEventListener('input', debounce((e) => {
  const q = e.target.value.trim();
  if (!q) { setOut('Type a query…'); clearPretty(); return; }
  fetchQueryLive(q);
}, 450));
$('#btn-query')?.addEventListener('click', () => {
  const q = $('#input-query').value.trim();
  if (!q) return alert('Enter a query');
  fetchQueryLive(q);
});

// ---------- Copy JSON ----------
document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'btn-copy') {
    try {
      await navigator.clipboard.writeText(out.textContent);
      const btn = e.target;
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = old), 900);
    } catch { alert('Copy failed'); }
  }
});

// ---------- hash 路由：支援 #/terms/<t1> ----------
window.addEventListener('hashchange', handleHashRoute);
function handleHashRoute() {
  const hash = location.hash.slice(1);
  const m = hash.match(/^\/terms\/(.+)$/);
  if (m) {
    const val = decodeURIComponent(m[1]);
    const el = $('#input-term');
    if (el) { el.value = val; fetchTermLive(val); }
  }
}
handleHashRoute();
