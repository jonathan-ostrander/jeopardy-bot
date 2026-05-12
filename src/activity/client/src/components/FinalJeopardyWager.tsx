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
    if (!isNaN(num) && num > 0 && num <= maxWager) {
      onWager(num);
    }
  };

  return (
    <div className="wager-screen">
      <h2>🏁 FINAL JEOPARDY!</h2>
      <p className="wager-label">Category: {category}</p>
      
      {canWager ? (
        <>
          <p className="wager-max">Max Wager: ${maxWager}</p>
          <form onSubmit={handleSubmit}>
            <input
              type="number"
              className="wager-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={maxWager}
              placeholder="$0"
              autoFocus
            />
            <button type="submit" className="button button-primary">
              Submit Wager
            </button>
          </form>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          {maxWager === 0 ? (
            <p className="wager-waiting">You cannot participate in Final Jeopardy with a non-positive score.</p>
          ) : (
            <p className="wager-waiting">Wager submitted! Waiting for other players...</p>
          )}
          <div className="lobby-players" style={{ marginTop: '30px' }}>
            {players.map(p => (
              <div key={p.userId} className="lobby-player">
                {p.username} — {p.score >= 0 ? `$${p.score}` : `-$${Math.abs(p.score)}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
