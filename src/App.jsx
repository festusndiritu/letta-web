import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IncomingCallOverlay, ActiveCallScreen, PostCallScreen } from './components/overlays/CallScreens'
import StoryViewer from './components/overlays/StoryViewer'
import StatusSidebar from './components/status/StatusSidebar'
import {
  BellIcon,
  BlockIcon,
  CallEndIcon,
  CallsIcon,
  ClockIcon,
  CloseIcon,
  CopyIcon,
  DeleteIcon,
  IncomingCallIcon,
  MessagesIcon,
  MissedCallIcon,
  MuteIcon,
  OutgoingCallIcon,
  PaperclipIcon,
  PinActionIcon,
  PollIcon,
  ReplyIcon,
  SendIcon,
  SettingsIcon,
  StatusIcon,
} from './components/ui/Icons'
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
  const [messageMenu, setMessageMenu] = useState(null) // { msgId, x, y }
  const [replyTarget, setReplyTarget] = useState(null)
  const [redialPrompt, setRedialPrompt] = useState(null)
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
  const [postCallSummary, setPostCallSummary] = useState(null)

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
  const callStateRef = useRef(callState)
  const callDurationRef = useRef(callDuration)
  const callPeerNameRef = useRef('Unknown')

  // Keep refs in sync
  useEffect(() => { tokenRef.current = token; store.set('letta_token', token) }, [token])
  useEffect(() => { refreshRef.current = refreshTok; store.set('letta_refresh', refreshTok) }, [refreshTok])
  useEffect(() => { activeConvIdRef.current = activeConvId }, [activeConvId])
  useEffect(() => { statusFeedRef.current = statusFeed }, [statusFeed])
  useEffect(() => { callStateRef.current = callState }, [callState])
  useEffect(() => { callDurationRef.current = callDuration }, [callDuration])

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
        loadCalls()
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
      sendWs('message.send', {
        conversation_id: activeConvId,
        type: 'poll',
        content: pollQ.trim(),
        poll_data: JSON.stringify({ question: pollQ.trim(), options, multiple_choice: false }),
        reply_to_id: replyTarget?.id || null,
      })
      setPollQ('')
      setReplyTarget(null)
      return
    }

    const content = draft.trim()
    if (!content) return
    const optimisticId = `tmp-${Date.now()}`
    setMsgsByConv(prev => ({
      ...prev,
      [activeConvId]: [
        ...(prev[activeConvId] || []),
        {
          id: optimisticId,
          conversation_id: activeConvId,
          sender_id: me?.id,
          type: 'text',
          content,
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to_id: replyTarget?.id || null,
        },
      ],
    }))
    setDraft('')
    sendWs('message.send', { conversation_id: activeConvId, type: 'text', content, reply_to_id: replyTarget?.id || null })
    setReplyTarget(null)
    sendWs('typing.stop', { conversation_id: activeConvId })
    if (typingOutTimer.current) { clearTimeout(typingOutTimer.current); typingOutTimer.current = null }
  }, [activeConvId, composerMode, draft, pollQ, pollOpts, me?.id, replyTarget, sendWs, showToast])

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
      sendWs('message.send', { conversation_id: activeConvId, type, content: null, media_url: data.url, media_mime: mime, reply_to_id: replyTarget?.id || null })
      setReplyTarget(null)
    } catch (e) { showToast('Upload failed: ' + e.message, 'error') }
  }, [activeConvId, api, replyTarget, sendWs, showToast])

  // ── Calls ──────────────────────────────────────────────────────────────────
  const teardownCall = useCallback(() => {
    const currentCall = callStateRef.current
    if (currentCall.active && currentCall.status !== 'idle' && currentCall.status !== 'ringing') {
      const seconds = callDurationRef.current
      setPostCallSummary({
        peerName: callPeerNameRef.current,
        peerUserId: currentCall.peerUserId,
        duration: seconds,
        durationLabel: seconds > 0 ? fmtDuration(seconds) : '00:00',
        label: currentCall.status === 'connected' ? 'Completed call' : 'Call ended',
      })
    }
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

  const playRingtoneBurst = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const times = [0, 0.18, 0.42]
      const notes = [880, 1174, 1046]
      notes.forEach((note, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = index === 1 ? 'triangle' : 'sine'
        osc.frequency.value = note
        gain.gain.value = 0.0001
        osc.connect(gain)
        gain.connect(ctx.destination)
        const startAt = ctx.currentTime + times[index]
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22)
        osc.start(startAt)
        osc.stop(startAt + 0.24)
      })
      setTimeout(() => ctx.close().catch(() => {}), 900)
    } catch {}
  }, [])

  // Ring tone for incoming calls
  useEffect(() => {
    if (callState.status !== 'ringing') {
      if (ringRef.current) { clearInterval(ringRef.current); ringRef.current = null }
      return
    }
    playRingtoneBurst()
    ringRef.current = setInterval(playRingtoneBurst, 2600)
  }, [callState.status, playRingtoneBurst])

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
    const isMine = storyViewerId === me?.id
    const feed = statusFeedRef.current
    const group = isMine ? { user_id: me?.id, statuses: statusMine } : feed.find(g => g.user_id === storyViewerId)
    const story = group?.statuses?.[storyViewerIndex]
    if (!isMine && story?.id) viewStatus(story.id)
    const timer = setTimeout(() => {
      const currentFeed = statusFeedRef.current
      const currentGroup = isMine ? { statuses: statusMine } : currentFeed.find(g => g.user_id === storyViewerId)
      if (!currentGroup) { setStoryViewerId(null); return }
      if (storyViewerIndex < currentGroup.statuses.length - 1) {
        setStoryViewerIndex(storyViewerIndex + 1)
      } else {
        const gIdx = isMine ? -1 : currentFeed.findIndex(g => g.user_id === storyViewerId)
        if (gIdx >= 0 && gIdx < currentFeed.length - 1) {
          setStoryViewerId(currentFeed[gIdx + 1].user_id)
          setStoryViewerIndex(0)
        } else {
          setStoryViewerId(null)
        }
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [storyViewerId, storyViewerIndex, me?.id, statusMine, viewStatus])

  const startCall = useCallback(async (calleeId) => {
    if (!activeConvId || !calleeId) return
    const callId = crypto.randomUUID()
    try {
      setPostCallSummary(null)
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
      setPostCallSummary(null)
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
    loadCalls()
    teardownCall()
  }, [callState.callId, loadCalls, sendWs, teardownCall])

  const endCall = useCallback(() => {
    if (callState.callId) sendWs('call.end', { call_id: callState.callId })
    loadCalls()
    teardownCall()
  }, [callState.callId, loadCalls, sendWs, teardownCall])

  // ── Messaging actions ──────────────────────────────────────────────────────
  const reactToMessage = useCallback(async (msgId, emoji) => {
    setMessageMenu(null)
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

  // Close message menu on outside click
  useEffect(() => {
    if (!messageMenu) return
    const handler = e => {
      if (!e.target.closest('.message-menu-popup')) setMessageMenu(null)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [messageMenu])

  // ── Computed values ────────────────────────────────────────────────────────
  const activeConv = useMemo(() => convs.find(c => c.id === activeConvId) || null, [convs, activeConvId])
  const activeMsgs = msgsByConv[activeConvId] || []
  const activeMsgMap = useMemo(() => Object.fromEntries(activeMsgs.map(msg => [String(msg.id), msg])), [activeMsgs])
  const otherMember = useMemo(() => activeConv?.members?.find(m => m.user_id !== me?.id) || null, [activeConv, me?.id])
  const convTitle = useMemo(() => activeConv?.type === 'group' ? (activeConv.name || 'Group') : (otherMember?.display_name || '…'), [activeConv, otherMember])
  const otherPresence = otherMember ? presenceMap[otherMember.user_id] : null

  const latestCallByConv = useMemo(() => {
    const next = {}
    for (const call of callsFeed) {
      const current = next[call.conversation_id]
      if (!current || new Date(call.started_at) > new Date(current.started_at)) next[call.conversation_id] = call
    }
    return next
  }, [callsFeed])

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

  useEffect(() => { callPeerNameRef.current = callPeerDisplayName }, [callPeerDisplayName])

  const mobileSidebarVisible = mobileSidebarOpen || workspace !== 'chats' || !activeConvId

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

  const copyMessage = useCallback(async (msg) => {
    const text = msg.content || msg.media_url || ''
    if (!text) {
      showToast('Nothing to copy', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied')
    } catch {
      showToast('Copy failed', 'error')
    }
  }, [showToast])

  const promptReply = useCallback((msg) => {
    setReplyTarget(msg)
    setMessageMenu(null)
  }, [])

  const openMessageMenu = useCallback((event, msgId) => {
    event.preventDefault()
    setMessageMenu({ msgId, x: event.clientX, y: event.clientY })
  }, [])

  const callMeta = useCallback((call) => {
    const outgoing = call.caller_id === me?.id
    const missed = call.status === 'missed' || call.status === 'rejected'
    const durationSeconds = Number(call.duration_seconds || 0)
    const timeLabel = fmtTime(call.started_at)
    if (missed) {
      return {
        align: outgoing ? 'mine' : 'theirs',
        directionLabel: outgoing ? 'Missed outgoing call' : 'Missed incoming call',
        icon: 'missed',
        durationLabel: null,
        timeLabel,
      }
    }
    return {
      align: outgoing ? 'mine' : 'theirs',
      directionLabel: outgoing ? 'Outgoing call' : 'Incoming call',
      icon: outgoing ? 'outgoing' : 'incoming',
      durationLabel: durationSeconds > 0 ? fmtDuration(durationSeconds) : null,
      timeLabel,
    }
  }, [fmtTime, fmtDuration, me?.id])

  const activeTimeline = useMemo(() => {
    const messageItems = activeMsgs.map(msg => ({ kind: 'message', id: `msg-${msg.id}`, created_at: msg.created_at, msg }))
    const callItems = callsFeed
      .filter(call => call.conversation_id === activeConvId)
      .map(call => ({ kind: 'call', id: `call-${call.id}`, created_at: call.started_at, call }))
    return [...messageItems, ...callItems].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }, [activeConvId, activeMsgs, callsFeed])

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderMessage = (msg, idx) => {
    const mine = msg.sender_id === me?.id
    const prev = activeTimeline[idx - 1]
    const prevCreatedAt = prev ? (prev.kind === 'message' ? prev.msg.created_at : prev.call.started_at) : null
    const showDate = !prevCreatedAt || fmtDate(prevCreatedAt) !== fmtDate(msg.created_at)
    const isOpt = String(msg.id).startsWith('tmp-')
    const repliedMsg = msg.reply_to_id ? activeMsgMap[String(msg.reply_to_id)] : null

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
            onContextMenu={e => openMessageMenu(e, msg.id)}
            onDoubleClick={() => promptReply(msg)}
          >
            {senderName && <div className="msg-sender">{senderName}</div>}
            <div className="msg-bubble">
              {repliedMsg && (
                <button className="msg-reply-ref" onClick={() => setReplyTarget(repliedMsg)}>
                  <span className="msg-reply-label">Replying to</span>
                  <span className="msg-reply-snippet">{repliedMsg.content || repliedMsg.type || 'Attachment'}</span>
                </button>
              )}
              {body}
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

  const renderCallBubble = (call, idx) => {
    const meta = callMeta(call)
    const prev = activeTimeline[idx - 1]
    const prevCreatedAt = prev ? (prev.kind === 'message' ? prev.msg.created_at : prev.call.started_at) : null
    const showDate = !prevCreatedAt || fmtDate(prevCreatedAt) !== fmtDate(call.started_at)
    const IconComp = meta.icon === 'missed' ? MissedCallIcon : meta.icon === 'incoming' ? IncomingCallIcon : OutgoingCallIcon
    const peer = callPeerName(call)

    return (
      <div key={`call-${call.id}`}>
        {showDate && <div className="date-pill">{fmtDate(call.started_at)}</div>}
        <div className={`msg-row ${meta.align}`}>
          <button className="call-bubble" onClick={() => setRedialPrompt({ peerId: peer.peerId, peerName: peer.name, call })}>
            <div className={`call-bubble-icon ${meta.icon}`}><IconComp /></div>
            <div className="call-bubble-copy">
              <div className="call-bubble-title">{meta.directionLabel}</div>
              <div className="call-bubble-sub">
                {meta.timeLabel}
                {meta.durationLabel ? ` · ${meta.durationLabel}` : ''}
              </div>
            </div>
          </button>
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
    <div className={`app-shell ${mobileSidebarVisible ? 'sidebar-open' : ''} ${workspace !== 'chats' ? 'mobile-workspace-open' : ''}`}>

      {/* Mobile overlay */}
      {mobileSidebarOpen && workspace === 'chats' && <div className="mobile-overlay" onClick={() => setMobileSidebarOpen(false)} />}

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
              const latestCall = latestCallByConv[c.id]
              const lastMsgAt = lastMsg?.created_at ? new Date(lastMsg.created_at) : null
              const latestCallAt = latestCall?.started_at ? new Date(latestCall.started_at) : null
              const useCallPreview = latestCallAt && (!lastMsgAt || latestCallAt > lastMsgAt)
              const preview = useCallPreview
                ? `${latestCall.caller_id === me?.id ? 'Outgoing' : 'Incoming'} call${latestCall.duration_seconds ? ` · ${fmtDuration(latestCall.duration_seconds)}` : ''}`
                : lastMsg?.deleted_at ? 'Deleted' : lastMsg?.type !== 'text' ? `${lastMsg?.type || 'Attachment'}` : (lastMsg?.content || '')
              const previewTime = useCallPreview ? latestCall.started_at : lastMsg?.created_at
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
                      <span className="conv-time">{fmtTime(previewTime)}</span>
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
            <StatusSidebar
              deleteStatus={deleteStatus}
              fmtTime={fmtTime}
              initial={initial}
              me={me}
              postStatus={postStatus}
              setStatusColor={setStatusColor}
              setStatusComposerOpen={setStatusComposerOpen}
              setStatusText={setStatusText}
              setStoryViewerId={setStoryViewerId}
              setStoryViewerIndex={setStoryViewerIndex}
              statusColor={statusColor}
              statusComposerOpen={statusComposerOpen}
              statusFeed={statusFeed}
              statusMine={statusMine}
              statusText={statusText}
              uploadStatusMedia={uploadStatusMedia}
            />
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

      <StoryViewer
        deleteStatus={deleteStatus}
        fmtTime={fmtTime}
        initial={initial}
        me={me}
        setStoryViewerId={setStoryViewerId}
        setStoryViewerIndex={setStoryViewerIndex}
        statusFeed={statusFeed}
        statusFeedRef={statusFeedRef}
        statusMine={statusMine}
        storyViewerId={storyViewerId}
        storyViewerIndex={storyViewerIndex}
      />


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
                  {activeTimeline.map((item, i) => item.kind === 'message' ? renderMessage(item.msg, i) : renderCallBubble(item.call, i))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="chat-input-area">
                {replyTarget && (
                  <div className="reply-composer-bar">
                    <div className="reply-composer-copy">
                      <span className="reply-composer-label">Replying to</span>
                      <span className="reply-composer-snippet">{replyTarget.content || replyTarget.type || 'Attachment'}</span>
                    </div>
                    <button className="reply-composer-close" onClick={() => setReplyTarget(null)}><CloseIcon /></button>
                  </div>
                )}
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

      {workspace === 'chats' && messageMenu && (
        <div className="message-menu-popup" style={{ left: messageMenu.x, top: messageMenu.y }}>
          <div className="message-menu-section reactions">
            {QUICK_EMOJIS.map(e => (
              <button key={e} onClick={() => reactToMessage(messageMenu.msgId, e)}>{e}</button>
            ))}
          </div>
          <div className="message-menu-section actions">
            {(() => {
              const msg = activeMsgMap[String(messageMenu.msgId)]
              if (!msg) return null
              return (
                <>
                  <button onClick={() => promptReply(msg)}><ReplyIcon /> Reply</button>
                  <button onClick={() => { copyMessage(msg); setMessageMenu(null) }}><CopyIcon /> Copy</button>
                  <button onClick={() => { pinMessage(msg.id); setMessageMenu(null) }}><PinActionIcon /> Pin</button>
                  <button onClick={() => { deleteMessage(msg.id); setMessageMenu(null) }} className="danger"><DeleteIcon /> Delete</button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {redialPrompt && (
        <div className="confirm-overlay" onClick={() => setRedialPrompt(null)}>
          <div className="confirm-card" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Call again?</div>
            <div className="confirm-copy">Redial {redialPrompt.peerName} from this call event.</div>
            <div className="confirm-actions">
              <button className="confirm-btn ghost" onClick={() => setRedialPrompt(null)}>Cancel</button>
              <button className="confirm-btn" onClick={() => { callBackUser(redialPrompt.peerId); setRedialPrompt(null) }}>Call</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Incoming call overlay ── */}
      {callState.status === 'ringing' && callState.incoming && (
        <IncomingCallOverlay answerCall={answerCall} rejectCall={rejectCall} />
      )}

      {callState.active && callState.status !== 'idle' && callState.status !== 'ringing' && (
        <ActiveCallScreen
          callDuration={callDuration}
          callMuted={callMuted}
          callPeerDisplayName={callPeerDisplayName}
          callState={callState}
          endCall={endCall}
          fmtDuration={fmtDuration}
          toggleMute={toggleMute}
        />
      )}

      <PostCallScreen
        onCallAgain={callBackUser}
        onClose={() => setPostCallSummary(null)}
        summary={postCallSummary}
      />

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}