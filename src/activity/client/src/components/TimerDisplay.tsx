import React, { useState, useEffect, useRef } from 'react';

interface TimerDisplayProps {
  timeRemaining: number | null;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeRemaining }) => {
  const [displayTime, setDisplayTime] = useState<number | null>(timeRemaining);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timeRemaining === null) {
      setDisplayTime(null);
      endTimeRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Calculate the absolute end time from the server-provided remaining time
    const now = Date.now();
    const newEndTime = now + timeRemaining;

    // Only reset if this is a significantly different timer (not just a re-broadcast)
    if (endTimeRef.current === null || Math.abs(newEndTime - endTimeRef.current) > 1000) {
      endTimeRef.current = newEndTime;
      setDisplayTime(timeRemaining);
    }

    // Start local countdown
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        const remaining = endTimeRef.current ? Math.max(0, endTimeRef.current - Date.now()) : 0;
        setDisplayTime(remaining);
        if (remaining <= 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timeRemaining]);

  if (displayTime === null) return null;

  const seconds = Math.ceil(displayTime / 1000);
  const isUrgent = seconds <= 5;

  return (
    <div className={`timer-display ${isUrgent ? 'urgent' : ''}`}>
      {seconds}s
    </div>
  );
};
