import express from 'express'
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
// import fetch from 'node-fetch'   ← 이 줄 삭제
import 'dotenv/config' 

const app = express()
app.use(express.json())
app.use(express.static('public'))

const HOME = os.homedir() || process.env.USERPROFILE || process.env.HOME || process.cwd()
const ROOT = path.resolve(HOME, 'edge-capture', 'jobs')
fs.mkdirSync(ROOT, { recursive: true })

function which(bin) {
	try {
		const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' })
		return r.status === 0
	} catch {
		return false
	}
}
function pickStillBin() {
	if (which('rpicam-still')) return 'rpicam-still'
	if (which('libcamera-still')) return 'libcamera-still'
	return null
}

//실전용
// app.post('/capture/start', (req, res) => {
// 	const {
// 		car_code,
// 		rpm = Number(process.env.DEFAULT_RPM || 2),
// 		frames = Number(process.env.DEFAULT_FRAMES || 36),
// 	} = req.body || {}
// 	if (!car_code) return res.status(400).json({ error: 'car_code required' })

// 	const bin = pickStillBin()
// 	if (!bin) return res.status(500).json({ error: 'no still-capture binary found' })

// 	const T = 60 / rpm // seconds per revolution
// 	const interval = Math.max(200, Math.floor((T / frames) * 1000)) // ms
// 	const timeout = Math.ceil(T * 1000) // ms

// 	const dir = path.join(ROOT, car_code)
// 	const seq = path.join(dir, 'seq')
// 	fs.mkdirSync(seq, { recursive: true })

// 	const args = [
// 		'--width',
// 		String(process.env.WIDTH || 1920),
// 		'--height',
// 		String(process.env.HEIGHT || 1080),
// 		'--timeout',
// 		String(timeout),
// 		'--timelapse',
// 		String(interval),
// 		'--shutter',
// 		'2000',
// 		'--gain',
// 		'1.0',
// 		'--awb',
// 		'tungsten',
// 		'-o',
// 		path.join(seq, 'frame_%03d.jpg'),
// 		'-n',
// 	]

// 	const p = spawn(bin, args)
// 	p.on('exit', code => {
// 		if (code !== 0) return res.status(500).json({ error: 'capture failed', code })

// 		const files = fs
// 			.readdirSync(seq)
// 			.filter(f => f.endsWith('.jpg'))
// 			.sort()
// 		let picked = files
// 		if (files.length !== frames) {
// 			const step = Math.max(1, files.length / frames)
// 			picked = Array.from({ length: frames }, (_, i) => files[Math.floor(i * step)]).filter(Boolean)
// 			const keep = new Set(picked)
// 			for (const f of files) if (!keep.has(f)) fs.unlinkSync(path.join(seq, f))
// 		}

// 		const manifest = {
// 			car_code,
// 			frames: picked.length,
// 			ext: 'jpg',
// 			width: Number(process.env.WIDTH || 1920),
// 			height: Number(process.env.HEIGHT || 1080),
// 			shot: { rpm, duration_sec: T, interval_ms: interval },
// 			meta: { taken_at: new Date().toISOString() },
// 		}
// 		fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))

// 		res.json({ ok: true, car_code, frames: picked.length, manifest })
// 	})
// })

