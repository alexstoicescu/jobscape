'use client';
import {useEffect, useState} from 'react';
import {Moon, Sun} from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark');
    const apply = (value: boolean) => {document.documentElement.dataset.theme = value ? 'dark' : 'light'; setDark(value);};
    const followSystem = () => {
      try {if (['light','dark'].includes(localStorage.getItem('jobscape-theme') ?? '')) return;} catch { /* Storage may be unavailable. */ }
      apply(system.matches);
    };
    const followStorage = (event: StorageEvent) => {
      if (event.key !== 'jobscape-theme' && event.key !== null) return;
      apply(event.newValue === 'dark' || event.newValue !== 'light' && system.matches);
    };
    sync();
    system.addEventListener('change', followSystem);
    window.addEventListener('storage', followStorage);
    return () => {system.removeEventListener('change', followSystem); window.removeEventListener('storage', followStorage);};
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try {localStorage.setItem('jobscape-theme', next ? 'dark' : 'light');} catch { /* The current-page toggle still works. */ }
  };
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={dark} onClick={toggle}>
    {dark ? <Sun size={17} aria-hidden="true"/> : <Moon size={17} aria-hidden="true"/>}<span>Dark mode</span>
  </button>;
}
