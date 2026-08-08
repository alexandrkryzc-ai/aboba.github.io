/* ============================================================
   app.js — расширение тренажёра:
   1) статистика в localStorage (по темам + история)
   2) перемешивание вариантов ответов
   3) поиск по вопросам
   4) режим «только ошибки»
   ============================================================ */

/* ---------- Хранилище ---------- */
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
let STATS   = LS.get('erp_stats',{});     // {"1.0":{t:попыток,r:верно,last:bool}}
let MISSED  = LS.get('erp_missed',[]);     // ["1.0","5.12",...] — ключи вопросов с ошибками
let HISTORY = LS.get('erp_history',[]);    // [{d,title,score,total}]
let SETTINGS= LS.get('erp_settings',{shuffle:true});
function saveAll(){LS.set('erp_stats',STATS);LS.set('erp_missed',MISSED);LS.set('erp_history',HISTORY);LS.set('erp_settings',SETTINGS);}

/* ---------- Стабильные ключи вопросов (тема.номер) ---------- */
(function assignKeys(){const n={};QB.forEach(q=>{const i=n[q.t]||0;n[q.t]=i+1;q.k=q.t+'.'+i;});})();

/* ---------- Учёт ответа ---------- */
function recordAnswer(q,ok){
  if(!q.k)return; // экзаменационные вопросы (вне банка) не отслеживаем
  const s=STATS[q.k]||(STATS[q.k]={t:0,r:0,last:null});
  s.t++; if(ok)s.r++; s.last=ok;
  const i=MISSED.indexOf(q.k);
  if(ok){ if(i>-1)MISSED.splice(i,1); } else { if(i===-1)MISSED.push(q.k); }
  saveAll();
}
function missedQuestions(){const set={};MISSED.forEach(k=>set[k]=true);return QB.filter(q=>set[q.k]);}
function topicStats(t){const pool=poolOf(t);let learned=0,attempts=0,right=0;
  pool.forEach(q=>{const s=STATS[q.k];if(s){attempts+=s.t;right+=s.r;if(s.r>0)learned++;}});
  return {learned,attempts,right,total:pool.length};}

/* ---------- Переопределяем отрисовку вопроса (с перемешиванием) ---------- */
function renderQ(){
  const s=session,q=s.qs[s.idx];s.sel=null;s.checked=false;
  $("qcount").textContent=`Вопрос ${s.idx+1} из ${s.qs.length} · Тема ${q.t}. ${T(q.t).name}`;
  $("pbar").style.width=(s.idx/s.qs.length*100)+"%";
  $("qtext").textContent=q.q;
  let idxs=q.o.map((_,i)=>i);
  if(SETTINGS.shuffle)idxs=shuffle(idxs);
  s.order=idxs; s.opts=idxs.map(i=>q.o[i]); s.correctPos=idxs.indexOf(q.a);
  const box=$("opts");box.innerHTML="";
  s.opts.forEach((txt,i)=>{const b=document.createElement("button");b.className="opt";b.type="button";
    b.innerHTML=`<span class="n">${i+1}</span><span>${txt}</span>`;b.onclick=()=>select(i);box.appendChild(b);});
  $("btn-check").classList.add("hidden");$("btn-next").classList.add("hidden");
  const fb=$("fb");fb.style.display="none";fb.className="fb";
}

/* ---------- Переопределяем проверку (учёт + верный текст) ---------- */
function check(){
  const s=session,q=s.qs[s.idx];if(s.sel===null||s.checked)return;
  s.checked=true;
  const ok=s.sel===s.correctPos; if(ok)s.score++;
  const selText=s.opts[s.sel], correctText=s.opts[s.correctPos];
  s.results.push({q,ok,selText,correctText});
  recordAnswer(q,ok);
  [...$("opts").children].forEach((b,j)=>{b.disabled=true;
    if(j===s.correctPos)b.classList.add("correct");else if(j===s.sel)b.classList.add("wrong");
    b.classList.remove("sel");});
  const fb=$("fb");fb.style.display="block";fb.className="fb "+(ok?"ok":"no");
  $("fb-t").textContent=ok?"✔ Верно!":"✘ Неверно";
  let html= ok? "" : `<div style="margin-bottom:8px"><b>Правильный ответ:</b> ${correctText}</div>`;
  html+= q.c? `<b>Комментарий:</b> ${q.c}` : `<i>Пояснение к этому вопросу не добавлено.</i>`;
  $("fb-c").innerHTML=html;
  $("btn-check").classList.add("hidden");
  $("btn-next").textContent=(s.idx+1<s.qs.length)?"Следующий вопрос →":"Показать результат";
  $("btn-next").classList.remove("hidden");
}

