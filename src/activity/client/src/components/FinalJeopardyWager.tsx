import React, { useState } from 'react';
import { PublicPlayer } from '../types';

interface FinalJeopardyWagerProps {
  category: string;
  maxWager: number;
  canWager: boolean;
  onWager: (amount: number) => void;
  players: PublicPlayer[];
}

export const FinalJeopardyWager: React.FC<FinalJeopardyWagerProps> = ({
  category,
  maxWager,
  canWager,
  onWager,
  players,
}) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!isNaN(num) && num >= 0 && num <= maxWager) {
      onWager(num);
    }
  };

  return (
    <div className="lobby">
      <h1>🏁 Final Jeopardy!</h1>
      <p>Category: <strong>{category}</strong></p>
      
      {canWager ? (
        <form onSubmit={handleSubmit} style={{ marginTop: '40px' }}>
          <p>Your max wager: ${maxWager}</p>
          <input
            type="number"
            className="wager-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            max={maxWager}
            placeholder="Enter wager..."
            autoFocus
          />
          <button type="submit" className="button button-primary">
            Submit Wager
          </button>
        </form>
      ) : (
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <p>Wager submitted! Waiting for other players...</p>
          <div className="lobby-players" style={{ marginTop: '20px' }}>
            {players.map(p => (
              <div key={p.userId} className="lobby-player">
                {p.username} - {p.score >= 0 ? `$${p.score}` : `-$${Math.abs(p.score)}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
