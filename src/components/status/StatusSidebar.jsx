import React from 'react'
import { ImageIcon, VideoIcon, StoryRing } from '../ui/Icons'

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
  const openMine = () => {
    if (statusMine.length > 0) {
      setStoryViewerId(me?.id)
      setStoryViewerIndex(0)
      return
    }
    setStatusComposerOpen(true)
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

      {statusMine.length > 0 && (
        <div className="my-stories-strip">
          {statusMine.map((status, index) => (
            <div
              key={status.id}
              className="my-story-chip"
              style={{ background: status.bg_color || '#1e1e21' }}
            >
              <button
                className="my-story-chip-open"
                onClick={() => {
                  setStoryViewerId(me?.id)
                  setStoryViewerIndex(index)
                }}
              >
                <span className="my-story-chip-label">{fmtTime(status.created_at)}</span>
                {status.type === 'image' && <img src={status.media_url} alt="" />}
                {status.type === 'text' && <span className="my-story-chip-text">{status.content?.slice(0, 28)}</span>}
                <span className="my-story-chip-views">{status.view_count ?? 0} views</span>
              </button>
              <button className="my-story-thumb-del" onClick={() => deleteStatus(status.id)} title="Delete">×</button>
            </div>
          ))}
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

      {statusFeed.length === 0 && !statusComposerOpen && (
        <div className="empty-convs status-empty">No recent updates from contacts.</div>
      )}
    </div>
  )
}
