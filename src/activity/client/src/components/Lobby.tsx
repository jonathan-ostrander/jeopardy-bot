import React from 'react';
import { PublicPlayer } from '../types';

interface LobbyProps {
  players: PublicPlayer[];
  isHost: boolean;
  userId: string;
  onJoin: () => void;
  onStart: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({ players, isHost, userId, onJoin, onStart }) => {
  const hasJoined = players.some(p => p.userId === userId);

  return (
    <div className="lobby">
      <h1>🎯 Jeopardy!</h1>
      <p>{players.length} player{players.length !== 1 ? 's' : ''} joined</p>
      
      <div className="lobby-players">
        {players.map(player => (
          <div key={player.userId} className={`lobby-player ${player.isHost ? 'host' : ''}`}>
            {player.username} {player.isHost && '👑'}
          </div>
        ))}
      </div>

      {!hasJoined && (
        <button className="button button-primary" onClick={onJoin}>
          Join Game
        </button>
      )}

      {isHost && players.length >= 1 && (
        <button className="button button-primary" onClick={onStart}>
          Start Game
        </button>
      )}
    </div>
  );
};
