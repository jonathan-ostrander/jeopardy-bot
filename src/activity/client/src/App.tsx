import { FC } from 'react';
import { useDiscordSdk } from './hooks/useDiscordSdk';
import { useGameSocket } from './hooks/useGameSocket';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { ScorePanel } from './components/ScorePanel';
import { ClueOverlay } from './components/ClueOverlay';
import { ResultOverlay } from './components/ResultOverlay';
import { WagerInput } from './components/WagerInput';
import { FinalJeopardyWager } from './components/FinalJeopardyWager';
import { FinalJeopardyAnswer } from './components/FinalJeopardyAnswer';
import { FinalJeopardyReveal } from './components/FinalJeopardyReveal';
import { GameOver } from './components/GameOver';
import { TimerDisplay } from './components/TimerDisplay';
import './index.css';

const App: FC = () => {
  const { ready, error: sdkError, accessToken, userId, username, channelId } = useDiscordSdk();
  const { gameState, privateState, error: wsError, connected, sendAction } = useGameSocket(channelId, accessToken);

  if (sdkError || wsError) {
    return (
      <div className="error-screen">
        <h1>Error</h1>
        <p>{sdkError || wsError}</p>
      </div>
    );
  }

  if (!ready || !connected) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>{!ready ? 'Connecting to Discord...' : 'Connecting to game server...'}</p>
      </div>
    );
  }

  const isHost = gameState?.players.find(p => p.userId === userId)?.isHost ?? false;
  const isCurrentPlayer = gameState?.currentPlayerId === userId;
  const isAnsweringPlayer = gameState?.currentAnsweringPlayerId === userId;

  // Show lobby if no game exists yet (gameState is null) or game is in waiting status
  if (!gameState || gameState.status === 'waiting') {
    return (
      <div className="app">
        <Lobby
          players={gameState?.players || []}
          isHost={isHost}
          userId={userId!}
          onJoin={() => sendAction('join', { username })}
          onStart={() => sendAction('start')}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <TimerDisplay timeRemaining={gameState.timeRemaining} />

      {(gameState.status === 'selecting' || gameState.status === 'reading' || gameState.status === 'answering') && (
        <div className="game-layout">
          <div className="board-container">
            {gameState.correctAnswer ? (
              <ResultOverlay
                answer={gameState.correctAnswer}
                category={gameState.lastQuestionCategory || ''}
                value={gameState.lastQuestionValue || 0}
                isDailyDouble={gameState.lastQuestionIsDailyDouble}
                correctPlayerIds={gameState.correctPlayerIds}
                players={gameState.players}
                onDismiss={() => sendAction('dismiss_result')}
              />
            ) : gameState.selectedQuestion ? (
              <ClueOverlay
                question={gameState.selectedQuestion}
                isAnsweringPlayer={isAnsweringPlayer}
                userId={userId!}
                attemptedPlayerIds={gameState.attemptedPlayerIds}
                onBuzz={() => sendAction('buzz')}
                onPass={() => sendAction('pass')}
                onAnswer={(text) => sendAction('answer', { text })}
              />
            ) : (
              <GameBoard
                board={gameState.board}
                isCurrentPlayer={isCurrentPlayer}
                currentPlayerId={gameState.currentPlayerId}
                onSelect={(categoryIndex, questionIndex) =>
                  sendAction('select', { categoryIndex, questionIndex })
                }
              />
            )}
          </div>
          
          <ScorePanel
            players={gameState.players}
            currentPlayerId={gameState.currentPlayerId}
            round={gameState.round}
          />
        </div>
      )}

      {gameState.status === 'daily_double_wager' && (
        <div className="game-layout">
          <div className="board-container">
            <WagerInput
              maxWager={privateState?.maxWager || 0}
              isDailyDouble={true}
              onWager={(amount) => sendAction('wager', { amount })}
            />
          </div>
          <ScorePanel
            players={gameState.players}
            currentPlayerId={gameState.currentPlayerId}
            round={gameState.round}
          />
        </div>
      )}

      {gameState.status === 'final_jeopardy_wager' && (
        <FinalJeopardyWager
          category={gameState.board.finalJeopardy?.category || ''}
          maxWager={privateState?.maxWager || 0}
          canWager={privateState?.canWager || false}
          onWager={(amount) => sendAction('wager', { amount })}
          players={gameState.players}
        />
      )}

      {gameState.status === 'final_jeopardy_answering' && (
        <FinalJeopardyAnswer
          clue={privateState?.finalJeopardyClue || ''}
          onAnswer={(text) => sendAction('answer', { text })}
          timeRemaining={gameState.timeRemaining}
        />
      )}

      {gameState.status === 'final_jeopardy_reveal' && (
        <FinalJeopardyReveal
          answer={gameState.correctAnswer || ''}
          category={gameState.lastQuestionCategory || ''}
          correctPlayerIds={gameState.correctPlayerIds}
          players={gameState.players}
          timeRemaining={gameState.timeRemaining}
        />
      )}

      {gameState.status === 'ended' && (
        <GameOver
          players={gameState.players}
          onPlayAgain={() => sendAction('start')}
          isHost={isHost}
        />
      )}
    </div>
  );
}

export default App;
