// somesome.js - 수정 완전본

// 상태 변수
let state = {
  timeLimit: 10,
  filter: 'all', // all | Hot | Ice
  current: null,
  timerId: null,
  remaining: 0,
  score: 0,
  combo: 0,
  totalTime: 120,      // 전체 게임 제한 시간 (초)
  totalTimerId: null
};

// DOM 참조 (존재 여부 체크 포함)
const homeView = document.getElementById('homeView');
const optionsView = document.getElementById('optionsView');
const gameView = document.getElementById('gameView');
const resultView = document.getElementById('resultView');
const rankingView = document.getElementById('rankingView') || null;

const totalTimerEl = document.getElementById('totalTimer');
const scoreEl = document.getElementById('score');

// 안전: 필요한 엘리먼트가 없으면 경고
function ensure(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`DOM element not found: #${id}`);
  return el;
}

// 버튼들 (존재하면 이벤트 연결)
const startBtn = ensure('startBtn');
if (startBtn) startBtn.onclick = startGame;
const openBookBtn = ensure('openBookBtn');
if (openBookBtn) openBookBtn.onclick = openBook;
const optionsBtn = ensure('optionsBtn');
if (optionsBtn) optionsBtn.onclick = () => showView('options');
const quitBtn = ensure('quitBtn');
if (quitBtn) quitBtn.onclick = () => alert('창을 닫거나 새로고침 해주세요.');
const backFromOptionsBtn = ensure('backFromOptions');
if (backFromOptionsBtn) backFromOptionsBtn.onclick = () => showView('home');
const closeBookBtn = ensure('closeBook');
if (closeBookBtn) closeBookBtn.onclick = closeBook;
const giveUpBtn = ensure('giveUpBtn');
if (giveUpBtn) giveUpBtn.onclick = () => { stopTimer(); showResult(false); };
const backHomeBtn = ensure('backHome');
if (backHomeBtn) backHomeBtn.onclick = () => showView('home');

const saveScoreBtn = ensure('saveScoreBtn');
if (saveScoreBtn) {
  saveScoreBtn.onclick = async () => {
    const nameInput = ensure('usernameInput');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      alert('이름을 입력해주세요!');
      return;
    }

    // window.saveScore 는 HTML의 Firebase 모듈 스크립트에서 제공해야 함
    if (typeof window.saveScore !== 'function') {
      alert('Firebase가 준비되지 않았습니다.');
      console.error('window.saveScore is not a function');
      return;
    }

    try {
      await window.saveScore(name, state.score);
      alert('점수가 저장되었습니다!');
      // 결과 화면의 랭킹 영역 갱신
      await showRankingInResult();
    } catch (e) {
      console.error('점수 저장 실패', e);
      alert('점수 저장에 실패했습니다. 콘솔을 확인하세요.');
    }
  };
}

// 데이터-타이머 버튼들 (data-t)
document.querySelectorAll('[data-t]').forEach(b => {
  b.onclick = (e) => {
    const sec = Number(e.target.dataset.t);
    if (!isNaN(sec)) {
      state.timeLimit = sec;
      alert('타이머를 ' + state.timeLimit + '초로 설정했습니다');
    }
  };
});

// 필터 버튼
const filterAllBtn = ensure('filterAll');
if (filterAllBtn) filterAllBtn.onclick = () => { state.filter = 'all'; ensure('currentMode').innerText = '모든 메뉴'; };
const filterHotBtn = ensure('filterHot');
if (filterHotBtn) filterHotBtn.onclick = () => { state.filter = 'Hot'; ensure('currentMode').innerText = 'Hot만'; };
const filterIceBtn = ensure('filterIce');
if (filterIceBtn) filterIceBtn.onclick = () => { state.filter = 'Ice'; ensure('currentMode').innerText = 'Ice만'; };

// 레시피북 열기/닫기
const recipePopup = document.getElementById('recipePopup');
function openBook() {
  renderRecipeBook();
  if (recipePopup) recipePopup.classList.remove('hidden');
}
function closeBook() {
  if (recipePopup) recipePopup.classList.add('hidden');
}

