import React from 'react';
import { PublicPlayer } from '../types';

interface FinalJeopardyRevealProps {
  answer: string;
  category: string;
  correctPlayerIds: string[];
  players: PublicPlayer[];
  timeRemaining: number | null;
}

export const FinalJeopardyReveal: React.FC<FinalJeopardyRevealProps> = ({
  answer,
  category,
  correctPlayerIds,
  players,
  timeRemaining,
}) => {
  return (
    <div className="lobby">
      <h1>🏁 Final Jeopardy!</h1>
      <p>Category: <strong>{category}</strong></p>
      
      <div 
        className="clue-text"
        style={{ marginBottom: '20px', fontSize: '28px' }}
      >
        The answer was:
      </div>
      
      <div 
        className="clue-text"
        style={{ marginBottom: '40px', fontSize: '32px', fontWeight: 'bold' }}
      >
        {answer}
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

      {timeRemaining !== null && timeRemaining > 0 && (
        <p style={{ marginTop: '20px', color: '#666' }}>
          Final scores in {Math.ceil(timeRemaining / 1000)}s...
        </p>
      )}
    </div>
  );
};
