import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, apiFetch } from '../api/client.js';

const AnalyticsContext = createContext(null);
const STREAM_ENDPOINT = `${API_BASE}/api/admin/analytics/stream`;
const OVERVIEW_ENDPOINT = '/api/admin/analytics/overview';
const RECONNECT_DELAY_MS = 5000;

function AnalyticsProvider({ children }) {
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      setIsLoading(true);
      try {
        const data = await apiFetch(OVERVIEW_ENDPOINT);
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    function cleanup() {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (retryRef.current) return;
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        if (!cancelled) {
          connect();
        }
      }, RECONNECT_DELAY_MS);
    }

    function connect() {
      cleanup();
      try {
        const source = new EventSource(STREAM_ENDPOINT, { withCredentials: true });

        source.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setSnapshot(data);
            setIsConnected(true);
            setError(null);
          } catch (err) {
            console.error('Failed to parse analytics stream payload', err);
          }
        };

        source.onerror = (err) => {
          console.warn('Analytics stream error', err);
          setIsConnected(false);
          setError((prev) => prev || new Error('Disconnected from analytics stream'));
          source.close();
          scheduleReconnect();
        };

        eventSourceRef.current = source;
      } catch (err) {
        console.error('Failed to establish analytics stream', err);
        setError(err);
        scheduleReconnect();
      }
    }

    fetchInitial();
    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      isLoading,
      isConnected,
      error,
      lastUpdated: snapshot?.generatedAt ?? null,
    }),
    [snapshot, isLoading, isConnected, error]
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

export { AnalyticsProvider, useAnalytics };
