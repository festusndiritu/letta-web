import React from 'react'
import { CloseIcon, DeleteIcon } from '../ui/Icons'

export default function StoryViewer({
  me,
  statusMine,
  statusFeed,
  statusFeedRef,
  storyViewerId,
  storyViewerIndex,
  setStoryViewerId,
  setStoryViewerIndex,
  deleteStatus,
  fmtTime,
  initial,
}) {
  if (!storyViewerId) return null

  const isMine = storyViewerId === me?.id
  const group = isMine
    ? { user_id: me.id, display_name: me.display_name, statuses: statusMine }
    : statusFeed.find(g => g.user_id === storyViewerId)
  const story = group?.statuses?.[storyViewerIndex]

  if (!group || !story) return null

  return (
    <div className="story-viewer">
      <div className="story-progress">
        {group.statuses.map((_, i) => (
          <div
            key={i === storyViewerIndex ? `active-${storyViewerIndex}` : i}
            className={`progress-bar ${i < storyViewerIndex ? 'done' : i === storyViewerIndex ? 'active' : ''}`}
          />
        ))}
      </div>

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

      <div className="story-content" style={{ '--sbg': story.bg_color || '#1e1e21' }}>
        {story.type === 'image' && <img src={story.media_url} alt="" />}
        {story.type === 'video' && <video src={story.media_url} autoPlay muted playsInline />}
        {story.type === 'text' && <div className="story-text">{story.content}</div>}
      </div>

      <div className="story-nav">
        <button
          className="nav-prev"
          onClick={() => {
            if (storyViewerIndex > 0) {
              setStoryViewerIndex(storyViewerIndex - 1)
            } else {
              const feed = statusFeedRef.current
              const gIdx = isMine ? -1 : feed.findIndex(g => g.user_id === storyViewerId)
              if (gIdx > 0) {
                setStoryViewerId(feed[gIdx - 1].user_id)
                setStoryViewerIndex(0)
              }
            }
          }}
        />
        <button
          className="nav-next"
          onClick={() => {
            const feed = statusFeedRef.current
            const currentGroup = isMine ? { statuses: statusMine } : feed.find(g => g.user_id === storyViewerId)
            if (!currentGroup) return
            if (storyViewerIndex < currentGroup.statuses.length - 1) {
              setStoryViewerIndex(storyViewerIndex + 1)
            } else {
              const gIdx = isMine ? -1 : feed.findIndex(g => g.user_id === storyViewerId)
              if (gIdx >= 0 && gIdx < feed.length - 1) {
                setStoryViewerId(feed[gIdx + 1].user_id)
                setStoryViewerIndex(0)
              } else {
                setStoryViewerId(null)
              }
            }
          }}
        />
      </div>

      <button className="story-close" onClick={() => setStoryViewerId(null)}><CloseIcon /></button>
    </div>
  )
}
