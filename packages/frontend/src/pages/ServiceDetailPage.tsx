import { useParams, useNavigate } from 'react-router-dom'

export function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const navigate = useNavigate()

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', color: 'var(--tron-blue)',
          fontFamily: 'var(--font-mono)', fontSize: '14px', cursor: 'pointer',
          padding: '8px 0', marginBottom: '16px'
        }}
        aria-label="Back to dashboard"
      >
        &larr; Dashboard
      </button>
      <h1 className="text-heading" style={{ textTransform: 'capitalize', marginBottom: '16px' }}>
        {serviceId}
      </h1>
      <div style={{ color: 'var(--text-muted)' }}>
        <p className="text-body" style={{ marginBottom: '8px' }}>Status: ---</p>
        <p className="text-body" style={{ marginBottom: '8px' }}>Last checked: ---</p>
        <p className="text-body" style={{ marginBottom: '8px' }}>Response time: ---</p>
      </div>
    </div>
  )
}
