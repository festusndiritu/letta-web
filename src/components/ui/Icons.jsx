import React from 'react'

export function Icon({ children, title }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" role={title ? 'img' : 'presentation'}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function MessagesIcon() {
  return <Icon><path d="M5 6h14v8H10l-5 4V6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>
}

export function StatusIcon() {
  return <Icon><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 6.5v11M6.5 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

export function CallsIcon() {
  return <Icon><path d="M7.5 5.5c1.3 0 2.4.5 3.3 1.4l1.2 1.2c.4.4.4 1 0 1.4l-.8.8c-.2.2-.3.6-.2.9.4 1.1 1.4 2.2 2.5 2.6.3.1.7 0 .9-.2l.8-.8c.4-.4 1-.4 1.4 0l1.2 1.2c.9.9 1.4 2 1.4 3.3v1.1c0 .8-.6 1.5-1.4 1.6-1.1.1-2.7-.1-5-1-2.7-1.1-5.3-3.7-6.4-6.4-1-2.3-1.2-3.9-1-5 .1-.8.8-1.4 1.6-1.4h1.1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></Icon>
}

export function SettingsIcon() {
  return <Icon><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>
}

export function AddChatIcon() {
  return <Icon><path d="M6 5.5h12v8H9l-3 2.6V5.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M15 8.5v4M13 10.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

export function PaperclipIcon() {
  return <Icon><path d="M9 12.5l5.8-5.8a3 3 0 1 1 4.2 4.2l-7.4 7.4a5 5 0 1 1-7.1-7.1l7.4-7.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></Icon>
}

export function PollIcon() {
  return <Icon><path d="M6 17V7M11 17V10M16 17v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M4.5 17.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>
}

export function SendIcon() {
  return <Icon><path d="M4.5 11.5 19.5 4.5l-4 15-3.7-6.1-7.3-2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></Icon>
}

export function CloseIcon() {
  return <Icon><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

export function ImageIcon() {
  return <Icon><rect x="4.5" y="5" width="15" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M7 15l3.2-3.2 2.4 2.4 2.7-2.7 3.2 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /></Icon>
}

export function VideoIcon() {
  return <Icon><rect x="4.5" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M16.5 10.2 20 8.2v7.6l-3.5-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></Icon>
}

export function CallEndIcon() {
  return <Icon><path d="M7.5 6.5c1.3 0 2.4.5 3.3 1.4l1.2 1.2c.4.4.4 1 0 1.4l-.8.8c-.2.2-.3.6-.2.9.4 1.1 1.4 2.2 2.5 2.6.3.1.7 0 .9-.2l.8-.8c.4-.4 1-.4 1.4 0l1.2 1.2c.9.9 1.4 2 1.4 3.3v1.1c0 .8-.6 1.5-1.4 1.6-1.1.1-2.7-.1-5-1-2.7-1.1-5.3-3.7-6.4-6.4-1-2.3-1.2-3.9-1-5 .1-.8.8-1.4 1.6-1.4h1.1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /><path d="M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

export function MuteIcon() {
  return <Icon><path d="M5.5 14V10.5h3l4-4v11l-4-4h-3z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.4 7.1a7 7 0 0 1 0 9.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></Icon>
}

export function BellIcon() {
  return <Icon><path d="M12 18a1.8 1.8 0 0 0 1.8-1.8h-3.6A1.8 1.8 0 0 0 12 18z" fill="currentColor" /><path d="M6.5 15.5h11l-1.2-1.9V10a4.3 4.3 0 1 0-8.6 0v3.6l-1.2 1.9z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></Icon>
}

export function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v4l2.7 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Icon>
}

export function BlockIcon() {
  return <Icon><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7.2 16.8 16.8 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

export function MicIcon() {
  return <Icon title="Mute"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7 12a5 5 0 0 0 10 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Icon>
}

export function MicOffIcon() {
  return <Icon title="Unmute"><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V6a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12M19 12a7 7 0 0 0-.11-1.23M12 19v2M9 22h6M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></Icon>
}

export function SpeakerIcon() {
  return <Icon title="Speaker"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></Icon>
}

export function DeleteIcon() {
  return <Icon><path d="M6.5 7.5h11M9 7.5V6h6v1.5M8.5 7.5l.6 9h5.8l.6-9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 10v4M14 10v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></Icon>
}

export function RingIcon() {
  return <Icon><path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.5 6.5l1.6 1.6M15.9 15.9l1.6 1.6M17.5 6.5l-1.6 1.6M7.6 15.9 6 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>
}

export function StoryRing({ count, viewedCount, size = 50 }) {
  const stroke = 2.5
  const segments = Math.max(count || 1, 1)
  const r = (size - stroke * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const gap = segments > 1 ? 4 : 0
  const segLen = (circumference - gap * segments) / segments

  return (
    <svg width={size} height={size} className="story-ring-svg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: segments }).map((_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
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
