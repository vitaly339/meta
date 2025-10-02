let COURSE=null, CURRENT_LESSON_ID=1;
const PASS_THRESHOLD = 0.7;

async function loadCourse(){
  const res = await fetch('course.json'); COURSE = await res.json();
  renderTOC(); const saved = +localStorage.getItem('currentLesson')||1;
  CURRENT_LESSON_ID = Math.max(1, Math.min(saved, 16));
  renderLesson(CURRENT_LESSON_ID); updateProgressUI();
  initMatrix();
}
function renderTOC(){
  const toc = document.getElementById('toc'); toc.innerHTML='';
  COURSE.weeks.forEach(week=>{
    const h = document.createElement('h3'); h.textContent = week.title; toc.appendChild(h);
    week.lessons.forEach(ls=>{
      const btn = document.createElement('button'); btn.textContent = `${ls.id}. ${ls.title}`;
      btn.addEventListener('click', ()=>{ renderLesson(ls.id) }); toc.appendChild(btn);
    });
  });
}
function getLessonById(id){
  for(const w of COURSE.weeks){ for(const l of w.lessons){ if(l.id===id) return l; } }
}
function renderLesson(id){
  const ls = getLessonById(id); if(!ls) return;
  CURRENT_LESSON_ID = id; localStorage.setItem('currentLesson', id);
  document.querySelectorAll('.toc button').forEach(b=>{
    b.classList.toggle('active', b.textContent.startsWith(id+'. '));
  });
  const el = document.getElementById('lesson'); el.innerHTML='';
  const header = document.createElement('div');
  header.innerHTML = `<h2>${ls.title}</h2>
  <div class="badges">
    <span>⏱️ ${ls.duration_min} мин</span>
    <span>🧩 Тест из ${ls.quiz.length} вопросов</span>
    <span>❤ Лайков: <b id="likesForLesson">0</b></span>
  </div>`;
  el.appendChild(header);
  // Theory
  const th = document.createElement('div'); th.className='card';
  th.innerHTML = `<h3>Теория</h3>` + ls.theory.map(p=>`<p>${escapeHtml(p)}</p>`).join('');
  el.appendChild(th);
  // Code
  if(ls.code){
    const cd = document.createElement('div'); cd.className='card';
    cd.innerHTML = `<h3>Примеры кода</h3>` + Object.entries(ls.code).map(([lang,src])=>`<h4>${lang.toUpperCase()}</h4><pre><code>${escapeHtml(src)}</code></pre>`).join('');
    el.appendChild(cd);
  }
  // Task
  const tk = document.createElement('div'); tk.className='card';
  tk.innerHTML = `<h3>Практика</h3><p>${escapeHtml(ls.task)}</p>`;
  el.appendChild(tk);
  // Quiz
  const qz = document.createElement('div'); qz.className='quiz card';
  qz.innerHTML = `<h3>Тест</h3>` + ls.quiz.map((q,i)=>renderQuestion(ls.id,i,q)).join('') + `<button class="btn" id="submitQuiz">Проверить</button><div class="result" id="quizResult"></div>`;
  el.appendChild(qz);
  document.getElementById('submitQuiz').addEventListener('click', ()=>checkQuiz(ls));
  // Likes per lesson
  const likes = JSON.parse(localStorage.getItem('likes')||'{}');
  document.getElementById('likesForLesson').textContent = likes[id]||0;
  updateLikeBtn();
  updateNavButtons();
  updateProgressUI();
  window.scrollTo({top:0, behavior:'smooth'});
}
function renderQuestion(lessonId, idx, q){
  const name = `q_${lessonId}_${idx}`;
  return `<div class="q">
    <div><b>${idx+1}.</b> ${escapeHtml(q.q)}</div>
    ${q.options.map((opt,i)=>`<label><input type="radio" name="${name}" value="${i}">${escapeHtml(opt)}</label>`).join('')}
  </div>`;
}
function checkQuiz(ls){
  const total = ls.quiz.length; let correct=0;
  ls.quiz.forEach((q,i)=>{
    const sel = document.querySelector(`input[name="q_${ls.id}_${i}"]:checked`);
    if(sel && +sel.value===q.answer) correct++;
  });
  const score = correct/total; const passed = score>= (COURSE.meta?.pass_threshold || PASS_THRESHOLD);
  const res = document.getElementById('quizResult');
  res.textContent = `Результат: ${correct}/${total} • ${Math.round(score*100)}% • ${passed?'Пройдено ✅':'Недостаточно, попробуй снова ❌'}`;
  if(passed){
    markPassed(ls.id);
    updateProgressUI();
    // авто-переход через 1.2 сек
    setTimeout(()=>{ goNext(); }, 1200);
  }
}
function markPassed(id){
  const passed = JSON.parse(localStorage.getItem('passed')||'[]');
  if(!passed.includes(id)){ passed.push(id); localStorage.setItem('passed', JSON.stringify(passed)); }
}
function calcProgress(){
  const passed = JSON.parse(localStorage.getItem('passed')||'[]');
  return Math.round((passed.length/16)*100);
}
function updateProgressUI(){
  const pct = calcProgress();
  const bar = document.getElementById('progressBar'); if(bar) bar.style.width = pct+'%';
  const t = document.getElementById('progressText'); if(t) t.textContent = `Прогресс: ${pct}%`;
}
function updateNavButtons(){
  document.getElementById('prevBtn').onclick = ()=>goPrev();
  document.getElementById('nextBtn').onclick = ()=>goNext();
}
function goPrev(){ if(CURRENT_LESSON_ID>1){ renderLesson(CURRENT_LESSON_ID-1); } }
function goNext(){
  // gate: next lesson requires previous passed
  const nextId = Math.min(16, CURRENT_LESSON_ID+1);
  const passed = JSON.parse(localStorage.getItem('passed')||'[]');
  if(!passed.includes(CURRENT_LESSON_ID)){ alert('Сначала пройди тест этого урока (≥ 70%).'); return; }
  renderLesson(nextId);
}
function updateLikeBtn(){
  const btn = document.getElementById('likeBtn');
  const likes = JSON.parse(localStorage.getItem('likes')||'{}');
  const count = likes[CURRENT_LESSON_ID]||0;
  document.getElementById('likeCount').textContent = count;
  btn.onclick = ()=>{
    const likes = JSON.parse(localStorage.getItem('likes')||'{}');
    likes[CURRENT_LESSON_ID]=(likes[CURRENT_LESSON_ID]||0)+1;
    localStorage.setItem('likes', JSON.stringify(likes));
    document.getElementById('likeCount').textContent = likes[CURRENT_LESSON_ID];
    document.getElementById('likesForLesson').textContent = likes[CURRENT_LESSON_ID];
    // small burst
    burstHeart(btn);
  };
}
function burstHeart(btn){
  const heart = document.createElement('div');
  heart.textContent = '❤'; heart.style.position='fixed';
  const r = btn.getBoundingClientRect();
  heart.style.left = (r.left + r.width/2)+'px';
  heart.style.top = (r.top)+'px';
  heart.style.fontSize='18px'; heart.style.pointerEvents='none';
  heart.style.transition='transform .8s ease, opacity .8s ease';
  document.body.appendChild(heart);
  requestAnimationFrame(()=>{ heart.style.transform='translateY(-60px) scale(1.6)'; heart.style.opacity='0'; });
  setTimeout(()=>heart.remove(), 820);
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// Matrix rain background
function initMatrix(){
  const canvas = document.getElementById('matrix'); const ctx = canvas.getContext('2d');
  const resize=()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
  resize(); window.addEventListener('resize', resize);
  const letters = 'アカサタナハマヤラワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const fontSize = 14; const columns = Math.floor(canvas.width / fontSize);
  const drops = new Array(columns).fill(1);
  function draw(){
    ctx.fillStyle='rgba(10,15,31,0.08)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#6ae0ff'; ctx.font = fontSize+'px monospace';
    for(let i=0;i<drops.length;i++){
      const text = letters[Math.floor(Math.random()*letters.length)];
      ctx.fillText(text, i*fontSize, drops[i]*fontSize);
      if(drops[i]*fontSize > canvas.height && Math.random()>0.975) drops[i]=0;
      drops[i]++;
    }
    requestAnimationFrame(draw);
  }
  draw();
}

document.getElementById('prevBtn').addEventListener('click', goPrev);
document.getElementById('nextBtn').addEventListener('click', goNext);
document.getElementById('likeBtn').addEventListener('click', updateLikeBtn);
loadCourse();
