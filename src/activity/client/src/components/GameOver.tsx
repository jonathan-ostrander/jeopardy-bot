import React from 'react';
import { PublicPlayer } from '../types';

interface GameOverProps {
  players: PublicPlayer[];
  onPlayAgain: () => void;
  isHost: boolean;
}

export const GameOver: React.FC<GameOverProps> = ({ players, onPlayAgain, isHost }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  return (
    <div className="game-over">
      <h1>🎉 Game Over!</h1>
      
      <div className="final-standings">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.userId}
            className={`final-player ${player.userId === winner?.userId ? 'winner' : ''}`}
          >
            <span>
              {index === 0 && '🥇 '}
              {index === 1 && '🥈 '}
              {index === 2 && '🥉 '}
              {player.username}
            </span>
            <span className={player.score < 0 ? 'negative' : ''}>
              {player.score >= 0 ? `$${player.score}` : `-$${Math.abs(player.score)}`}
            </span>
          </div>
        ))}
      </div>

      {isHost && (
        <button className="button button-primary" onClick={onPlayAgain}>
          Play Again
        </button>
      )}
    </div>
  );
};
