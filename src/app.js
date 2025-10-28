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

async function request(path) {
  setOut(`Requesting: ${BASE}${path} …`);
  clearPretty();
  try {
    const resp = await fetch(`${BASE}${path}`);
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

$('#btn-all-terms').addEventListener('click', async () => {
  const res = await request('/terms');
  if (!res.ok || !res.data) return;
  if (Array.isArray(res.data)) {
    clearPretty();
    res.data.slice(0, 60).forEach((t) => {
      pretty.appendChild(card({
        title: t,
        body: `<a class="text-blue-600 underline" href="#/terms/${encodeURIComponent(t)}">Open /terms/${t}</a>`
      }));
    });
  }
});

$('#btn-term').addEventListener('click', async () => {
  const t = $('#input-term').value.trim();
  if (!t) return alert('Enter a term');
  const res = await request(`/terms/${encodeURIComponent(t)}`);
  if (!res.ok || !res.data) return;
  if (Array.isArray(res.data)) {
    clearPretty();
    res.data.forEach((s) => {
      pretty.appendChild(card({
        title: s,
        body: `Associated with <span class="font-mono">${t}</span>`
      }));
    });
  }
});

$('#btn-query').addEventListener('click', async () => {
  const q = $('#input-query').value.trim();
  if (!q) return alert('Enter a query');
  const res = await request(`/query/${encodeURIComponent(q)}/studies`);
  if (!res.ok || !res.data) return;
  if (Array.isArray(res.data)) {
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
});

// Copy JSON
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

// hash 路由：支援直接打開 #/terms/<t1>
window.addEventListener('hashchange', handleHashRoute);
function handleHashRoute() {
  const hash = location.hash.slice(1);
  const m = hash.match(/^\/terms\/(.+)$/);
  if (m) {
    document.querySelector('#input-term').value = decodeURIComponent(m[1]);
    document.querySelector('#btn-term').click();
  }
}
handleHashRoute();
