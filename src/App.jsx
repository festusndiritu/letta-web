import { useEffect, useMemo, useRef, useState } from 'react'
import { API, EMOJIS, RTC_CONFIG, WS_BASE } from './config/chat'
import './styles/app.css'
import { formatDate, formatTime, initials } from './utils/formatters'
import { readStorage, writeStorage } from './utils/storage'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 980px)'

function App() {
  const [token, setToken] = useState(() => readStorage('letta_token'))
  const [refreshToken, setRefreshToken] = useState(() => readStorage('letta_refresh'))
  const [setupToken, setSetupToken] = useState(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authStep, setAuthStep] = useState('phone')
  const [authError, setAuthError] = useState('')

  const [me, setMe] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messagesByConv, setMessagesByConv] = useState({})
  const [messageDraft, setMessageDraft] = useState('')
  const [messageStatusById, setMessageStatusById] = useState({})
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('Option 1\nOption 2')
  const [composerType, setComposerType] = useState('text')
  const [typingMap, setTypingMap] = useState({})
  const [presenceMap, setPresenceMap] = useState({})

  const [searchConversations, setSearchConversations] = useState('')
  const [showNewConv, setShowNewConv] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [memberToAdd, setMemberToAdd] = useState(null)
  const [groupUserSearch, setGroupUserSearch] = useState('')
  const [groupUserResults, setGroupUserResults] = useState([])

  const [pins, setPins] = useState([])
  const [statusesFeed, setStatusesFeed] = useState([])
  const [statusesMine, setStatusesMine] = useState([])
  const [statusText, setStatusText] = useState('')
  const [statusColor, setStatusColor] = useState('#1e1e21')
  const [leftTab, setLeftTab] = useState('chats')
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return !window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
  })

  const [focusProfile, setFocusProfile] = useState('normal')
  const [wsState, setWsState] = useState('offline')
  const [toast, setToast] = useState(null)
  const [callState, setCallState] = useState({
    active: false,
    incoming: null,
    callId: null,
    status: 'idle',
    localReady: false,
    remoteReady: false,
    peerUserId: null,
    muted: false,
    outputDeviceId: 'default',
  })
  const [audioOutputs, setAudioOutputs] = useState([])

  const wsRef = useRef(null)
  const wsReconnectRef = useRef(null)
  const wsHeartbeatRef = useRef(null)
  const wsAttemptsRef = useRef(0)
  const typingOutRef = useRef(null)
  const lastEventIsoRef = useRef(readStorage('letta_last_event_iso', new Date(0).toISOString()))
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const ringTimerRef = useRef(null)
  const vibrateTimerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const bootstrapRef = useRef(null)
  const searchUsersRef = useRef(null)
  const apiRef = useRef(null)
  const loadStatusesRef = useRef(null)
  const startIncomingAlertRef = useRef(null)
  const callStateRef = useRef(callState)
  const activeConvIdRef = useRef(activeConvId)
  const messagesAreaRef = useRef(null)

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId],
  )
  const activeMessages = messagesByConv[activeConvId] || []

  function pushToast(message, type = '') {
    setToast({ message, type })
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
  }

  function clearSession() {
    setToken(null)
    setRefreshToken(null)
    setMe(null)
    setConversations([])
    setMessagesByConv({})
    setActiveConvId(null)
    closeWebSocket()
    teardownCall()
  }

  function startIncomingAlert() {
    stopIncomingAlert()

    const beep = () => {
      try {
        const ctx = new window.AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.value = 0.05
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        setTimeout(() => {
          osc.stop()
          void ctx.close()
        }, 180)
      } catch {
        // Ignore autoplay restrictions.
      }
    }

    beep()
    ringTimerRef.current = setInterval(beep, 2000)

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
      vibrateTimerRef.current = setInterval(() => {
        navigator.vibrate([200, 100, 200])
      }, 2000)
    }
  }

  function stopIncomingAlert() {
    if (ringTimerRef.current) clearInterval(ringTimerRef.current)
    if (vibrateTimerRef.current) clearInterval(vibrateTimerRef.current)
    ringTimerRef.current = null
    vibrateTimerRef.current = null
    if (navigator.vibrate) navigator.vibrate(0)
  }

  function upsertMessageInConversations(messageId, mapper) {
    setMessagesByConv((prev) => {
      const next = { ...prev }
      for (const [convId, list] of Object.entries(next)) {
        const idx = list.findIndex((m) => m.id === messageId)
        if (idx === -1) continue
        const updated = mapper(list[idx])
        if (!updated) return prev
        const copy = [...list]
        copy[idx] = updated
        next[convId] = copy
        return next
      }
      return prev
    })
  }

  function applyReaction(messageId, emoji, delta, actorId = null) {
    upsertMessageInConversations(messageId, (msg) => {
      const reactions = { ...(msg.reactions || {}) }
      const current = reactions[emoji] || 0
      const next = current + delta
      if (next <= 0) delete reactions[emoji]
      else reactions[emoji] = next
      return {
        ...msg,
        reactions,
        my_reaction: actorId && actorId === me?.id ? (delta < 0 ? null : emoji) : msg.my_reaction,
      }
    })
  }

  async function tryRefresh() {
    if (!refreshToken) return false
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (!data.access_token) return false
      setToken(data.access_token)
      setRefreshToken(data.refresh_token)
      return true
    } catch {
      return false
    }
  }

  async function api(path, opts = {}, retry = true) {
    const headers = { ...(opts.headers || {}) }
    if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API}${path}`, { ...opts, headers })
    if (res.status === 401 && retry && refreshToken) {
      const ok = await tryRefresh()
      if (ok) return api(path, opts, false)
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  async function bootstrap() {
    try {
      const meData = await api('/auth/users/me')
      setMe(meData)
      setFocusProfile(meData?.focus_profile || 'normal')
      const list = await api('/conversations')
      setConversations(list)
      connectWebSocket(token)
    } catch (err) {
      pushToast(err.message, 'error')
      clearSession()
    }
  }

  function closeWebSocket() {
    if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current)
    if (wsHeartbeatRef.current) clearInterval(wsHeartbeatRef.current)
    wsReconnectRef.current = null
    wsHeartbeatRef.current = null
    const ws = wsRef.current
    wsRef.current = null
    if (ws) {
      ws.onclose = null
      ws.close()
    }
    setWsState('offline')
  }

  async function ensureLocalMedia() {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localStreamRef.current = stream
    setCallState((prev) => ({ ...prev, localReady: true }))
    return stream
  }

  function createPeerConnection(callId, peerUserId) {
    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }

    const pc = new RTCPeerConnection(RTC_CONFIG)
    peerRef.current = pc

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      sendWs('call.ice_candidate', {
        call_id: callId,
        target_user_id: peerUserId,
        candidate: event.candidate,
      })
    }

    pc.ontrack = (event) => {
      const stream = event.streams?.[0]
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream
      }
      setCallState((prev) => ({ ...prev, remoteReady: true }))
    }

    return pc
  }

  function teardownCall() {
    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    setCallState({
      active: false,
      incoming: null,
      callId: null,
      status: 'idle',
      localReady: false,
      remoteReady: false,
      peerUserId: null,
    })
  }

  function connectWebSocket(accessToken) {
    closeWebSocket()
    setWsState('connecting')
    const ws = new WebSocket(`${WS_BASE}?token=${accessToken}`)
    wsRef.current = ws

    ws.onopen = () => {
      wsAttemptsRef.current = 0
      setWsState('connected')
      wsHeartbeatRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping', payload: {} }))
        }
      }, 30000)
      void recoverMissedMessages()

      const call = callStateRef.current
      if (call.active && call.callId) {
        setCallState((prev) => ({ ...prev, status: prev.remoteReady ? 'connected' : 'reconnecting' }))
        const localSdp = peerRef.current?.localDescription?.sdp
        if (localSdp && call.peerUserId) {
          sendWs('call.offer', {
            call_id: call.callId,
            conversation_id: activeConvIdRef.current,
            callee_id: call.peerUserId,
            type: 'audio',
            sdp: localSdp,
          })
        }
      }
    }

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data)
        if (packet?.payload?.created_at) {
          lastEventIsoRef.current = packet.payload.created_at
          writeStorage('letta_last_event_iso', lastEventIsoRef.current)
        }
        handleWsPacket(packet)
      } catch {
        pushToast('Received malformed websocket event', 'error')
      }
    }

    ws.onclose = () => {
      setWsState('offline')
      if (callStateRef.current.active) {
        setCallState((prev) => ({ ...prev, status: 'reconnecting' }))
      }
      if (wsHeartbeatRef.current) clearInterval(wsHeartbeatRef.current)
      wsHeartbeatRef.current = null
      const attempts = Math.min(wsAttemptsRef.current + 1, 6)
      wsAttemptsRef.current = attempts
      const backoff = Math.min(30000, 1000 * (2 ** attempts))
      wsReconnectRef.current = setTimeout(() => {
        if (token) connectWebSocket(token)
      }, backoff)
    }

    ws.onerror = () => setWsState('offline')
  }

  async function recoverMissedMessages() {
    try {
      const missed = await api(`/messages/missed?since=${encodeURIComponent(lastEventIsoRef.current)}`)
      if (!Array.isArray(missed) || !missed.length) return

      setMessagesByConv((prev) => {
        const next = { ...prev }
        for (const m of missed) {
          if (!next[m.conversation_id]) next[m.conversation_id] = []
          const exists = next[m.conversation_id].some((x) => x.id === m.id)
          if (!exists) next[m.conversation_id] = [...next[m.conversation_id], m]
        }
        return next
      })

      setConversations((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]))
        for (const m of missed) {
          const c = map.get(m.conversation_id)
          if (c) map.set(m.conversation_id, { ...c, last_message: m })
        }
        return Array.from(map.values())
      })
    } catch {
      pushToast('Missed-message sync failed', 'error')
    }
  }

  function sendWs(type, payload) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      pushToast('WebSocket disconnected, retrying...', 'error')
      if (token) connectWebSocket(token)
      return false
    }
    wsRef.current.send(JSON.stringify({ type, payload }))
    return true
  }

  function mergeIncomingMessage(msg) {
    setMessagesByConv((prev) => {
      const list = prev[msg.conversation_id] || []
      const exists = list.some((x) => x.id === msg.id)
      if (exists) return prev

      // Best-effort replacement of optimistic message placeholder.
      const optimisticIdx = list.findIndex(
        (x) =>
          String(x.id).startsWith('tmp-')
          && x.sender_id === msg.sender_id
          && x.type === msg.type
          && (x.content || '') === (msg.content || ''),
      )

      if (optimisticIdx >= 0) {
        const copy = [...list]
        const tempId = copy[optimisticIdx].id
        copy[optimisticIdx] = msg
        setMessageStatusById((statusPrev) => {
          const next = { ...statusPrev }
          if (next[tempId]) {
            next[msg.id] = next[tempId] === 'pending' ? 'sent' : next[tempId]
            delete next[tempId]
          }
          return next
        })
        return { ...prev, [msg.conversation_id]: copy }
      }

      return { ...prev, [msg.conversation_id]: [...list, msg] }
    })
    setConversations((prev) =>
      prev.map((c) => (c.id === msg.conversation_id ? { ...c, last_message: msg } : c)),
    )
  }

  function handleWsPacket(event) {
    switch (event.type) {
      case 'pong':
      case 'message.ack': {
        const id = event.payload?.message_id
        if (id) setMessageStatusById((prev) => ({ ...prev, [id]: 'sent' }))
        break
      }
      case 'message.delivered': {
        const id = event.payload?.message_id
        if (id) setMessageStatusById((prev) => ({ ...prev, [id]: 'delivered' }))
        break
      }
      case 'message.read': {
        const id = event.payload?.message_id
        if (id) setMessageStatusById((prev) => ({ ...prev, [id]: 'read' }))
        break
      }
      case 'message.new':
      case 'message.sent':
        mergeIncomingMessage(event.payload)
        if (event.payload?.sender_id === me?.id) {
          setMessageStatusById((prev) => ({ ...prev, [event.payload.id]: 'sent' }))
        }
        break
      case 'message.deleted': {
        const { message_id: messageId, conversation_id: conversationId } = event.payload
        setMessagesByConv((prev) => {
          const list = prev[conversationId] || []
          return {
            ...prev,
            [conversationId]: list.map((m) =>
              m.id === messageId
                ? { ...m, deleted_at: new Date().toISOString(), content: null, media_url: null }
                : m,
            ),
          }
        })
        break
      }
      case 'typing.start':
        setTypingMap((prev) => ({ ...prev, [event.payload.conversation_id]: true }))
        break
      case 'typing.stop':
        setTypingMap((prev) => ({ ...prev, [event.payload.conversation_id]: false }))
        break
      case 'presence.update':
        setPresenceMap((prev) => ({ ...prev, [event.payload.user_id]: event.payload }))
        break
      case 'reaction.add': {
        const { message_id: messageId, emoji, user_id: userId } = event.payload
        applyReaction(messageId, emoji, 1, userId)
        break
      }
      case 'reaction.remove': {
        const { message_id: messageId, emoji, user_id: userId } = event.payload
        if (!emoji) break
        applyReaction(messageId, emoji, -1, userId)
        break
      }
      case 'message.pinned':
      case 'message.unpinned':
        if (activeConvId) void loadPins(activeConvId)
        break
      case 'poll.vote':
        if (activeConvId) void loadMessages(activeConvId)
        break
      case 'status.new':
        if (leftTab === 'status') void loadStatuses()
        break
      case 'call.offer':
        setCallState((prev) => ({
          ...prev,
          active: true,
          incoming: event.payload,
          callId: event.payload.call_id,
          status: 'ringing',
          peerUserId: event.payload.caller_id || event.payload.callee_id || null,
        }))
        break
      case 'call.answer': {
        const sdp = event.payload?.sdp
        if (peerRef.current && sdp) {
          void peerRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
          setCallState((prev) => ({ ...prev, status: 'connected' }))
        }
        break
      }
      case 'call.ice-candidate':
      case 'call.ice_candidate': {
        const candidate = event.payload?.candidate
        if (peerRef.current && candidate) {
          void peerRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        }
        break
      }
      case 'call.rejected':
      case 'call.ended':
        if (event.type === 'call.ended' || event.type === 'call.rejected') {
          teardownCall()
        }
        break
      case 'error':
        pushToast(event.payload?.detail || 'Server websocket error', 'error')
        break
      default:
        console.warn('Unknown websocket event', event.type)
    }
  }

  async function requestOtp() {
    setAuthError('')
    try {
      await api('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number: phone.trim() }),
      })
      setAuthStep('otp')
    } catch (err) {
      setAuthError(err.message)
    }
  }

  async function verifyOtp() {
    setAuthError('')
    try {
      const data = await api('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number: phone.trim(), code: otp.trim() }),
      })
      if (data.needs_profile) {
        setSetupToken(data.setup_token)
        setAuthStep('profile')
      } else {
        setToken(data.access_token)
        setRefreshToken(data.refresh_token)
      }
    } catch (err) {
      setAuthError(err.message)
    }
  }

  async function completeProfile() {
    setAuthError('')
    try {
      const data = await api('/auth/complete-profile', {
        method: 'POST',
        body: JSON.stringify({
          setup_token: setupToken,
          display_name: displayName,
          avatar_url: null,
        }),
      })
      setToken(data.access_token)
      setRefreshToken(data.refresh_token)
    } catch (err) {
      setAuthError(err.message)
    }
  }

  async function updateMe(patch) {
    const updated = await api('/auth/users/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    setMe(updated)
    return updated
  }

  async function registerPushToken(fcmToken) {
    await api('/auth/users/me/push-token', {
      method: 'POST',
      body: JSON.stringify({ fcm_token: fcmToken }),
    })
    pushToast('Push token registered', 'success')
  }

  async function loadMessages(conversationId) {
    const items = await api(`/conversations/${conversationId}/messages?limit=50`)
    const sorted = [...items].reverse()
    setMessagesByConv((prev) => ({ ...prev, [conversationId]: sorted }))
    return sorted
  }

  async function loadConversationDetail(conversationId) {
    const detail = await api(`/conversations/${conversationId}`)
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, ...detail } : c)))
    return detail
  }

  async function updateConversationName(conversationId, name) {
    const updated = await api(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim(), avatar_url: null }),
    })
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, ...updated } : c)))
  }

  async function addMembers(conversationId, userIds) {
    await api(`/conversations/${conversationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    })
    await loadConversationDetail(conversationId)
  }

  async function removeMember(conversationId, userId) {
    await api(`/conversations/${conversationId}/members`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    })
    await loadConversationDetail(conversationId)
  }

  async function openConversation(conversationId) {
    const selectedConversation = conversations.find((c) => c.id === conversationId)
    setActiveConvId(conversationId)
    setGroupNameDraft(selectedConversation?.name || '')
    setMemberToAdd(null)
    setGroupUserSearch('')
    setGroupUserResults([])
    if (isMobileViewport) setIsSidebarOpen(false)
    try {
      const [list] = await Promise.all([loadMessages(conversationId), loadPins(conversationId), loadConversationDetail(conversationId)])
      const last = list[list.length - 1]
      if (last) {
        sendWs('message.read', { message_id: last.id, conversation_id: conversationId })
      }
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function sendMessage() {
    if (!activeConvId) return

    if (composerType === 'poll') {
      const options = pollOptions
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean)
      if (!pollQuestion.trim() || options.length < 2) {
        pushToast('Poll needs a question and at least two options', 'error')
        return
      }

      const payload = {
        client_id: crypto.randomUUID(),
        conversation_id: activeConvId,
        type: 'poll',
        content: pollQuestion.trim(),
        poll_data: JSON.stringify({ question: pollQuestion.trim(), options, multi_choice: false }),
      }
      if (sendWs('message.send', payload)) {
        setPollQuestion('')
        const tempId = `tmp-${payload.client_id}`
        const optimistic = {
          id: tempId,
          conversation_id: activeConvId,
          sender_id: me?.id,
          type: 'poll',
          content: pollQuestion.trim(),
          poll_data: payload.poll_data,
          created_at: new Date().toISOString(),
          reactions: {},
        }
        mergeIncomingMessage(optimistic)
        setMessageStatusById((prev) => ({ ...prev, [tempId]: 'pending' }))
      }
      return
    }

    const content = messageDraft.trim()
    if (!content) return
    const payload = {
      client_id: crypto.randomUUID(),
      conversation_id: activeConvId,
      type: 'text',
      content,
      reply_to_id: null,
      media_url: null,
      media_mime: null,
      poll_data: null,
    }
    if (sendWs('message.send', payload)) {
      const tempId = `tmp-${payload.client_id}`
      const optimistic = {
        id: tempId,
        conversation_id: activeConvId,
        sender_id: me?.id,
        type: 'text',
        content,
        created_at: new Date().toISOString(),
        reactions: {},
      }
      mergeIncomingMessage(optimistic)
      setMessageStatusById((prev) => ({ ...prev, [tempId]: 'pending' }))
      setMessageDraft('')
      sendWs('typing.stop', { conversation_id: activeConvId })
    }
  }

  function onDraftChange(value) {
    setMessageDraft(value)
    if (!activeConvId) return
    sendWs('typing.start', { conversation_id: activeConvId })
    if (typingOutRef.current) clearTimeout(typingOutRef.current)
    typingOutRef.current = setTimeout(() => {
      sendWs('typing.stop', { conversation_id: activeConvId })
    }, 2000)
  }

  async function uploadMedia(file) {
    if (!file || !activeConvId) return
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await api('/media/upload', { method: 'POST', body: form })
      const mime = data.mime_type || file.type || ''
      const type = mime.startsWith('image')
        ? 'image'
        : mime.startsWith('video')
          ? 'video'
          : mime.startsWith('audio')
            ? 'audio'
            : 'document'
      sendWs('message.send', {
        conversation_id: activeConvId,
        type,
        content: null,
        media_url: data.url,
        media_mime: mime,
      })
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function reactToMessage(messageId, emoji) {
    try {
      await api(`/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      })
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function deleteMessage(messageId) {
    try {
      await api(`/messages/${messageId}`, { method: 'DELETE' })
      pushToast('Message deleted', 'success')
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function pinMessage(messageId) {
    if (!activeConvId) return
    try {
      await api(`/conversations/${activeConvId}/pins`, {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId }),
      })
      await loadPins(activeConvId)
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function unpinMessage(messageId) {
    if (!activeConvId) return
    try {
      await api(`/conversations/${activeConvId}/pins/${messageId}`, { method: 'DELETE' })
      await loadPins(activeConvId)
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function loadPins(conversationId) {
    try {
      const data = await api(`/conversations/${conversationId}/pins`)
      setPins(data)
    } catch {
      setPins([])
    }
  }

  async function votePoll(messageId, optionIndex) {
    try {
      await api(`/messages/${messageId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ option_indices: [optionIndex] }),
      })
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function muteConversation(duration) {
    if (!activeConvId) return
    await api(`/conversations/${activeConvId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ duration }),
    })
    pushToast(`Muted for ${duration}`, 'success')
  }

  async function clearMuteConversation() {
    if (!activeConvId) return
    await api(`/conversations/${activeConvId}/mute`, { method: 'DELETE' })
    pushToast('Mute cleared', 'success')
  }

  async function setDisappear(seconds) {
    if (!activeConvId) return
    await api(`/conversations/${activeConvId}/disappear`, {
      method: 'PATCH',
      body: JSON.stringify({ seconds }),
    })
    pushToast('Disappear timer updated', 'success')
  }

  async function loadStatuses() {
    try {
      const [feed, mine] = await Promise.all([api('/statuses/feed'), api('/statuses/mine')])
      setStatusesFeed(feed)
      setStatusesMine(mine)
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function postStatus() {
    if (!statusText.trim()) return
    try {
      await api('/statuses', {
        method: 'POST',
        body: JSON.stringify({ type: 'text', content: statusText.trim(), media_url: null, bg_color: statusColor }),
      })
      setStatusText('')
      await loadStatuses()
      pushToast('Status posted', 'success')
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function viewStatus(statusId) {
    await api(`/statuses/${statusId}/view`, { method: 'POST', body: JSON.stringify({}) })
    await loadStatuses()
  }

  async function deleteStatus(statusId) {
    await api(`/statuses/${statusId}`, { method: 'DELETE' })
    await loadStatuses()
  }

  async function searchUsers(query) {
    try {
      const data = await api(`/users/search?q=${encodeURIComponent(query)}&limit=10`)
      setUserResults(data)
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function createDirectConversation() {
    if (!selectedUserId) return
    try {
      const conversation = await api('/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ other_user_id: selectedUserId }),
      })
      setConversations((prev) => {
        if (prev.some((c) => c.id === conversation.id)) return prev
        return [conversation, ...prev]
      })
      setShowNewConv(false)
      setSelectedUserId(null)
      setUserSearch('')
      await openConversation(conversation.id)
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function createGroupConversation() {
    if (!selectedUserId) return
    try {
      const conversation = await api('/conversations/group', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New group',
          member_ids: [selectedUserId],
        }),
      })
      setConversations((prev) => [conversation, ...prev])
      setShowNewConv(false)
      await openConversation(conversation.id)
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function fetchPreview(url) {
    try {
      const data = await api(`/meta/preview?url=${encodeURIComponent(url)}`)
      pushToast(data?.title ? `Preview: ${data.title}` : 'Preview fetched', 'success')
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  async function startCall(calleeId) {
    if (!activeConvId || !calleeId) return
    const callId = crypto.randomUUID()
    try {
      const stream = await ensureLocalMedia()
      const pc = createPeerConnection(callId, calleeId)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const offer = await pc.createOffer({ offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)

      sendWs('call.offer', {
        call_id: callId,
        conversation_id: activeConvId,
        callee_id: calleeId,
        type: 'audio',
        sdp: offer.sdp,
      })

      setCallState((prev) => ({
        ...prev,
        active: true,
        callId,
        incoming: null,
        status: 'calling',
        peerUserId: calleeId,
      }))
    } catch (err) {
      pushToast(err.message || 'Could not start call', 'error')
      teardownCall()
    }
  }

  async function answerCall() {
    if (!callState.callId || !callState.incoming?.sdp) return
    try {
      const peerUserId = callState.incoming?.caller_id || callState.incoming?.callee_id
      const stream = await ensureLocalMedia()
      const pc = createPeerConnection(callState.callId, peerUserId)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: callState.incoming.sdp }))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      sendWs('call.answer', { call_id: callState.callId, sdp: answer.sdp })
      setCallState((prev) => ({ ...prev, status: 'connected', active: true, peerUserId }))
    } catch (err) {
      pushToast(err.message || 'Could not answer call', 'error')
    }
  }

  function rejectCall() {
    if (!callState.callId) return
    sendWs('call.reject', { call_id: callState.callId })
    teardownCall()
  }

  function toggleMute() {
    const stream = localStreamRef.current
    if (!stream) return
    const nextMuted = !callStateRef.current.muted
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setCallState((prev) => ({ ...prev, muted: nextMuted }))
  }

  async function setOutputDevice(deviceId) {
    setCallState((prev) => ({ ...prev, outputDeviceId: deviceId }))
    const audio = remoteAudioRef.current
    if (!audio) return
    if (typeof audio.setSinkId !== 'function') {
      pushToast('Audio output switching is not supported in this browser', 'error')
      return
    }
    try {
      await audio.setSinkId(deviceId)
    } catch (err) {
      pushToast(err.message || 'Could not switch output device', 'error')
    }
  }

  function endCall() {
    if (!callState.callId) return
    sendWs('call.end', { call_id: callState.callId })
    teardownCall()
  }

  useEffect(() => {
    bootstrapRef.current = bootstrap
    searchUsersRef.current = searchUsers
    apiRef.current = api
    loadStatusesRef.current = loadStatuses
    startIncomingAlertRef.current = startIncomingAlert
  })

  useEffect(() => {
    writeStorage('letta_token', token)
  }, [token])

  useEffect(() => {
    writeStorage('letta_refresh', refreshToken)
  }, [refreshToken])

  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  useEffect(() => {
    activeConvIdRef.current = activeConvId
  }, [activeConvId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    const onViewportChange = (event) => {
      setIsMobileViewport(event.matches)
      setIsSidebarOpen(!event.matches)
    }

    mediaQuery.addEventListener('change', onViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', onViewportChange)
    }
  }, [])

  useEffect(() => {
    const el = messagesAreaRef.current
    if (!el || !activeConvId) return
    el.scrollTop = el.scrollHeight
  }, [activeConvId, activeMessages.length])

  useEffect(() => {
    if (!token) return
    const id = window.setTimeout(() => {
      void bootstrapRef.current?.()
    }, 0)
    return () => {
      window.clearTimeout(id)
      closeWebSocket()
    }
  }, [token])

  useEffect(() => {
    if (!showNewConv || userSearch.trim().length < 2) return undefined
    const id = setTimeout(() => {
      void searchUsersRef.current?.(userSearch)
    }, 250)
    return () => clearTimeout(id)
  }, [showNewConv, userSearch])

  useEffect(() => {
    if (!groupUserSearch.trim() || groupUserSearch.trim().length < 2) return undefined
    const id = setTimeout(async () => {
      try {
        const data = await apiRef.current(`/users/search?q=${encodeURIComponent(groupUserSearch)}&limit=8`)
        setGroupUserResults(data)
      } catch {
        setGroupUserResults([])
      }
    }, 250)
    return () => clearTimeout(id)
  }, [groupUserSearch])

  useEffect(() => {
    if (leftTab !== 'status') return
    void loadStatusesRef.current?.()
  }, [leftTab])

  useEffect(() => {
    remoteAudioRef.current = new Audio()
    remoteAudioRef.current.autoplay = true
    return () => {
      teardownCall()
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    async function refreshDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const outputs = devices.filter((d) => d.kind === 'audiooutput')
        setAudioOutputs(outputs)
      } catch {
        setAudioOutputs([])
      }
    }

    void refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices)
    }
  }, [])

  useEffect(() => {
    if (callState.status !== 'ringing') {
      stopIncomingAlert()
      return
    }

    startIncomingAlertRef.current?.()
    return () => {
      stopIncomingAlert()
    }
  }, [callState.status])

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const title = c.type === 'group'
        ? (c.name || 'Group')
        : (c.members?.find((m) => m.user_id !== me?.id)?.display_name || 'Unknown')
      return title.toLowerCase().includes(searchConversations.toLowerCase())
    })
  }, [conversations, searchConversations, me])

  const visibleUserResults = showNewConv && userSearch.trim().length >= 2 ? userResults : []
  const visibleGroupUserResults = groupUserSearch.trim().length >= 2 ? groupUserResults : []

  if (!token) {
    return (
      <div id="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">Letta</div>
          <div className="auth-sub">Messaging without the noise.</div>

          {authStep === 'phone' && (
            <>
              <label className="auth-label">Phone number</label>
              <input
                className="auth-input"
                placeholder="+254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <button className="auth-btn" onClick={() => void requestOtp()}>
                Send code
              </button>
            </>
          )}

          {authStep === 'otp' && (
            <>
              <label className="auth-label">Verification code</label>
              <input
                className="auth-input"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button className="auth-btn" onClick={() => void verifyOtp()}>
                Verify
              </button>
              <button className="auth-back" onClick={() => setAuthStep('phone')}>
                Back
              </button>
            </>
          )}

          {authStep === 'profile' && (
            <>
              <label className="auth-label">Display name</label>
              <input
                className="auth-input"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <button className="auth-btn" onClick={() => void completeProfile()}>
                Complete profile
              </button>
            </>
          )}

          {authError && <div className="auth-error">{authError}</div>}
        </div>
      </div>
    )
  }

  return (
    <div id="app" className={`${isMobileViewport ? 'mobile-app' : 'desktop-app'} ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">Letta</div>
          <div className="sidebar-actions">
            {isMobileViewport && activeConversation && (
              <button className="icon-btn" onClick={() => setIsSidebarOpen(false)} title="Close chats">
                ←
              </button>
            )}
            <div className={`ws-indicator ${wsState === 'connected' ? 'connected' : wsState === 'connecting' ? 'connecting' : ''}`} />
            <button className="icon-btn" onClick={() => setShowNewConv(true)} title="New conversation">
              ✏️
            </button>
          </div>
        </div>

        <div className="sidebar-tabs">
          <button className={leftTab === 'chats' ? 'tab active' : 'tab'} onClick={() => setLeftTab('chats')}>Chats</button>
          <button className={leftTab === 'status' ? 'tab active' : 'tab'} onClick={() => setLeftTab('status')}>Status</button>
          <button className={leftTab === 'settings' ? 'tab active' : 'tab'} onClick={() => setLeftTab('settings')}>Settings</button>
        </div>

        {leftTab === 'chats' && (
          <>
            <div className="sidebar-search">
              <input
                className="search-input"
                placeholder="Search conversations"
                value={searchConversations}
                onChange={(e) => setSearchConversations(e.target.value)}
              />
            </div>
            <div className="conv-list">
              {filteredConversations.map((conversation) => {
                const isGroup = conversation.type === 'group'
                const otherMember = conversation.members?.find((m) => m.user_id !== me?.id)
                const title = isGroup ? (conversation.name || 'Group') : (otherMember?.display_name || 'Unknown')
                const presence = otherMember ? presenceMap[otherMember.user_id] : null
                return (
                  <button
                    key={conversation.id}
                    className={`conv-item ${activeConvId === conversation.id ? 'active' : ''}`}
                    onClick={() => void openConversation(conversation.id)}
                  >
                    <div className="avatar">{initials(title)}{presence?.online ? <span className="online-dot" /> : null}</div>
                    <div className="conv-meta">
                      <div className="conv-name">{title}</div>
                      <div className="conv-preview">
                        {conversation.last_message?.deleted_at
                          ? 'Deleted message'
                          : (conversation.last_message?.content || `No ${isGroup ? 'group' : 'direct'} messages yet`) }
                      </div>
                    </div>
                    <div className="conv-right">
                      <div className="conv-time">{formatTime(conversation.last_message?.created_at)}</div>
                      {!!conversation.unread_count && <div className="unread-badge">{conversation.unread_count}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {leftTab === 'status' && (
          <div className="panel">
            <h3>Status composer</h3>
            <textarea className="chat-textarea" value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="Share a thought..." />
            <input type="color" value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="color-input" />
            <button className="auth-btn" onClick={() => void postStatus()}>Post status</button>

            <h3>Feed</h3>
            <div className="status-list">
              {statusesFeed.map((s) => (
                <div key={s.id} className="status-item" style={{ background: s.bg_color || 'var(--bg3)' }}>
                  <div>{s.content || s.type}</div>
                  <div className="status-actions">
                    <button onClick={() => void viewStatus(s.id)}>Mark viewed</button>
                  </div>
                </div>
              ))}
            </div>

            <h3>Mine</h3>
            <div className="status-list">
              {statusesMine.map((s) => (
                <div key={s.id} className="status-item" style={{ background: s.bg_color || 'var(--bg3)' }}>
                  <div>{s.content || s.type}</div>
                  <div className="status-actions">
                    <button onClick={() => void deleteStatus(s.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {leftTab === 'settings' && (
          <div className="panel">
            <h3>Profile</h3>
            <input
              className="modal-input"
              placeholder="Display name"
              defaultValue={me?.display_name || ''}
              onBlur={(e) => void updateMe({ display_name: e.target.value.trim() })}
            />
            <div className="switch-row">
              <span>Read receipts</span>
              <input type="checkbox" defaultChecked={!!me?.receipts_visible} onChange={(e) => void updateMe({ receipts_visible: e.target.checked })} />
            </div>
            <div className="switch-row">
              <span>Presence visible</span>
              <input type="checkbox" defaultChecked={!!me?.presence_visible} onChange={(e) => void updateMe({ presence_visible: e.target.checked })} />
            </div>

            <h3>Focus</h3>
            <select className="modal-input" value={focusProfile} onChange={(e) => {
              setFocusProfile(e.target.value)
              void api('/users/me/focus', { method: 'PATCH', body: JSON.stringify({ profile: e.target.value }) })
            }}>
              <option value="normal">normal</option>
              <option value="quiet">quiet</option>
              <option value="off">off</option>
            </select>

            <h3>Push token</h3>
            <input className="modal-input" placeholder="fcm token" onKeyDown={(e) => {
              if (e.key === 'Enter') void registerPushToken(e.currentTarget.value.trim())
            }} />

            <button className="auth-back" onClick={() => clearSession()}>Sign out</button>
          </div>
        )}

        <div className="sidebar-profile">
          <div className="avatar">{initials(me?.display_name)}</div>
          <div>
            <div className="profile-name">{me?.display_name || 'Unknown'}</div>
            <div className="profile-status">{me?.phone_number || '-'}</div>
          </div>
        </div>
      </aside>

      {!activeConversation ? (
        <main className="empty-state">
          <div className="empty-icon">💬</div>
          <div className="empty-title">Pick a conversation</div>
          <div className="empty-sub">Choose from the sidebar or start a new thread.</div>
          {isMobileViewport && !isSidebarOpen && (
            <button className="auth-btn" onClick={() => setIsSidebarOpen(true)}>
              Open chats
            </button>
          )}
        </main>
      ) : (
        <main className="chat-pane">
          <div className="chat-header">
            {isMobileViewport && (
              <button className="icon-btn" onClick={() => setIsSidebarOpen(true)} title="Open chats">
                ←
              </button>
            )}
            <div className="avatar small">{initials(activeConversation.name || activeConversation.members?.[0]?.display_name)}</div>
            <div className="chat-main-title">
              <div className="chat-name">{activeConversation.type === 'group' ? (activeConversation.name || 'Group') : (activeConversation.members?.find((m) => m.user_id !== me?.id)?.display_name || 'Unknown')}</div>
              <div className="chat-status">
                {typingMap[activeConvId] ? 'typing...' : `${activeConversation.members?.length || 0} members`}
              </div>
            </div>
            <div className="chat-header-actions">
              <button className="icon-btn" onClick={() => void muteConversation('1h')}>Mute 1h</button>
              <button className="icon-btn" onClick={() => void clearMuteConversation()}>Unmute</button>
              <button className="icon-btn" onClick={() => void setDisappear(3600)}>Disappear 1h</button>
              <button className="icon-btn" onClick={() => void setDisappear(null)}>Off</button>
            </div>
          </div>

          {activeConversation.type === 'group' && (
            <div className="group-admin-bar">
              <input
                className="modal-input"
                placeholder="Rename group"
                value={groupNameDraft || activeConversation.name || ''}
                onChange={(e) => setGroupNameDraft(e.target.value)}
              />
              <button className="icon-btn" onClick={() => void updateConversationName(activeConversation.id, groupNameDraft || activeConversation.name || '')}>Save</button>

              <input
                className="modal-input"
                placeholder="Search users to add"
                value={groupUserSearch}
                onChange={(e) => setGroupUserSearch(e.target.value)}
              />
              <select className="modal-input" value={memberToAdd || ''} onChange={(e) => setMemberToAdd(e.target.value || null)}>
                <option value="">Select user</option>
                {visibleGroupUserResults
                  .filter((u) => !activeConversation.members?.some((m) => m.user_id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
              </select>
              <button className="icon-btn" disabled={!memberToAdd} onClick={() => void addMembers(activeConversation.id, [memberToAdd])}>Add</button>
              <div className="member-pills">
                {(activeConversation.members || []).map((m) => (
                  <span key={m.user_id} className="member-pill">
                    {m.display_name || m.user_id}
                    {m.user_id !== me?.id && (
                      <button onClick={() => void removeMember(activeConversation.id, m.user_id)}>x</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!pins.length && (
            <div className="pins-bar">
              <span>Pinned:</span>
              {pins.slice(0, 2).map((p) => (
                <button key={p.message_id || p.id} onClick={() => void unpinMessage(p.message_id || p.id)}>
                  {p.content || p.message?.content || 'Pinned message'}
                </button>
              ))}
            </div>
          )}

          <div className="messages-area" ref={messagesAreaRef}>
            {activeMessages.map((msg, idx) => {
              const mine = msg.sender_id === me?.id
              const previous = activeMessages[idx - 1]
              const newDate = !previous || formatDate(previous.created_at) !== formatDate(msg.created_at)
              return (
                <div key={msg.id}>
                  {newDate && <div className="date-divider">{formatDate(msg.created_at)}</div>}
                  <div className={`msg-row ${mine ? 'me' : 'them'}`}>
                    <div className={`msg-bubble ${msg.deleted_at ? 'deleted' : ''}`}>
                      {msg.deleted_at ? 'This message was deleted' : msg.type === 'poll' ? (
                        <div>
                          <strong>{msg.content || 'Poll'}</strong>
                          <div className="poll-options">
                            {(JSON.parse(msg.poll_data || '{"options":[]}').options || []).map((opt, optionIdx) => (
                              <button key={optionIdx} className="poll-option" onClick={() => void votePoll(msg.id, optionIdx)}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : msg.media_url ? (
                        <a href={msg.media_url} target="_blank" rel="noreferrer">{msg.type || 'file'}</a>
                      ) : (
                        msg.content
                      )}
                    </div>

                    {!!msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="msg-reactions">
                        {Object.entries(msg.reactions).map(([emoji, count]) => (
                          <button key={emoji} className="reaction-pill" onClick={() => void reactToMessage(msg.id, emoji)}>
                            {emoji} <span className="reaction-count">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="msg-actions">
                      {EMOJIS.slice(0, 4).map((emoji) => (
                        <button key={emoji} onClick={() => void reactToMessage(msg.id, emoji)}>{emoji}</button>
                      ))}
                      <button onClick={() => void pinMessage(msg.id)}>Pin</button>
                      {mine && <button onClick={() => void deleteMessage(msg.id)}>Delete</button>}
                    </div>

                    <div className="msg-meta">
                      {formatTime(msg.created_at)}
                      {mine && (
                        <span className="status-pill">
                          {messageStatusById[msg.id] || (String(msg.id).startsWith('tmp-') ? 'pending' : 'sent')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="chat-input-area">
            <label className="attach-btn">
              📎
              <input type="file" hidden onChange={(e) => void uploadMedia(e.target.files?.[0])} />
            </label>

            <div className="input-wrap">
              <div className="composer-type-row">
                <button className={composerType === 'text' ? 'tab active' : 'tab'} onClick={() => setComposerType('text')}>Text</button>
                <button className={composerType === 'poll' ? 'tab active' : 'tab'} onClick={() => setComposerType('poll')}>Poll</button>
              </div>
              {composerType === 'text' ? (
                <textarea className="chat-textarea" value={messageDraft} onChange={(e) => onDraftChange(e.target.value)} placeholder="Message..." />
              ) : (
                <div className="poll-editor">
                  <input className="modal-input" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" />
                  <textarea className="chat-textarea" value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} placeholder="One option per line" />
                </div>
              )}
            </div>
            <button className="send-btn" onClick={() => void sendMessage()}>➤</button>
          </div>

          <div className="tools-strip">
            <input
              className="modal-input"
              placeholder="Paste URL and press Enter for /meta/preview"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchPreview(e.currentTarget.value.trim())
              }}
            />
            <button className="icon-btn" onClick={() => void startCall(activeConversation.members?.find((m) => m.user_id !== me?.id)?.user_id)}>Call</button>
            <button className="icon-btn" onClick={answerCall} disabled={!callState.incoming}>Answer</button>
            <button className="icon-btn" onClick={rejectCall} disabled={!callState.incoming}>Reject</button>
            <button className="icon-btn" onClick={endCall} disabled={!callState.active}>End</button>
            <button className="icon-btn" onClick={toggleMute} disabled={!callState.active}>{callState.muted ? 'Unmute' : 'Mute'}</button>
            <select
              className="modal-input output-select"
              value={callState.outputDeviceId}
              onChange={(e) => void setOutputDevice(e.target.value)}
              disabled={!callState.active}
            >
              <option value="default">Default output</option>
              {audioOutputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Speaker ${device.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
            <span className="call-state">Call: {callState.status}</span>
          </div>
        </main>
      )}

      {callState.status === 'ringing' && callState.incoming && (
        <div className="call-overlay">
          <div className="call-card">
            <div className="call-title">Incoming call</div>
            <div className="call-subtitle">
              Conversation {callState.incoming.conversation_id?.slice(0, 8) || 'Unknown'}
            </div>
            <div className="call-actions">
              <button className="modal-btn decline" onClick={rejectCall}>Decline</button>
              <button className="modal-btn accept" onClick={() => void answerCall()}>Answer</button>
            </div>
          </div>
        </div>
      )}

      {showNewConv && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target.className === 'modal-overlay') setShowNewConv(false)
        }}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">New conversation</h3>
              <button className="modal-close" onClick={() => setShowNewConv(false)}>✕</button>
            </div>
            <div className="modal-body">
              <input
                className="modal-input"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user"
              />
              <div className="search-results">
                {visibleUserResults.map((user) => (
                  <button
                    key={user.id}
                    className={`search-result-item ${selectedUserId === user.id ? 'selected' : ''}`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="avatar small">{initials(user.display_name)}</div>
                    <div>
                      <div>{user.display_name}</div>
                      <div className="conv-preview">{user.bio || user.phone_number || '-'}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="new-conv-actions">
                <button className="modal-btn" disabled={!selectedUserId} onClick={() => void createDirectConversation()}>Direct</button>
                <button className="modal-btn muted" disabled={!selectedUserId} onClick={() => void createGroupConversation()}>Group</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </div>
  )
}

export default App
