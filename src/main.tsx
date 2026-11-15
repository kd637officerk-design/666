import './lib/polyfills';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __SYMPHONY_MOUNTED__?: boolean;
  }
}

function isNativeOrEmbeddedRuntime(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // ignore
  }
  if (typeof window === 'undefined') return true;
  const proto = window.location.protocol;
  return proto === 'file:' || proto === 'capacitor:' || proto === 'content:';
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (isNativeOrEmbeddedRuntime()) {
    // Never run PWA Service Worker inside Capacitor Android WebView;
    // unregister any stale SW registrations so asset loads never stall.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
  } else {
    registerSW({immediate: true});
  }
}

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#09090b',
            color: '#f4f4f5',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <h1 style={{fontSize: '18px', fontWeight: 700, margin: 0}}>
            Symphony No. 9 failed to render
          </h1>
          <p style={{fontSize: '13px', color: '#a1a1aa', margin: 0, wordBreak: 'break-word'}}>
            {this.state.error.message || 'Unknown startup error'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px',
              alignSelf: 'flex-start',
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

window.__SYMPHONY_MOUNTED__ = true;

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
