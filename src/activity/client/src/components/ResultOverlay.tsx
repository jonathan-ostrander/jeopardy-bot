import React, { useEffect, useState } from 'react';
import { generateAnswerSvg } from '../svgRenderer';
import { PublicPlayer } from '../types';

interface ResultOverlayProps {
  answer: string;
  category: string;
  value: number;
  isDailyDouble: boolean;
  correctPlayerIds: string[];
  players: PublicPlayer[];
  onDismiss: () => void;
}

export const ResultOverlay: React.FC<ResultOverlayProps> = ({
  answer,
  category,
  value,
  isDailyDouble,
  correctPlayerIds,
  players,
  onDismiss,
}) => {
  const [countdown, setCountdown] = useState(5);

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

  const svgString = generateAnswerSvg(answer, category, value, isDailyDouble);

  return (
    <div className="result-overlay">
      <div className="clue-container">
        <div
          dangerouslySetInnerHTML={{ __html: svgString }}
          className="clue-svg-wrapper"
        />
      </div>
      <div className="result-players">
        {correctPlayerIds.length > 0 ? (
          <p>
            Correct:{' '}
            {correctPlayerIds
              .map((id) => players.find((p) => p.userId === id)?.username || id)
              .join(', ')}
          </p>
        ) : (
          <p>No one got it right!</p>
        )}
      </div>
      <button className="button button-primary" onClick={onDismiss}>
        Continue ({countdown})
      </button>
    </div>
  );
};
