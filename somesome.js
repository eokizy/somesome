// 상태 변수
let state = {
  timeLimit:10,
  filter:'all', // all | Hot | Ice
  current:null,
  timerId:null,
  remaining:0,
  score:0,
  combo:0,
  totalTime:120,      // 전체 게임 제한 시간 3분
  totalTimerId:null
};

// DOM 참조
const homeView = document.getElementById('homeView');
const optionsView = document.getElementById('optionsView');
const gameView = document.getElementById('gameView');
const resultView = document.getElementById('resultView');
const recipePopup = document.getElementById('recipePopup');

// 버튼들
document.getElementById('startBtn').onclick = startGame;
document.getElementById('openBookBtn').onclick = openBook;
document.getElementById('optionsBtn').onclick = ()=>showView('options');
document.getElementById('quitBtn').onclick = ()=>alert('창을 닫거나 새로고침 해주세요.');
document.getElementById('backFromOptions').onclick = ()=>showView('home');
document.getElementById('closeBook').onclick = closeBook;
document.getElementById('filterAll').onclick = ()=>{state.filter='all'; document.getElementById('currentMode').innerText='모든 메뉴';}
document.getElementById('filterHot').onclick = ()=>{state.filter='Hot'; document.getElementById('currentMode').innerText='Hot만';}
document.getElementById('filterIce').onclick = ()=>{state.filter='Ice'; document.getElementById('currentMode').innerText='Ice만';}

document.querySelectorAll('[data-t]').forEach(b=>b.onclick=(e)=>{state.timeLimit = Number(e.target.dataset.t); alert('타이머를 '+state.timeLimit+'초로 설정했습니다');});

document.getElementById('giveUpBtn').onclick = ()=>{stopTimer(); showResult(false)};
document.getElementById('backHome').onclick = ()=>{showView('home')};

// 레시피북 열기/닫기
function openBook(){
  renderRecipeBook();
  recipePopup.classList.remove('hidden');
}
function closeBook(){ recipePopup.classList.add('hidden'); }

function renderRecipeBook(){
  const grouped = {};
  RECIPES.forEach(r=>{
    if(!grouped[r.menu]) grouped[r.menu]={};
    grouped[r.menu][r.temp]=r.steps;
  });
  let out = '';
  Object.keys(grouped).forEach(menu=>{
    out += `"${menu}"\n`;
    ['Hot','Ice'].forEach(t=>{
      if(grouped[menu][t]){
        out += `  (${t})\n`;
        grouped[menu][t].forEach((s,i)=> out += `    ${i+1}. ${s}\n`);
      }
    });
    out += '\n';
  });
  document.getElementById('recipeContent').innerText = out;
}

// 화면 전환 도우미
function showView(name){
  homeView.classList.add('hidden');
  optionsView.classList.add('hidden');
  gameView.classList.add('hidden');
  resultView.classList.add('hidden');

  if(name==='home') homeView.classList.remove('hidden');
  if(name==='options') optionsView.classList.remove('hidden');
  if(name==='game') gameView.classList.remove('hidden');
  if(name==='result') resultView.classList.remove('hidden');
}

// 게임 시작
function startGame(){
  state.score = 0; 
  state.combo = 0;
  document.getElementById('score').innerText = state.score;
  
  showView('game');

  // 전체 게임 타이머 초기화
  state.totalTime = 120;
  startTotalTimer();

  nextProblem();
}

// 전체 게임 타이머
function startTotalTimer(){
  state.totalTimerId = setInterval(()=>{
    state.totalTime--;
    if(state.totalTime <= 0){
      stopTotalTimer();
      showResult(false);
      alert('TIME OVER!');
    }
  }, 1000);
}
function stopTotalTimer(){
  if(state.totalTimerId) clearInterval(state.totalTimerId);
  state.totalTimerId = null;
}

// 문제 선택
function pickRandomRecipe(){
  const pool = RECIPES.filter(r=> state.filter==='all' || r.temp===state.filter);
  if(pool.length===0) return null;
  const idx = Math.floor(Math.random()*pool.length);
  return JSON.parse(JSON.stringify(pool[idx])); // 복제
}

