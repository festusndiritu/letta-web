// Re-export lucide-react icons with the names used throughout the app.
// StoryRing is kept as a custom SVG since it's a segmented progress ring.
export {
  MessageSquare as MessagesIcon,
  Phone as CallsIcon,
  Settings as SettingsIcon,
  MessageSquarePlus as AddChatIcon,
  Paperclip as PaperclipIcon,
  BarChart2 as PollIcon,
  Send as SendIcon,
  X as CloseIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  PhoneOff as CallEndIcon,
  VolumeX as MuteIcon,
  Bell as BellIcon,
  Clock as ClockIcon,
  Ban as BlockIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Volume2 as SpeakerIcon,
  Trash2 as DeleteIcon,
  Loader as RingIcon,
  Reply as ReplyIcon,
  Copy as CopyIcon,
  Pin as PinActionIcon,
  PhoneOutgoing as OutgoingCallIcon,
  PhoneIncoming as IncomingCallIcon,
  PhoneMissed as MissedCallIcon,
  CircleDot as StatusIcon,
} from 'lucide-react'

// ── Segmented story-ring SVG (custom, no lucide equivalent) ────────────────
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
