// 伺服器改為老師公告的替代主機
const BASE = 'https://hpc.psy.ntu.edu.tw:5000';

const $ = (s) => document.querySelector(s);
const out = $('#out');
const pretty = $('#pretty');

function setOut(t){ out.textContent = t; }
function setJSON(obj, info=''){ setOut((info?info+'\n':'')+JSON.stringify(obj,null,2)); }
function clearPretty(){ pretty.innerHTML=''; }

// ---- 通用請求 ----
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
    setOut(`Error: ${err?.message||String(err)}\n\nCommon causes:\n1) CORS\n2) file://\n3) Network/server issues`);
    return { ok:false };
  }
}

// ========= Autocomplete 核心 =========

// 1) 啟動時抓一次 /terms 存到前端（小型快取）
let TERMS_CACHE = [];
(async () => {
  const res = await request('/terms');
  if (res.ok && Array.isArray(res.data)) TERMS_CACHE = res.data;
})();

// 2) 取得建議（前綴比對，不分大小寫）
function getSuggestions(prefix, limit=20){
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  return TERMS_CACHE.filter(t => t.toLowerCase().startsWith(p)).slice(0, limit);
}

// 3) 渲染清單 + 高亮目前選取（支援鍵盤）
const suggestEl = $('#term-suggest');
let activeIndex = -1;  // -1 代表未選
let currentList = [];

function renderSuggestions(list, query){
  currentList = list;
  activeIndex = -1;
  if (!list.length){ suggestEl.classList.add('hidden'); suggestEl.innerHTML=''; return; }
  suggestEl.innerHTML = list.map((t,i)=>{
    // 粗體顯示匹配前綴
    const pre = t.slice(0, query.length);
    const rest = t.slice(query.length);
    return `<li data-i="${i}" class="px-3 py-2 hover:bg-slate-100 cursor-pointer">
              <span class="font-semibold">${pre}</span>${rest}
            </li>`;
  }).join('');
  suggestEl.classList.remove('hidden');
}

function moveActive(delta){
  if (!currentList.length) return;
  activeIndex = (activeIndex + delta + currentList.length) % currentList.length;
  [...suggestEl.children].forEach((li,idx)=>{
    li.classList.toggle('bg-slate-100', idx===activeIndex);
  });
}

function pickActiveToInput(){
  const input = $('#input-term');
  if (activeIndex>=0 && currentList[activeIndex]){
    input.value = currentList[activeIndex];
    suggestEl.classList.add('hidden');
    fetchTermLive(input.value); // 直接觸發查詢
  }
}

// 4) 綁定滑鼠事件（點選某項）
suggestEl?.addEventListener('mousedown', (e)=>{
  // mousedown 可避免 input 失焦導致清單消失太快
  const li = e.target.closest('li'); if (!li) return;
  const i = Number(li.dataset.i);
  const input = $('#input-term');
  input.value = currentList[i];
  suggestEl.classList.add('hidden');
  fetchTermLive(input.value);
});

// ========= 既有 /terms 功能（按鈕保留） =========
$('#btn-all-terms')?.addEventListener('click', async () => {
  const res = await request('/terms');
  if (!res.ok || !Array.isArray(res.data)) return;
  clearPretty();
  res.data.slice(0,60).forEach(t=>{
    const card = document.createElement('div');
    card.className='p-4 bg-white rounded-xl shadow';
    card.innerHTML=`<h3 class="font-semibold mb-1">${t}</h3>
                    <button class="text-blue-600 underline" onclick="document.querySelector('#input-term').value='${t}'; fetchTermLive('${t}')">Open</button>`;
    pretty.appendChild(card);
  });
});

// ========= /terms/<t1> 即時查詢 + 自動完成 =========
let termsCtrl;
async function fetchTermLive(t){
  if (termsCtrl) termsCtrl.abort();
  termsCtrl = new AbortController();
  const res = await request(`/terms/${encodeURIComponent(t)}`, { signal: termsCtrl.signal });
  if (!res.ok || !Array.isArray(res.data)) return;
  clearPretty();
  res.data.forEach(s=>{
    const card = document.createElement('div');
    card.className='p-4 bg-white rounded-xl shadow';
    card.innerHTML = `<h3 class="font-semibold">${s}</h3>
                      <div class="text-sm text-slate-600">Associated with <span class="font-mono">${t}</span></div>`;
    pretty.appendChild(card);
  });
}

// 去抖動
const debounce = (fn,ms=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

$('#input-term')?.addEventListener('input', debounce((e)=>{
  const q = e.target.value;
  // 1) 渲染建議
  const list = getSuggestions(q, 30);
  renderSuggestions(list, q.toLowerCase());
  // 2) 亦可在輸入達到一定字數就自動查後端（可調）
  if (q.trim().length >= 2) fetchTermLive(q.trim());
}, 250));

// 鍵盤操作：↑ ↓ Enter Esc
$('#input-term')?.addEventListener('keydown', (e)=>{
  if (suggestEl.classList.contains('hidden')) return;
  if (e.key==='ArrowDown'){ e.preventDefault(); moveActive(1); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); moveActive(-1); }
  else if (e.key==='Enter'){ e.preventDefault(); pickActiveToInput(); }
  else if (e.key==='Escape'){ suggestEl.classList.add('hidden'); }
});

$('#btn-term')?.addEventListener('click', ()=>{
  const t = $('#input-term').value.trim(); if (!t) return;
  suggestEl.classList.add('hidden');
  fetchTermLive(t);
});



