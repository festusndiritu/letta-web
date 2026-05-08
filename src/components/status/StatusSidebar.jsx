import React, { useRef, useState } from 'react'
import { Image, Video, X } from 'lucide-react'
import { StoryRing } from '../ui/Icons'

export default function StatusSidebar({
  deleteStatus,
  fmtTime,
  initial,
  me,
  postStatus,
  setStatusComposerOpen,
  setStatusText,
  setStatusColor,
  setStoryViewerId,
  setStoryViewerIndex,
  statusColor,
  statusComposerOpen,
  statusFeed,
  statusMine,
  statusText,
  uploadStatusMedia,
}) {
  const [pendingFile, setPendingFile] = useState(null) // { file, type, preview }
  const [pendingCaption, setPendingCaption] = useState('')
  const imageRef = useRef()
  const videoRef = useRef()

  const openMine = () => {
    if (statusMine.length > 0) {
      setStoryViewerId(me?.id)
      setStoryViewerIndex(0)
      return
    }
    setStatusComposerOpen(true)
  }

  const selectMedia = (file, type) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setPendingFile({ file, type, preview })
    setPendingCaption('')
    setStatusComposerOpen(false)
  }

  const submitMedia = async () => {
    if (!pendingFile) return
    await uploadStatusMedia(pendingFile.file, pendingFile.type, pendingCaption.trim())
    URL.revokeObjectURL(pendingFile.preview)
    setPendingFile(null)
    setPendingCaption('')
  }

  const cancelMedia = () => {
    if (pendingFile) URL.revokeObjectURL(pendingFile.preview)
    setPendingFile(null)
    setPendingCaption('')
  }

  return (
    <div className="status-sidebar">
      <div className="my-status-card">
        <button className="story-list-row my-story-row" onClick={openMine}>
          <div className="story-list-avatar-wrap">
            <div className="story-list-avatar mine">{initial(me?.display_name)}</div>
            {statusMine.length > 0 && <StoryRing count={statusMine.length} viewedCount={0} size={56} />}
          </div>
          <div className="story-list-info">
            <div className="story-list-name">My status</div>
            <div className="story-list-sub">
              {statusMine.length > 0
                ? `${statusMine.length} update${statusMine.length > 1 ? 's' : ''}`
                : 'Tap to add your first update'}
            </div>
          </div>
        </button>
        <button className="my-status-add-btn" onClick={() => setStatusComposerOpen(p => !p)}>
          Add
        </button>
      </div>

      {/* Media caption step */}
      {pendingFile && (
        <div className="px-4 py-3 border-b border-[var(--border)] flex flex-col gap-3">
          <div className="relative rounded-xl overflow-hidden bg-[var(--bg3)] max-h-48">
            {pendingFile.type === 'image'
              ? <img src={pendingFile.preview} alt="" className="w-full h-full object-contain max-h-48" />
              : <video src={pendingFile.preview} className="w-full max-h-48 object-contain" muted playsInline />}
            <button
              className="absolute top-2 right-2 size-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              onClick={cancelMedia}
            ><X className="size-3.5" /></button>
          </div>
          <input
            value={pendingCaption}
            onChange={e => setPendingCaption(e.target.value)}
            placeholder="Add a caption… (optional)"
            className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text1)] placeholder:text-[var(--text3)] focus:border-[var(--gold2)] outline-none"
          />
          <button
            className="px-4 py-1.5 rounded-lg bg-[var(--gold)] text-[var(--bg0)] text-sm font-semibold hover:bg-[var(--gold2)] transition-colors"
            onClick={submitMedia}
          >Post</button>
        </div>
      )}

      {/* Text composer */}
      {statusComposerOpen && !pendingFile && (
        <div className="px-4 py-3 border-b border-[var(--border)] flex flex-col gap-3">
          <textarea
            value={statusText}
            onChange={e => setStatusText(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text1)] placeholder:text-[var(--text3)] resize-none focus:border-[var(--gold2)] outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="color" value={statusColor} onChange={e => setStatusColor(e.target.value)}
              className="size-8 rounded-lg cursor-pointer border-0 bg-transparent p-0" title="Background color"
            />
            <label className="size-8 flex items-center justify-center rounded-lg bg-[var(--bg3)] text-[var(--text2)] hover:text-[var(--text1)] cursor-pointer transition-colors" title="Image">
              <Image className="size-4" />
              <input ref={imageRef} type="file" accept="image/*" hidden onChange={e => { selectMedia(e.target.files[0], 'image'); e.target.value = '' }} />
            </label>
            <label className="size-8 flex items-center justify-center rounded-lg bg-[var(--bg3)] text-[var(--text2)] hover:text-[var(--text1)] cursor-pointer transition-colors" title="Video">
              <Video className="size-4" />
              <input ref={videoRef} type="file" accept="video/*" hidden onChange={e => { selectMedia(e.target.files[0], 'video'); e.target.value = '' }} />
            </label>
            <button
              className="ml-auto px-4 py-1.5 rounded-lg bg-[var(--gold)] text-[var(--bg0)] text-sm font-semibold disabled:opacity-40 hover:bg-[var(--gold2)] transition-colors"
              onClick={() => { postStatus(); setStatusComposerOpen(false) }}
              disabled={!statusText.trim()}
            >Post</button>
          </div>
        </div>
      )}

      {statusFeed.length > 0 && <div className="story-section-label">Recent updates</div>}
      {statusFeed.map(group => {
        const viewedCount = group.statuses.filter(s => s.viewed).length
        const latest = group.statuses[group.statuses.length - 1]
        return (
          <button
            key={group.user_id}
            className={`story-list-row ${group.all_viewed ? 'viewed' : ''}`}
            onClick={() => {
              setStoryViewerId(group.user_id)
              setStoryViewerIndex(0)
            }}
          >
            <div className="story-list-avatar-wrap">
              <div className={`story-list-avatar ${group.all_viewed ? 'viewed' : ''}`}>{initial(group.display_name)}</div>
              <StoryRing count={group.statuses.length} viewedCount={viewedCount} size={56} />
            </div>
            <div className="story-list-info">
              <div className="story-list-name">{group.display_name}</div>
              <div className="story-list-sub">{fmtTime(latest?.created_at)}</div>
            </div>
          </button>
        )
      })}

      {statusFeed.length === 0 && !statusComposerOpen && !pendingFile && (
        <div className="empty-convs status-empty">No recent updates from contacts.</div>
      )}
    </div>
  )
}
