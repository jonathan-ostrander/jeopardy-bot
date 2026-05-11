import React from 'react';

interface TimerDisplayProps {
  timeRemaining: number | null;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeRemaining }) => {
  if (timeRemaining === null) return null;

  const seconds = Math.ceil(timeRemaining / 1000);
  const isUrgent = seconds <= 5;

  return (
    <div className={`timer-display ${isUrgent ? 'urgent' : ''}`}>
      {seconds}s
    </div>
  );
};
