import React from "react";

type State = {
  hasError: boolean;
};

class ErrorBoundary extends React.Component<{}, State> {
  state: State = { hasError: false };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Display fallback UI
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
