import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  viewName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Comprehensive error logging
    const errorPayload = {
      timestamp: new Date().toISOString(),
      view: this.props.viewName || 'Application',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
    };

    console.error('[FollowFlow ErrorBoundary Captured Error]', errorPayload);

    // Save to session storage for recovery diagnostics
    try {
      if (typeof window !== 'undefined') {
        const existingLogs = JSON.parse(sessionStorage.getItem('followflow_error_logs') || '[]');
        existingLogs.unshift(errorPayload);
        sessionStorage.setItem('followflow_error_logs', JSON.stringify(existingLogs.slice(0, 10)));
      }
    } catch {}
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoDashboard = (): void => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
      });
      if (this.props.onReset) {
        this.props.onReset();
      }
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const viewLabel = this.props.viewName ? `in ${this.props.viewName}` : '';

      return (
        <div className="w-full my-4 p-6 sm:p-8 rounded-2xl bg-white border border-rose-200 shadow-sm text-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Unable to display this content {viewLabel}
              </h3>
              <p className="text-xs text-slate-600 mb-4 max-w-xl">
                An unexpected rendering error occurred. Your saved contacts, follow-ups, and drafts remain safe and preserved.
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>

                <button
                  type="button"
                  onClick={this.handleGoDashboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  Return to Dashboard
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Reload Page
                </button>

                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer ml-auto"
                >
                  {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {this.state.showDetails && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed">
                  <div className="text-rose-400 font-semibold mb-1">
                    {this.state.error?.name}: {this.state.error?.message}
                  </div>
                  {this.state.error?.stack && (
                    <div className="text-slate-400 whitespace-pre-wrap mb-2">
                      {this.state.error.stack}
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div className="text-slate-400 whitespace-pre-wrap border-t border-slate-800 pt-2">
                      Component Stack:
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component helper for functional components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  viewName?: string
): React.FC<P> {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary viewName={viewName}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
