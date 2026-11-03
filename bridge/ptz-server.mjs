// Pan/tilt for ONVIF cameras, in front of go2rtc. Serves a player with arrows at /ptz/, turns
// arrow presses into ONVIF ContinuousMove/Stop, and passes every other request (player files,
// video socket) through to go2rtc. Camera credentials come from go2rtc.yaml.
// Run: node ptz-server.mjs   (listens on 127.0.0.1:1985; the tunnel sends cam.<domain> here)

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { connect } from 'node:net'

const PORT = 1985
const GO2RTC = { host: '127.0.0.1', port: 1984 }
const DIR = new URL('.', import.meta.url)
// A move lasts this long unless the page renews it, so a dropped connection never leaves the camera spinning.
const MOVE_MS = 1000
const MAX_SPEED = 0.5

/** stream name → camera, from the rtsp:// sources in go2rtc.yaml */
function loadCameras() {
  const yaml = readFileSync(new URL('go2rtc.yaml', DIR), 'utf8')
  const cameras = new Map()
  for (const [, name, source] of yaml.matchAll(/^\s+([\w-]+):\s*(rtsp:\/\/\S+)/gm)) {
    const url = new URL(source)
    cameras.set(name, {
      host: url.hostname,
      user: decodeURIComponent(url.username),
      pass: decodeURIComponent(url.password),
    })
  }
  return cameras
}

const cameras = loadCameras()
const PAGE = readFileSync(new URL('ptz.html', DIR))

function security({ user, pass }) {
  const nonce = randomBytes(16)
  const created = new Date().toISOString()
  const digest = createHash('sha1').update(Buffer.concat([nonce, Buffer.from(created + pass)])).digest('base64')
  return `<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><UsernameToken><Username>${user}</Username><Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password><Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</Nonce><Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created></UsernameToken></Security>`
}

async function soap(camera, path, body) {
  const envelope = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema"><s:Header>${security(camera)}</s:Header><s:Body>${body}</s:Body></s:Envelope>`
  const res = await fetch(`http://${camera.host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml' },
    body: envelope,
    signal: AbortSignal.timeout(5000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ONVIF ${path} ${res.status}`)
  return text
}

/** The first media profile with PTZ, looked up once per camera. */
async function profileToken(camera) {
  camera.profile ??= soap(camera, '/onvif/media_service', '<trt:GetProfiles/>').then((xml) => {
    const profiles = xml.split(/<trt:Profiles\b/).slice(1)
    const withPtz = profiles.find((p) => p.includes('PTZConfiguration')) ?? profiles[0]
    const token = withPtz?.match(/^[^>]*token="([^"]+)"/)?.[1]
    if (!token) throw new Error('no ONVIF profile')
    return token
  })
  // Retry the lookup next time instead of caching a failure.
  camera.profile.catch(() => (camera.profile = undefined))
  return camera.profile
}

const clamp = (n) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (Number(n) || 0) * MAX_SPEED))

async function move(camera, x, y) {
  const token = await profileToken(camera)
  await soap(camera, '/onvif/ptz_service', `<tptz:ContinuousMove><tptz:ProfileToken>${token}</tptz:ProfileToken><tptz:Velocity><tt:PanTilt x="${clamp(x)}" y="${clamp(y)}"/></tptz:Velocity></tptz:ContinuousMove>`)
  clearTimeout(camera.stopTimer)
  camera.stopTimer = setTimeout(() => stop(camera).catch(log), MOVE_MS)
}

async function stop(camera) {
  clearTimeout(camera.stopTimer)
  const token = await profileToken(camera)
  await soap(camera, '/onvif/ptz_service', `<tptz:Stop><tptz:ProfileToken>${token}</tptz:ProfileToken><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop>`)
}

function log(err) {
  console.error(new Date().toISOString(), err.message, err.cause?.code ?? err.cause?.message ?? '')
}

async function readJson(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 1000) throw new Error('body too large')
  }
  return body ? JSON.parse(body) : {}
}

/** Passes a request through to go2rtc unchanged; its allow_paths still decides what is served. */
function proxy(req, res) {
  const upstream = request({ ...GO2RTC, method: req.method, path: req.url, headers: req.headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers)
    up.pipe(res)
  })
  upstream.on('error', (err) => {
    log(err)
    if (!res.headersSent) res.writeHead(502).end('go2rtc is not running')
  })
  req.pipe(upstream)
}

/** WebSocket upgrades (the video in /api/ws) are piped to go2rtc as raw TCP. */
function proxyUpgrade(req, socket, head) {
  const upstream = connect(GO2RTC.port, GO2RTC.host, () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`)
    upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  const close = () => (socket.destroy(), upstream.destroy())
  upstream.on('error', close)
  socket.on('error', close)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const send = (status, body = '', type = 'text/plain') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
    res.end(body)
  }

  if (!url.pathname.startsWith('/ptz/')) return proxy(req, res)
  if (req.method === 'GET' && url.pathname === '/ptz/') return send(200, PAGE, 'text/html; charset=utf-8')

  const action = { '/ptz/move': 'move', '/ptz/stop': 'stop' }[url.pathname]
  if (!action || req.method !== 'POST') return send(404)
  // A JSON content type can't be sent cross-site without a CORS preflight, which this server never allows.
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415)
  const camera = cameras.get(url.searchParams.get('src') ?? '')
  if (!camera) return send(404, 'unknown stream')

  try {
    if (action === 'move') {
      const { x, y } = await readJson(req)
      await move(camera, x, y)
    } else {
      await stop(camera)
    }
    send(204)
  } catch (err) {
    log(err)
    send(502, 'camera did not respond')
  }
})
server.on('upgrade', proxyUpgrade)
server.listen(PORT, '127.0.0.1', () => console.log(`ptz on 127.0.0.1:${PORT}, streams: ${[...cameras.keys()].join(', ')}`))
