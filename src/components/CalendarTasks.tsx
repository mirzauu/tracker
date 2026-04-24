"use client";

import React, { useEffect, useState, useRef } from 'react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

export default function CalendarTasks() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [newTaskSummary, setNewTaskSummary] = useState<string>('');
  const [addingTask, setAddingTask] = useState<boolean>(false);

  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number, lastPos: {x: number, y: number} } | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1300);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const savedPos = localStorage.getItem('calendarTasksPos');
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch (e) {}
    } else {
      if (typeof window !== 'undefined') {
        const defaultX = Math.max(window.innerWidth - 380, 0);
        setPosition({ x: defaultX, y: 80 });
      }
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current || isMobile) return;
      e.preventDefault();
      
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      
      const newPos = {
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy
      };
      
      // Roughly keep within window bounds
      newPos.x = Math.max(0, Math.min(newPos.x, window.innerWidth - 200));
      newPos.y = Math.max(0, Math.min(newPos.y, window.innerHeight - 50));

      dragRef.current.lastPos = newPos;
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      if (isDragging && dragRef.current?.lastPos) {
        localStorage.setItem('calendarTasksPos', JSON.stringify(dragRef.current.lastPos));
      }
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMobile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position?.x || 0,
      initialY: position?.y || 0,
      lastPos: position || {x: 0, y: 0}
    };
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/calendar/events');
      const data = await res.json();
      
      if (data.reauth) {
        setAuthenticated(false);
      } else {
        setAuthenticated(data.authenticated);
      }
      
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events', err);
    } finally {
      setLoading(loading => false);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const markAsCompleted = async (eventId: string) => {
    try {
      // Optimistic update
      const originalEvents = [...events];
      setEvents(events.map(e => e.id === eventId ? { ...e, summary: e.summary.startsWith('✅') ? e.summary : `✅ ${e.summary}` } : e));

      const res = await fetch(`/api/calendar/events?eventId=${eventId}`, {
        method: 'PATCH',
      });

      const data = await res.json();

      if (!res.ok) {
        // Rollback on error
        setEvents(originalEvents);
        
        if (data.reauth) {
          setAuthenticated(false);
          alert('New permissions are required to update events. Please reconnect your calendar.');
          return;
        }

        console.error('Failed to complete task', data.error);
        alert('Failed to mark task as completed. Please try again.');
      }
    } catch (err) {
      console.error('Error completing task', err);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskSummary.trim()) return;

    setAddingTask(true);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: newTaskSummary }),
      });

      const data = await res.json();

      if (res.ok) {
        setEvents(prev => [...prev, data.event]);
        setNewTaskSummary('');
      } else {
        if (data.reauth) {
          setAuthenticated(false);
          alert('New permissions are required to create events. Please reconnect your calendar.');
          return;
        }
        alert(data.error || 'Failed to add task');
      }
    } catch (err) {
      console.error('Error adding task', err);
    } finally {
      setAddingTask(false);
    }
  };




  if (loading) {
    return (
      <div className="calendar-panel loading">
        <div className="spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }



  const panelStyle = (!isMobile && position) 
    ? { 
        position: 'fixed' as const, 
        left: position.x, 
        top: position.y, 
        margin: 0, 
        zIndex: 100 
      } 
    : {};

  return (
    <div className={`calendar-panel ${isDragging ? 'dragging' : ''}`} style={panelStyle}>
      <div 
        className="panel-header" 
        onMouseDown={handleMouseDown}
        style={{ cursor: isMobile ? 'default' : (isDragging ? 'grabbing' : 'grab') }}
      >
        <h3>Today's Tasks</h3>
        <span className="task-count">{events.length}</span>
      </div>
      
      <div className="events-list">
        {events.length === 0 ? (
          <p className="no-events">No tasks for today! 🎉</p>
        ) : (
          events.map(event => {
              const isFullDay = !event.start.includes('T');
              const isCompleted = event.summary.startsWith('✅');
              return (
            <div key={event.id} className={`event-item group ${isCompleted ? 'completed' : ''}`}>
              <button 
                className="complete-trigger"
                onClick={() => !isCompleted && markAsCompleted(event.id)}
                title={isCompleted ? "Completed" : "Mark as completed"}
                disabled={isCompleted}
              >
                <div className={`check-circle ${isCompleted ? 'checked' : ''}`}>
                  {isCompleted && '✓'}
                </div>
              </button>
              <div className="event-content">
                <div className="event-time">
                  {isFullDay ? 'All Day' : formatTime(event.start)}
                </div>
                <div className="event-details">
                  <div className="event-summary">{event.summary}</div>
                </div>
              </div>
            </div>
          )})
        )}
      </div>

      <form className="add-task-form" onSubmit={addTask}>
        <input 
          type="text" 
          placeholder="Add a new task..." 
          value={newTaskSummary}
          onChange={(e) => setNewTaskSummary(e.target.value)}
          disabled={addingTask}
        />
        <button type="submit" disabled={addingTask || !newTaskSummary.trim()}>
          {addingTask ? '...' : '+'}
        </button>
      </form>



      <style jsx>{`
        .calendar-panel {
          background: var(--bg-color);
          border-radius: 12px;
          border: 1px solid var(--border-medium);
          padding: 20px;
          width: 100%;
          max-width: 350px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          height: fit-content;
          transition: box-shadow 0.2s;
        }

        .calendar-panel.dragging {
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-light);
          user-select: none;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .task-count {
          background: var(--color-green-light);
          color: var(--color-green);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .events-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .event-item {
          display: flex;
          gap: 12px;
          padding: 10px;
          border-radius: 8px;
          background: var(--category-bg);
          transition: background 0.2s;
        }

        .event-item:hover {
          background: var(--cell-bg);
        }

        .event-item.completed {
          background: var(--bg-color);
          opacity: 0.7;
        }

        .event-item.completed .event-summary {
          text-decoration: line-through;
          color: var(--text-secondary);
        }

        .event-item.completed .event-time {
          color: var(--text-secondary);
        }


        .complete-trigger {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }

        .check-circle {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border-dark);
          border-radius: 50%;
          transition: all 0.2s;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
        }

        .check-circle.checked {
          background: var(--color-green);
          border-color: var(--color-green);
          color: white;
        }


        .complete-trigger:hover .check-circle {
          border-color: var(--color-green);
          background: var(--color-green-light);
        }

        .complete-trigger:hover .check-circle::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: var(--color-green);
          font-size: 10px;
          font-weight: 800;
        }

        .event-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .event-time {
          font-size: 12px;
          color: var(--color-green);
          font-weight: 600;
          min-width: 60px;
          padding-top: 2px;
        }

        .event-summary {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .no-events {
          color: var(--text-secondary);
          text-align: center;
          padding: 20px 0;
          font-size: 14px;
        }

        .auth-needed {
          text-align: center;
          padding: 30px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .auth-icon {
          background: var(--color-green-light);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .auth-needed h3 {
          font-size: 20px;
          margin: 0;
          color: var(--text-primary);
        }

        .auth-needed p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0 0 12px 0;
        }

        .connect-button {
          background: white;
          color: #3c4043;
          border: 1px solid var(--border-medium);
          padding: 10px 24px;
          border-radius: 24px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
        }

        .connect-button:hover {
          background: #f8f9fa;
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
          border-color: transparent;
        }

        .connect-button:active {
          background: #f1f3f4;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid var(--border-light);
          border-top: 3px solid var(--color-green);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }
        .add-task-form {
          display: flex;
          gap: 8px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid var(--border-light);
        }

        .add-task-form input {
          flex: 1;
          border: 1px solid var(--border-medium);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .add-task-form input:focus {
          border-color: var(--color-green);
        }

        .add-task-form button {
          background: var(--color-green);
          color: white;
          border: none;
          border-radius: 6px;
          width: 36px;
          height: 36px;
          font-size: 20px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .add-task-form button:hover:not(:disabled) {
          background: #0ea85d;
        }

        .add-task-form button:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
