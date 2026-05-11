import React, { useState } from 'react';
import { generateClueSvg } from '../svgRenderer';

interface ClueOverlayProps {
  question: {
    clue: string;
    categoryName: string;
    value: number;
    isDailyDouble: boolean;
  };
  isAnsweringPlayer: boolean;
  userId: string;
  attemptedPlayerIds: string[];
  onBuzz: () => void;
  onAnswer: (text: string) => void;
}

export const ClueOverlay: React.FC<ClueOverlayProps> = ({
  question,
  isAnsweringPlayer,
  userId,
  attemptedPlayerIds,
  onBuzz,
  onAnswer,
}) => {
  const [answerText, setAnswerText] = useState('');

  const svgString = generateClueSvg(
    question.clue,
    question.categoryName,
    question.value,
    question.isDailyDouble
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerText.trim()) {
      onAnswer(answerText.trim());
      setAnswerText('');
    }
  };

  return (
    <div className="clue-overlay">
      <div 
        dangerouslySetInnerHTML={{ __html: svgString }}
        style={{ 
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '700px',
        }}
      />

      {!isAnsweringPlayer && !attemptedPlayerIds.includes(userId) && (
        <button className="buzz-button" onClick={onBuzz}>
          BUZZ IN!
        </button>
      )}

      {isAnsweringPlayer && (
        <form className="answer-input-container" onSubmit={handleSubmit}>
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
      )}
    </div>
  );
};
