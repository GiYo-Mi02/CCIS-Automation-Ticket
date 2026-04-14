import { createContext, useContext } from 'react';

const AnalyticsContext = createContext(null);

function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

export { AnalyticsContext, useAnalytics };
