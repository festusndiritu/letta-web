import React from 'react'
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function IncomingCallOverlay({ answerCall, rejectCall }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-80 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] shadow-2xl p-8 flex flex-col items-center gap-6">
        <div className="size-16 rounded-full bg-[var(--gold)]/10 flex items-center justify-center animate-pulse">
          <Phone className="size-7 text-[var(--gold)]" />
        </div>
        <div className="text-center">
          <div className="font-serif text-2xl text-[var(--text1)]">Incoming call</div>
          <div className="text-sm text-[var(--text3)] mt-1">Audio call</div>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={rejectCall}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-[var(--red)]/10 text-[var(--red)] hover:bg-[var(--red)]/20 transition-colors text-sm font-medium"
          >
            <PhoneOff className="size-4" /> Decline
          </button>
          <button
            onClick={answerCall}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-[var(--green)]/10 text-[var(--green)] hover:bg-[var(--green)]/20 transition-colors text-sm font-medium"
          >
            <Phone className="size-4" /> Answer
          </button>
        </div>
      </div>
    </div>
  )
}

export function ActiveCallScreen({ callDuration, callMuted, callPeerDisplayName, callState, endCall, fmtDuration, toggleMute }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg0)]/95 backdrop-blur-md">
      <div className="flex flex-col items-center gap-8">
        <div className="size-24 rounded-full bg-[var(--gold)]/10 flex items-center justify-center font-serif text-4xl text-[var(--gold)]">
          {(callPeerDisplayName || '?')[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <div className="font-serif text-3xl text-[var(--text1)]">{callPeerDisplayName}</div>
          <div className="mt-2 tabular-nums text-[var(--green)] text-base">
            {callState.status === 'calling' ? 'Calling…' : callState.status === 'connected' ? fmtDuration(callDuration) : 'Connecting…'}
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleMute}
              className={cn(
                'size-14 rounded-full flex items-center justify-center transition-colors',
                callMuted ? 'bg-[var(--gold)] text-[var(--bg0)]' : 'bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)]'
              )}
            >
              {callMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <span className="text-xs text-[var(--text3)]">{callMuted ? 'Unmute' : 'Mute'}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={endCall}
              className="size-14 rounded-full bg-[var(--red)] text-white flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <PhoneOff className="size-6" />
            </button>
            <span className="text-xs text-[var(--text3)]">End call</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button className="size-14 rounded-full bg-[var(--bg3)] text-[var(--text2)] flex items-center justify-center hover:bg-[var(--bg4)] transition-colors">
              <Volume2 className="size-6" />
            </button>
            <span className="text-xs text-[var(--text3)]">Speaker</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PostCallScreen({ onCallAgain, onClose, summary }) {
  if (!summary) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-80 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] shadow-2xl p-8 flex flex-col items-center gap-5">
        <div className="size-16 rounded-full bg-[var(--bg3)] flex items-center justify-center font-serif text-3xl text-[var(--text1)]">
          {(summary.peerName || '?')[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <div className="font-serif text-2xl text-[var(--text1)]">{summary.peerName}</div>
          <div className="text-sm text-[var(--text3)] mt-1">{summary.label} · {summary.durationLabel}</div>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-[var(--bg3)] text-sm text-[var(--text1)] hover:bg-[var(--bg4)] transition-colors"
          >Close</button>
          <button
            onClick={() => { onCallAgain(summary.peerUserId); onClose() }}
            className="flex-1 h-11 rounded-xl bg-[var(--gold)] text-[var(--bg0)] text-sm font-semibold hover:bg-[var(--gold2)] transition-colors flex items-center justify-center gap-1.5"
          >
            <Phone className="size-4" /> Call again
          </button>
        </div>
      </div>
    </div>
  )
}
