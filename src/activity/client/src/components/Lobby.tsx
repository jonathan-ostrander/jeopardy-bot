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
      <h1>JEOPARDY!</h1>
      <p className="lobby-subtitle">{players.length} PLAYER{players.length !== 1 ? 'S' : ''} JOINED</p>
      
      <div className="lobby-players">
        {players.map(player => (
          <div key={player.userId} className={`lobby-player ${player.isHost ? 'host' : ''}`}>
            {player.username}
            {player.isHost && <span className="host-crown"> 👑</span>}
          </div>
        ))}
      </div>

      <div className="lobby-actions">
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
    </div>
  );
};
