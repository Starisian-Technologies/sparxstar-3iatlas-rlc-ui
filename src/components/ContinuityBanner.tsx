interface ContinuityBannerProps {
  isOnline: boolean
  hasConnectionIssue?: boolean
  hasDraft?: boolean
}

export function ContinuityBanner({
  isOnline,
  hasConnectionIssue = false,
  hasDraft = false,
}: ContinuityBannerProps) {
  if (isOnline && !hasConnectionIssue) return null

  const title = isOnline
    ? 'Sync retry in progress'
    : hasDraft
      ? 'Offline — current entry stays on this screen'
      : 'Offline — live sync paused'

  const body = isOnline
    ? 'Local interaction can continue while the app retries session sync in the background.'
    : hasDraft
      ? 'Keep working on this device and submit once the connection returns.'
      : 'Reconnect to refresh the session and continue syncing with the class.'

  return (
    <div role="status" aria-live="polite" style={bannerStyle(isOnline)}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{body}</div>
    </div>
  )
}

const bannerStyle = (isOnline: boolean): React.CSSProperties => ({
  borderRadius: 12,
  border: `1px solid ${isOnline ? 'rgba(245, 158, 11, 0.45)' : 'rgba(96, 165, 250, 0.4)'}`,
  background: isOnline ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
})
