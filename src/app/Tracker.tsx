"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type GoalType = 'daily' | 'weekly' | 'monthly';

export interface Goal {
  id: string;
  name: string;
  type: string;
  target: number;
  category: {
    name: string;
    color: string;
  } | null;
  reminderOn: boolean;
  reminderTime: string;
}

export interface Log {
  id: string;
  goalId: string;
  entryKey: string;
  value: number;
}

interface TrackerProps {
  initialGoals: Goal[];
  initialLogs: Log[];
}

const WEEKS = [
  { id: 'w1', start: 1, end: 7, days: 7 },
  { id: 'w2', start: 8, end: 14, days: 7 },
  { id: 'w3', start: 15, end: 21, days: 7 },
  { id: 'w4', start: 22, end: 28, days: 7 },
  { id: 'w5', start: 29, end: 31, days: 3 },
];

export default function HabitTracker({ initialGoals, initialLogs }: TrackerProps) {
  // Convert initial logs into the format the UI expects: goalId -> entryKey -> value
  const initialData: Record<string, Record<string | number, number>> = {};
  initialLogs.forEach(log => {
    if (!initialData[log.goalId]) initialData[log.goalId] = {};
    initialData[log.goalId][log.entryKey] = log.value;
  });

  const [data, setData] = useState<Record<string, Record<string | number, number>>>(initialData);
  const [popover, setPopover] = useState<{ goalId: string; day: string | number; val: number } | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<Goal | null>(null);
  const handledReminders = React.useRef<Record<string, boolean>>({});

  const [viewDate, setViewDate] = useState(new Date());

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  // Scroll to current day on mount and when viewDate changes
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const todayElement = document.getElementById('today-cell');
      if (todayElement) {
        todayElement.scrollIntoView({ 
          behavior: 'smooth', 
          inline: 'center', 
          block: 'nearest' 
        });
      }
    }, 200); // Slightly longer delay to ensure full render
    return () => clearTimeout(timeout);
  }, [viewDate]);

  // Alarm checker effect
  React.useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentHHmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      initialGoals.forEach(goal => {
        if (goal.reminderOn && goal.reminderTime === currentHHmm) {
          const alarmKey = `${dayKey}-${goal.id}-${currentHHmm}`;
          if (!handledReminders.current[alarmKey]) {
            handledReminders.current[alarmKey] = true;
            setActiveAlarm(goal);
            // Play a ding sound
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.play();
            } catch (e) { console.error('Audio play failed', e); }
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [initialGoals]);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const currentMonthName = viewDate.toLocaleString('default', { month: 'long' });
  const monthKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`;
  
  // Get days in the current month
  const DAYS_IN_MONTH = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const notifyChange = async (goalId: string, entryKey: string, value: number) => {
    await fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify({ goalId, entryKey, value }),
    });
  };

  const handleDayClick = (goal: Goal, day: number) => {
    if (goal.type !== 'daily') return;
    const entryKey = `${monthKey}-day-${day}`;
    
    setData((prev) => {
      const goalData = prev[goal.id] || {};
      const currentVal = goalData[entryKey] || 0;
      const newVal = currentVal === 0 ? 1 : 0;
      notifyChange(goal.id, entryKey, newVal);
      return {
        ...prev,
        [goal.id]: {
          ...goalData,
          [entryKey]: newVal
        }
      };
    });
  };

  const handleWeekClick = (goal: Goal, weekId: string) => {
    if (goal.type !== 'weekly') return;
    const entryKey = `${monthKey}-${weekId}`;
    setData((prev) => {
      const goalData = prev[goal.id] || {};
      const currentVal = goalData[entryKey] || 0;
      const target = goal.target || 1;
      const newVal = currentVal >= target ? 0 : currentVal + 1;
      notifyChange(goal.id, entryKey, newVal);
      return {
        ...prev,
        [goal.id]: {
          ...goalData,
          [entryKey]: newVal
        }
      };
    });
  };

  const handleMonthlyClick = (goal: Goal, day: number) => {
    if (goal.type !== 'monthly') return;
    const entryKey = `${monthKey}-day-${day}`;
    const goalData = data[goal.id] || {};
    setPopover({ goalId: goal.id, day: entryKey, val: goalData[entryKey] || 0 });
  };

  const closePopover = () => setPopover(null);

  const submitPopover = (e: React.FormEvent) => {
    e.preventDefault();
    if (popover) {
      setData((prev) => ({
        ...prev,
        [popover.goalId]: {
          ...(prev[popover.goalId] || {}),
          [popover.day]: popover.val
        }
      }));
      notifyChange(popover.goalId, popover.day.toString(), popover.val);
      closePopover();
    }
  };

  const calculateGoalTotal = (goal: Goal) => {
    const goalData = data[goal.id] || {};
    let total = 0;
    
    if (goal.type === 'weekly') {
      WEEKS.forEach(week => {
        total += (goalData[`${monthKey}-${week.id}`] || 0);
      });
    } else {
      // For daily and monthly, only count entries for the current monthKey
      Object.entries(goalData).forEach(([key, val]) => {
        if (key.startsWith(monthKey)) {
          total += val;
        }
      });
    }
    return total;
  };

  function renderGoalCells(goal: Goal, goalData: Record<string | number, number>) {
    if (goal.type === 'weekly') {
      return WEEKS.map((week) => {
        const entryKey = `${monthKey}-${week.id}`;
        const val = goalData[entryKey] || 0;
        const target = goal.target || 1;
        const isComplete = val >= target;

        return (
          <div 
            key={`${goal.id}-${week.id}`}
            onClick={() => handleWeekClick(goal, week.id)}
            className={`${styles.dayCell} ${styles.weekEnd}`}
            style={{ 
              flex: week.days, 
              padding: '6px',
              cursor: 'pointer',
              background: isComplete ? 'var(--color-green-light)' : val > 0 ? 'var(--hover-bg)' : 'transparent'
            }}
          >
            <div className={`
              ${styles.weeklyBlock} 
              ${isComplete ? styles.completed : val > 0 ? styles.active : ''}
            `}>
              {val} / {target}
            </div>
          </div>
        );
      });
    }

    return Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map((day) => {
      const entryKey = `${monthKey}-day-${day}`;
      const val = goalData[entryKey] || 0;
      
      const dateInMonth = new Date(currentYear, currentMonth, day);
      const isWeekEnd = dateInMonth.getDay() === 0 || dateInMonth.getDay() === 6;
      const isToday = day === todayObj.getDate() && currentMonth === todayObj.getMonth() && currentYear === todayObj.getFullYear();
      const isPast = dateInMonth < todayObj;
      const isMissed = isPast && val === 0 && goal.type === 'daily' && !isToday;

      return (
        <div 
          key={`${goal.id}-${day}`}
          className={`
            ${styles.dayCell} 
            ${isWeekEnd ? styles.weekEnd : ''} 
            ${isToday ? styles.today : ''}
          `}
          onClick={() => goal.type === 'monthly' ? handleMonthlyClick(goal, day) : handleDayClick(goal, day)}
          style={{ cursor: 'pointer' }}
        >
          {goal.type === 'daily' && (
            <div className={`${styles.checkbox} ${val > 0 ? styles.checked : ''} ${isMissed ? styles.missed : ''}`}>
              {val > 0 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
          )}

          {goal.type === 'monthly' && val > 0 && (
            <div className={`${styles.monthlyInput} ${styles.hasData}`}>
              {val}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className={styles.monthNav}>
            <button onClick={handlePrevMonth}>{'<'}</button>
            <span>{currentMonthName} {currentYear}</span>
            <button onClick={handleNextMonth}>{'>'}</button>
          </div>
          <Link href="/goals" style={{ 
            fontSize: '14px', 
            padding: '8px 16px', 
            borderRadius: '6px', 
            background: 'var(--color-green)',
            color: 'white',
            fontWeight: 500,
            textDecoration: 'none'
          }}>
            Manage Goals
          </Link>
        </div>
      </header>

      <div id="tracker-grid" className={styles.grid}>
        <div className={styles.gridInner}>
          <div className={`${styles.row} ${styles.headerRow}`}>
          <div className={styles.goalName}>Goals</div>
          {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map((day) => {
            const dateInMonth = new Date(currentYear, currentMonth, day);
            const isWeekEnd = dateInMonth.getDay() === 0 || dateInMonth.getDay() === 6;
            const isToday = day === todayObj.getDate() && currentMonth === todayObj.getMonth() && currentYear === todayObj.getFullYear();
            return (
              <div key={`header-${day}`} id={isToday ? 'today-cell' : undefined} className={`${styles.dayCell} ${styles.headerCell} ${isWeekEnd ? styles.weekEnd : ''} ${isToday ? styles.today : ''}`}>
                {day}
              </div>
            );
          })}
          <div className={styles.summary}>Summary</div>
        </div>

        {Object.entries(
          initialGoals.reduce((acc, goal) => {
            const catName = goal.category?.name || 'No Category';
            if (!acc[catName]) acc[catName] = { goals: [], color: goal.category?.color || '#cbd5e1' };
            acc[catName].goals.push(goal);
            return acc;
          }, {} as Record<string, { goals: Goal[], color: string }>)
        ).map(([categoryName, { goals: categoryGoals, color }]) => (
          <React.Fragment key={categoryName}>
            <div className={styles.categoryRow}>
              <div className={styles.categoryContent}>
                <div className={styles.categoryColor} style={{ backgroundColor: color }} />
                {categoryName}
              </div>
            </div>
            
            {categoryGoals.map((goal) => {
              const goalData = data[goal.id] || {};
              const total = calculateGoalTotal(goal);

              return (
                <div key={goal.id} className={styles.row}>
                  <div className={styles.goalName}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!goal.category && <div className={styles.categoryColor} style={{ backgroundColor: '#cbd5e1', width: '8px', height: '8px' }} />}
                      <div className={styles.goalTitle}>{goal.name}</div>
                    </div>
                    <div className={styles.goalType}>{goal.type}</div>
                  </div>

                  {renderGoalCells(goal, goalData)}

                  <div className={styles.summary}>
                    {goal.type === 'daily' && <span>{total} / {DAYS_IN_MONTH}</span>}
                    {goal.type === 'weekly' && <span>{total} / {goal.target! * 5}</span>}
                    {goal.type === 'monthly' && goal.target && (
                      <div className={styles.summaryWrapper}>
                        <span>{total} / {goal.target}</span>
                        <div className={styles.progressContainer}>
                          <div className={styles.progressBar} style={{ width: `${Math.min((total / goal.target) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        </div>
      </div>

      {popover && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, border: '1px solid var(--border-medium)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Update monthly progress</h3>
          <form onSubmit={submitPopover} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" value={popover.val} onChange={(e) => setPopover({...popover, val: parseInt(e.target.value) || 0})} style={{ width: '60px', padding: '8px', border: '1px solid var(--border-medium)', borderRadius: '4px' }} autoFocus />
            <button type="submit" style={{ background: 'var(--color-green)', color: 'white', padding: '8px 16px', borderRadius: '4px', fontWeight: 500, border: 'none', cursor: 'pointer' }}>Save</button>
            <button type="button" onClick={closePopover} style={{ padding: '8px 16px', color: 'var(--text-secondary)', border: 'none', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          </form>
        </div>
      )}
      
      {popover && <div onClick={closePopover} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.05)', zIndex: 99 }} />}

      {activeAlarm && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', zIndex: 1000, border: '1px solid var(--border-medium)', textAlign: 'center', minWidth: '320px', animation: 'pop 0.3s ease-out' }}>
          <div style={{ background: activeAlarm.category?.color || '#10b981', width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Habit Reminder!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '16px' }}>It&apos;s time for &quot;<strong>{activeAlarm.name}</strong>&quot;</p>
          <button 
            onClick={() => setActiveAlarm(null)} 
            style={{ width: '100%', padding: '12px', background: 'var(--color-green)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'filter 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
            onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            I&apos;m on it!
          </button>
        </div>
      )}
      
      {activeAlarm && <div onClick={() => setActiveAlarm(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 999 }} />}

      <style jsx>{`
        @keyframes pop {
          0% { transform: translate(-50%, -45%) scale(0.95); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
