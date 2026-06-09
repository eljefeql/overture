"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./Button";
import { WarningCircle } from "@phosphor-icons/react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <WarningCircle className="w-12 h-12 text-ruby-400 mb-4" weight="duotone" />
          <h2 className="text-xl font-display text-curtain-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-clay-500 max-w-md mb-6">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
