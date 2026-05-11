import React from 'react';

interface GameBoardProps {
  board: {
    categories: Array<{
      name: string;
      questions: Array<{
        value: number;
        isPlayed: boolean;
        isDailyDouble: boolean;
      }>;
    }>;
  };
  isCurrentPlayer: boolean;
  currentPlayerId: string | null;
  onSelect: (categoryIndex: number, questionIndex: number) => void;
}

const JEOPARDY_BLUE = '#071277';
const PLAYED_BG = '#333333';
const TEXT_GOLD = '#CEA15A';
const TEXT_WHITE = '#FFFFFF';
const BORDER_COLOR = '#000033';

export const GameBoard: React.FC<GameBoardProps> = ({ board, isCurrentPlayer, onSelect }) => {
  return (
    <div className="game-board">
      <div className="board-grid">
        {/* Category Headers */}
        {board.categories.map((cat, catIndex) => (
          <div key={`cat-${catIndex}`} className="category-header">
            <span className="category-name">{cat.name}</span>
          </div>
        ))}

        {/* Question Grid - Render row by row */}
        {Array.from({ length: 5 }, (_, qIndex) =>
          board.categories.map((cat, catIndex) => {
            const q = cat.questions[qIndex];
            return (
              <button
                key={`${catIndex}-${qIndex}`}
                className={`question-cell ${q.isPlayed ? 'played' : ''} ${!isCurrentPlayer ? 'disabled' : ''}`}
                onClick={() => !q.isPlayed && isCurrentPlayer && onSelect(catIndex, qIndex)}
                disabled={q.isPlayed || !isCurrentPlayer}
                title={q.isPlayed ? 'Already played' : `${cat.name} - $${q.value}`}
              >
                {!q.isPlayed && (
                  <span className="question-value">
                    ${q.value}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

// Inject styles
const style = document.createElement('style');
style.textContent = `
  .game-board {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .board-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: 1fr repeat(5, 2fr);
    gap: 4px;
    width: 100%;
    max-width: 1200px;
    aspect-ratio: 4 / 3;
    background: ${BORDER_COLOR};
    padding: 4px;
  }

  .category-header {
    background: ${JEOPARDY_BLUE};
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 6px;
    height: 100%;
    overflow: hidden;
  }

  .category-name {
    color: ${TEXT_WHITE};
    font-family: 'Swiss 911', Arial, sans-serif;
    font-size: clamp(11px, 1.6vw, 22px);
    text-align: center;
    text-transform: uppercase;
    line-height: 1.15;
    word-break: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
  }

  .question-cell {
    background: ${JEOPARDY_BLUE};
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
    padding: 0;
  }

  .question-cell:hover:not(.played):not(.disabled) {
    background: #0a1d8f;
  }

  .question-cell.played {
    background: ${PLAYED_BG};
    cursor: default;
  }

  .question-cell.disabled {
    cursor: default;
  }

  .question-value {
    color: ${TEXT_GOLD};
    font-family: 'Swiss 911', Arial, sans-serif;
    font-size: clamp(24px, 4vw, 60px);
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  }
`;
document.head.appendChild(style);
