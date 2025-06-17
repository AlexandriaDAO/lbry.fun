import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SwapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Swap error boundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-8">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold text-destructive">
              Something went wrong
            </h2>
            <p className="text-muted-foreground">
              An error occurred while loading the swap interface. This might be due to network issues or temporary service unavailability.
            </p>
            {this.state.error && (
              <details className="text-left bg-muted p-4 rounded-md">
                <summary className="cursor-pointer text-sm font-medium">
                  Error details
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}