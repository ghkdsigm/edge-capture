// ===== API 베이스 설정 =====
// index.html의 <body data-api="http://<CM4-IP>:8080"> 값을 우선 사용하고,
// 없으면 현재 페이지의 origin을 사용한다.
const API_BASE =
  (document.body.dataset.api ? document.body.dataset.api.replace(/\/$/, "") : "") ||
  window.location.origin;

// 공통 POST 헬퍼
async function post(path, body, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${API_BASE}${path}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await r.text();
    let j = {};
    try { j = JSON.parse(text); } catch {}
    if (!r.ok) {
      const msg = j.error || `request failed (${r.status})`;
      throw new Error(`${msg} [${url}]${text ? " :: " + text.slice(0, 200) : ""}`);
    }
    return j;
  } finally {
    clearTimeout(t);
  }
}

// 헬스 체크용 GET 헬퍼
async function get(path, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${API_BASE}${path}`;
  try {
    const r = await fetch(url, { method: "GET", signal: controller.signal });
    const text = await r.text();
    let j = {};
    try { j = JSON.parse(text); } catch {}
    if (!r.ok) {
      const msg = j.error || `request failed (${r.status})`;
      throw new Error(`${msg} [${url}]${text ? " :: " + text.slice(0, 200) : ""}`);
    }
    return j;
  } finally {
    clearTimeout(t);
  }
}

// DOM 유틸
function $(id) { return document.getElementById(id); }

// 상단 날짜 표시
function setToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  $("today-date").textContent = `${y}-${m}-${day}`;
}

// 히스토리 로그 추가
function addHistory(type, title, desc) {
  const li = document.createElement("li");
  li.className = `history-item ${type}`;
  const row = document.createElement("div");
  row.className = "row";
  const badge = document.createElement("span");
  badge.className = `badge ${type}`;
  badge.textContent = title;
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleString();
  row.appendChild(badge);
  row.appendChild(time);
  const dd = document.createElement("div");
  dd.className = "desc";
  dd.textContent = desc;
  li.appendChild(row);
  li.appendChild(dd);
  $("history").prepend(li);
}

// 상태 표시
function setStatus(text) { $("status-text").textContent = text; }
function setProgress(v) {
  const pct = Math.max(0, Math.min(100, v));
  $("progress-bar").style.width = pct + "%";
}
function setResponse(obj) {
  $("last-response").textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

// 버튼 상태 토글
function setBusy(busy) {
  $("start").disabled = busy;
  $("upload").disabled = busy;
}

// 촬영 시작
async function handleStart() {
  const car_code = $("car_code").value.trim();
  const rpm = Number($("rpm").value);
  const frames = Number($("frames").value);
  if (!car_code) { alert("차량코드를 입력하세요."); return; }

  setBusy(true);
  setStatus("촬영 중");
  setProgress(5);

  // 한 바퀴 시간(ms) + 여유 버퍼
  const turnMs = Math.ceil((60 / Math.max(0.1, rpm)) * 1000);
  const startTimeout = turnMs + 15000;

  try {
    const j = await post("/capture/start", { car_code, rpm, frames }, { timeoutMs: startTimeout });
    setProgress(60);
    setResponse(j);
    addHistory("info", "CAPTURE OK", `${car_code} 촬영 완료 (frames=${j.frames})`);

    const mode = document.querySelector("input[name=save_mode]:checked")?.value || "local";
    if (mode === "upload") {
      await handleUploadWithTimeout(120000);
    } else {
      setStatus("촬영 완료");
      setProgress(100);
    }
  } catch (e) {
    setStatus("오류");
    setProgress(0);
    setResponse(String(e.message || e));
    addHistory("error", "CAPTURE FAIL", String(e.message || e));
  } finally {
    setBusy(false);
  }
}

// 업로드
async function handleUploadWithTimeout(timeoutMs = 600000) {
  const car_code = $("car_code").value.trim();
  if (!car_code) { alert("차량코드를 입력하세요."); return; }

  setBusy(true);
  setStatus("업로드 중");
  setProgress(75);

  try {
    const j = await post("/capture/upload", { car_code }, { timeoutMs });
    setProgress(100);
    setStatus("업로드 완료");
    setResponse(j);
    addHistory("success", "UPLOAD OK", `${car_code} 업로드 완료 (job_id=${j.job_id || "-"})`);
  } catch (e) {
    setProgress(0);
    setStatus("업로드 실패");
    setResponse(String(e.message || e));
    addHistory("error", "UPLOAD FAIL", String(e.message || e));
  } finally {
    setBusy(false);
  }
}

async function handleUpload() {
  return handleUploadWithTimeout(600000);
}

// 좌측 프리뷰 버튼 이벤트
function bindPreview() {
  $("btn-refresh").addEventListener("click", () => {
    addHistory("info", "PREVIEW", "미리보기 새로고침 요청");
  });
  $("btn-play").addEventListener("click", () => {
    addHistory("info", "PREVIEW", "시퀀스 재생 요청");
  });
}

// API 핑
async function ping() {
  try {
    const j = await get("/healthz");
    addHistory("success", "PING OK", JSON.stringify(j));
  } catch (e) {
    addHistory("error", "PING FAIL", String(e.message || e));
    setStatus("API 연결 실패");
  }
}

// 이벤트 바인딩
function bindActions() {
  $("start").addEventListener("click", handleStart);
  $("upload").addEventListener("click", handleUpload);
}

// 초기화
(function init() {
  setToday();
  bindActions();
  bindPreview();
  addHistory("info", "API BASE", API_BASE);
  ping();
})();
