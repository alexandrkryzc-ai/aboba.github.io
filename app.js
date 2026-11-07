/* ============================================================
   app.js — тренажёр 1С:Профессионал по платформе 8.3
   - статистика в localStorage
   - перемешивание вариантов
   - поиск
   - режим «только ошибки»
   - поддержка картинок в вопросах
   ============================================================ */

const LS = {
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
let STATS   = LS.get('plat_stats',{});
let MISSED  = LS.get('plat_missed',[]);
let HISTORY = LS.get('plat_history',[]);
let SETTINGS= LS.get('plat_settings',{shuffle:true});
function saveAll(){LS.set('plat_stats',STATS);LS.set('plat_missed',MISSED);LS.set('plat_history',HISTORY);LS.set('plat_settings',SETTINGS);}

var QB=[], TOPICS=[], session=null, timerInt=null;

var TOPIC_NAMES = {
  '1':'Общие механизмы, понятия и термины',
  '2':'Редакторы и инструменты общие',
  '3':'Редакторы и инструменты режима разработки',
  '4':'Конструкторы',
  '5':'Технология разработки',
  '6':'Объектная модель прикладного решения',
  '7':'Табличная модель прикладного решения',
  '8':'Механизмы интеграции и обмена данными',
  '9':'Система взаимодействия',
  '10':'Интерфейсные механизмы',
  '11':'Механизмы построения отчетности',
  '12':'Механизмы оперативного учета',
  '13':'Объекты и механизмы бухгалтерского учета',
  '14':'Механизмы сложных периодических расчетов'
};

var $ = function(id){return document.getElementById(id);};
function shuffle(a){var x=a.slice();for(var i=x.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=x[i];x[i]=x[j];x[j]=t;}return x;}
function show(id){
  document.querySelectorAll('.screen').forEach(function(s){
    s.classList.remove('active');
    s.classList.remove('hidden');
  });
  var el = $(id);
  if(el) el.classList.add('active');
  window.scrollTo(0,0);
}
function poolOf(t){return QB.filter(function(q){return q.t===t;});}
function T(t){return TOPICS.find(function(x){return x.id===t;});}
function missedQuestions(){var set={};MISSED.forEach(function(k){set[k]=true;});return QB.filter(function(q){return set[q.k];});}
function topicStats(t){var pool=poolOf(t),learned=0,attempts=0,right=0;
  pool.forEach(function(q){var s=STATS[q.k];if(s){attempts+=s.t;right+=s.r;if(s.r>0)learned++;}});
  return{learned:learned,attempts:attempts,right:right,total:pool.length};}
function recordAnswer(q,ok){
  if(!q.k)return;
  var s=STATS[q.k]||(STATS[q.k]={t:0,r:0,last:null});
  s.t++;if(ok)s.r++;s.last=ok;
  var i=MISSED.indexOf(q.k);
  if(ok){if(i>-1)MISSED.splice(i,1);}else{if(i===-1)MISSED.push(q.k);}
  saveAll();
}

function loadData(){
  if(typeof platformQuestions==='undefined'||!Array.isArray(platformQuestions)){
    document.body.innerHTML='<p style="padding:40px;text-align:center;color:#ff6161">Ошибка: не загружен data.js</p>';
    return false;
  }
  var topicMap={};
  QB=[];
  platformQuestions.forEach(function(q){
    if(!q||!q.id)return;
    var opts=(q.options||[]).map(function(o){return o.text;});
    var ai=-1;
    if(q.correct&&q.correct.length){ai=q.correct[0]-1;}
    else{var c=(q.options||[]).find(function(o){return o.is_correct;});if(c)ai=c.number-1;}
    if(ai<0)return;
    var tid=String(q.id).split('.')[0];
    if(!topicMap[tid]){
      topicMap[tid]={id:tid,title:TOPIC_NAMES[tid]||('Раздел '+tid),name:TOPIC_NAMES[tid]||('Раздел '+tid)};
    }
    QB.push({
      t:tid,
      q:q.question,
      o:opts,
      a:ai,
      c:(q.explanation||''),
      rawId:q.id,
      images: q.images || [],
      link: q.link || ''
    });
  });
  TOPICS=Object.keys(topicMap).map(function(k){return topicMap[k];}).sort(function(a,b){return(+a.id)-(+b.id);});
  var n={};
  QB.forEach(function(q){var i=n[q.t]||0;n[q.t]=i+1;q.k=q.t+'.'+i;});
  return true;
}

function startQuiz(qs,title,timed){
  if(!qs||!qs.length){alert('Нет вопросов.');return;}
  session={qs:qs,title:title,timed:timed,idx:0,score:0,sel:null,checked:false,results:[],order:[],opts:[],correctPos:-1,timeLeft:timed?30*60:0};
  show('screen-quiz');renderQ();
  if(timerInt)clearInterval(timerInt);
  if(timed){updateTimer();timerInt=setInterval(function(){session.timeLeft--;updateTimer();if(session.timeLeft<=0){clearInterval(timerInt);finish();}},1000);}
  else{$('timer').textContent='';}
}
function updateTimer(){var t=session.timeLeft,m=Math.floor(t/60),s=t%60;$('timer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function startSim(){
  var qs=[];
  TOPICS.forEach(function(t){var pool=poolOf(t.id);if(pool.length)qs.push(pool[Math.floor(Math.random()*pool.length)]);});
  while(qs.length<14&&QB.length){var extra=QB[Math.floor(Math.random()*QB.length)];if(qs.indexOf(extra)===-1)qs.push(extra);else break;}
  startQuiz(shuffle(qs).slice(0,14),'Случайный билет (14 вопросов)',true);
}
function exitQuiz(){if(confirm('Выйти из теста? Прогресс текущего теста будет потерян.')){if(timerInt)clearInterval(timerInt);goHome();}}
function goHome(){show('screen-home');buildHome();}

function renderQ(){
  var s=session,q=s.qs[s.idx];s.sel=null;s.checked=false;
  var tName=(T(q.t)&&T(q.t).name)||(TOPIC_NAMES[q.t]||q.t);
  $('qcount').textContent='Вопрос '+(s.idx+1)+' из '+s.qs.length+' · Раздел '+q.t+'. '+tName;
  $('pbar').style.width=(s.idx/s.qs.length*100)+'%';
  $('qtext').textContent=q.q;

  // images
  var imgBox=$('qimgs');
  imgBox.innerHTML='';
  if(q.images&&q.images.length){
    q.images.forEach(function(src){
      var im=document.createElement('img');
      im.src=src;im.alt='Иллюстрация к вопросу';
      im.onclick=function(e){e.stopPropagation();$('lightbox-img').src=src;$('lightbox').classList.add('active');};
      imgBox.appendChild(im);
    });
  }

  var idxs=q.o.map(function(_,i){return i;});
  if(SETTINGS.shuffle)idxs=shuffle(idxs);
  s.order=idxs;s.opts=idxs.map(function(i){return q.o[i];});s.correctPos=idxs.indexOf(q.a);
  var box=$('opts');box.innerHTML='';
  s.opts.forEach(function(txt,i){
    var b=document.createElement('button');b.className='opt';b.type='button';
    b.innerHTML='<span class="n">'+(i+1)+'</span><span>'+txt+'</span>';
    b.onclick=function(){select(i);};box.appendChild(b);
  });
  $('btn-check').classList.add('hidden');$('btn-next').classList.add('hidden');
  var fb=$('fb');fb.style.display='none';fb.className='fb';
}

function select(i){
  if(session.checked)return;
  session.sel=i;
  [...$('opts').children].forEach(function(b,j){b.classList.toggle('sel',j===i);});
  $('btn-check').classList.remove('hidden');
}

function check(){
  var s=session,q=s.qs[s.idx];if(s.sel===null||s.checked)return;
  s.checked=true;
  var ok=s.sel===s.correctPos;if(ok)s.score++;
  var selText=s.opts[s.sel],correctText=s.opts[s.correctPos];
  s.results.push({q:q,ok:ok,selText:selText,correctText:correctText});
  recordAnswer(q,ok);
  [...$('opts').children].forEach(function(b,j){b.disabled=true;
    if(j===s.correctPos)b.classList.add('correct');else if(j===s.sel)b.classList.add('wrong');
    b.classList.remove('sel');});
  var fb=$('fb');fb.style.display='block';fb.className='fb '+(ok?'ok':'no');
  $('fb-t').textContent=ok?'✔ Верно!':'✘ Неверно';
  var html=ok?'':'<div style="margin-bottom:8px"><b>Правильный ответ:</b> '+correctText+'</div>';
  html+=q.c?('<b>Комментарий:</b> '+q.c):'<i>Пояснение к этому вопросу не добавлено.</i>';
  if(q.link)html+='<div style="margin-top:8px"><a href="'+q.link+'" target="_blank" style="color:var(--blue)">Документация ITS</a></div>';
  $('fb-c').innerHTML=html;
  $('btn-check').classList.add('hidden');
  $('btn-next').textContent=(s.idx+1<s.qs.length)?'Следующий вопрос →':'Показать результат';
  $('btn-next').classList.remove('hidden');
}

function next(){
  var s=session;
  if(s.idx+1<s.qs.length){s.idx++;renderQ();}
  else finish();
}

function finish(){
  clearInterval(timerInt);
  var s = session;
  if(!s){ goHome(); return; }

  // mark remaining unanswered questions as wrong
  for(var i = s.idx + (s.checked ? 1 : 0); i < s.qs.length; i++){
    var q = s.qs[i];
    s.results.push({
      q: q,
      ok: false,
      selText: null,
      correctText: (q.o && q.a >= 0 && q.a < q.o.length) ? q.o[q.a] : ''
    });
    recordAnswer(q, false);
  }

  HISTORY.unshift({
    d: new Date().toLocaleString('ru-RU'),
    title: s.title,
    score: s.score,
    total: s.qs.length
  });
  if(HISTORY.length > 30) HISTORY.length = 30;
  saveAll();

  // Force switch to result screen
  document.querySelectorAll('.screen').forEach(function(el){
    el.classList.remove('active');
    el.classList.remove('hidden');
  });
  var resultEl = $('screen-result');
  if(resultEl){
    resultEl.classList.add('active');
  } else {
    goHome();
    return;
  }

  var n = s.qs.length;
  $('r-score').textContent = s.score + ' / ' + n;

  var v = $('r-verdict');
  if(n === 14){
    var passed = s.score >= 12;
    v.textContent = passed ? 'СДАНО ✔' : 'НЕ СДАНО ✘';
    v.className = 'verdict ' + (passed ? 'pass' : 'fail');
    $('r-sub').textContent = passed
      ? 'Поздравляем! 12 и более правильных ответов — как на реальном экзамене «1С:Профессионал».'
      : 'Для успешной сдачи нужно минимум 12 правильных ответов из 14.';
  } else {
    var p = n > 0 && (s.score / n >= 0.85);
    v.textContent = p ? 'Отличный результат!' : 'Продолжайте тренироваться';
    v.className = 'verdict ' + (p ? 'pass' : 'fail');
    $('r-sub').textContent = 'Ориентир для экзамена — не менее 12 правильных из 14 (≈ 85%).';
  }

  var rows = $('r-rows');
  rows.innerHTML = '';
  s.results.forEach(function(r, i){
    var d = document.createElement('div');
    d.className = 'row ' + (r.ok ? 'good' : 'bad');
    var qText = (r.q && r.q.q) ? r.q.q : '';
    var topicName = (r.q && TOPIC_NAMES[r.q.t]) ? TOPIC_NAMES[r.q.t] : '';
    var status = r.selText === null
      ? 'Нет ответа'
      : (r.ok ? 'Верный ответ' : ('Ваш ответ: ' + r.selText + ' → правильно: ' + (r.correctText || '')));
    var comment = (r.q && r.q.c) ? ('<br><small style="color:#c9d1ee">💬 ' + r.q.c + '</small>') : '';
    d.innerHTML = '<div class="ic">' + (r.ok ? '✔' : '✘') + '</div>' +
      '<div><b>Вопрос ' + (i + 1) + '.</b> ' + qText + '<br>' +
      '<small>Раздел ' + (r.q ? r.q.t : '') + '. ' + topicName + ' · ' + status + '</small>' +
      comment + '</div>';
    rows.appendChild(d);
  });

  $('r-retry').onclick = function(){
    startQuiz(shuffle(s.qs.map(function(q){ return Object.assign({}, q); })), s.title, s.timed);
  };
  window.scrollTo(0, 0);
}

function startMissed(){
  var qs=missedQuestions();
  if(!qs.length){alert('Ошибок пока нет. Отвечайте на вопросы — неверно решённые появятся здесь.');return;}
  startQuiz(shuffle(qs.map(function(q){return Object.assign({},q);})),'Работа над ошибками ('+qs.length+')',false);
}

var _searchFound=[];
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function doSearch(){
  var q=$('search-input').value.trim().toLowerCase();var res=$('search-results');
  if(!q){res.innerHTML='';return;}
  _searchFound=QB.filter(function(it){return (it.q+' '+it.o.join(' ')).toLowerCase().includes(q);});
  if(!_searchFound.length){res.innerHTML='<div class="sresult" style="cursor:default">Ничего не найдено.</div>';return;}
  var html='<div style="margin:10px 0"><button class="btn" onclick="trainSearch()">Тренировать найденные ('+_searchFound.length+')</button></div>';
  _searchFound.slice(0,50).forEach(function(it){
    html+='<div class="sresult" onclick="trainOne(\''+it.k+'\')"><span class="tm">Раздел '+it.t+'. '+TOPIC_NAMES[it.t]+'</span><br>'+escapeHtml(it.q)+'</div>';});
  if(_searchFound.length>50)html+='<div class="sresult" style="cursor:default">…и ещё '+(_searchFound.length-50)+'. Уточните запрос.</div>';
  res.innerHTML=html;
}
function trainSearch(){if(!_searchFound.length)return;startQuiz(shuffle(_searchFound.map(function(q){return Object.assign({},q);})),'Поиск ('+_searchFound.length+')',false);}
function trainOne(k){var it=QB.find(function(q){return q.k===k;});if(it)startQuiz([Object.assign({},it)],'Вопрос · Раздел '+it.t,false);}

function renderOverall(){
  var attempts=0,right=0,learned=0;Object.values(STATS).forEach(function(s){attempts+=s.t;right+=s.r;if(s.r>0)learned++;});
  var acc=attempts?Math.round(right/attempts*100):0;
  $('stats-overall').innerHTML=
   '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:16px">'+
     '<div class="card stat"><span>Всего вопросов</span><b>'+QB.length+'</b></div>'+
     '<div class="card stat"><span>Изучено (≥1 верно)</span><b>'+learned+'</b></div>'+
     '<div class="card stat"><span>Дано ответов</span><b>'+attempts+'</b></div>'+
     '<div class="card stat"><span>Правильных</span><b>'+acc+'%</b></div>'+
     '<div class="card stat"><span>Ошибок к повтору</span><b>'+MISSED.length+'</b></div>'+
   '</div>';
}
function renderTopicStats(){
  var rows='';TOPICS.forEach(function(t){var st=topicStats(t.id);var pct=st.total?Math.round(st.learned/st.total*100):0;
    rows+='<tr><td>'+t.id+'. '+t.name+'</td><td>'+st.total+'</td><td>'+st.learned+'</td><td>'+st.attempts+'</td><td>'+(st.attempts?Math.round(st.right/st.attempts*100)+'%':'—')+'</td><td><div class="bar"><div style="width:'+pct+'%"></div></div></td></tr>';});
  $('stats-topics').innerHTML='<table class="stat-table"><thead><tr><th>Раздел</th><th>Вопросов</th><th>Изучено</th><th>Попыток</th><th>Верно</th><th>Прогресс</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function renderHistory(){
  var h=HISTORY.slice(0,10);
  if(!h.length){$('stats-history').innerHTML='<div style="color:var(--muted);font-size:13px">Пока нет пройденных тестов.</div>';return;}
  $('stats-history').innerHTML=h.map(function(r){var pass=r.total===14?r.score>=12:(r.score/r.total>=0.85);
    return '<div class="hist-item"><span>'+r.title+'</span><span style="color:var(--muted)">'+r.d+'</span><span class="pill '+(pass?'pass':'fail')+'">'+r.score+'/'+r.total+'</span></div>';}).join('');
}
function resetStats(){if(!confirm('Сбросить всю статистику и историю ошибок?'))return;STATS={};MISSED=[];HISTORY=[];saveAll();buildHome();}

function buildHome(){
  $('screen-home').innerHTML=
   '<h2 class="sec">🎯 Симулятор и спецрежимы</h2>'+
   '<div class="grid">'+
     '<div class="card exam-card" onclick="startSim()"><div class="num">⏱</div><div><b>Случайный билет: 14 вопросов</b><span>По одному из каждого раздела · 30 минут · порог 12/14</span></div></div>'+
     '<div class="card" onclick="startMissed()"><div class="num">🔁</div><div><b>Только ошибки</b><span id="missed-count"></span></div></div>'+
   '</div>'+
   '<div style="margin:14px 0"><label class="toggle"><input type="checkbox" id="shuffle-toggle">Перемешивать варианты ответов</label></div>'+
   '<h2 class="sec">🔍 Поиск по вопросам</h2>'+
   '<div class="searchbox"><input id="search-input" type="text" placeholder="Ключевое слово, например: динамический список, XDTO, регистр"><button class="btn" id="search-btn">Найти</button></div>'+
   '<div id="search-results"></div>'+
   '<h2 class="sec">📚 Тренировка по разделам</h2>'+
   '<div class="grid" id="topics-grid"></div>'+
   '<h2 class="sec">📊 Статистика</h2>'+
   '<div id="stats-overall"></div>'+
   '<div id="stats-topics"></div>'+
   '<h3 style="font-size:14px;color:var(--muted);margin:18px 0 8px">Последние результаты</h3>'+
   '<div id="stats-history"></div>'+
   '<div style="margin-top:16px"><button class="btn ghost" onclick="resetStats()">🗑 Сбросить статистику</button></div>';

  var tg=$('topics-grid');tg.innerHTML='';
  TOPICS.forEach(function(t){var pool=poolOf(t.id);var n=pool.length;var st=topicStats(t.id);var pct=n?Math.round(st.learned/n*100):0;
    var d=document.createElement('div');d.className='card';
    d.innerHTML='<div class="num">'+t.id+'</div><div style="flex:1"><b>'+t.title+'</b><span>'+n+' вопрос(ов) · изучено '+st.learned+'/'+n+'</span><div class="bar" style="margin-top:6px"><div style="width:'+pct+'%"></div></div></div>';
    d.onclick=function(){if(!n){alert('В этом разделе нет вопросов.');return;}startQuiz(shuffle(pool.map(function(q){return Object.assign({},q);})),'Раздел '+t.id+'. '+t.title,false);};
    tg.appendChild(d);});
  $('missed-count').textContent=MISSED.length?MISSED.length+' вопрос(ов) к повтору':'Ошибок пока нет';
  var stgl=$('shuffle-toggle');stgl.checked=!!SETTINGS.shuffle;stgl.onchange=function(){SETTINGS.shuffle=stgl.checked;saveAll();};
  $('search-btn').onclick=doSearch;$('search-input').onkeydown=function(e){if(e.key==='Enter')doSearch();};
  renderOverall();renderTopicStats();renderHistory();
  $('bank-size').textContent='В банке: '+QB.length+' вопросов';
}

// init
if(loadData()){
  buildHome();
} else {
  // error already shown
}
