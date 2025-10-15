import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully
 * Prevents the entire app from crashing due to component errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // logErrorToService(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-2xl w-full text-center">
            <div className="mb-6 flex justify-center">
              <div className="p-4 bg-red-600/20 rounded-full">
                <AlertCircle className="w-16 h-16 text-red-500" />
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-4 text-white">
              Oeps! Er ging iets mis
            </h1>
            
            <p className="text-xl text-gray-400 mb-8">
              De applicatie heeft een onverwachte fout tegengekomen. Probeer de pagina te verversen of ga terug naar home.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-8 text-left">
                <h3 className="text-lg font-semibold mb-3 text-red-400">
                  Error Details (Development Only):
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-500 text-sm">Message:</span>
                    <p className="text-red-400 font-mono text-sm break-words">
                      {this.state.error.message}
                    </p>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <span className="text-gray-500 text-sm">Stack Trace:</span>
                      <pre className="text-xs text-gray-400 overflow-auto max-h-64 mt-2 p-3 bg-black rounded">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo && (
                    <div>
                      <span className="text-gray-500 text-sm">Component Stack:</span>
                      <pre className="text-xs text-gray-400 overflow-auto max-h-64 mt-2 p-3 bg-black rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                <Home className="w-5 h-5" />
                Terug naar Home
              </button>

              <button
                onClick={this.resetError}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Probeer Opnieuw
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error handling utility for functional components
 * Usage: wrap async operations in try-catch and call this
 */
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
    
    // TODO: Send to error tracking service
    // logErrorToService(error, { context });
    
    // Show user-friendly notification
    // This could be integrated with a toast/notification system
    return {
      message: error.message || 'Er is een fout opgetreden',
      shouldReload: false,
    };
  };

  return { handleError };
}
