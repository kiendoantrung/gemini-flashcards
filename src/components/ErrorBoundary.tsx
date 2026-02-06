import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and prevent app crashes.
 * Displays a user-friendly error UI with options to retry or go home.
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
        // Update state so the next render shows the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({ errorInfo });

        // You can also log the error to an error reporting service here
        // Example: reportError(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // If a custom fallback is provided, use it
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen bg-neo-cream flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-neo-xl border-2 border-neo-border shadow-neo-lg p-8 text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 bg-neo-pink/30 rounded-full border-2 border-neo-border flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        {/* Error Title */}
                        <h1 className="text-2xl font-heading font-extrabold text-neo-charcoal mb-2">
                            Oops! Something went wrong
                        </h1>

                        {/* Error Description */}
                        <p className="text-neo-gray mb-6">
                            We encountered an unexpected error. Don't worry, your data is safe.
                        </p>

                        {/* Error Details (development only) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-neo-cream rounded-neo-md border-2 border-neo-border p-4 mb-6 text-left overflow-auto max-h-40">
                                <p className="text-sm font-mono text-red-600 break-words">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neo-green text-white font-bold rounded-full border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-neo-charcoal font-bold rounded-full border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
