import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          color: 'white',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#ff4444', marginBottom: '20px' }}>
            🚨 APPLICATION ERROR CAUGHT
          </h1>
          
          <div style={{
            backgroundColor: '#333',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '20px',
            border: '1px solid #555'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '10px' }}>Error Details</h3>
            <p><strong>Message:</strong> {this.state.error?.message}</p>
            <p><strong>Type:</strong> {this.state.error?.name}</p>
            <p><strong>Stack:</strong></p>
            <pre style={{
              backgroundColor: '#222',
              padding: '10px',
              borderRadius: '3px',
              fontSize: '12px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error?.stack}
            </pre>
          </div>

          {this.state.errorInfo && (
            <div style={{
              backgroundColor: '#333',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '20px',
              border: '1px solid #555'
            }}>
              <h3 style={{ color: '#fff', marginBottom: '10px' }}>Component Stack</h3>
              <pre style={{
                backgroundColor: '#222',
                padding: '10px',
                borderRadius: '3px',
                fontSize: '12px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#0066cc',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            🔄 Reload Page
          </button>

          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{
              backgroundColor: '#cc6600',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🔧 Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}