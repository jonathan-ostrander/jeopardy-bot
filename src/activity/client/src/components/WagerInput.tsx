import React, { useState } from 'react';

interface WagerInputProps {
  maxWager: number;
  isDailyDouble: boolean;
  onWager: (amount: number) => void;
}

export const WagerInput: React.FC<WagerInputProps> = ({ maxWager, isDailyDouble, onWager }) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!isNaN(num) && num >= 0 && num <= maxWager) {
      onWager(num);
    }
  };

  return (
    <div className="wager-container">
      <h2>{isDailyDouble ? '⚠️ DAILY DOUBLE!' : 'Place Your Wager'}</h2>
      <p>Max wager: ${maxWager}</p>
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          className="wager-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={0}
          max={maxWager}
          placeholder="$0"
          autoFocus
        />
        <button type="submit" className="button button-primary">
          Wager
        </button>
      </form>
    </div>
  );
};
