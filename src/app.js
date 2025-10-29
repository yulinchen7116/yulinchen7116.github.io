const BASE = 'https://hpc.psy.ntu.edu.tw:5000';
const $  = (s) => document.querySelector(s);
const out = $('#out');
const pretty = $('#pretty');

// ---------- 基本 I/O ----------
function setOut(t){ out.textContent = t; }
function setJSON(obj, info=''){ setOut((info ? info+'\n' : '') + JSON.stringify(obj, null, 2)); }
function clearPretty(){ pretty.innerHTML=''; }

// 小工具
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

// ---------- 通用請求 ----------
async function request(path, { signal } = {}) {
  setOut(`Requesting: ${BASE}${path} …`);
  clearPretty();
  try {
    const resp = await fetch(`${BASE}${path}`, { signal });
    const info = `HTTP ${resp.status} ${resp.statusText}`;
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) { setOut(info + '\n\n' + (await resp.text())); return { ok:false }; }
    if (ct.includes('application/json')) {
      const data = await resp.json(); setJSON(data, info); return { ok:true, data };
    } else {
      const text = await resp.text(); setOut(info + '\n\n' + text); return { ok:true, data:text };
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok:false, aborted:true };
    setOut(`Error: ${err?.message || String(err)}\n\nCommon causes:\n1) CORS not allowed by the server\n2) Opening via file:// instead of a local server\n3) Network/server issues`);
    return { ok:false };
  }
}

// ======================================================
//                Autocomplete for /terms<t1>
// ======================================================

// 1) 啟動時抓一次 /terms 作快取
let TERMS_CACHE = [];
(async () => {
  const r = await request('/terms');
  if (r.ok && Array.isArray(r.data)) TERMS_CACHE = r.data;
})();

// 2) 取得建議（前綴匹配，不分大小寫；你也可改成 .includes）
function getSuggestions(prefix, limit=30){
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  return TERMS_CACHE.filter(t => t.toLowerCase().startsWith(p)).slice(0, limit);
}

// 3) DOM 與狀態
const inputTerm   = $('#input-term');
const suggestEl   = $('#term-suggest');
let   activeIndex = -1;       // -1 代表未選
let   currentList = [];
let   termsCtrl;              // AbortController for live fetch

// 4) 渲染清單（把匹配前綴加粗顯示）
function renderSuggestions(list, query){
  currentList = list;
  activeIndex = -1;

  if (!list.length){
    hideSuggest();
    return;
  }
  const q = query.toLowerCase();
  suggestEl.innerHTML = list.map((t,i)=>{
    const pre  = t.slice(0, q.length);
    const rest = t.slice(q.length);
    return `<li role="option" data-i="${i}"
                class="px-3 py-2 hover:bg-slate-100 cursor-pointer">
              <span class="font-semibold">${pre}</span>${rest}
            </li>`;
  }).join('');
  showSuggest();
}

function showSuggest(){
  suggestEl.classList.remove('hidden');
  inputTerm.setAttribute('aria-expanded','true');
}
function hideSuggest(){
  suggestEl.classList.add('hidden');
  inputTerm.setAttribute('aria-expanded','false');
}

// 5) 鍵盤操作
function moveActive(delta){
  if (!currentList.length) return;
  activeIndex = (activeIndex + delta + currentList.length) % currentList.length;
  [...suggestEl.children].forEach((li,idx)=>{
    li.classList.toggle('bg-slate-100', idx===activeIndex);
  });
}
function pickActive(){
  if (activeIndex < 0 || !currentList[activeIndex]) return;
  inputTerm.value = currentList[activeIndex];
  hideSuggest();
  triggerLookup(inputTerm.value);
}

// 6) 滑鼠點選（mousedown 可避免 blur 提早關閉）
suggestEl.addEventListener('mousedown', (e)=>{
  const li = e.target.closest('li'); if (!li) return;
  const i = Number(li.dataset.i);
  inputTerm.value = currentList[i];
  hideSuggest();
  triggerLookup(inputTerm.value);
});

// 7) 監聽輸入（即時建議 + 達到長度門檻就查）
inputTerm.addEventListener('input', debounce((e)=>{
  const q = e.target.value;
  renderSuggestions(getSuggestions(q, 30), q);
  if (q.trim().length >= 2) triggerLookup(q.trim()); // 門檻可改成 >=1
}, 200));

// 8) 方向鍵 / Enter / Esc
inputTerm.addEventListener('keydown', (e)=>{
  if (!suggestEl.classList.contains('hidden')){
    if (e.key === 'ArrowDown'){ e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter'){ e.preventDefault(); pickActive(); }
    else if (e.key === 'Escape'){ hideSuggest(); }
  }
});

// 9) 失焦後隱藏（延遲一點讓點擊可以生效）
inputTerm.addEventListener('blur', () => setTimeout(hideSuggest, 120));

// 10) 按鈕仍可用
$('#btn-term')?.addEventListener('click', ()=>{
  const t = inputTerm.value.trim(); if (!t) return;
  hideSuggest(); triggerLookup(t);
});

// 11) 查 /terms/<t1>
async function triggerLookup(term){
  if (termsCtrl) termsCtrl.abort();
  termsCtrl = new AbortController();
  const r = await request(`/terms/${encodeURIComponent(term)}`, { signal: termsCtrl.signal });
  if (!r.ok || !Array.isArray(r.data)) return;
  clearPretty();
  r.data.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'p-4 bg-white rounded-xl shadow';
    div.innerHTML = `<h3 class="font-semibold">${s}</h3>
                     <div class="text-sm text-slate-600">
                       Associated with <span class="font-mono">${term}</span>
                     </div>`;
    pretty.appendChild(div);
  });
}

// ------------------------------------------------------
// 你原本的 /terms（列出全部）與 /query/<q>/studies 邏輯可照舊
// ------------------------------------------------------
$('#btn-all-terms')?.addEventListener('click', async () => {
  const res = await request('/terms');
  if (!res.ok || !Array.isArray(res.data)) return;
  clearPretty();
  res.data.slice(0,60).forEach(t=>{
    const card = document.createElement('div');
    card.className='p-4 bg-white rounded-xl shadow';
    card.innerHTML=`<h3 class="font-semibold mb-1">${t}</h3>
                    <button class="text-blue-600 underline"
                            onclick="document.querySelector('#input-term').value='${t}'; ${'('+triggerLookup.toString()+')'}('${t}')">
                      Open
                    </button>`;
    pretty.appendChild(card);
  });
});