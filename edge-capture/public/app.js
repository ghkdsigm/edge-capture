// public/app.js
// 코드 주석에 이모티콘은 사용하지 마세요.
async function post(url, body) {
	const r = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	const j = await r.json()
	if (!r.ok) throw new Error(j.error || 'request failed')
	return j
}
const $ = id => document.getElementById(id)
function log(s) {
	$('log').textContent += s + '\n'
}

$('start').onclick = async () => {
	const car_code = $('car_code').value.trim()
	const rpm = Number($('rpm').value)
	const frames = Number($('frames').value)
	const save_mode = document.querySelector('input[name="save_mode"]:checked').value

	try {
		log('촬영 시작...')
		const j = await post('/capture/start', { car_code, rpm, frames, save_mode })
		log('완료: ' + JSON.stringify(j))
	} catch (e) {
		log('오류: ' + e.message)
	}
}

$('upload').onclick = async () => {
	const car_code = $('car_code').value.trim()
	const save_mode = document.querySelector('input[name="save_mode"]:checked').value

	try {
		if (save_mode === 'upload') {
			log('업로드 시작...')
			const j = await post('/capture/upload', { car_code })
			log('업로드 완료: ' + JSON.stringify(j))
		} else {
			log('로컬 저장 모드입니다. 업로드 기능이 비활성화되었습니다.')
		}
	} catch (e) {
		log('오류: ' + e.message)
	}
}
