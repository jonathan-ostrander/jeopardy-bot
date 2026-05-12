import React, { useState, useEffect } from 'react';
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
  buzzDelayRemaining: number | null;
  buzzDelayTotal: number | null;
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
  buzzDelayRemaining,
  buzzDelayTotal,
  onBuzz,
  onPass,
  onAnswer,
}) => {
  const [answerText, setAnswerText] = useState('');

  const canBuzz = !isAnsweringPlayer && !attemptedPlayerIds.includes(userId) && currentAnsweringPlayerId === null && !question.isDailyDouble;
  const buzzDelayActive = buzzDelayRemaining !== null && buzzDelayRemaining > 0;
  const progress = buzzDelayTotal && buzzDelayTotal > 0
    ? (Math.max(0, buzzDelayRemaining || 0) / buzzDelayTotal) * 100
    : 100;

  const svgString = generateClueSvg(
    question.clue,
    question.categoryName,
    question.value,
    question.isDailyDouble
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && canBuzz && !buzzDelayActive) {
        e.preventDefault();
        onBuzz();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canBuzz, buzzDelayActive, onBuzz]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerText.trim()) {
      onAnswer(answerText.trim());
      setAnswerText('');
    }
  };

  const handleClick = () => {
    if (canBuzz && !buzzDelayActive) {
      onBuzz();
    }
  };

  const someoneElseBuzzedIn = currentAnsweringPlayerId !== null && currentAnsweringPlayerId !== userId;
  const isDailyDoubleNonSelector = question.isDailyDouble && !isAnsweringPlayer;

  return (
    <div 
      className={`clue-overlay ${canBuzz ? 'buzz-ready' : ''}`}
      onClick={handleClick}
      style={{ cursor: canBuzz && !buzzDelayActive ? 'pointer' : 'default' }}
    >
      <div className="clue-container">
        <div
          dangerouslySetInnerHTML={{ __html: svgString }}
          className="clue-svg-wrapper"
        />
      </div>

      {buzzDelayActive && (
        <div className="buzz-delay-indicator">
          <p className="buzz-delay-text">Get ready to buzz...</p>
          <div className="buzz-progress-container">
            <div 
              className="buzz-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {someoneElseBuzzedIn && !isDailyDoubleNonSelector && (
        <div className="clue-actions">
          <p className="locked-out-message">Someone else has buzzed in!</p>
        </div>
      )}

      {!isAnsweringPlayer && !attemptedPlayerIds.includes(userId) && !someoneElseBuzzedIn && !isDailyDoubleNonSelector && !buzzDelayActive && (
        <div className="clue-actions">
          <button className="buzz-button" onClick={(e) => { e.stopPropagation(); onBuzz(); }}>
            BUZZ IN!
          </button>
          <button className="pass-button" onClick={(e) => { e.stopPropagation(); onPass(); }}>
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
