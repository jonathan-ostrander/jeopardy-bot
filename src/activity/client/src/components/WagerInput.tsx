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
    if (!isNaN(num) && num > 0 && num <= maxWager) {
      onWager(num);
    }
  };

  return (
    <div className="wager-screen">
      <h2>{isDailyDouble ? '⚠️ DAILY DOUBLE!' : 'PLACE YOUR WAGER'}</h2>
      <p className="wager-label">Enter your wager amount:</p>
      <p className="wager-max">Max: ${maxWager}</p>
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
          Wager
        </button>
      </form>
    </div>
  );
};