// 다음 문제
function nextProblem(){
  clearStateForProblem();

  const chosen = pickRandomRecipe();
  if(!chosen){ 
    alert('조건에 맞는 레시피가 없습니다. 옵션을 확인하세요.'); 
    showView('home'); 
    return; 
  }
  state.current = chosen;
  document.getElementById('menuTitle').innerText = chosen.menu;
  document.getElementById('menuTemp').innerText = chosen.temp;

  // 슬롯 렌더
  const slots = document.getElementById('slots'); 
  slots.innerHTML='';
  chosen.steps.forEach(()=>{
    const s = document.createElement('div'); 
    s.className='slot'; 
    s.innerText='___'; 
    slots.appendChild(s);
  });

  // 재료 목록 랜덤 배치
  const ing = document.getElementById('ingredients'); 
  ing.innerHTML='';
  const shuffledSteps = [...chosen.steps].sort(() => Math.random() - 0.5);
  shuffledSteps.forEach((it, i)=>{
    const d = document.createElement('div'); 
    d.className='ingredient'; 
    d.innerText = `${i+1}. ${it}`; 
    d.dataset.origIdx = chosen.steps.indexOf(it); 
    d.onclick = ()=>selectIngredient(Number(d.dataset.origIdx)); 
    ing.appendChild(d);
  });

  // 타이머 시작
  startTimer();
}

// 문제별 타이머 초기화
function clearStateForProblem(){
  stopTimer();
  state.remaining = state.timeLimit;
  document.getElementById('timer').innerText = state.remaining;
  document.getElementById('status').innerText = '';
  document.getElementById('nextBtn').classList.add('hidden');
}

// 문제별 타이머 시작/정지
function startTimer(){
  state.remaining = state.timeLimit;
  document.getElementById('timer').innerText = state.remaining;
  state.timerId = setInterval(()=>{
    state.remaining--;
    document.getElementById('timer').innerText = state.remaining;
    if(state.remaining<=0){ stopTimer(); checkAnswerTimeout(); }
  },1000);
}
function stopTimer(){ if(state.timerId) clearInterval(state.timerId); state.timerId = null; }

// 남은 게임시간 표시
function startTotalTimer(){
  updateTotalTimerDisplay();
  state.totalTimerId = setInterval(()=>{
    state.totalTime--;
    updateTotalTimerDisplay();

    if(state.totalTime <= 0){
      stopTotalTimer();
      saveScoreAndReturnHome();  // 전체 시간이 끝나면 점수 저장 후 홈 화면 이동
    }
  }, 1000);
}

function updateTotalTimerDisplay(){
  const minutes = Math.floor(state.totalTime / 60);
  const seconds = state.totalTime % 60;
  const formatted = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  document.getElementById('totalTimer').innerText = formatted;
}

function saveScoreAndReturnHome(){
  // 최고 점수 갱신
  const bestEl = document.getElementById('bestScore');
  if(state.score > Number(bestEl.innerText)){
    bestEl.innerText = state.score;
  }

  alert('TIME OVER! 최종 점수: ' + state.score);
  showView('home');  // 홈 화면으로 이동
}



// 재료 선택
function selectIngredient(idx){
  const cur = state.current;
  const slots = document.querySelectorAll('.slot');
  const filledCount = Array.from(slots).filter(s=>s.dataset.filled==='1').length;
  if(filledCount >= cur.steps.length) return;

  const chosenText = cur.steps[idx];
  slots[filledCount].innerText = chosenText;
  slots[filledCount].dataset.filled = '1';

  let ok = true;
  for(let i=0;i<filledCount+1;i++){
    if(slots[i].innerText !== cur.steps[i]){ ok = false; break; }
  }

  if(!ok){
    stopTimer();
    state.combo = 0;
    state.score = Math.max(0, state.score - 20);
    document.getElementById('score').innerText = state.score;
    document.getElementById('status').innerText = '오답! -20점';
    document.getElementById('nextBtn').classList.remove('hidden');
    return;
  }

  const allFilled = Array.from(slots).every(s=>s.dataset.filled==='1');
  if(allFilled){
    stopTimer();
    const base = 100;
    const timeBonus = state.remaining * 5;
    state.combo += 1;
    const comboBonus = (state.combo>1)? state.combo*10 : 0;
    const gained = base + timeBonus + comboBonus;
    state.score += gained;
    document.getElementById('score').innerText = state.score;
    document.getElementById('status').innerText = `정답! +${gained} (기본${base} + 시간보너스${timeBonus} + 콤보${comboBonus})`;
    document.getElementById('nextBtn').classList.remove('hidden');
  }
}

//시간 초과
function checkAnswerTimeout(){
  // 콤보 초기화
  state.combo = 0;

  // 점수 감점
  const penalty = 100;
  state.score = Math.max(0, state.score - penalty);
  document.getElementById('score').innerText = state.score;

  // 상태 메시지 표시
  document.getElementById('status').innerText = `시간 초과! -${penalty}점`;
  
  // 다음 문제 버튼 표시
  document.getElementById('nextBtn').classList.remove('hidden');
}


