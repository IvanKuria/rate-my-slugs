import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_BASE_URL = 'https://rate-my-slugs-server.onrender.com';

const GRADE_COLORS = {
  'A+': '#22c55e', 'A': '#22c55e', 'A-': '#4ade80',
  'B+': '#84cc16', 'B': '#a3e635', 'B-': '#bef264',
  'C+': '#facc15', 'C': '#fbbf24', 'C-': '#f59e0b',
  'D+': '#fb923c', 'D': '#f97316', 'D-': '#ea580c',
  'F': '#ef4444'
};

// ── Cache config ─────────────────────────────────────────────────────────────
// Successful responses are cached in chrome.storage.local under keys prefixed
// with `cache_` so the existing background `clearCache` route (which removes any
// key starting with `cache_`) wipes them when the user clears data.
const CACHE_PREFIX = 'cache_grades_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 12000; // Render free tier cold-starts; give it room

const cacheKeyFor = (instructor, course) =>
  `${CACHE_PREFIX}${instructor || ''}_${course || ''}`;

const readCache = (key) =>
  new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get(key, (items) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        const entry = items?.[key];
        if (entry && entry.timestamp && Date.now() - entry.timestamp < CACHE_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });

const writeCache = (key, data) => {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.set({ [key]: { timestamp: Date.now(), data } });
  } catch {
    /* ignore cache write failures */
  }
};