/* ---------- Переопределяем финал (история + разбор) ---------- */
function finish(){
  clearInterval(timerInt);const s=session;
  for(let i=s.idx+(s.checked?1:0);i<s.qs.length;i++){const q=s.qs[i];
    s.results.push({q,ok:false,selText:null,correctText:q.o[q.a]});recordAnswer(q,false);}
  HISTORY.unshift({d:new Date().toLocaleString('ru-RU'),title:s.title,score:s.score,total:s.qs.length});
  if(HISTORY.length>30)HISTORY.length=30; saveAll();
  $("screen-quiz").classList.add("hidden");$("screen-result").classList.remove("hidden");
  const n=s.qs.length;$("r-score").textContent=`${s.score} / ${n}`;
  const v=$("r-verdict");
  if(n===14){v.textContent=s.score>=12?"СДАНО ✔":"НЕ СДАНО ✘";v.className="verdict "+(s.score>=12?"pass":"fail");
    $("r-sub").textContent=s.score>=12?"Поздравляем! 12 и более правильных ответов — как на реальном экзамене «1С:Профессионал».":"Для успешной сдачи нужно минимум 12 правильных ответов из 14.";}
  else{const p=s.score/n>=0.85;v.textContent=p?"Отличный результат!":"Продолжайте тренироваться";v.className="verdict "+(p?"pass":"fail");
    $("r-sub").textContent="Ориентир для экзамена — не менее 12 правильных из 14 (≈ 85%).";}
  const rows=$("r-rows");rows.innerHTML="";
  s.results.forEach((r,i)=>{const d=document.createElement("div");d.className="row "+(r.ok?"good":"bad");
    d.innerHTML=`<div class="ic">${r.ok?"✔":"✘"}</div><div><b>Вопрос ${i+1}.</b> ${r.q.q}<br>
    <small>Тема ${r.q.t}. ${T(r.q.t).name} · ${r.selText===null?"Нет ответа":(r.ok?"Верный ответ":"Ваш ответ: "+r.selText+" → правильно: "+r.correctText)}</small>${r.q.c?`<br><small style="color:#c9d1ee">💬 ${r.q.c}</small>`:""}</div>`;
    rows.appendChild(d);});
  $("r-retry").onclick=()=>startQuiz(shuffle(s.qs.map(q=>({...q}))),s.title,s.timed);
  window.scrollTo(0,0);
}

/* ---------- Режим «только ошибки» ---------- */
function startMissed(){
  const qs=missedQuestions();
  if(!qs.length){alert("Ошибок пока нет. Отвечайте на вопросы — неверно решённые появятся здесь.");return;}
  startQuiz(shuffle(qs.map(q=>({...q}))),"Работа над ошибками ("+qs.length+")",false);
}