function renderRecipeBook() {
  if (typeof RECIPES === 'undefined') {
    console.warn('RECIPES 데이터가 없습니다.');
    ensure('recipeContent').innerText = '레시피 데이터가 없습니다.';
    return;
  }
  const grouped = {};
  RECIPES.forEach(r => {
    if (!grouped[r.menu]) grouped[r.menu] = {};
    grouped[r.menu][r.temp] = r.steps;
  });
  let out = '';
  Object.keys(grouped).forEach(menu => {
    out += `"${menu}"\n`;
    ['Hot', 'Ice'].forEach(t => {
      if (grouped[menu][t]) {
        out += `  (${t})\n`;
        grouped[menu][t].forEach((s, i) => out += `    ${i+1}. ${s}\n`);
      }
    });
    out += '\n';
  });
  const rc = ensure('recipeContent');
  if (rc) rc.innerText = out;
}

// 화면 전환 도우미
function showView(name) {
  // 숨기기
  if (homeView) homeView.classList.add('hidden');
  if (optionsView) optionsView.classList.add('hidden');
  if (gameView) gameView.classList.add('hidden');
  if (resultView) resultView.classList.add('hidden');
  if (rankingView) rankingView.classList.add('hidden');

  // 보이기
  if (name === 'home' && homeView) homeView.classList.remove('hidden');
  if (name === 'options' && optionsView) optionsView.classList.remove('hidden');
  if (name === 'game' && gameView) gameView.classList.remove('hidden');
  if (name === 'result' && resultView) resultView.classList.remove('hidden');
  if (name === 'ranking' && rankingView) rankingView.classList.remove('hidden');
}

// 게임 시작
function startGame() {
  state.score = 0;
  state.combo = 0;
  const scoreElLocal = ensure('score');
  if (scoreElLocal) scoreElLocal.innerText = state.score;

  showView('game');

  // 전체 게임 타이머 초기화
  state.totalTime = 120;
  updateTotalTimerDisplay();
  startTotalTimer();

  nextProblem();
}

// 전체 게임 타이머 (하나로 통일)
function startTotalTimer() {
  // 안전: 기존 타이머 정리
  if (state.totalTimerId) clearInterval(state.totalTimerId);
  updateTotalTimerDisplay();
  state.totalTimerId = setInterval(() => {
    state.totalTime--;
    updateTotalTimerDisplay();
    if (state.totalTime <= 0) {
      stopTotalTimer();
      // 전체 시간이 끝나면 결과 화면으로
      showResult(false);
      alert('TIME OVER!');
    }
  }, 1000);
}
function stopTotalTimer() {
  if (state.totalTimerId) clearInterval(state.totalTimerId);
  state.totalTimerId = null;
}

function updateTotalTimerDisplay() {
  const minutes = Math.floor(state.totalTime / 60);
  const seconds = state.totalTime % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (totalTimerEl) totalTimerEl.innerText = formatted;
}

// 문제 선택
function pickRandomRecipe() {
  if (typeof RECIPES === 'undefined') return null;
  const pool = RECIPES.filter(r => state.filter === 'all' || r.temp === state.filter);
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return JSON.parse(JSON.stringify(pool[idx])); // 복제
}

// 다음 문제
function nextProblem() {
  clearStateForProblem();

  const chosen = pickRandomRecipe();
  if (!chosen) {
    alert('조건에 맞는 레시피가 없습니다. 옵션을 확인하세요.');
    showView('home');
    return;
  }
  state.current = chosen;
  const menuTitle = ensure('menuTitle');
  const menuTemp = ensure('menuTemp');
  if (menuTitle) menuTitle.innerText = chosen.menu;
  if (menuTemp) menuTemp.innerText = chosen.temp;

  // 슬롯 렌더
  const slots = ensure('slots');
  if (slots) {
    slots.innerHTML = '';
    chosen.steps.forEach(() => {
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerText = '___';
      slots.appendChild(s);
    });
  }

  // 재료 목록 랜덤 배치
  const ing = ensure('ingredients');
  if (ing) {
    ing.innerHTML = '';
    const shuffledSteps = [...chosen.steps].sort(() => Math.random() - 0.5);
    shuffledSteps.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = 'ingredient';
      d.innerText = `${i + 1}. ${it}`;
      d.dataset.origIdx = chosen.steps.indexOf(it);
      d.onclick = () => selectIngredient(Number(d.dataset.origIdx));
      ing.appendChild(d);
    });
  }

  // 타이머 시작 (문제별)
  startTimer();
}

