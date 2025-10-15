// 코드 주석에 이모티콘은 사용하지 마세요.
async function post(url, body) {
	const r = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	const j = await r.json().catch(() => ({}))
	if (!r.ok) throw new Error(j.error || 'request failed')
	return j
}

function $(id) {
	return document.getElementById(id)
}

function setToday() {
	const d = new Date()
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	$('today-date').textContent = `${y}-${m}-${day}`
}

function addHistory(type, title, desc) {
	const li = document.createElement('li')
	li.className = `history-item ${type}`
	const row = document.createElement('div')
	row.className = 'row'
	const badge = document.createElement('span')
	badge.className = `badge ${type}`
	badge.textContent = title
	const time = document.createElement('time')
	time.textContent = new Date().toLocaleString()
	row.appendChild(badge)
	row.appendChild(time)
	const dd = document.createElement('div')
	dd.className = 'desc'
	dd.textContent = desc
	li.appendChild(row)
	li.appendChild(dd)
	$('history').prepend(li)
}

function setStatus(text) {
	$('status-text').textContent = text
}
function setProgress(v) {
	const pct = Math.max(0, Math.min(100, v))
	$('progress-bar').style.width = pct + '%'
}
function setResponse(obj) {
	$('last-response').textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
}

async function handleStart() {
	const car_code = $('car_code').value.trim()
	const rpm = Number($('rpm').value)
	const frames = Number($('frames').value)
	if (!car_code) {
		alert('차량코드를 입력하세요.')
		return
	}

	setStatus('촬영 중')
	setProgress(5)

	try {
		const j = await post('/capture/start', { car_code, rpm, frames })
		setProgress(60)
		setResponse(j)
		addHistory('info', 'CAPTURE OK', `${car_code} 촬영 완료 (frames=${j.frames})`)

		// 미리보기 플레이어에 연결하려면, jobs/<car_code>/seq/frame_XXX.jpg 접근 경로가 필요
		// 현재는 백엔드에서 jobs를 정적으로 서빙하지 않으므로 자리만 남겨둔다.

		const mode = document.querySelector('input[name=save_mode]:checked')?.value || 'local'
		if (mode === 'upload') {
			await handleUpload() // 자동 업로드
		} else {
			setStatus('촬영 완료')
			setProgress(100)
		}
	} catch (e) {
		setStatus('오류')
		setProgress(0)
		setResponse(String(e.message || e))
		addHistory('error', 'CAPTURE FAIL', String(e.message || e))
	}
}

async function handleUpload() {
	const car_code = $('car_code').value.trim()
	if (!car_code) {
		alert('차량코드를 입력하세요.')
		return
	}
	setStatus('업로드 중')
	setProgress(75)
	try {
		const j = await post('/capture/upload', { car_code })
		setProgress(100)
		setStatus('업로드 완료')
		setResponse(j)
		addHistory('success', 'UPLOAD OK', `${car_code} 업로드 완료 (job_id=${j.job_id || '-'})`)
	} catch (e) {
		setProgress(0)
		setStatus('업로드 실패')
		setResponse(String(e.message || e))
		addHistory('error', 'UPLOAD FAIL', String(e.message || e))
	}
}

/* 좌측 프리뷰 자리 이벤트 */
function bindPreview() {
	$('btn-refresh').addEventListener('click', () => {
		// 실제 프레임을 서비스하려면, 백엔드에서 jobs 디렉토리를 정적으로 서빙하거나
		// 프록시 엔드포인트를 추가하세요. 이 버튼은 자리 표시용입니다.
		addHistory('info', 'PREVIEW', '미리보기 새로고침 요청')
	})
	$('btn-play').addEventListener('click', () => {
		addHistory('info', 'PREVIEW', '시퀀스 재생 요청')
	})
}

/* 이벤트 바인딩 */
function bindActions() {
	$('start').addEventListener('click', handleStart)
	$('upload').addEventListener('click', handleUpload)
}

/* 초기화 */
setToday()
bindActions()
bindPreview()
