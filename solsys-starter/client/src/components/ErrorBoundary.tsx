import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Solar System Viewer Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          margin: '20px',
          textAlign: 'center'
        }}>
          <h2>🌌 Solar System Viewer Error</h2>
          <p>Something went wrong with the 3D visualization.</p>
          <details style={{ marginTop: '10px', textAlign: 'left' }}>
            <summary>Error Details</summary>
            <pre style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button 
            className="btn" 
            onClick={() => window.location.reload()}
            style={{ marginTop: '10px' }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}