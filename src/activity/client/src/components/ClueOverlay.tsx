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
  currentAnsweringPlayerId: string | null;
  onBuzz: () => void;
  onPass: () => void;
  onAnswer: (text: string) => void;
}

export const ClueOverlay: React.FC<ClueOverlayProps> = ({
  question,
  isAnsweringPlayer,
  userId,
  attemptedPlayerIds,
  currentAnsweringPlayerId,
  onBuzz,
  onPass,
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

  const someoneElseBuzzedIn = currentAnsweringPlayerId !== null && currentAnsweringPlayerId !== userId;
  const isDailyDoubleNonSelector = question.isDailyDouble && !isAnsweringPlayer;

  return (
    <div className="clue-overlay">
      <div className="clue-container">
        <div
          dangerouslySetInnerHTML={{ __html: svgString }}
          className="clue-svg-wrapper"
        />
      </div>

      {someoneElseBuzzedIn && !isDailyDoubleNonSelector && (
        <div className="clue-actions">
          <p className="locked-out-message">Someone else has buzzed in!</p>
        </div>
      )}

      {!isAnsweringPlayer && !attemptedPlayerIds.includes(userId) && !someoneElseBuzzedIn && !isDailyDoubleNonSelector && (
        <div className="clue-actions">
          <button className="buzz-button" onClick={onBuzz}>
            BUZZ IN!
          </button>
          <button className="pass-button" onClick={onPass}>
            PASS
          </button>
        </div>
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
