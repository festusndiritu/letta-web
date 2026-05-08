import React from 'react'
import { CallEndIcon, MicIcon, MicOffIcon, RingIcon, SpeakerIcon } from '../ui/Icons'

export function IncomingCallOverlay({ answerCall, rejectCall }) {
  return (
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
  )
}

export function ActiveCallScreen({ callDuration, callMuted, callPeerDisplayName, callState, endCall, fmtDuration, toggleMute }) {
  return (
    <div className="call-fullscreen">
      <div className="call-fs-bg" />
      <div className="call-fs-body">
        <div className="call-fs-avatar">{callPeerDisplayName?.slice(0, 1) || '?'}</div>
        <div className="call-fs-name">{callPeerDisplayName}</div>
        <div className="call-fs-status">
          {callState.status === 'calling'
            ? 'Calling...'
            : callState.status === 'connected'
              ? fmtDuration(callDuration)
              : 'Connecting...'}
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
            <button className="call-ctrl-btn" type="button">
              <SpeakerIcon />
              <span>Speaker</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PostCallScreen({ onCallAgain, onClose, summary }) {
  if (!summary) return null

  return (
    <div className="post-call-screen">
      <div className="post-call-card">
        <div className="post-call-kicker">Call ended</div>
        <div className="post-call-name">{summary.peerName}</div>
        <div className="post-call-meta">{summary.label} · {summary.durationLabel}</div>
        <div className="post-call-actions">
          <button className="post-call-btn ghost" onClick={onClose}>Close</button>
          <button className="post-call-btn" onClick={() => onCallAgain(summary.peerUserId)}>Call again</button>
        </div>
      </div>
    </div>
  )
}