// 다음 문제 버튼
document.getElementById('nextBtn').onclick = ()=>{ nextProblem(); };

// 결과 화면
function showResult(success){
  document.getElementById('lastScore').innerText = state.score;
  if(state.score > Number(document.getElementById('bestScore').innerText)){
    document.getElementById('bestScore').innerText = state.score;
  }
  stopTotalTimer();
  showView('result');
}

// 초기화: 홈으로
showView('home');

document.getElementById('giveUpBtn').onclick = () => {
  stopTimer();          // 현재 문제 타이머 멈춤
  stopTotalTimer();     // 전체 게임 타이머 멈춤 (총 3분 타이머)
  
  // 최고 점수 갱신
  const bestEl = document.getElementById('bestScore');
  if(state.score > Number(bestEl.innerText)){
    bestEl.innerText = state.score;
  }

  alert('포기했습니다! 최종 점수: ' + state.score);
  showView('home');     // 홈 화면으로 이동
}

document.getElementById('saveScoreBtn').onclick = async () => {
  const name = document.getElementById('usernameInput').value.trim();  
  if(!name){
    alert("이름을 입력해주세요!");
    return;
  }

  // Firebase 반영된 함수 사용
  await window.saveScore(name, state.score);
  alert("점수가 저장되었습니다!");

  showRanking(); // TOP10 불러오기
};

async function showRanking(){
  const list = await window.getTop10Scores();  // Firebase에서 TOP10 가져오기
  const box = document.getElementById('rankingList');
  
  box.innerHTML = "<h3>🏆 TOP 10 랭킹</h3>";

  list.forEach((item, i) => {
    box.innerHTML += `
      <div>${i+1}위 | ${item.name} - ${item.score}</div>
    `;
  });
}

// 🔥 Ranking View 표시
document.getElementById("rankingBtn").onclick = async () => {
  showView("rankingView"); // 화면 전환 함수 (이미 있음)
  loadRanking();
};

// 뒤로가기
document.getElementById("rankingBackBtn").onclick = () => {
  showView("homeView");
};

// 🔥 TOP 10 불러와서 표시하는 함수
async function loadRanking() {
  const box = document.getElementById("rankingContent");
  box.innerHTML = "불러오는 중...";

  try {
    const list = await window.getTop10Scores();

    let html = "<ol>";
    list.forEach((item, i) => {
      html += `<li>${item.name} — ${item.score}</li>`;
    });
    html += "</ol>";

    box.innerHTML = html;
  } catch (e) {
    console.error(e);
    box.innerHTML = "랭킹을 불러오는 중 오류 발생!";
  }
}
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
  import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } 
    from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyD6MCzGTSI4ECLqg7FjKOKwsL-rLNH5YAg",
    authDomain: "somesome-b9a49.firebaseapp.com",
    projectId: "somesome-b9a49",
    storageBucket: "somesome-b9a49.firebasestorage.app",
    messagingSenderId: "237879091690",
    appId: "1:237879091690:web:5e1b5ea6908904f978d293",
    measurementId: "G-4QN3DYJJFB"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  async function saveScore(name, score) {
    await addDoc(collection(db, "scores"), {
      name: name,
      score: score,
      timestamp: Date.now()
    });
  }

  async function getTop10Scores() {
    const q = query(
      collection(db, "scores"),
      orderBy("score", "desc"),
      limit(10)
    );
    const snapshot = await getDocs(q);
    let list = [];

    snapshot.forEach(doc => {
      list.push(doc.data());
    });

    return list;
  }

  window.saveScore = saveScore;
  window.getTop10Scores = getTop10Scores;

  const rankingBtn = document.getElementById("rankingBtn");
  const rankingView = document.getElementById("rankingView");
  const rankingContent = document.getElementById("rankingContent");
  const rankingBackBtn = document.getElementById("rankingBackBtn");
  const homeView = document.getElementById("homeView");

  rankingBtn.addEventListener("click", async () => {
    homeView.classList.add("hidden");
    rankingView.classList.remove("hidden");

    // 데이터 가져오기
    const top10 = await getTop10Scores();

    // HTML 변환
    let html = "<ol>";
    top10.forEach((item, i) => {
      html += `<li>${i + 1}위 - ${item.name} : ${item.score}점</li>`;
    });
    html += "</ol>";

    rankingContent.innerHTML = html;
  });

  rankingBackBtn.addEventListener("click", () => {
    rankingView.classList.add("hidden");
    homeView.classList.remove("hidden");
  });
</script>