import { useEffect } from 'react';

const isAndroid = () => /android/i.test(navigator.userAgent);

export default function ThemeProvider({ children }) {
  useEffect(() => {
    const applyTheme = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };

    // System-aware on all platforms
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mq.matches);

    const handler = (e) => applyTheme(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return children;
}