//목업용
app.post('/capture/start', (req, res) => {
	const {
		car_code,
		rpm = Number(process.env.DEFAULT_RPM || 2),
		frames = Number(process.env.DEFAULT_FRAMES || 36),
	} = req.body || {}
	if (!car_code) return res.status(400).json({ error: 'car_code required' })

	const dir = path.join(ROOT, car_code)
	const seq = path.join(dir, 'seq')
	fs.mkdirSync(seq, { recursive: true })

	const T = 60 / rpm
	const interval = Math.max(200, Math.floor((T / frames) * 1000))

	const bin = pickStillBin()

	// PC에서 개발할 때는 MOCK=1로 더미 프레임 생성
	if (!bin && process.env.MOCK === '1') {
		for (let i = 1; i <= frames; i++) {
			const p = path.join(seq, `frame_${String(i).padStart(3, '0')}.jpg`)
			// 간단한 placeholder 생성
			fs.writeFileSync(p, Buffer.from([]))
		}
		const manifest = {
			car_code,
			frames,
			ext: 'jpg',
			width: Number(process.env.WIDTH || 1920),
			height: Number(process.env.HEIGHT || 1080),
			shot: { rpm, duration_sec: T, interval_ms: interval },
			meta: { taken_at: new Date().toISOString() },
		}
		fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
		return res.json({ ok: true, car_code, frames, manifest, note: 'MOCK frames generated (empty files)' })
	}

	if (!bin) return res.status(500).json({ error: 'no still-capture binary found (run on CM4 or set MOCK=1)' })

	const args = [
		'--width',
		String(process.env.WIDTH || 1920),
		'--height',
		String(process.env.HEIGHT || 1080),
		'--timeout',
		String(Math.ceil(T * 1000)),
		'--timelapse',
		String(interval),
		'--shutter',
		'2000',
		'--gain',
		'1.0',
		'--awb',
		'tungsten',
		'-o',
		path.join(seq, 'frame_%03d.jpg'),
		'-n',
	]

	const p = spawn(bin, args)
	p.on('exit', code => {
		if (code !== 0) return res.status(500).json({ error: 'capture failed', code })

		const files = fs
			.readdirSync(seq)
			.filter(f => f.endsWith('.jpg'))
			.sort()
		let picked = files
		if (files.length !== frames) {
			const step = Math.max(1, files.length / frames)
			picked = Array.from({ length: frames }, (_, i) => files[Math.floor(i * step)]).filter(Boolean)
			const keep = new Set(picked)
			for (const f of files) if (!keep.has(f)) fs.unlinkSync(path.join(seq, f))
		}

		const manifest = {
			car_code,
			frames: picked.length,
			ext: 'jpg',
			width: Number(process.env.WIDTH || 1920),
			height: Number(process.env.HEIGHT || 1080),
			shot: { rpm, duration_sec: T, interval_ms: interval },
			meta: { taken_at: new Date().toISOString() },
		}
		fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
		res.json({ ok: true, car_code, frames: picked.length, manifest })
	})
})

app.post("/capture/upload", async (req, res) => {
	const { car_code } = req.body || {};
	if (!car_code) return res.status(400).json({ error: "car_code required" });
  
	const dir = path.join(ROOT, car_code);
	const manifestPath = path.join(dir, "manifest.json");
	const seqDir = path.join(dir, "seq");
	if (!fs.existsSync(manifestPath) || !fs.existsSync(seqDir)) {
	  return res.status(400).json({ error: "no manifest or seq; capture first" });
	}
  
	const zipPath = path.join(dir, "payload.zip");
  
	try {
	  await new Promise((resolve, reject) => {
		const output = fs.createWriteStream(zipPath);
		const archive = archiver("zip", { zlib: { level: 9 } });
		output.on("close", resolve);
		archive.on("error", reject);
		archive.pipe(output);
		archive.file(manifestPath, { name: "manifest.json" });
		archive.directory(seqDir, "seq");
		archive.finalize();
	  });
  
	  const stream = fs.createReadStream(zipPath);
	  const url = `${process.env.CORE_URL}/ingest/upload`;
	  const r = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${process.env.UPLOAD_TOKEN}` },
		body: stream
	  });
  
	  const txt = await r.text();
	  if (!r.ok) {
		return res.status(502).json({ error: "upload failed", status: r.status, body: txt, url });
	  }
	  const j = JSON.parse(txt);
	  res.json(j);
	} catch (e) {
	  res.status(500).json({ error: "backend upload exception", detail: String(e) });
	}
  });

const PORT = 8080
app.listen(PORT, () => console.log(`edge-capture listening :${PORT}`))
