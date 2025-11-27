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

const GradeDistribution = ({ instructorName, course }) => {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const params = new URLSearchParams({ instructor: instructorName });
        if (course) params.append('course', course);

        const response = await fetch(`${API_BASE_URL}/api/grades?${params}`);
        const result = await response.json();

        if (result.success) {
          setData(result);
          setStatus('success');
        } else {
          setStatus(result.error === 'instructor_not_found' ? 'not_found' : 'no_data');
        }
      } catch (error) {
        console.error('Error fetching grade data:', error);
        setStatus('error');
      }
    };

    fetchGrades();
  }, [instructorName, course]);

  if (status === 'loading') {
    return (
      <div className="grade-dist-section">
        <div className="grade-dist-loading">Loading grade distribution...</div>
      </div>
    );
  }

  if (status === 'not_found' || status === 'no_data' || status === 'error') {
    return (
      <div className="grade-dist-section">
        <h4 className="grade-dist-title">Grade Distribution</h4>
        <div className="grade-dist-empty">
          No grade distribution data available for this instructor and course combination.
        </div>
      </div>
    );
  }

  const { distributions, aggregated } = data;

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
  const displayData = (selectedQuarter === 'ALL' && selectedYear === 'ALL')
    ? aggregated
    : aggregateFiltered(filteredDistributions);

  // Convert to chart format
  const chartData = Object.entries(displayData.letterGrades).map(([grade, count]) => ({
    grade,
    count,
    color: GRADE_COLORS[grade]
  }));

  const totalLetterGrades = Object.values(displayData.letterGrades).reduce((a, b) => a + b, 0);

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
          <div className="grade-dist-chart">
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
      letterGrades: distributions[0].letterGrades,
      otherGrades: distributions[0].otherGrades,
      totalStudents: distributions[0].totalStudents,
      gpa: distributions[0].gpa
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
    for (const key of gradeKeys) {
      letterGrades[key] += dist.letterGrades[key] || 0;
    }
    for (const key of otherKeys) {
      if (dist.otherGrades[key]) {
        otherGrades[key] = (otherGrades[key] || 0) + dist.otherGrades[key];
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
