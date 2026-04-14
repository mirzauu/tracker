"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { updateUserTimezone } from './actions';
// import CalendarTasks from '@/components/CalendarTasks';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const handledReminders = React.useRef<Record<string, boolean>>({});
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    const { logout } = await import('./login/actions');
    await logout();
  };

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Register service worker and subscribe to push
    const initPush = async () => {
      const { registerServiceWorker, subscribeToPush, isPushSupported, getPushPermissionState } = await import('@/utils/pushNotifications');
      if (!isPushSupported()) return;
      
      await registerServiceWorker();
      
      const permission = await getPushPermissionState();
      if (permission === 'granted') {
        const success = await subscribeToPush();
        setPushEnabled(success);
      } else if (permission === 'default') {
        // We'll let the user enable it from the menu
        setPushEnabled(false);
      }
    };
    initPush();

    // Set user timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    updateUserTimezone(tz);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    if (newTheme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const [viewDate, setViewDate] = useState(new Date());

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  // Scroll to current day on mount and when viewDate changes
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const grid = document.getElementById('tracker-grid');
      const todayElement = document.getElementById('today-cell');
      if (grid && todayElement) {
        const stickyWidth = 200; // The fixed width of our goal name column
        const gridWidth = grid.offsetWidth;
        const visibleWidth = gridWidth - stickyWidth;
        
        // Offset of today cell relative to its parent container (gridInner)
        const todayOffsetLeft = todayElement.offsetLeft;
        const todayWidth = todayElement.offsetWidth;
        
        // We want the today center to be at: stickyWidth + (visibleWidth / 2)
        // so: todayOffsetLeft + (todayWidth / 2) - scrollLeft = stickyWidth + (visibleWidth / 2)
        const targetScrollLeft = todayOffsetLeft + (todayWidth / 2) - (stickyWidth + visibleWidth / 2);
        
        grid.scrollTo({ 
          left: Math.max(0, targetScrollLeft), 
          behavior: 'smooth' 
        });
      }
    }, 300); // 300ms to ensure everything is settled
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
            
            // Show browser notification if possible
            if (Notification.permission === 'granted') {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('🔔 Habit Reminder', {
                  body: `Time for "${goal.name}"!`,
                  icon: '/favicon.ico',
                  tag: `reminder-${goal.id}`,
                });
              });
            }

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
      <div className={styles.mainLayout}>
        <div className={styles.trackerContent}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className={styles.monthNav}>
            <button onClick={handlePrevMonth}>{'<'}</button>
            <span>{currentMonthName} {currentYear}</span>
            <button onClick={handleNextMonth}>{'>'}</button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

            <div className={styles.userMenu} ref={menuRef}>
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className={styles.userAvatar}
              >
                👤
              </button>
              
              {menuOpen && (
                <div className={styles.dropdown}>
                  <div style={{ padding: '8px', borderBottom: '1px solid var(--border-medium)', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>THEME</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => changeTheme('default')} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#10b981', border: theme === 'default' ? '2px solid var(--text-primary)' : '2px solid transparent' }} title="Default" />
                      <button onClick={() => changeTheme('dark')} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1f2937', border: theme === 'dark' ? '2px solid var(--text-primary)' : '2px solid var(--border-light)' }} title="Dark" />
                      <button onClick={() => changeTheme('midnight')} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0f172a', border: theme === 'midnight' ? '2px solid var(--text-primary)' : '2px solid var(--border-light)' }} title="Midnight" />
                      <button onClick={() => changeTheme('blue')} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', border: theme === 'blue' ? '2px solid var(--text-primary)' : '2px solid transparent' }} title="Blue" />
                      <button onClick={() => changeTheme('purple')} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#a855f7', border: theme === 'purple' ? '2px solid var(--text-primary)' : '2px solid transparent' }} title="Purple" />
                    </div>
                  </div>

                  <div style={{ padding: '8px', borderBottom: '1px solid var(--border-medium)', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>NOTIFICATIONS</div>
                    <button 
                      onClick={async () => {
                        if (pushEnabled) {
                          const { unsubscribeFromPush } = await import('@/utils/pushNotifications');
                          await unsubscribeFromPush();
                          setPushEnabled(false);
                        } else {
                          const { subscribeToPush, registerServiceWorker } = await import('@/utils/pushNotifications');
                          await registerServiceWorker();
                          const success = await subscribeToPush();
                          setPushEnabled(success);
                          if (!success) {
                            alert('Please allow notifications in your browser settings.');
                          }
                        }
                      }}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '8px', width: '100%',
                        background: pushEnabled ? 'var(--color-green-light)' : 'transparent',
                        color: pushEnabled ? 'var(--color-green)' : 'var(--text-secondary)',
                        fontSize: '13px', fontWeight: 500,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{pushEnabled ? '🔔' : '🔕'}</span>
                      {pushEnabled ? 'Push Enabled' : 'Enable Push'}
                    </button>
                  </div>

                  <button onClick={handleLogout} className={styles.logoutBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
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

        </div>
{/* 
        <div className={styles.tasksSidebar}>
          <CalendarTasks />
        </div>
        */}
      </div>

      <style jsx>{`
        @keyframes pop {
          0% { transform: translate(-50%, -45%) scale(0.95); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
