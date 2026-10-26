import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in place of the children once they have thrown. */
  fallback: ReactNode;
  /** Changing this clears the error and renders the children again (e.g. a new model URL). */
  resetKey?: unknown;
}

/** Contains a render error to one part of the page instead of blanking the whole app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean; resetKey: unknown }> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: { failed: boolean; resetKey: unknown }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