/* ---------- Поиск ---------- */
let _searchFound=[];
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function doSearch(){
  const q=$("search-input").value.trim().toLowerCase();const res=$("search-results");
  if(!q){res.innerHTML="";return;}
  _searchFound=QB.filter(it=>(it.q+" "+it.o.join(" ")).toLowerCase().includes(q));
  if(!_searchFound.length){res.innerHTML='<div class="sresult" style="cursor:default">Ничего не найдено.</div>';return;}
  let html='<div style="margin:10px 0"><button class="btn" onclick="trainSearch()">Тренировать найденные ('+_searchFound.length+')</button></div>';
  _searchFound.slice(0,50).forEach(it=>{
    html+='<div class="sresult" onclick="trainOne(\''+it.k+'\')"><span class="tm">Тема '+it.t+'. '+T(it.t).name+'</span><br>'+escapeHtml(it.q)+'</div>';});
  if(_searchFound.length>50)html+='<div class="sresult" style="cursor:default">…и ещё '+(_searchFound.length-50)+'. Уточните запрос.</div>';
  res.innerHTML=html;
}
function trainSearch(){if(!_searchFound.length)return;startQuiz(shuffle(_searchFound.map(q=>({...q}))),"Поиск ("+_searchFound.length+")",false);}
function trainOne(k){const it=QB.find(q=>q.k===k);if(it)startQuiz([{...it}],"Вопрос · Тема "+it.t,false);}

