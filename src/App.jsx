import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles/app.css'

// ─── Config ──────────────────────────────────────────────────────────────────
const API = 'https://api.letta.mizzenmast.dev'
const WS_BASE = 'wss://api.letta.mizzenmast.dev/ws'
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👎']
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

// ─── Storage helpers ─────────────────────────────────────────────────────────
const store = {
  get: (k, fb = null) => { try { return localStorage.getItem(k) ?? fb } catch { return fb } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} },
}

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date(), diff = now - d
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}
function fmtDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
function initial(name) { return (name || '?').trim()[0]?.toUpperCase() ?? '?' }

function Icon({ children, title }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" role={title ? 'img' : 'presentation'}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

function MessagesIcon() {
  return <Icon><path d="M5 6h14v8H10l-5 4V6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>
}

function StatusIcon() {
  return <Icon><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 6.5v11M6.5 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

function CallsIcon() {
  return <Icon><path d="M7.5 5.5c1.3 0 2.4.5 3.3 1.4l1.2 1.2c.4.4.4 1 0 1.4l-.8.8c-.2.2-.3.6-.2.9.4 1.1 1.4 2.2 2.5 2.6.3.1.7 0 .9-.2l.8-.8c.4-.4 1-.4 1.4 0l1.2 1.2c.9.9 1.4 2 1.4 3.3v1.1c0 .8-.6 1.5-1.4 1.6-1.1.1-2.7-.1-5-1-2.7-1.1-5.3-3.7-6.4-6.4-1-2.3-1.2-3.9-1-5 .1-.8.8-1.4 1.6-1.4h1.1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></Icon>
}

function SettingsIcon() {
  return <Icon><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>
}

function AddChatIcon() {
  return <Icon><path d="M6 5.5h12v8H9l-3 2.6V5.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M15 8.5v4M13 10.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

function PaperclipIcon() {
  return <Icon><path d="M9 12.5l5.8-5.8a3 3 0 1 1 4.2 4.2l-7.4 7.4a5 5 0 1 1-7.1-7.1l7.4-7.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></Icon>
}

function PollIcon() {
  return <Icon><path d="M6 17V7M11 17V10M16 17v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M4.5 17.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>
}

function SendIcon() {
  return <Icon><path d="M4.5 11.5 19.5 4.5l-4 15-3.7-6.1-7.3-2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></Icon>
}

function CloseIcon() {
  return <Icon><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

function ImageIcon() {
  return <Icon><rect x="4.5" y="5" width="15" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M7 15l3.2-3.2 2.4 2.4 2.7-2.7 3.2 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /></Icon>
}

function VideoIcon() {
  return <Icon><rect x="4.5" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M16.5 10.2 20 8.2v7.6l-3.5-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></Icon>
}

function CallEndIcon() {
  return <Icon><path d="M7.5 6.5c1.3 0 2.4.5 3.3 1.4l1.2 1.2c.4.4.4 1 0 1.4l-.8.8c-.2.2-.3.6-.2.9.4 1.1 1.4 2.2 2.5 2.6.3.1.7 0 .9-.2l.8-.8c.4-.4 1-.4 1.4 0l1.2 1.2c.9.9 1.4 2 1.4 3.3v1.1c0 .8-.6 1.5-1.4 1.6-1.1.1-2.7-.1-5-1-2.7-1.1-5.3-3.7-6.4-6.4-1-2.3-1.2-3.9-1-5 .1-.8.8-1.4 1.6-1.4h1.1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /><path d="M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

function MuteIcon() {
  return <Icon><path d="M5.5 14V10.5h3l4-4v11l-4-4h-3z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.4 7.1a7 7 0 0 1 0 9.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></Icon>
}

function BellIcon() {
  return <Icon><path d="M12 18a1.8 1.8 0 0 0 1.8-1.8h-3.6A1.8 1.8 0 0 0 12 18z" fill="currentColor" /><path d="M6.5 15.5h11l-1.2-1.9V10a4.3 4.3 0 1 0-8.6 0v3.6l-1.2 1.9z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></Icon>
}

function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v4l2.7 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Icon>
}

function BlockIcon() {
  return <Icon><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7.2 16.8 16.8 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

function MicIcon() {
  return <Icon title="Mute"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7 12a5 5 0 0 0 10 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

function MicOffIcon() {
  return <Icon title="Unmute"><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V6a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12M19 12a7 7 0 0 0-.11-1.23M12 19v2M9 22h6M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></Icon>
}

function SpeakerIcon() {
  return <Icon title="Speaker"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></Icon>
}

// Segmented story ring — drawn as overlapping circle arcs
function StoryRing({ count, viewedCount, size = 50 }) {
  const stroke = 2.5
  const r = (size - stroke * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const gap = count > 1 ? 4 : 0
  const segLen = (circumference - gap * count) / count
  return (
    <svg
      width={size} height={size}
      className="story-ring-svg"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={i < viewedCount ? 'var(--border2)' : 'var(--gold)'}
          strokeWidth={stroke}
          strokeDasharray={`${segLen} ${circumference - segLen}`}
          strokeDashoffset={-(segLen + gap) * i}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
    </svg>
  )
}

function DeleteIcon() {
  return <Icon><path d="M6.5 7.5h11M9 7.5V6h6v1.5M8.5 7.5l.6 9h5.8l.6-9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 10v4M14 10v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></Icon>
}

function RingIcon() {
  return <Icon><path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.5 6.5l1.6 1.6M15.9 15.9l1.6 1.6M17.5 6.5l-1.6 1.6M7.6 15.9 6 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [token, setToken] = useState(() => store.get('letta_token'))
  const [refreshTok, setRefreshTok] = useState(() => store.get('letta_refresh'))
  const [setupToken, setSetupToken] = useState(null)
  const [authStep, setAuthStep] = useState('phone') // phone | otp | profile
  const [authPhone, setAuthPhone] = useState('')
  const [authOtp, setAuthOtp] = useState('')
  const [authName, setAuthName] = useState('')
  const [authErr, setAuthErr] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  // Core data
  const [me, setMe] = useState(null)
  const [convs, setConvs] = useState([])
  const [msgsByConv, setMsgsByConv] = useState({})
  const [activeConvId, setActiveConvId] = useState(null)
  const [pins, setPins] = useState([])

  // UI state
  const [workspace, setWorkspace] = useState('chats') // chats | status | calls | settings
  const [draft, setDraft] = useState('')
  const [composerMode, setComposerMode] = useState('text') // text | poll
  const [pollQ, setPollQ] = useState('')
  const [pollOpts, setPollOpts] = useState('Option A\nOption B')
  const [convSearch, setConvSearch] = useState('')
  const [showNewConv, setShowNewConv] = useState(false)
  const [newChatMode, setNewChatMode] = useState('direct') // direct | group
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(null) // msgId | null
  const [reactionPickerPos, setReactionPickerPos] = useState({ x: 0, y: 0 })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [toast, setToast] = useState(null)

  // WS
  const [wsState, setWsState] = useState('offline') // offline | connecting | connected
  const [typingMap, setTypingMap] = useState({}) // convId -> bool
  const [presenceMap, setPresenceMap] = useState({}) // userId -> {online, last_seen}

  // Status
  const [statusFeed, setStatusFeed] = useState([]) // list[{user_id, display_name, avatar, all_viewed, statuses[]}]
  const [statusMine, setStatusMine] = useState([])
  const [statusText, setStatusText] = useState('')
  const [statusColor, setStatusColor] = useState('#1e1e21')
  const [statusComposerOpen, setStatusComposerOpen] = useState(false)
  const [storyViewerId, setStoryViewerId] = useState(null) // userId of story being viewed
  const [storyViewerIndex, setStoryViewerIndex] = useState(0) // index in stories array

  // Calls history
  const [callsFeed, setCallsFeed] = useState([])
  const [callsBusy, setCallsBusy] = useState(false)

  // Calls
  const [callState, setCallState] = useState({ active: false, incoming: null, callId: null, status: 'idle', peerUserId: null })
  const [callMuted, setCallMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  // Settings
  const [focusProfile, setFocusProfile] = useState('normal')

  // Refs
  const wsRef = useRef(null)
  const wsReconnRef = useRef(null)
  const wsHeartRef = useRef(null)
  const tokenRef = useRef(token)
  const refreshRef = useRef(refreshTok)
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(new Audio())
  const remoteAudioInit = useRef(false)
  const ringRef = useRef(null)
  const messagesEndRef = useRef(null)
  const headerMenuRef = useRef(null)
  const toastTimer = useRef(null)
  const typingOutTimer = useRef(null)
  const activeConvIdRef = useRef(activeConvId)
  const callDurationTimer = useRef(null)
  const statusFeedRef = useRef(statusFeed)

  // Keep refs in sync
  useEffect(() => { tokenRef.current = token; store.set('letta_token', token) }, [token])
  useEffect(() => { refreshRef.current = refreshTok; store.set('letta_refresh', refreshTok) }, [refreshTok])
  useEffect(() => { activeConvIdRef.current = activeConvId }, [activeConvId])
  useEffect(() => { statusFeedRef.current = statusFeed }, [statusFeed])

  // ── API ────────────────────────────────────────────────────────────────────
  const api = useCallback(async (path, opts = {}, isRetry = false) => {
    const headers = { ...(opts.headers || {}) }
    if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type'])
      headers['Content-Type'] = 'application/json'
    const curToken = tokenRef.current
    if (curToken) headers.Authorization = `Bearer ${curToken}`

    const res = await fetch(`${API}${path}`, { ...opts, headers })

    if (res.status === 401 && !isRetry && refreshRef.current) {
      const ok = await tryRefresh()
      if (ok) return api(path, opts, true)
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    if (res.status === 204) return null
    return res.json()
  }, []) // eslint-disable-line

  const tryRefresh = useCallback(async () => {
    const rt = refreshRef.current
    if (!rt) return false
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (!data.access_token) return false
      tokenRef.current = data.access_token
      refreshRef.current = data.refresh_token
      setToken(data.access_token)
      setRefreshTok(data.refresh_token)
      return true
    } catch { return false }
  }, [])

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = '') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const sendWs = useCallback((type, payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false
    wsRef.current.send(JSON.stringify({ type, payload }))
    return true
  }, [])

  const mergeMsg = useCallback((msg) => {
    setMsgsByConv(prev => {
      const list = prev[msg.conversation_id] || []
      if (list.some(m => m.id === msg.id)) return prev
      // Replace optimistic placeholder
      const optIdx = list.findIndex(m =>
        String(m.id).startsWith('tmp-') && m.sender_id === msg.sender_id &&
        m.type === msg.type && (m.content || '') === (msg.content || '')
      )
      const copy = optIdx >= 0 ? [...list] : [...list, msg]
      if (optIdx >= 0) copy[optIdx] = msg
      return { ...prev, [msg.conversation_id]: copy }
    })
    setConvs(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, last_message: msg } : c))
  }, [])

  const handleWsEvent = useCallback((event) => {
    switch (event.type) {
      case 'pong': break

      case 'message.new':
      case 'message.sent':
        mergeMsg(event.payload)
        // Auto-read if active conversation
        if (event.payload.conversation_id === activeConvIdRef.current &&
          event.payload.sender_id !== (me?.id)) {
          sendWs('message.read', { message_id: event.payload.id, conversation_id: event.payload.conversation_id })
        } else if (event.payload.sender_id !== me?.id) {
          setConvs(prev => prev.map(c => c.id === event.payload.conversation_id
            ? { ...c, unread_count: (c.unread_count || 0) + 1 }
            : c))
        }
        break

      case 'message.deleted': {
        const { message_id, conversation_id } = event.payload
        setMsgsByConv(prev => {
          const list = prev[conversation_id] || []
          return { ...prev, [conversation_id]: list.map(m => m.id === message_id ? { ...m, deleted_at: new Date().toISOString(), content: null, media_url: null } : m) }
        })
        break
      }

      case 'typing.start':
        setTypingMap(prev => ({ ...prev, [event.payload.conversation_id]: event.payload.user_id }))
        break
      case 'typing.stop':
        setTypingMap(prev => ({ ...prev, [event.payload.conversation_id]: null }))
        break

      case 'presence.update':
        setPresenceMap(prev => ({ ...prev, [event.payload.user_id]: event.payload }))
        break

      case 'reaction.add': {
        const { message_id, emoji } = event.payload
        setMsgsByConv(prev => {
          for (const [cid, list] of Object.entries(prev)) {
            const idx = list.findIndex(m => m.id === message_id)
            if (idx >= 0) {
              const msg = list[idx]
              const reactions = { ...((msg.reactions) || {}) }
              reactions[emoji] = (reactions[emoji] || 0) + 1
              const copy = [...list]; copy[idx] = { ...msg, reactions }
              return { ...prev, [cid]: copy }
            }
          }
          return prev
        })
        break
      }
      case 'reaction.remove': {
        const { message_id, emoji } = event.payload
        if (!emoji) break
        setMsgsByConv(prev => {
          for (const [cid, list] of Object.entries(prev)) {
            const idx = list.findIndex(m => m.id === message_id)
            if (idx >= 0) {
              const msg = list[idx]
              const reactions = { ...((msg.reactions) || {}) }
              if (reactions[emoji] > 1) reactions[emoji]--; else delete reactions[emoji]
              const copy = [...list]; copy[idx] = { ...msg, reactions }
              return { ...prev, [cid]: copy }
            }
          }
          return prev
        })
        break
      }

      case 'message.pinned':
      case 'message.unpinned':
        if (activeConvIdRef.current) loadPins(activeConvIdRef.current)
        break

      case 'status.new':
        loadStatuses()
        break

      case 'call.offer':
        setCallState({ active: true, incoming: event.payload, callId: event.payload.call_id, status: 'ringing', peerUserId: event.payload.caller_id })
        break

      case 'call.answer':
        if (peerRef.current && event.payload?.sdp) {
          const sdpStr = typeof event.payload.sdp === 'string' ? event.payload.sdp : event.payload.sdp?.sdp || JSON.stringify(event.payload.sdp)
          peerRef.current.setRemoteDescription({ type: 'answer', sdp: sdpStr })
            .then(() => setCallState(p => ({ ...p, status: 'connected' })))
            .catch(e => showToast('Call answer error: ' + e.message, 'error'))
        }
        break

      case 'call.ice-candidate':
      case 'call.ice_candidate':
        if (peerRef.current && event.payload?.candidate) {
          const c = event.payload.candidate
          const candidate = typeof c === 'string' ? { candidate: c } : c
          peerRef.current.addIceCandidate(candidate).catch(() => {})
        }
        break

      case 'call.rejected':
      case 'call.ended':
        teardownCall()
        break

      case 'error':
        showToast(event.payload?.detail || 'Server error', 'error')
        break

      default:
        break
    }
  }, [me?.id]) // eslint-disable-line

  const connectWS = useCallback((accessToken) => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    if (wsReconnRef.current) clearTimeout(wsReconnRef.current)
    if (wsHeartRef.current) clearInterval(wsHeartRef.current)

    setWsState('connecting')
    const ws = new WebSocket(`${WS_BASE}?token=${accessToken}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsState('connected')
      wsHeartRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(JSON.stringify({ type: 'ping', payload: {} }))
      }, 30000)
    }

    ws.onmessage = e => {
      try { handleWsEvent(JSON.parse(e.data)) } catch {}
    }

    ws.onclose = () => {
      setWsState('offline')
      if (wsHeartRef.current) clearInterval(wsHeartRef.current)
      const tok = tokenRef.current
      if (tok) wsReconnRef.current = setTimeout(() => connectWS(tok), 3000)
    }
    ws.onerror = () => setWsState('offline')
  }, [handleWsEvent])

  // ── Auth ───────────────────────────────────────────────────────────────────
  const requestOtp = async () => {
    setAuthErr(''); setAuthBusy(true)
    try {
      await api('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone_number: authPhone.trim() }) })
      setAuthStep('otp')
    } catch (e) { setAuthErr(e.message) }
    finally { setAuthBusy(false) }
  }

  const verifyOtp = async () => {
    setAuthErr(''); setAuthBusy(true)
    try {
      const data = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone_number: authPhone.trim(), code: authOtp.trim() }) })
      if (data.needs_profile) { setSetupToken(data.setup_token); setAuthStep('profile') }
      else { tokenRef.current = data.access_token; refreshRef.current = data.refresh_token; setToken(data.access_token); setRefreshTok(data.refresh_token) }
    } catch (e) { setAuthErr(e.message) }
    finally { setAuthBusy(false) }
  }

  const completeProfile = async () => {
    setAuthErr(''); setAuthBusy(true)
    try {
      const data = await api('/auth/complete-profile', { method: 'POST', body: JSON.stringify({ setup_token: setupToken, display_name: authName.trim(), avatar_url: null }) })
      tokenRef.current = data.access_token; refreshRef.current = data.refresh_token
      setToken(data.access_token); setRefreshTok(data.refresh_token)
    } catch (e) { setAuthErr(e.message) }
    finally { setAuthBusy(false) }
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const [meData, convList] = await Promise.all([api('/auth/users/me'), api('/conversations')])
        setMe(meData)
        setConvs(convList)
        connectWS(tokenRef.current)
      } catch (e) {
        showToast(e.message, 'error')
        setToken(null); setRefreshTok(null); tokenRef.current = null; refreshRef.current = null
      }
    })()
    return () => {
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
      if (wsReconnRef.current) clearTimeout(wsReconnRef.current)
      if (wsHeartRef.current) clearInterval(wsHeartRef.current)
    }
  }, [token]) // eslint-disable-line

  // ── Data loaders ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId) => {
    const items = await api(`/conversations/${convId}/messages?limit=50`)
    const sorted = [...items].reverse()
    setMsgsByConv(prev => ({ ...prev, [convId]: sorted }))
    return sorted
  }, [api])

  const loadPins = useCallback(async (convId) => {
    try { setPins(await api(`/conversations/${convId}/pins`)) }
    catch { setPins([]) }
  }, [api])

  const loadStatuses = useCallback(async () => {
    try {
      const [feed, mine] = await Promise.all([api('/statuses/feed'), api('/statuses/mine')])
      setStatusFeed(feed)
      setStatusMine(mine)
    } catch (e) { showToast(e.message, 'error') }
  }, [api, showToast])

  const loadCalls = useCallback(async () => {
    try {
      setCallsBusy(true)
      setCallsFeed(await api('/calls?limit=40'))
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setCallsBusy(false)
    }
  }, [api, showToast])

  useEffect(() => { if (workspace === 'status') loadStatuses() }, [workspace, loadStatuses])
  useEffect(() => { if (workspace === 'calls') loadCalls() }, [workspace, loadCalls])
  useEffect(() => {
    if (!token) return
    loadStatuses()
    loadCalls()
  }, [token, loadStatuses, loadCalls])

  const statusPreview = useMemo(() => statusFeed.slice(0, 4), [statusFeed])

  // ── Open conversation ──────────────────────────────────────────────────────
  const openConversation = useCallback(async (convId) => {
    setWorkspace('chats')
    setActiveConvId(convId)
    setMobileSidebarOpen(false)
    setShowHeaderMenu(false)
    setConvs(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    try {
      const [msgs] = await Promise.all([loadMessages(convId), loadPins(convId)])
      if (msgs.length) sendWs('message.read', { message_id: msgs[msgs.length - 1].id, conversation_id: convId })
    } catch (e) { showToast(e.message, 'error') }
  }, [loadMessages, loadPins, sendWs, showToast])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgsByConv, activeConvId])

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!activeConvId) return

    if (composerMode === 'poll') {
      const options = pollOpts.split('\n').map(o => o.trim()).filter(Boolean)
      if (!pollQ.trim() || options.length < 2) { showToast('Poll needs a question and at least 2 options', 'error'); return }
      sendWs('message.send', { conversation_id: activeConvId, type: 'poll', content: pollQ.trim(), poll_data: JSON.stringify({ question: pollQ.trim(), options, multiple_choice: false }) })
      setPollQ(''); return
    }

    const content = draft.trim()
    if (!content) return
    const optimisticId = `tmp-${Date.now()}`
    setMsgsByConv(prev => ({ ...prev, [activeConvId]: [...(prev[activeConvId] || []), { id: optimisticId, conversation_id: activeConvId, sender_id: me?.id, type: 'text', content, created_at: new Date().toISOString(), reactions: {} }] }))
    setDraft('')
    sendWs('message.send', { conversation_id: activeConvId, type: 'text', content })
    sendWs('typing.stop', { conversation_id: activeConvId })
    if (typingOutTimer.current) { clearTimeout(typingOutTimer.current); typingOutTimer.current = null }
  }, [activeConvId, composerMode, draft, pollQ, pollOpts, me?.id, sendWs, showToast])

  const onDraftChange = useCallback((val) => {
    setDraft(val)
    if (!activeConvId) return
    sendWs('typing.start', { conversation_id: activeConvId })
    if (typingOutTimer.current) clearTimeout(typingOutTimer.current)
    typingOutTimer.current = setTimeout(() => sendWs('typing.stop', { conversation_id: activeConvId }), 2500)
  }, [activeConvId, sendWs])

  const uploadMedia = useCallback(async (file) => {
    if (!file || !activeConvId) return
    try {
      const form = new FormData(); form.append('file', file)
      const data = await api('/media/upload', { method: 'POST', body: form })
      const mime = data.mime_type || file.type || ''
      const type = mime.startsWith('image') ? 'image' : mime.startsWith('video') ? 'video' : mime.startsWith('audio') ? 'audio' : 'document'
      sendWs('message.send', { conversation_id: activeConvId, type, content: null, media_url: data.url, media_mime: mime })
    } catch (e) { showToast('Upload failed: ' + e.message, 'error') }
  }, [activeConvId, api, sendWs, showToast])

  // ── Calls ──────────────────────────────────────────────────────────────────
  const teardownCall = useCallback(() => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    if (ringRef.current) { clearInterval(ringRef.current); ringRef.current = null }
    if (callDurationTimer.current) { clearInterval(callDurationTimer.current); callDurationTimer.current = null }
    setCallState({ active: false, incoming: null, callId: null, status: 'idle', peerUserId: null })
    setCallMuted(false)
    setCallDuration(0)
  }, [])

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return
    const newMuted = !callMuted
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    setCallMuted(newMuted)
  }, [callMuted])

  // Ring tone for incoming calls
  useEffect(() => {
    if (callState.status !== 'ringing') {
      if (ringRef.current) { clearInterval(ringRef.current); ringRef.current = null }
      return
    }
    const beep = () => {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = 880; gain.gain.value = 0.06
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(); setTimeout(() => { osc.stop(); ctx.close() }, 200)
      } catch {}
    }
    beep(); ringRef.current = setInterval(beep, 2000)
  }, [callState.status])

  // Call duration counter
  useEffect(() => {
    if (callState.status === 'connected') {
      setCallDuration(0)
      callDurationTimer.current = setInterval(() => setCallDuration(p => p + 1), 1000)
    } else {
      if (callDurationTimer.current) { clearInterval(callDurationTimer.current); callDurationTimer.current = null }
    }
    return () => { if (callDurationTimer.current) { clearInterval(callDurationTimer.current); callDurationTimer.current = null } }
  }, [callState.status])

  // Story auto-advance (5s per story, then next person, then close)
  useEffect(() => {
    if (!storyViewerId) return
    // Mark current story as viewed
    const feed = statusFeedRef.current
    const group = feed.find(g => g.user_id === storyViewerId)
    const story = group?.statuses?.[storyViewerIndex]
    if (story?.id) viewStatus(story.id)
    const timer = setTimeout(() => {
      const currentFeed = statusFeedRef.current
      const currentGroup = currentFeed.find(g => g.user_id === storyViewerId)
      if (!currentGroup) { setStoryViewerId(null); return }
      if (storyViewerIndex < currentGroup.statuses.length - 1) {
        setStoryViewerIndex(storyViewerIndex + 1)
      } else {
        const gIdx = currentFeed.findIndex(g => g.user_id === storyViewerId)
        if (gIdx >= 0 && gIdx < currentFeed.length - 1) {
          setStoryViewerId(currentFeed[gIdx + 1].user_id)
          setStoryViewerIndex(0)
        } else {
          setStoryViewerId(null)
        }
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [storyViewerId, storyViewerIndex]) // eslint-disable-line

  const startCall = useCallback(async (calleeId) => {
    if (!activeConvId || !calleeId) return
    const callId = crypto.randomUUID()
    try {
      if (!remoteAudioInit.current) { remoteAudioRef.current.autoplay = true; remoteAudioInit.current = true }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      const pc = new RTCPeerConnection(RTC_CONFIG)
      peerRef.current = pc
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      pc.ontrack = e => { if (e.streams[0]) remoteAudioRef.current.srcObject = e.streams[0] }
      pc.onicecandidate = e => {
        if (!e.candidate) return
        sendWs('call.ice_candidate', { call_id: callId, target_user_id: calleeId, candidate: e.candidate.toJSON() })
      }
      const offer = await pc.createOffer({ offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)
      // Send sdp as string — backend accepts Any
      sendWs('call.offer', { call_id: callId, conversation_id: activeConvId, callee_id: calleeId, type: 'audio', sdp: offer.sdp })
      setCallState({ active: true, incoming: null, callId, status: 'calling', peerUserId: calleeId })
    } catch (e) { showToast('Call failed: ' + e.message, 'error'); teardownCall() }
  }, [activeConvId, sendWs, showToast, teardownCall])

  const answerCall = useCallback(async () => {
    if (!callState.callId || !callState.incoming?.sdp) return
    const peerUserId = callState.incoming.caller_id
    try {
      if (!remoteAudioInit.current) { remoteAudioRef.current.autoplay = true; remoteAudioInit.current = true }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      const pc = new RTCPeerConnection(RTC_CONFIG)
      peerRef.current = pc
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      pc.ontrack = e => { if (e.streams[0]) remoteAudioRef.current.srcObject = e.streams[0] }
      pc.onicecandidate = e => {
        if (!e.candidate) return
        sendWs('call.ice_candidate', { call_id: callState.callId, target_user_id: peerUserId, candidate: e.candidate.toJSON() })
      }
      const rawSdp = callState.incoming.sdp
      const sdpStr = typeof rawSdp === 'string' ? rawSdp : rawSdp?.sdp || JSON.stringify(rawSdp)
      await pc.setRemoteDescription({ type: 'offer', sdp: sdpStr })
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      // Send sdp as string — backend accepts Any
      sendWs('call.answer', { call_id: callState.callId, sdp: answer.sdp })
      setCallState(p => ({ ...p, status: 'connected', active: true, peerUserId }))
    } catch (e) { showToast('Answer failed: ' + e.message, 'error'); teardownCall() }
  }, [callState, sendWs, showToast, teardownCall])

  const rejectCall = useCallback(() => {
    if (callState.callId) sendWs('call.reject', { call_id: callState.callId })
    teardownCall()
  }, [callState.callId, sendWs, teardownCall])

  const endCall = useCallback(() => {
    if (callState.callId) sendWs('call.end', { call_id: callState.callId })
    teardownCall()
  }, [callState.callId, sendWs, teardownCall])

  // ── Messaging actions ──────────────────────────────────────────────────────
  const reactToMessage = useCallback(async (msgId, emoji) => {
    setShowReactionPicker(null)
    try { await api(`/messages/${msgId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }) }
    catch (e) { showToast(e.message, 'error') }
  }, [api, showToast])

  const deleteMessage = useCallback(async (msgId) => {
    try { await api(`/messages/${msgId}`, { method: 'DELETE' }); showToast('Deleted') }
    catch (e) { showToast(e.message, 'error') }
  }, [api, showToast])

  const pinMessage = useCallback(async (msgId) => {
    if (!activeConvId) return
    try { await api(`/conversations/${activeConvId}/pins`, { method: 'POST', body: JSON.stringify({ message_id: msgId }) }); await loadPins(activeConvId) }
    catch (e) { showToast(e.message, 'error') }
  }, [activeConvId, api, loadPins, showToast])

  const unpinMessage = useCallback(async (msgId) => {
    if (!activeConvId) return
    try { await api(`/conversations/${activeConvId}/pins/${msgId}`, { method: 'DELETE' }); await loadPins(activeConvId) }
    catch (e) { showToast(e.message, 'error') }
  }, [activeConvId, api, loadPins, showToast])

  const votePoll = useCallback(async (msgId, idx) => {
    try { await api(`/messages/${msgId}/vote`, { method: 'POST', body: JSON.stringify({ option_indices: [idx] }) }) }
    catch (e) { showToast(e.message, 'error') }
  }, [api, showToast])

  // ── New conversation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!showNewConv || userSearch.trim().length < 2) { setUserResults([]); return }
    const t = setTimeout(async () => {
      try { setUserResults(await api(`/users/search?q=${encodeURIComponent(userSearch)}&limit=10`)) }
      catch { setUserResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [showNewConv, userSearch, api])

  const startDirect = useCallback(async () => {
    if (!selectedUser) return
    try {
      const conv = await api('/conversations/direct', { method: 'POST', body: JSON.stringify({ other_user_id: selectedUser.id }) })
      setConvs(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev])
      setShowNewConv(false); setSelectedUser(null); setUserSearch(''); setGroupName(''); setSelectedUsers([]); setNewChatMode('direct')
      openConversation(conv.id)
    } catch (e) { showToast(e.message, 'error') }
  }, [selectedUser, api, openConversation, showToast])

  const startGroup = useCallback(async () => {
    if (!groupName.trim() || selectedUsers.length < 2) return
    try {
      const conv = await api('/conversations/group', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          member_ids: selectedUsers.map(u => u.id),
        }),
      })
      setConvs(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev])
      setShowNewConv(false); setSelectedUser(null); setUserSearch(''); setGroupName(''); setSelectedUsers([]); setNewChatMode('direct')
      openConversation(conv.id)
    } catch (e) { showToast(e.message, 'error') }
  }, [groupName, selectedUsers, api, openConversation, showToast])

  // ── Status ─────────────────────────────────────────────────────────────────
  const postStatus = useCallback(async () => {
    if (!statusText.trim()) return
    try {
      await api('/statuses', { method: 'POST', body: JSON.stringify({ type: 'text', content: statusText.trim(), media_url: null, bg_color: statusColor }) })
      setStatusText(''); loadStatuses(); showToast('Status posted')
    } catch (e) { showToast(e.message, 'error') }
  }, [statusText, statusColor, api, loadStatuses, showToast])

  const uploadStatusMedia = useCallback(async (file, type) => {
    try {
      const form = new FormData(); form.append('file', file)
      const data = await api('/media/upload', { method: 'POST', body: form })
      await api('/statuses', { method: 'POST', body: JSON.stringify({ type, content: null, media_url: data.url, bg_color: null }) })
      loadStatuses(); showToast('Status posted')
    } catch (e) { showToast(e.message, 'error') }
  }, [api, loadStatuses, showToast])

  const viewStatus = useCallback(async (statusId) => {
    try { await api(`/statuses/${statusId}/view`, { method: 'POST' }) ; loadStatuses() }
    catch {}
  }, [api, loadStatuses])

  const deleteStatus = useCallback(async (statusId) => {
    try { await api(`/statuses/${statusId}`, { method: 'DELETE' }); loadStatuses() }
    catch (e) { showToast(e.message, 'error') }
  }, [api, loadStatuses, showToast])

  // ── Settings ───────────────────────────────────────────────────────────────
  const blockUser = useCallback(async (userId) => {
    try {
      await api('/contacts/block', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
      showToast('User blocked')
    } catch (e) { showToast(e.message, 'error') }
  }, [api, showToast])

  const setDisappear = useCallback(async (seconds) => {
    if (!activeConvId) return
    try {
      await api(`/conversations/${activeConvId}/disappear`, { method: 'PATCH', body: JSON.stringify({ seconds }) })
      showToast('Disappear timer updated')
    } catch (e) { showToast(e.message, 'error') }
  }, [activeConvId, api, showToast])

  const setMute = useCallback(async (duration) => {
    if (!activeConvId) return
    try {
      await api(`/conversations/${activeConvId}/mute`, { method: 'POST', body: JSON.stringify({ duration }) })
      showToast(`Muted ${duration}`)
    } catch (e) { showToast(e.message, 'error') }
  }, [activeConvId, api, showToast])

  const clearMute = useCallback(async () => {
    if (!activeConvId) return
    try { await api(`/conversations/${activeConvId}/mute`, { method: 'DELETE' }); showToast('Unmuted') }
    catch (e) { showToast(e.message, 'error') }
  }, [activeConvId, api, showToast])

  // Close header menu on outside click
  useEffect(() => {
    if (!showHeaderMenu) return
    const handler = e => { if (!headerMenuRef.current?.contains(e.target)) setShowHeaderMenu(false) }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [showHeaderMenu])

  // Close reaction picker on outside click
  useEffect(() => {
    if (!showReactionPicker) return
    const handler = e => {
      if (!e.target.closest('.reaction-picker-popup') && !e.target.closest('.msg-long-press'))
        setShowReactionPicker(null)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [showReactionPicker])

  // ── Computed values ────────────────────────────────────────────────────────
  const activeConv = useMemo(() => convs.find(c => c.id === activeConvId) || null, [convs, activeConvId])
  const activeMsgs = msgsByConv[activeConvId] || []
  const otherMember = useMemo(() => activeConv?.members?.find(m => m.user_id !== me?.id) || null, [activeConv, me?.id])
  const convTitle = useMemo(() => activeConv?.type === 'group' ? (activeConv.name || 'Group') : (otherMember?.display_name || '…'), [activeConv, otherMember])
  const otherPresence = otherMember ? presenceMap[otherMember.user_id] : null

  const filteredConvs = useMemo(() =>
    convs.filter(c => {
      const name = c.type === 'group' ? (c.name || 'Group') : (c.members?.find(m => m.user_id !== me?.id)?.display_name || '…')
      return name.toLowerCase().includes(convSearch.toLowerCase())
    }), [convs, convSearch, me?.id])

  const callPeerName = useCallback((call) => {
    const peerId = call.caller_id === me?.id ? call.callee_id : call.caller_id
    const conv = convs.find(c => c.id === call.conversation_id)
    const peer = conv?.members?.find(m => m.user_id === peerId)
    return { peerId, name: peer?.display_name || 'Unknown user' }
  }, [convs, me?.id])

  const callPeerDisplayName = useMemo(() => {
    if (!callState.peerUserId) return 'Unknown'
    for (const conv of convs) {
      const peer = conv.members?.find(m => m.user_id === callState.peerUserId)
      if (peer) return peer.display_name || 'Unknown'
    }
    return 'Unknown'
  }, [callState.peerUserId, convs])

  const callBackUser = useCallback(async (userId) => {
    try {
      const conv = await api('/conversations/direct', { method: 'POST', body: JSON.stringify({ other_user_id: userId }) })
      setConvs(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev])
      setWorkspace('chats')
      await openConversation(conv.id)
      await startCall(userId)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [api, openConversation, showToast, startCall])

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderMessage = (msg, idx) => {
    const mine = msg.sender_id === me?.id
    const prev = activeMsgs[idx - 1]
    const showDate = !prev || fmtDate(prev.created_at) !== fmtDate(msg.created_at)
    const isOpt = String(msg.id).startsWith('tmp-')

    let body
    if (msg.deleted_at) {
      body = <span className="deleted-msg"><DeleteIcon /> This message was deleted</span>
    } else if (msg.type === 'image' && msg.media_url) {
      body = <img src={msg.media_url} alt="" className="msg-img" onClick={() => window.open(msg.media_url, '_blank')} />
    } else if (msg.type === 'video' && msg.media_url) {
      body = <video src={msg.media_url} controls className="msg-video" />
    } else if (msg.type === 'audio' && msg.media_url) {
      body = <audio src={msg.media_url} controls className="msg-audio" />
    } else if (msg.type === 'document' && msg.media_url) {
      body = <a href={msg.media_url} target="_blank" rel="noreferrer" className="msg-doc"><PaperclipIcon /> Document</a>
    } else if (msg.type === 'poll' && msg.poll_data) {
      let pd = {}; try { pd = JSON.parse(msg.poll_data) } catch {}
      body = (
        <div className="poll-card">
          <div className="poll-question">{pd.question || msg.content}</div>
          <div className="poll-options">
            {(pd.options || []).map((opt, i) => (
              <button key={i} className="poll-opt" onClick={() => votePoll(msg.id, i)}>{opt}</button>
            ))}
          </div>
        </div>
      )
    } else {
      body = <span>{msg.content}</span>
    }

    const reactions = msg.reactions && Object.keys(msg.reactions).length > 0
    const isGroup = activeConv?.type === 'group'
    const senderName = isGroup && !mine ? (activeConv?.members?.find(m => m.user_id === msg.sender_id)?.display_name || '…') : null

    return (
      <div key={msg.id}>
        {showDate && <div className="date-pill">{fmtDate(msg.created_at)}</div>}
        <div className={`msg-row ${mine ? 'mine' : 'theirs'} ${isOpt ? 'optimistic' : ''}`}>
          <div
            className="msg-bubble-wrap"
            onContextMenu={e => { e.preventDefault(); setReactionPickerPos({ x: e.clientX, y: e.clientY }); setShowReactionPicker(msg.id) }}
          >
            {senderName && <div className="msg-sender">{senderName}</div>}
            <div className="msg-bubble">
              {body}
              {mine && !msg.deleted_at && (
                <button className="msg-delete-btn" onClick={() => deleteMessage(msg.id)} title="Delete">×</button>
              )}
              {!msg.deleted_at && (
                <button className="msg-pin-btn" onClick={() => pinMessage(msg.id)} title="Pin">📌</button>
              )}
            </div>
            {reactions && (
              <div className="msg-reactions">
                {Object.entries(msg.reactions).map(([emoji, count]) => (
                  <button key={emoji} className="rxn-pill" onClick={() => reactToMessage(msg.id, emoji)}>
                    {emoji} <span>{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="msg-time">{fmtTime(msg.created_at)}{mine && (isOpt ? ' ·' : ' ✓')}</div>
        </div>
      </div>
    )
  }

  // ── Auth screen ────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-logo">Letta</div>
            <div className="auth-tagline">messaging without the noise</div>
          </div>
          {authStep === 'phone' && (
            <div className="auth-fields">
              <label>Phone number <span className="auth-hint">E.164 format</span></label>
              <input value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+254712345678" type="tel"
                onKeyDown={e => e.key === 'Enter' && requestOtp()} />
              <button onClick={requestOtp} disabled={authBusy}>{authBusy ? '...' : 'Send code'}</button>
            </div>
          )}
          {authStep === 'otp' && (
            <div className="auth-fields">
              <label>Verification code</label>
              <input value={authOtp} onChange={e => setAuthOtp(e.target.value)} placeholder="123456" maxLength={6} autoFocus
                onKeyDown={e => e.key === 'Enter' && verifyOtp()} />
              <button onClick={verifyOtp} disabled={authBusy}>{authBusy ? '...' : 'Verify'}</button>
              <button className="auth-back" onClick={() => setAuthStep('phone')}>← Back</button>
            </div>
          )}
          {authStep === 'profile' && (
            <div className="auth-fields">
              <label>Your name</label>
              <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Display name" autoFocus
                onKeyDown={e => e.key === 'Enter' && completeProfile()} />
              <button onClick={completeProfile} disabled={authBusy}>{authBusy ? '...' : 'Get started'}</button>
            </div>
          )}
          {authErr && <div className="auth-err">{authErr}</div>}
        </div>
      </div>
    )
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <div className={`app-shell ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>

      {/* Mobile overlay */}
      {mobileSidebarOpen && <div className="mobile-overlay" onClick={() => setMobileSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <span className="sidebar-wordmark">Letta</span>
          <div className="ws-dot" title={`${wsState}`} style={{ background: wsState === 'connected' ? '#4ade80' : wsState === 'connecting' ? '#fbbf24' : '#ef4444' }} />
        </div>

        <div className="sidebar-main">
          {workspace === 'chats' && (
            <div className="sidebar-search">
              <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search conversations…" />
            </div>
          )}

          {workspace === 'chats' && (
          <div className="conv-list">
            {filteredConvs.length === 0 && (
              <div className="empty-convs">No conversations yet.<br />Start one with the new chat button above.</div>
            )}
            {filteredConvs.map(c => {
              const isGroup = c.type === 'group'
              const other = c.members?.find(m => m.user_id !== me?.id)
              const name = isGroup ? (c.name || 'Group') : (other?.display_name || '…')
              const presence = other ? presenceMap[other.user_id] : null
              const lastMsg = c.last_message
              const preview = lastMsg?.deleted_at ? 'Deleted' : lastMsg?.type !== 'text' ? `${lastMsg?.type || 'Attachment'}` : (lastMsg?.content || '')
              return (
                <button key={c.id} className={`conv-item ${activeConvId === c.id ? 'active' : ''}`}
                  onClick={() => openConversation(c.id)}>
                  <div className="conv-avatar">
                    {initial(name)}
                    {presence?.online && <span className="online-pip" />}
                  </div>
                  <div className="conv-body">
                    <div className="conv-name-row">
                      <span className="conv-name">{name}</span>
                      <span className="conv-time">{fmtTime(lastMsg?.created_at)}</span>
                    </div>
                    <div className="conv-preview-row">
                      <span className="conv-preview">{preview}</span>
                      {!!c.unread_count && <span className="unread-badge">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          )}

          {workspace === 'status' && (
            <div className="status-sidebar">
              {/* My status row */}
              <button className="story-list-row my-story-row"
                onClick={() => setStatusComposerOpen(p => !p)}>
                <div className="story-list-avatar-wrap">
                  <div className="story-list-avatar mine">{initial(me?.display_name)}</div>
                  {statusMine.length > 0 && (
                    <StoryRing count={statusMine.length} viewedCount={0} size={50} />
                  )}
                  <span className="story-add-badge">+</span>
                </div>
                <div className="story-list-info">
                  <div className="story-list-name">My status</div>
                  <div className="story-list-sub">
                    {statusMine.length > 0
                      ? `${statusMine.length} update${statusMine.length > 1 ? 's' : ''} · tap to add`
                      : 'Add to my status'}
                  </div>
                </div>
              </button>

              {/* Inline compose */}
              {statusComposerOpen && (
                <div className="status-inline-compose">
                  <textarea
                    value={statusText}
                    onChange={e => setStatusText(e.target.value)}
                    placeholder="What's on your mind?"
                    rows={3}
                  />
                  <div className="compose-actions-row">
                    <input type="color" value={statusColor} onChange={e => setStatusColor(e.target.value)} title="Background color" />
                    <label className="attach-btn compact" title="Image">
                      <ImageIcon />
                      <input type="file" accept="image/*" hidden onChange={e => { e.target.files[0] && uploadStatusMedia(e.target.files[0], 'image'); setStatusComposerOpen(false) }} />
                    </label>
                    <label className="attach-btn compact" title="Video">
                      <VideoIcon />
                      <input type="file" accept="video/*" hidden onChange={e => { e.target.files[0] && uploadStatusMedia(e.target.files[0], 'video'); setStatusComposerOpen(false) }} />
                    </label>
                    <button className="status-post-btn" onClick={() => { postStatus(); setStatusComposerOpen(false) }} disabled={!statusText.trim()}>Post</button>
                  </div>
                </div>
              )}

              {/* My stories thumbnails */}
              {statusMine.length > 0 && (
                <div className="my-stories-strip">
                  {statusMine.map(s => (
                    <div key={s.id} className="my-story-thumb"
                      style={{ background: s.bg_color || '#1e1e21' }}
                      onClick={() => { setStoryViewerId(me?.id); setStoryViewerIndex(statusMine.indexOf(s)) }}>
                      {s.type === 'image' && <img src={s.media_url} alt="" />}
                      {s.type === 'text' && <span>{s.content?.slice(0, 30)}</span>}
                      <button className="my-story-thumb-del" onClick={e => { e.stopPropagation(); deleteStatus(s.id) }} title="Delete">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent updates */}
              {statusFeed.length > 0 && (
                <>
                  <div className="story-section-label">Recent updates</div>
                  {statusFeed.map(group => {
                    const viewedCount = group.statuses.filter(s => s.viewed).length
                    const latest = group.statuses[group.statuses.length - 1]
                    return (
                      <button key={group.user_id}
                        className={`story-list-row ${group.all_viewed ? 'viewed' : ''}`}
                        onClick={() => { setStoryViewerId(group.user_id); setStoryViewerIndex(0) }}>
                        <div className="story-list-avatar-wrap">
                          <div className={`story-list-avatar ${group.all_viewed ? 'viewed' : ''}`}>
                            {initial(group.display_name)}
                          </div>
                          <StoryRing
                            count={group.statuses.length}
                            viewedCount={viewedCount}
                            size={50}
                          />
                        </div>
                        <div className="story-list-info">
                          <div className="story-list-name">{group.display_name}</div>
                          <div className="story-list-sub">{fmtTime(latest?.created_at)}</div>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}

              {statusFeed.length === 0 && !statusComposerOpen && (
                <div className="empty-convs" style={{ marginTop: 12 }}>
                  No recent updates from contacts.
                </div>
              )}
            </div>
          )}

          {workspace === 'calls' && (
            <div className="calls-sidebar">
              <div className="sidebar-search">
                <input placeholder="Search calls…" />
              </div>
              <div className="call-list">
                {callsFeed.length === 0 && <div className="empty-convs">No calls yet.</div>}
                {callsFeed.map(call => {
                  const other = call.participants?.find(p => p.user_id !== me?.id)
                  return (
                    <button key={call.id} className="call-item">
                      <div className="call-avatar">{initial(other?.display_name)}</div>
                      <div className="call-info">
                        <div className="call-name">{other?.display_name}</div>
                        <div className="call-meta">{fmtTime(call.ended_at || call.started_at)}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {workspace === 'settings' && (
            <div className="settings-sidebar">
              <div className="sidebar-me">
                <div className="sidebar-me-avatar">{initial(me?.display_name)}</div>
                <div>
                  <div className="sidebar-me-name">{me?.display_name}</div>
                  <div className="sidebar-me-sub">{me?.phone_number}</div>
                </div>
              </div>
            </div>
          )}

          {workspace === 'chats' && showNewConv && (
            <div className="sidebar-drawer new-chat-drawer">
              <div className="drawer-head">
                <div>
                  <div className="drawer-kicker">New chat</div>
                  <div className="drawer-title">Start a direct conversation</div>
                </div>
                <button className="drawer-close" onClick={() => { setShowNewConv(false); setUserSearch(''); setSelectedUser(null); setGroupName(''); setSelectedUsers([]); setNewChatMode('direct') }}><CloseIcon /></button>
              </div>
              <div className="new-chat-body">
                <div className="new-chat-mode">
                  <button className={newChatMode === 'direct' ? 'active' : ''} onClick={() => { setNewChatMode('direct'); setSelectedUsers([]); setGroupName('') }}>Direct</button>
                  <button className={newChatMode === 'group' ? 'active' : ''} onClick={() => setNewChatMode('group')}>Group</button>
                </div>
                {newChatMode === 'group' && (
                  <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name…" />
                )}
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name…" autoFocus />
                <div className="new-chat-results">
                  {userResults.length === 0 && userSearch.trim().length >= 2 && (
                    <div className="new-chat-empty">No matches yet.</div>
                  )}
                  {userResults.map(u => (
                    <button key={u.id} className={`user-result ${(newChatMode === 'direct' ? selectedUser?.id === u.id : selectedUsers.some(s => s.id === u.id)) ? 'selected' : ''}`}
                      onClick={() => {
                        if (newChatMode === 'direct') {
                          setSelectedUser(u)
                          return
                        }
                        setSelectedUsers(prev => prev.some(s => s.id === u.id) ? prev.filter(s => s.id !== u.id) : [...prev, u])
                      }}>
                      <div className="user-result-avatar">{initial(u.display_name)}</div>
                      <div>
                        <div className="user-result-name">{u.display_name}</div>
                        {u.bio && <div className="user-result-bio">{u.bio}</div>}
                      </div>
                    </button>
                  ))}
                </div>
                {newChatMode === 'group' && selectedUsers.length > 0 && (
                  <div className="new-chat-picked">{selectedUsers.length} selected</div>
                )}
                <button
                  className="modal-action-btn"
                  disabled={newChatMode === 'direct' ? !selectedUser : (!groupName.trim() || selectedUsers.length < 2)}
                  onClick={newChatMode === 'direct' ? startDirect : startGroup}
                >
                  {newChatMode === 'direct'
                    ? `Start conversation${selectedUser ? ` with ${selectedUser.display_name}` : ''}`
                    : `Create group${groupName.trim() ? `: ${groupName.trim()}` : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-tabs">
          <button className={`tab-btn ${workspace === 'chats' ? 'active' : ''}`}
            onClick={() => setWorkspace('chats')} title="Chats">
            <MessagesIcon />
            <span>Chats</span>
          </button>
          <button className={`tab-btn ${workspace === 'status' ? 'active' : ''}`}
            onClick={() => setWorkspace('status')} title="Status">
            <StatusIcon />
            <span>Status</span>
          </button>
          <button className={`tab-btn ${workspace === 'calls' ? 'active' : ''}`}
            onClick={() => setWorkspace('calls')} title="Calls">
            <CallsIcon />
            <span>Calls</span>
          </button>
          <button className={`tab-btn ${workspace === 'settings' ? 'active' : ''}`}
            onClick={() => setWorkspace('settings')} title="Settings">
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* ── Story Carousel Viewer ── */}
      {storyViewerId && (() => {
        const isMine = storyViewerId === me?.id
        const group = isMine
          ? { user_id: me.id, display_name: me.display_name, statuses: statusMine }
          : statusFeed.find(g => g.user_id === storyViewerId)
        const story = group?.statuses?.[storyViewerIndex]
        if (!group || !story) return null
        return (
          <div className="story-viewer">
            {/* Progress bars */}
            <div className="story-progress">
              {group.statuses.map((_, i) => (
                <div
                  key={i === storyViewerIndex ? `active-${storyViewerIndex}` : i}
                  className={`progress-bar ${i < storyViewerIndex ? 'done' : i === storyViewerIndex ? 'active' : ''}`}
                />
              ))}
            </div>

            {/* Header */}
            <div className="story-header">
              <div className="story-avatar">{initial(group.display_name)}</div>
              <div className="story-info">
                <div className="story-name">{group.display_name}</div>
                <div className="story-time">{fmtTime(story.created_at)}</div>
              </div>
              {isMine && (
                <button className="story-delete-btn" onClick={() => deleteStatus(story.id)} title="Delete">
                  <DeleteIcon />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="story-content" style={{ '--sbg': story.bg_color || '#1e1e21' }}>
              {story.type === 'image' && <img src={story.media_url} alt="" />}
              {story.type === 'video' && <video src={story.media_url} autoPlay muted playsInline />}
              {story.type === 'text' && <div className="story-text">{story.content}</div>}
            </div>

            {/* Tap areas to navigate */}
            <div className="story-nav">
              <button className="nav-prev" onClick={() => {
                if (storyViewerIndex > 0) {
                  setStoryViewerIndex(storyViewerIndex - 1)
                } else {
                  const feed = statusFeedRef.current
                  const gIdx = isMine ? -1 : feed.findIndex(g => g.user_id === storyViewerId)
                  if (gIdx > 0) { setStoryViewerId(feed[gIdx - 1].user_id); setStoryViewerIndex(0) }
                }
              }} />
              <button className="nav-next" onClick={() => {
                const feed = statusFeedRef.current
                const currentGroup = isMine ? { statuses: statusMine } : feed.find(g => g.user_id === storyViewerId)
                if (!currentGroup) return
                if (storyViewerIndex < currentGroup.statuses.length - 1) {
                  setStoryViewerIndex(storyViewerIndex + 1)
                } else {
                  const gIdx = isMine ? -1 : feed.findIndex(g => g.user_id === storyViewerId)
                  if (gIdx >= 0 && gIdx < feed.length - 1) { setStoryViewerId(feed[gIdx + 1].user_id); setStoryViewerIndex(0) }
                  else setStoryViewerId(null)
                }
              }} />
            </div>

            <button className="story-close" onClick={() => setStoryViewerId(null)}><CloseIcon /></button>
          </div>
        )
      })()}


      {/* ── Main workspace ── */}
      {workspace === 'chats' && (
        <main className="chat-pane">
          {!activeConv ? (
              <div className="empty-state">
              <div className="empty-icon"><MessagesIcon /></div>
              <div className="empty-title">Letta</div>
              <div className="empty-sub">Select a conversation or start a new one.</div>
              <button className="empty-open-btn" onClick={() => setMobileSidebarOpen(true)}>Open chats</button>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button className="mobile-back-btn" onClick={() => { setMobileSidebarOpen(true) }}>←</button>
                <div className="chat-header-avatar">
                  {initial(convTitle)}
                  {otherPresence?.online && <span className="online-pip" />}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{convTitle}</div>
                  <div className="chat-header-sub">
                    {typingMap[activeConvId]
                      ? <span className="typing-anim">typing<span>.</span><span>.</span><span>.</span></span>
                      : otherPresence?.online ? <span className="online-text">online</span>
                        : otherPresence?.last_seen ? `last seen ${fmtTime(otherPresence.last_seen)}`
                          : activeConv.type === 'group' ? `${activeConv.members?.length || 0} members` : ''}
                  </div>
                </div>
                <div className="chat-header-actions">
                  {callState.active ? (
                    <button className="call-btn end-call" onClick={endCall} title="End call"><CallEndIcon /></button>
                  ) : otherMember && (
                    <button className="call-btn" onClick={() => startCall(otherMember.user_id)} title="Voice call"><CallsIcon /></button>
                  )}
                  <div className="header-menu-wrap" ref={headerMenuRef}>
                    <button className="icon-btn" onClick={() => setShowHeaderMenu(p => !p)}>⋯</button>
                    {showHeaderMenu && (
                      <div className="header-menu">
                        <button onClick={() => { setMute('1h'); setShowHeaderMenu(false) }}><MuteIcon /> Mute 1h</button>
                        <button onClick={() => { setMute('8h'); setShowHeaderMenu(false) }}><MuteIcon /> Mute 8h</button>
                        <button onClick={() => { clearMute(); setShowHeaderMenu(false) }}><BellIcon /> Unmute</button>
                        <div className="menu-divider" />
                        <button onClick={() => { setDisappear(3600); setShowHeaderMenu(false) }}><ClockIcon /> Disappear 1h</button>
                        <button onClick={() => { setDisappear(86400); setShowHeaderMenu(false) }}><ClockIcon /> Disappear 24h</button>
                        <button onClick={() => { setDisappear(null); setShowHeaderMenu(false) }}><ClockIcon /> Disappear off</button>
                        {otherMember && <>
                          <div className="menu-divider" />
                          <button className="danger" onClick={() => { blockUser(otherMember.user_id); setShowHeaderMenu(false) }}><BlockIcon /> Block user</button>
                        </>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {pins.length > 0 && (
                <div className="pins-bar">
                  📌
                  {pins.slice(0, 2).map(p => (
                    <button key={p.id} className="pin-item" onClick={() => unpinMessage(p.id)} title="Unpin">
                      {p.content || `[${p.type}]`}
                    </button>
                  ))}
                  {pins.length > 2 && <span className="pins-more">+{pins.length - 2} more</span>}
                </div>
              )}

              <div className="messages-area">
                <div className="messages-stack">
                  {activeMsgs.map((msg, i) => renderMessage(msg, i))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="chat-input-area">
                {composerMode === 'poll' && (
                  <div className="poll-composer">
                    <input className="poll-q-input" value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="Poll question…" />
                    <textarea className="poll-opts-input" value={pollOpts} onChange={e => setPollOpts(e.target.value)} placeholder="One option per line" rows={3} />
                    <button className="poll-cancel" onClick={() => setComposerMode('text')}>✕ Cancel</button>
                  </div>
                )}
                <div className="input-row">
                  <div className="input-actions-left">
                    <label className="attach-btn" title="Attach file">
                      <PaperclipIcon />
                      <input type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                        onChange={e => e.target.files[0] && uploadMedia(e.target.files[0])} />
                    </label>
                    <button className="attach-btn poll-toggle" title="Poll" onClick={() => setComposerMode(m => m === 'poll' ? 'text' : 'poll')}><PollIcon /></button>
                  </div>
                  <textarea
                    className="msg-input"
                    value={draft}
                    onChange={e => { onDraftChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Message…"
                    rows={1}
                  />
                  <button className="send-btn" onClick={sendMessage}><SendIcon /></button>
                </div>
              </div>
            </>
          )}
        </main>
      )}

      {workspace === 'status' && (
        <main className="space-pane status-welcome">
          <div className="status-welcome-inner">
            <div className="empty-icon"><StatusIcon /></div>
            <div className="empty-title">Status</div>
            <div className="empty-sub">Select someone's update to view it, or tap your status on the left to add one.</div>
          </div>
        </main>
      )}

      {workspace === 'calls' && (
        <main className="space-pane">
          <div className="space-head">
            <h2>Calls</h2>
            <p>Recent call activity and quick redial.</p>
          </div>
          <div className="space-content calls-space">
            {callsBusy && <div className="empty-convs">Loading calls…</div>}
            {!callsBusy && callsFeed.length === 0 && <div className="empty-convs">No call history yet.</div>}
            {!callsBusy && callsFeed.map(call => {
              const peer = callPeerName(call)
              const ts = call.ended_at || call.answered_at || call.started_at
              return (
                <div key={call.id} className="call-log-item">
                  <div className="call-log-main">
                    <div className="call-log-name">{peer.name}</div>
                    <div className="call-log-sub">{call.status} · {fmtTime(ts)}</div>
                  </div>
                  <button className="call-btn" onClick={() => callBackUser(peer.peerId)} title="Call back"><CallsIcon /></button>
                </div>
              )
            })}
          </div>
        </main>
      )}

      {workspace === 'settings' && (
        <main className="space-pane">
          <div className="space-head">
            <h2>Settings</h2>
            <p>Profile, privacy and notification controls.</p>
          </div>
          <div className="space-content settings-space">
            <div className="settings-panel">
              <div className="settings-avatar">{initial(me?.display_name)}</div>
              <div className="settings-name">{me?.display_name}</div>
              <div className="settings-phone">{me?.phone_number}</div>

              <div className="settings-section">
                <div className="settings-section-title">Notifications</div>
                <label className="settings-toggle">
                  <span>Read receipts</span>
                  <input type="checkbox" defaultChecked={!!me?.receipts_visible}
                    onChange={async e => { try { await api('/auth/users/me', { method: 'PATCH', body: JSON.stringify({ receipts_visible: e.target.checked }) }); setMe(p => ({ ...p, receipts_visible: e.target.checked })) } catch {} }} />
                </label>
                <label className="settings-toggle">
                  <span>Presence visible</span>
                  <input type="checkbox" defaultChecked={!!me?.presence_visible}
                    onChange={async e => { try { await api('/auth/users/me', { method: 'PATCH', body: JSON.stringify({ presence_visible: e.target.checked }) }); setMe(p => ({ ...p, presence_visible: e.target.checked })) } catch {} }} />
                </label>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Focus mode</div>
                <div className="focus-btns">
                  {['normal', 'quiet', 'off'].map(f => (
                    <button key={f} className={`focus-btn ${focusProfile === f ? 'active' : ''}`}
                      onClick={async () => { try { await api('/users/me/focus', { method: 'PATCH', body: JSON.stringify({ profile: f }) }); setFocusProfile(f) } catch (e) { showToast(e.message, 'error') } }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <button className="signout-btn" onClick={() => {
                setToken(null); setRefreshTok(null); tokenRef.current = null; refreshRef.current = null
                setMe(null); setConvs([]); setMsgsByConv({}); setActiveConvId(null)
                if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
              }}>Sign out</button>
            </div>
          </div>
        </main>
      )}

      {/* ── Reaction picker popup ── */}
      {workspace === 'chats' && showReactionPicker && (
        <div className="reaction-picker-popup" style={{ left: reactionPickerPos.x, top: reactionPickerPos.y }}>
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => reactToMessage(showReactionPicker, e)}>{e}</button>
          ))}
        </div>
      )}

      {/* ── Incoming call overlay ── */}
      {callState.status === 'ringing' && callState.incoming && (
        <div className="call-overlay">
          <div className="call-card">
            <div className="call-ring-anim"><RingIcon /></div>
            <div className="call-title">Incoming call</div>
            <div className="call-sub">Audio call</div>
            <div className="call-btns">
              <button className="call-decline" onClick={rejectCall}>Decline</button>
              <button className="call-accept" onClick={answerCall}>Answer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active call fullscreen ── */}
      {callState.active && callState.status !== 'idle' && callState.status !== 'ringing' && (
        <div className="call-fullscreen">
          <div className="call-fs-bg" />
          <div className="call-fs-body">
            <div className="call-fs-avatar">{initial(callPeerDisplayName)}</div>
            <div className="call-fs-name">{callPeerDisplayName}</div>
            <div className="call-fs-status">
              {callState.status === 'calling'
                ? 'Calling…'
                : callState.status === 'connected'
                  ? fmtDuration(callDuration)
                  : 'Connecting…'}
            </div>
            <div className="call-fs-controls">
              <div className="call-ctrl-group">
                <button className={`call-ctrl-btn ${callMuted ? 'active' : ''}`} onClick={toggleMute}>
                  {callMuted ? <MicOffIcon /> : <MicIcon />}
                  <span>{callMuted ? 'Unmute' : 'Mute'}</span>
                </button>
                <button className="call-ctrl-btn end" onClick={endCall}>
                  <CallEndIcon />
                  <span>End call</span>
                </button>
                <button className="call-ctrl-btn">
                  <SpeakerIcon />
                  <span>Speaker</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}