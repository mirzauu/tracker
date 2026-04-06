"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './goals.module.css';
import { getGoals, createGoal, updateGoal, deleteGoal, getCategories, createCategory } from '../actions';

type GoalType = 'daily' | 'weekly' | 'monthly';
type Priority = 'low' | 'medium' | 'high';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Goal {
  id: string;
  name: string;
  mission: string;
  type: GoalType;
  target: number;
  priority: Priority;
  reminderOn: boolean;
  reminderTime: string;
  categoryId: string | null;
  category?: Category | null;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  
  const [formData, setFormData] = useState<Omit<Goal, 'id' | 'category'>>({
    name: '',
    mission: '',
    type: 'daily',
    target: 1,
    priority: 'medium',
    reminderOn: false,
    reminderTime: '09:00',
    categoryId: null
  });

  const refreshData = async () => {
    const [goalsData, catsData] = await Promise.all([getGoals(), getCategories()]);
    setGoals(goalsData as unknown as Goal[]);
    setCategories(catsData as unknown as Category[]);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleCreate = async () => {
    await createGoal(formData);
    resetForm();
    refreshData();
  };

  const handleUpdate = async () => {
    if (!isEditing) return;
    await updateGoal(isEditing, formData);
    resetForm();
    refreshData();
  };

  const handleDelete = async (id: string) => {
    await deleteGoal(id);
    refreshData();
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const result = await createCategory(newCatName);
    if (result) {
      setFormData({ ...formData, categoryId: result.id });
      setNewCatName('');
      setShowCatModal(false);
      refreshData();
    }
  };

  const startEdit = (goal: Goal) => {
    setIsEditing(goal.id);
    setFormData({
      name: goal.name,
      mission: goal.mission,
      type: goal.type,
      target: goal.target,
      priority: goal.priority,
      reminderOn: goal.reminderOn,
      reminderTime: goal.reminderTime,
      categoryId: goal.categoryId
    });
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({
      name: '',
      mission: '',
      type: 'daily',
      target: 1,
      priority: 'medium',
      reminderOn: false,
      reminderTime: '09:00',
      categoryId: null
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <Link href="/" className={styles.backLink}>
            ← Back to Tracker
          </Link>
          <h1>Manage Your Goals</h1>
        </div>
      </header>

      <div className={styles.card}>
        <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
          {isEditing ? 'Edit Goal' : 'Create New Goal'}
        </h2>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>Goal Name</label>
          <input 
            type="text" 
            className={styles.input} 
            placeholder="e.g., Learn Spanish" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Mission Statement</label>
          <textarea 
            className={styles.textarea} 
            placeholder="Why is this goal important?" 
            rows={3}
            value={formData.mission}
            onChange={e => setFormData({...formData, mission: e.target.value})}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Category</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                className={styles.select}
                value={formData.categoryId || ''}
                onChange={e => setFormData({...formData, categoryId: e.target.value || null})}
              >
                <option value="">No Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button 
                className={`${styles.btn} ${styles.secondaryBtn}`}
                style={{ padding: '0 12px' }}
                onClick={() => setShowCatModal(true)}
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Frequency Type</label>
            <select 
              className={styles.select}
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value as GoalType})}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {showCatModal && (
          <div className={styles.formGroup} style={{ background: 'var(--hover-bg)', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px dashed var(--border-medium)' }}>
            <label className={styles.label}>New Category Name</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className={styles.input} 
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                autoFocus
              />
              <button className={`${styles.btn} ${styles.primaryBtn}`} style={{ padding: '0 12px' }} onClick={handleAddCategory}>Add</button>
              <button className={`${styles.btn} ${styles.secondaryBtn}`} style={{ padding: '0 12px' }} onClick={() => setShowCatModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Target ({formData.type === 'daily' ? 'counts/day' : formData.type === 'weekly' ? 'times/week' : 'times/month'})</label>
            <input 
              type="number" 
              className={styles.input} 
              value={formData.target}
              onChange={e => setFormData({...formData, target: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Priority</label>
            <select 
              className={styles.select}
              value={formData.priority}
              onChange={e => setFormData({...formData, priority: e.target.value as Priority})}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Reminder Time</label>
            <input 
              type="time" 
              className={styles.input}
              value={formData.reminderTime}
              onChange={e => setFormData({...formData, reminderTime: e.target.value})}
              disabled={!formData.reminderOn}
            />
          </div>
          <div className={styles.switchGroup} style={{ alignSelf: 'center', marginTop: '20px' }}>
            <input 
              type="checkbox" 
              id="reminder" 
              checked={formData.reminderOn}
              onChange={e => setFormData({...formData, reminderOn: e.target.checked})}
            />
            <label htmlFor="reminder" className={styles.label} style={{ marginBottom: 0 }}>Enable Reminders</label>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.secondaryBtn}`} onClick={resetForm}>Cancel</button>
          <button 
            className={`${styles.btn} ${styles.primaryBtn}`}
            onClick={isEditing ? handleUpdate : handleCreate}
          >
            {isEditing ? 'Update Goal' : 'Save Goal'}
          </button>
        </div>
      </div>

      <div className={styles.goalList}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Active Goals ({goals.length})</h2>
        {goals.map(goal => (
          <div key={goal.id} className={styles.goalItem}>
            <div className={styles.goalInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>{goal.name}</h3>
                {goal.category && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
                    {goal.category.name}
                  </span>
                )}
              </div>
              <div className={styles.goalMeta}>
                <span className={`${styles.badge} ${styles['priority-' + goal.priority]}`}>{goal.priority}</span>
                <span>{goal.type.toUpperCase()}</span>
                <span>Target: {goal.target}</span>
                {goal.reminderOn && <span>🔔 {goal.reminderTime}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`${styles.btn} ${styles.secondaryBtn}`} 
                style={{ padding: '6px 12px' }}
                onClick={() => startEdit(goal)}
              >
                Edit
              </button>
              <button 
                className={`${styles.btn} ${styles.deleteBtn}`} 
                style={{ padding: '6px 12px' }}
                onClick={() => handleDelete(goal.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