const GradeDistribution = ({ instructorName, course }) => {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');

  useEffect(() => {
    // Reset on every instructor/course change so a previous professor's chart
    // does not linger while the new one loads.
    let cancelled = false;
    setStatus('loading');
    setData(null);
    setSelectedQuarter('ALL');
    setSelectedYear('ALL');

    if (!instructorName) {
      setStatus('no_data');
      return;
    }

    const cacheKey = cacheKeyFor(instructorName, course);

    // Single attempt with an AbortController-based timeout.
    const attemptFetch = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const params = new URLSearchParams({ instructor: instructorName });
        if (course) params.append('course', course);

        const response = await fetch(`${API_BASE_URL}/api/grades?${params}`, {
          signal: controller.signal,
        });
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    };

    const fetchGrades = async () => {
      // Serve fresh cache immediately (covers cold-start / outage).
      const cached = await readCache(cacheKey);
      if (cancelled) return;
      if (cached) {
        if (cached.success) {
          setData(cached);
          setStatus('success');
        }
        // If cache holds a non-success payload we still try the network below.
      }

      // Try network, with ONE retry on failure/timeout.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await attemptFetch();
          if (cancelled) return; // discard out-of-order / stale response

          if (result.success) {
            writeCache(cacheKey, result);
            setData(result);
            setStatus('success');
          } else {
            setStatus(result.error === 'instructor_not_found' ? 'not_found' : 'no_data');
          }
          return;
        } catch (error) {
          if (cancelled) return;
          console.error(
            `Error fetching grade data (attempt ${attempt + 1}):`,
            error
          );
          // Loop will retry once; on final failure fall through.
        }
      }

      if (cancelled) return;
      // If we already painted something usable from cache, keep it.
      if (!(cached && cached.success)) {
        setStatus('error');
      }
    };

    fetchGrades();

    return () => {
      cancelled = true;
    };
  }, [instructorName, course]);

  if (status === 'loading') {
    return (
      <div className="grade-dist-section">
        <div className="grade-dist-loading">Loading grade distribution...</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="grade-dist-section">
        <h4 className="grade-dist-title">Grade Distribution</h4>
        <div className="grade-dist-error" role="alert">
          Grade data is temporarily unavailable, try again.
        </div>
      </div>
    );
  }

  if (status === 'not_found' || status === 'no_data') {
    return (
      <div className="grade-dist-section">
        <h4 className="grade-dist-title">Grade Distribution</h4>
        <div className="grade-dist-empty">
          No grade distribution data available for this instructor and course combination.
        </div>
      </div>
    );
  }

  const { distributions: rawDistributions, aggregated } = data;
  // Guard against the server omitting the distributions array.
  const distributions = Array.isArray(rawDistributions) ? rawDistributions : [];

  // Get unique quarters and years for filters
  const quarters = [...new Set(distributions.map(d => d.quarter))];
  const years = [...new Set(distributions.map(d => d.year))].sort((a, b) => b - a);

  // Filter distributions based on selection
  const filteredDistributions = distributions.filter(d => {
    if (selectedQuarter !== 'ALL' && d.quarter !== selectedQuarter) return false;
    if (selectedYear !== 'ALL' && d.year !== parseInt(selectedYear)) return false;
    return true;
  });

  // Aggregate filtered data or use overall if showing all
  const rawDisplayData = (selectedQuarter === 'ALL' && selectedYear === 'ALL')
    ? aggregated
    : aggregateFiltered(filteredDistributions);

  // Defensive defaults: the server may omit fields. Never iterate undefined.
  const displayData = {
    totalStudents: 0,
    gpa: null,
    ...(rawDisplayData || {}),
    letterGrades: (rawDisplayData && rawDisplayData.letterGrades) || {},
    otherGrades: (rawDisplayData && rawDisplayData.otherGrades) || {},
  };

  // Convert to chart format
  const chartData = Object.entries(displayData.letterGrades).map(([grade, count]) => ({
    grade,
    count,
    color: GRADE_COLORS[grade]
  }));

  const totalLetterGrades = Object.values(displayData.letterGrades).reduce((a, b) => a + b, 0);

  // Screen-reader summary of the (otherwise opaque) SVG bar chart.
  const chartAriaSummary = chartData.length > 0
    ? `Grade distribution: ${chartData
        .map(({ grade, count }) => `${grade}, ${count} student${count === 1 ? '' : 's'}`)
        .join('; ')}. Total ${totalLetterGrades} letter grades.`
    : 'No grade distribution data to display.';

  return (
    <div className="grade-dist-section">
      <header className="grade-dist-header">
        <h4 className="grade-dist-title">Grade Distribution</h4>
        {data.course && <span className="grade-dist-course">{data.course}</span>}
      </header>

      <div className="grade-dist-filters">
        <div className="grade-dist-filter">
          <label htmlFor="quarter-filter">Quarter</label>
          <select
            id="quarter-filter"
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
          >
            <option value="ALL">All</option>
            {quarters.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div className="grade-dist-filter">
          <label htmlFor="year-filter">Year</label>
          <select
            id="year-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="ALL">All</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {filteredDistributions.length === 0 ? (
        <div className="grade-dist-empty">
          No grade data for the selected filters.
        </div>
      ) : (
        <>
          <div className="grade-dist-chart" role="img" aria-label={chartAriaSummary}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [
                    `${value} students (${((value / totalLetterGrades) * 100).toFixed(1)}%)`,
                    'Count'
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grade-dist-stats">
            <div className="grade-dist-stat">
              <span className="grade-dist-stat-label">Avg GPA</span>
              <span className="grade-dist-stat-value">{displayData.gpa?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="grade-dist-stat">
              <span className="grade-dist-stat-label">Total</span>
              <span className="grade-dist-stat-value">{displayData.totalStudents} students</span>
            </div>
          </div>

          {Object.keys(displayData.otherGrades).length > 0 && (
            <div className="grade-dist-other">
              <span className="grade-dist-other-label">Other:</span>
              {Object.entries(displayData.otherGrades).map(([grade, count]) => (
                <span key={grade} className="grade-dist-other-item">
                  {grade}: {count}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Helper to aggregate filtered distributions
function aggregateFiltered(distributions) {
  if (distributions.length === 0) {
    return { letterGrades: {}, otherGrades: {}, totalStudents: 0, gpa: null };
  }

  if (distributions.length === 1) {
    return {
      letterGrades: distributions[0].letterGrades || {},
      otherGrades: distributions[0].otherGrades || {},
      totalStudents: distributions[0].totalStudents || 0,
      gpa: distributions[0].gpa ?? null
    };
  }

  const letterGrades = {};
  const otherGrades = {};
  const gradeKeys = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
  const otherKeys = ['P', 'NP', 'S', 'U', 'I', 'W'];

  for (const key of gradeKeys) {
    letterGrades[key] = 0;
  }

  for (const dist of distributions) {
    const distLetter = dist.letterGrades || {};
    const distOther = dist.otherGrades || {};
    for (const key of gradeKeys) {
      letterGrades[key] += distLetter[key] || 0;
    }
    for (const key of otherKeys) {
      if (distOther[key]) {
        otherGrades[key] = (otherGrades[key] || 0) + distOther[key];
      }
    }
  }

  const totalStudents = Object.values(letterGrades).reduce((a, b) => a + b, 0) +
    Object.values(otherGrades).reduce((a, b) => a + b, 0);

  // Calculate weighted GPA
  const gradePoints = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  };

  let totalPoints = 0;
  let gradeCount = 0;
  for (const [grade, count] of Object.entries(letterGrades)) {
    if (gradePoints[grade] !== undefined && count > 0) {
      totalPoints += gradePoints[grade] * count;
      gradeCount += count;
    }
  }

  const gpa = gradeCount > 0 ? Math.round((totalPoints / gradeCount) * 100) / 100 : null;

  return { letterGrades, otherGrades, totalStudents, gpa };
}

export default GradeDistribution;
