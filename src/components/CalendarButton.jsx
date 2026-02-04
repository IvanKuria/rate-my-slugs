import React, { useState } from 'react';

/**
 * Calendar button — either for a single course or "Add All".
 * Props: { courseData } for single course, { allCourses } for add-all.
 */
export default function CalendarButton({ courseData, allCourses }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const isAddAll = Boolean(allCourses);
  const label = isAddAll ? 'Add All to Google Calendar' : 'Add to Calendar';

  const handleClick = async () => {
    if (status === 'loading' || status === 'success') return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const courses = isAddAll ? allCourses : [courseData];
      const results = [];

      for (const course of courses) {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'addToCalendar', courseData: course },
            (res) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (res?.error) {
                reject(new Error(res.error));
              } else {
                resolve(res);
              }
            }
          );
        });
        results.push(response);
      }

      setStatus('success');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to add events');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <button
      className={`gcal-add-btn gcal-${status}`}
      onClick={handleClick}
      disabled={status === 'loading'}
      title={status === 'error' ? errorMsg : label}
    >
      {status === 'loading' && <span className="gcal-spinner" />}
      {status === 'success' && '✓ '}
      {status === 'error' && '✗ '}
      {status === 'loading' ? 'Adding…' : status === 'success' ? 'Added!' : status === 'error' ? 'Failed' : label}
    </button>
  );
}
