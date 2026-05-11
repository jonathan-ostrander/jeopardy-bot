import React from 'react';
import { PublicPlayer, GameRound } from '../types';

interface ScorePanelProps {
  players: PublicPlayer[];
  currentPlayerId: string | null;
  round: GameRound;
}

export const ScorePanel: React.FC<ScorePanelProps> = ({ players, currentPlayerId, round }) => {
  const roundName = round === 'jeopardy' ? 'Jeopardy!' : round === 'double_jeopardy' ? 'Double Jeopardy!' : 'Final Jeopardy!';

  return (
    <div className="score-panel">
      <h2>{roundName}</h2>
      {players.map(player => (
        <div
          key={player.userId}
          className={`score-player ${player.userId === currentPlayerId ? 'current' : ''}`}
        >
          <span className="username">
            {player.isHost && '👑 '}{player.username}
          </span>
          <span className={`score ${player.score < 0 ? 'negative' : ''}`}>
            {player.score >= 0 ? `$${player.score}` : `-$${Math.abs(player.score)}`}
          </span>
        </div>
      ))}
    </div>
  );
};
