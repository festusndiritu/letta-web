import React, { useState, useCallback } from 'react'
import { X, Trash2, Pause, Play } from 'lucide-react'

export default function StoryViewer({
  me, statusMine, statusFeed, statusFeedRef,
  storyViewerId, storyViewerIndex,
  setStoryViewerId, setStoryViewerIndex,
  deleteStatus, fmtTime, initial,
  isPaused, setIsPaused,
  onVideoEnded,
}) {
  if (!storyViewerId) return null

  const isMine = storyViewerId === me?.id
  const group = isMine
    ? { user_id: me.id, display_name: me.display_name, statuses: statusMine }
    : statusFeed.find(g => g.user_id === storyViewerId)
  const story = group?.statuses?.[storyViewerIndex]

  if (!group || !story) return null

  const goNext = useCallback(() => {
    const feed = statusFeedRef.current
    const cur = isMine ? { statuses: statusMine } : feed.find(g => g.user_id === storyViewerId)
    if (!cur) return
    if (storyViewerIndex < cur.statuses.length - 1) {
      setStoryViewerIndex(storyViewerIndex + 1)
    } else {
      const gIdx = isMine ? -1 : feed.findIndex(g => g.user_id === storyViewerId)
      if (gIdx >= 0 && gIdx < feed.length - 1) {
        setStoryViewerId(feed[gIdx + 1].user_id); setStoryViewerIndex(0)
      } else {
        setStoryViewerId(null)
      }
    }
  }, [isMine, statusMine, statusFeedRef, storyViewerId, storyViewerIndex, setStoryViewerId, setStoryViewerIndex])

  const goPrev = useCallback(() => {
    if (storyViewerIndex > 0) {
      setStoryViewerIndex(storyViewerIndex - 1)
    } else {
      const feed = statusFeedRef.current
      const gIdx = isMine ? -1 : feed.findIndex(g => g.user_id === storyViewerId)
      if (gIdx > 0) { setStoryViewerId(feed[gIdx - 1].user_id); setStoryViewerIndex(0) }
    }
  }, [isMine, statusFeedRef, storyViewerId, storyViewerIndex, setStoryViewerId, setStoryViewerIndex])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Progress bars — z-20 so above tap zones */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3 pb-1">
        {group.statuses.map((_, i) => (
          <div key={i === storyViewerIndex ? `active-${storyViewerIndex}` : i}
            className="h-0.5 flex-1 rounded-full overflow-hidden bg-white/25">
            <div className={[
              'h-full rounded-full bg-white origin-left',
              isPaused ? '[animation-play-state:paused]' : '',
              i < storyViewerIndex ? 'scale-x-100' :
              i === storyViewerIndex ? '[animation:story-progress_5s_linear_forwards]' : 'scale-x-0',
            ].filter(Boolean).join(' ')} />
          </div>
        ))}
      </div>

      {/* Header — z-30 so above tap zones and progress bars */}
      <div className="absolute top-5 left-0 right-0 z-30 flex items-center gap-3 px-4 pt-2">
        <div className="size-9 shrink-0 rounded-full bg-[var(--bg3)] flex items-center justify-center text-sm font-semibold text-[var(--gold)]">
          {initial(group.display_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate">{group.display_name}</div>
          <div className="text-xs text-white/60">{fmtTime(story.created_at)}</div>
        </div>
        {/* Pause indicator */}
        <div className="p-2 text-white/60 pointer-events-none">
          {isPaused ? <Play className="size-4" /> : <Pause className="size-4 opacity-0" />}
        </div>
        {isMine && (
          <button
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => deleteStatus(story.id)}
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setStoryViewerId(null)}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: story.bg_color || '#111' }}>
        {story.type === 'image' && <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />}
        {story.type === 'video' && (
          <video
            key={story.id}
            src={story.media_url}
            autoPlay
            playsInline
            className="max-h-full max-w-full"
            onEnded={onVideoEnded}
          />
        )}
        {story.type === 'text' && (
          <div className="font-serif text-2xl text-white px-8 text-center leading-relaxed">{story.content}</div>
        )}
        {/* Caption for image/video */}
        {story.type !== 'text' && story.content && (
          <div className="absolute bottom-16 left-0 right-0 px-6 text-center">
            <span className="bg-black/50 text-white text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">{story.content}</span>
          </div>
        )}
      </div>

      {/* Tap zones — z-10, below header/progress (z-20/z-30) */}
      <div className="absolute inset-0 z-10 flex">
        <button
          className="w-1/2 h-full"
          aria-label="Previous story"
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
          onClick={goPrev}
        />
        <button
          className="w-1/2 h-full"
          aria-label="Next story"
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
          onClick={goNext}
        />
      </div>
    </div>
  )
}
