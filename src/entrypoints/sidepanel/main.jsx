import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import '@/assets/styles.css';
import { useTheme } from '@/lib/hooks/useTheme';
import ProfessorPanel from '@/components/professor/ProfessorPanel';
import { Settings } from 'lucide-react';

function SidePanel() {
  const [professorData, setProfessorData] = useState(null);
  useTheme();

  useEffect(() => {
    const listener = (message) => {
      if (message?.action === 'displayProfessor') {
        setProfessorData(message.data);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {professorData ? (
        <ProfessorPanel {...professorData} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  const slugUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('icons/sammy/sammy-128.jpg')
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {slugUrl && (
        <img
          src={slugUrl}
          alt="Sammy the Slug"
          className="w-20 h-20 rounded-full mb-6 opacity-60"
        />
      )}
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Rate My Slugs
      </h2>
      <p className="text-sm text-muted-foreground max-w-[240px]">
        Click a professor's rating bar on your enrollment page to view their details here.
      </p>
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);
