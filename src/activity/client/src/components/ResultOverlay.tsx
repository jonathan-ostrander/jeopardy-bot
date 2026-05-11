import React, { useEffect, useState } from 'react';

interface ResultOverlayProps {
  answer: string;
  correctPlayerIds: string[];
  onDismiss: () => void;
}

export const ResultOverlay: React.FC<ResultOverlayProps> = ({ answer, correctPlayerIds, onDismiss }) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className="result-overlay">
      <h2>✅ Answer</h2>
      <div className="answer">{answer}</div>
      {correctPlayerIds.length > 0 ? (
        <p>Correct players: {correctPlayerIds.join(', ')}</p>
      ) : (
        <p>No one got it right!</p>
      )}
      <button className="button button-primary" onClick={onDismiss} style={{ marginTop: '30px' }}>
        Continue ({countdown})
      </button>
    </div>
  );
};
