import React, { useState } from 'react';

interface FinalJeopardyAnswerProps {
  clue: string;
  onAnswer: (text: string) => void;
  timeRemaining: number | null;
}

export const FinalJeopardyAnswer: React.FC<FinalJeopardyAnswerProps> = ({
  clue,
  onAnswer,
  timeRemaining,
}) => {
  const [answerText, setAnswerText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerText.trim()) {
      onAnswer(answerText.trim());
    }
  };

  return (
    <div className="lobby">
      <h1>🏁 Final Jeopardy!</h1>
      
      <div 
        className="clue-text"
        style={{ marginBottom: '40px', fontSize: '28px' }}
      >
        {clue}
      </div>

      {timeRemaining !== null && timeRemaining > 0 ? (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="answer-input"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="What is...?"
            autoFocus
          />
          <button type="submit" className="button button-primary">
            Submit Answer
          </button>
        </form>
      ) : (
        <p>Time's up! Calculating scores...</p>
      )}
    </div>
  );
};