// 문제별 타이머 초기화
function clearStateForProblem() {
  stopTimer();
  state.remaining = state.timeLimit;
  const timerEl = ensure('timer');
  if (timerEl) timerEl.innerText = state.remaining;
  const statusEl = ensure('status');
  if (statusEl) statusEl.innerText = '';
  const nextBtn = ensure('nextBtn');
  if (nextBtn) nextBtn.classList.add('hidden');
}

// 문제별 타이머 시작/정지
function startTimer() {
  state.remaining = state.timeLimit;
  const timerEl = ensure('timer');
  if (timerEl) timerEl.innerText = state.remaining;

  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.remaining--;
    if (timerEl) timerEl.innerText = state.remaining;
    if (state.remaining <= 0) { stopTimer(); checkAnswerTimeout(); }
  }, 1000);
}
function stopTimer() { if (state.timerId) clearInterval(state.timerId); state.timerId = null; }

// 재료 선택
function selectIngredient(idx) {
  const cur = state.current;
  if (!cur) return;
  const slots = document.querySelectorAll('.slot');
  const filledCount = Array.from(slots).filter(s => s.dataset.filled === '1').length;
  if (filledCount >= cur.steps.length) return;

  const chosenText = cur.steps[idx];
  slots[filledCount].innerText = chosenText;
  slots[filledCount].dataset.filled = '1';

  let ok = true;
  for (let i = 0; i < filledCount + 1; i++) {
    if (slots[i].innerText !== cur.steps[i]) { ok = false; break; }
  }

  if (!ok) {
    stopTimer();
    state.combo = 0;
    state.score = Math.max(0, state.score - 20);
    const scoreElLocal = ensure('score');
    if (scoreElLocal) scoreElLocal.innerText = state.score;
    const statusEl = ensure('status');
    if (statusEl) statusEl.innerText = '오답! -20점';
    const nextBtn = ensure('nextBtn');
    if (nextBtn) nextBtn.classList.remove('hidden');
    return;
  }

  const allFilled = Array.from(slots).every(s => s.dataset.filled === '1');
  if (allFilled) {
    stopTimer();
    const base = 100;
    const timeBonus = state.remaining * 5;
    state.combo += 1;
    const comboBonus = (state.combo > 1) ? state.combo * 10 : 0;
    const gained = base + timeBonus + comboBonus;
    state.score += gained;
    const scoreElLocal = ensure('score');
    if (scoreElLocal) scoreElLocal.innerText = state.score;
    const statusEl = ensure('status');
    if (statusEl) statusEl.innerText = `정답! +${gained} (기본${base} + 시간보너스${timeBonus} + 콤보${comboBonus})`;
    const nextBtn = ensure('nextBtn');
    if (nextBtn) nextBtn.classList.remove('hidden');
  }
}

// 시간 초과
function checkAnswerTimeout() {
  state.combo = 0;
  const penalty = 100;
  state.score = Math.max(0, state.score - penalty);
  const scoreElLocal = ensure('score');
  if (scoreElLocal) scoreElLocal.innerText = state.score;
  const statusEl = ensure('status');
  if (statusEl) statusEl.innerText = `시간 초과! -${penalty}점`;
  const nextBtn = ensure('nextBtn');
  if (nextBtn) nextBtn.classList.remove('hidden');
}

// 다음 문제 버튼
const nextBtn = ensure('nextBtn');
if (nextBtn) nextBtn.onclick = () => nextProblem();

