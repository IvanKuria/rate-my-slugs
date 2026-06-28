import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import { useTheme } from '@/lib/hooks/useTheme';
import SettingsPage from '@/components/settings/SettingsPage';

function OptionsApp() {
  useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SettingsPage />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
