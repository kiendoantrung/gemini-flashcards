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
                <div className="min-h-screen bg-white flex items-center justify-center p-4">
                    <div className="max-w-md w-full card-duo p-8 text-center bg-white">
                        {/* Error Icon */}
                        <div className="w-16 h-16 bg-duo-red-subtle rounded-2xl border-2 border-duo-red flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-duo-red stroke-[2.5]" />
                        </div>

                        {/* Error Title */}
                        <h1 className="text-2xl font-heading font-black text-duo-charcoal mb-2">
                            Oops! Something went wrong
                        </h1>

                        {/* Error Description */}
                        <p className="text-duo-pencil mb-6 font-medium">
                            We encountered an unexpected error. Don't worry, your progress is safe.
                        </p>

                        {/* Error Details (development only) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-duo-red-subtle/40 rounded-2xl border-2 border-duo-red/40 p-4 mb-6 text-left overflow-auto max-h-40">
                                <p className="text-xs font-mono text-duo-red break-words font-bold">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="btn-duo-green duo-label px-6 py-3 text-xs tracking-wider shadow-duo-green"
                            >
                                <RefreshCw className="w-4 h-4 mr-1.5 stroke-[2.5]" />
                                Try Again
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="btn-duo-white duo-label px-6 py-3 text-xs tracking-wider"
                            >
                                <Home className="w-4 h-4 mr-1.5 stroke-[2.5]" />
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
