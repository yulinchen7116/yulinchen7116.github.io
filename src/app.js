const BASE = 'https://hpc.psy.ntu.edu.tw:5000';

const $  = (s) => document.querySelector(s);
const out = $('#out');
function setOut(t){ out.textContent = t; }

const input   = $('#input-term');
const listEl  = $('#term-suggest');
const counter = $('#term-count');

let TERMS_CACHE = [];
let activeIndex = -1;
let currentList = [];

// 小工具
const debounce = (fn,ms=200)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

async function loadTerms() {
  setOut(`Loading terms from ${BASE}/terms ...`);
  try {
    const r = await fetch(`${BASE}/terms`);
    const data = await r.json();
    TERMS_CACHE = Array.isArray(data) ? data : [];
    counter.textContent = `loaded: ${TERMS_CACHE.length}`;
    setOut(`Loaded ${TERMS_CACHE.length} terms`);
  } catch (e) {
    setOut('Failed to load /terms: ' + (e.message || String(e)));
  }
}

// 前綴篩選
function getSuggestions(prefix, limit=30){
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  return TERMS_CACHE.filter(t => t.toLowerCase().startsWith(p)).slice(0, limit);
}

// 顯示/隱藏
function show(){ listEl.classList.remove('hidden'); input.setAttribute('aria-expanded','true'); }
function hide(){ listEl.classList.add('hidden');    input.setAttribute('aria-expanded','false'); }

function render(list, q){
  currentList = list;
  activeIndex = -1;
  if (!list.length){ hide(); listEl.innerHTML=''; return; }
  const ql = q.toLowerCase();
  listEl.innerHTML = list.map((t,i)=>{
    const pre  = t.slice(0, ql.length);
    const rest = t.slice(ql.length);
    return `<li role="option" data-i="${i}"
              class="px-3 py-2 hover:bg-slate-100 cursor-pointer">
              <span class="font-semibold">${pre}</span>${rest}
            </li>`;
  }).join('');
  show();
}

// 鍵盤移動/選取
function move(delta){
  if (!currentList.length) return;
  activeIndex = (activeIndex + delta + currentList.length) % currentList.length;
  [...listEl.children].forEach((li,idx)=>{
    li.classList.toggle('bg-slate-100', idx===activeIndex);
  });
}
function pick(){
  if (activeIndex<0 || !currentList[activeIndex]) return;
  input.value = currentList[activeIndex];
  hide();
  // 這裡你可以接著打 /terms/<t1> 顯示右側卡片；先簡化只顯示在 Response
  setOut(`Picked: ${input.value}`);
}

// 事件：輸入 → 建議、鍵盤、滑鼠
input.addEventListener('input', debounce((e)=>{
  const q = e.target.value;
  render(getSuggestions(q, 30), q);
}, 150));

input.addEventListener('keydown', (e)=>{
  if (listEl.classList.contains('hidden')) return;
  if (e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
  else if (e.key === 'Enter'){ e.preventDefault(); pick(); }
  else if (e.key === 'Escape'){ hide(); }
});

// 用 mousedown 可避免 blur 太早關閉
listEl.addEventListener('mousedown', (e)=>{
  const li = e.target.closest('li'); if (!li) return;
  activeIndex = Number(li.dataset.i);
  pick();
});

// 失焦延遲隱藏（讓點擊能生效）
input.addEventListener('blur', ()=> setTimeout(hide, 120));

// 一開始就把 /terms 載入快取
loadTerms();