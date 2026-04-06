"use client";

import dynamic from 'next/dynamic';

const HabitTracker = dynamic(() => import('./Tracker'), { ssr: false });

export default HabitTracker;