// 결과 화면
function showResult(success) {
  const lastScoreEl = ensure('lastScore');
  if (lastScoreEl) lastScoreEl.innerText = state.score;
  const bestEl = ensure('bestScore');
  if (bestEl && state.score > Number(bestEl.innerText)) bestEl.innerText = state.score;
  stopTotalTimer();
  showView('result');
  // 결과 화면에 진입하면 결과 랭킹도 갱신
  showRankingInResult();
}

// 초기화: 홈으로
showView('home');

// give up 버튼 (중복 방지: 위에서 attach 되어 있으면 덮어쓰지 않음)
// 이미 위에서 giveUpBtn 연결
document.getElementById("giveUpBtn").addEventListener("click", async () => {

    // 현재 점수
    let score = currentScore;  

    try {
        // 1) 점수 저장
        await addDoc(collection(db, "scores"), {
            score: score,
            timestamp: new Date()
        });

        console.log("점수 저장 완료:", score);

        // 2) 최고 점수 불러오기
        const q = query(
            collection(db, "scores"),
            orderBy("score", "desc"),
            limit(1)
        );

        const snapshot = await getDocs(q);
        let bestScore = 0;

        snapshot.forEach(doc => {
            bestScore = doc.data().score;
        });

        // 3) home view에 반영
        document.getElementById("bestScore").innerText = bestScore;

        alert("포기! 점수가 저장되었습니다.\n최고 점수: " + bestScore);

        // 4) home으로 이동
        showView("homeView");

    } catch (e) {
        console.error("점수 저장 오류:", e);
    }
});

// 저장 버튼 처리는 위에서 이미 구현

// 결과 화면의 랭킹 표시 함수 (resultView 내 rankingList)
async function showRankingInResult() {
  const box = ensure('rankingList');
  if (!box) return;
  box.innerHTML = '<h3>불러오는 중...</h3>';

  if (typeof window.getTop10Scores !== 'function') {
    box.innerHTML = '<div>랭킹을 불러올 수 없습니다(파이어베이스 미설정).</div>';
    return;
  }

  try {
    const list = await window.getTop10Scores();
    box.innerHTML = '<h3>🏆 TOP 10 랭킹</h3>';
    if (!list || list.length === 0) {
      box.innerHTML += '<div>아직 점수가 없습니다.</div>';
      return;
    }
    list.forEach((item, i) => {
      box.innerHTML += `<div>${i + 1}위 | ${item.name} - ${item.score}</div>`;
    });
  } catch (e) {
    console.error('showRankingInResult error', e);
    box.innerHTML = '<div>랭킹 불러오기 실패</div>';
  }
}

// -----------------------------
// Ranking View (독립 페이지) 관련
// -----------------------------
const rankingBtn = ensure('rankingBtn');
const rankingContent = ensure('rankingContent');
const rankingBackBtn = ensure('rankingBackBtn');

if (rankingBtn) {
  rankingBtn.onclick = async () => {
    showView('ranking');
    await loadRanking();
  };
}
if (rankingBackBtn) {
  rankingBackBtn.onclick = () => {
    showView('home');
  };
}

async function loadRanking() {
  const box = rankingContent;
  if (!box) return;
  box.innerHTML = '불러오는 중...';

  if (typeof window.getTop10Scores !== 'function') {
    box.innerHTML = '파이어베이스가 준비되지 않았습니다.';
    return;
  }

  try {
    const list = await window.getTop10Scores();
    if (!list || list.length === 0) {
      box.innerHTML = '<div>아직 점수가 없습니다.</div>';
      return;
    }
    let html = '<ol>';
    list.forEach((item, i) => {
      html += `<li>${i + 1}위 — ${item.name} — ${item.score}점</li>`;
    });
    html += '</ol>';
    box.innerHTML = html;
  } catch (e) {
    console.error('loadRanking error', e);
    box.innerHTML = '랭킹을 불러오는 중 오류 발생!';
  }
}