/* ---------- Статистика ---------- */
function renderOverall(){
  let attempts=0,right=0,learned=0;Object.values(STATS).forEach(s=>{attempts+=s.t;right+=s.r;if(s.r>0)learned++;});
  const acc=attempts?Math.round(right/attempts*100):0;
  $("stats-overall").innerHTML=`
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:16px">
     <div class="card stat"><span>Всего вопросов</span><b>${QB.length}</b></div>
     <div class="card stat"><span>Изучено (≥1 верно)</span><b>${learned}</b></div>
     <div class="card stat"><span>Дано ответов</span><b>${attempts}</b></div>
     <div class="card stat"><span>Правильных</span><b>${acc}%</b></div>
     <div class="card stat"><span>Ошибок к повтору</span><b>${MISSED.length}</b></div>
   </div>`;
}
function renderTopicStats(){
  let rows="";TOPICS.forEach(t=>{const st=topicStats(t.id);const pct=st.total?Math.round(st.learned/st.total*100):0;
    rows+=`<tr><td>${t.id}. ${t.name}</td><td>${st.total}</td><td>${st.learned}</td><td>${st.attempts}</td><td>${st.attempts?Math.round(st.right/st.attempts*100)+"%":"—"}</td><td><div class="bar"><div style="width:${pct}%"></div></div></td></tr>`;});
  $("stats-topics").innerHTML=`<table class="stat-table"><thead><tr><th>Тема</th><th>Вопросов</th><th>Изучено</th><th>Попыток</th><th>Верно</th><th>Прогресс</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderHistory(){
  const h=HISTORY.slice(0,10);
  if(!h.length){$("stats-history").innerHTML='<div style="color:var(--muted);font-size:13px">Пока нет пройденных тестов.</div>';return;}
  $("stats-history").innerHTML=h.map(r=>{const pass=r.total===14?r.score>=12:(r.score/r.total>=0.85);
    return `<div class="hist-item"><span>${r.title}</span><span style="color:var(--muted)">${r.d}</span><span class="pill ${pass?"pass":"fail"}">${r.score}/${r.total}</span></div>`;}).join("");
}
function resetStats(){if(!confirm("Сбросить всю статистику и историю ошибок?"))return;STATS={};MISSED=[];HISTORY=[];saveAll();buildHome();}

/* ---------- Переопределяем главный экран ---------- */
function buildHome(){
  $("screen-home").innerHTML=`
   <h2 class="sec">📋 Экзаменационные задания (официальные ответы и комментарии)</h2>
   <div class="grid" id="exams-grid"></div>
   <h2 class="sec">🎯 Симулятор и спецрежимы</h2>
   <div class="grid">
     <div class="card exam-card" onclick="startSim()"><div class="num">⏱</div><div><b>Случайный билет: 14 вопросов</b><span>По одному из каждой темы · 30 минут · порог 12/14</span></div></div>
     <div class="card" onclick="startMissed()"><div class="num">🔁</div><div><b>Только ошибки</b><span id="missed-count"></span></div></div>
   </div>
   <div style="margin:14px 0"><label class="toggle"><input type="checkbox" id="shuffle-toggle">Перемешивать варианты ответов</label></div>
   <h2 class="sec">🔍 Поиск по вопросам</h2>
   <div class="searchbox"><input id="search-input" type="text" placeholder="Ключевое слово, например: серия, бюджет, амортизация"><button class="btn" id="search-btn">Найти</button></div>
   <div id="search-results"></div>
   <h2 class="sec">📚 Тренировка по темам</h2>
   <div class="grid" id="topics-grid"></div>
   <h2 class="sec">📊 Статистика</h2>
   <div id="stats-overall"></div>
   <div id="stats-topics"></div>
   <h3 style="font-size:14px;color:var(--muted);margin:18px 0 8px">Последние результаты</h3>
   <div id="stats-history"></div>
   <div style="margin-top:16px"><button class="btn ghost" onclick="resetStats()">🗑 Сбросить статистику</button></div>`;
  // экзамены
  const eg=$("exams-grid");eg.innerHTML="";
  [EXAM1,EXAM2].forEach((ex,i)=>{const d=document.createElement("div");d.className="card exam-card";
    d.innerHTML=`<div class="num">${i+1}</div><div><b>${ex.name} — экзамен (14 вопросов)</b><span>${ex.desc}</span></div>`;
    d.onclick=()=>startQuiz(ex.questions.map(q=>({...q})),ex.name,false);eg.appendChild(d);});
  // темы с прогрессом
  const tg=$("topics-grid");tg.innerHTML="";
  TOPICS.forEach(t=>{const pool=poolOf(t.id);const n=pool.length;const st=topicStats(t.id);const pct=n?Math.round(st.learned/n*100):0;
    const d=document.createElement("div");d.className="card";
    d.innerHTML=`<div class="num">${t.id}</div><div style="flex:1"><b>${t.title}</b><span>${n} вопрос(ов) · изучено ${st.learned}/${n}</span><div class="bar" style="margin-top:6px"><div style="width:${pct}%"></div></div></div>`;
    d.onclick=()=>{if(!n){alert("В этой теме нет вопросов.");return;}startQuiz(shuffle(pool.map(q=>({...q}))),"Тема "+t.id+". "+t.title,false);};
    tg.appendChild(d);});
  $("missed-count").textContent=MISSED.length?MISSED.length+" вопрос(ов) к повтору":"Ошибок пока нет";
  const stgl=$("shuffle-toggle");stgl.checked=!!SETTINGS.shuffle;stgl.onchange=()=>{SETTINGS.shuffle=stgl.checked;saveAll();};
  $("search-btn").onclick=doSearch;$("search-input").onkeydown=e=>{if(e.key==="Enter")doSearch();};
  renderOverall();renderTopicStats();renderHistory();
  $("bank-size").textContent="В банке: "+QB.length+" вопросов";
}

/* ---------- Стили для новых элементов ---------- */
(function(){const s=document.createElement("style");s.textContent=`
.searchbox{display:flex;gap:10px;margin-bottom:12px}
.searchbox input{flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:12px 14px;font-size:14px}
.searchbox input:focus{outline:none;border-color:var(--yellow)}
.sresult{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font-size:13.5px;line-height:1.4}
.sresult:hover{border-color:var(--yellow)}
.sresult .tm{color:var(--yellow);font-size:12px;font-weight:700}
.stat-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
.stat-table th,.stat-table td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
.stat-table th{color:var(--muted);font-weight:600}
.bar{height:6px;background:var(--panel2);border-radius:99px;overflow:hidden;min-width:80px}
.bar div{height:100%;background:linear-gradient(90deg,var(--green),#7fe3a5)}
.toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);cursor:pointer;user-select:none}
.toggle input{width:16px;height:16px;accent-color:var(--yellow)}
.hist-item{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between;gap:10px;align-items:center}
.pill{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}
.pill.pass{background:rgba(62,207,122,.15);color:var(--green)}
.pill.fail{background:rgba(255,97,97,.15);color:var(--red)}
.card.stat{cursor:default;flex-direction:column;align-items:flex-start;gap:4px}
.card.stat:hover{transform:none;border-color:var(--line)}
.card.stat span{font-size:12px;color:var(--muted)}
.card.stat b{font-size:22px}
`;document.head.appendChild(s);})();

buildHome();