import { useState } from 'react';
import type { AnswerMap } from './engine/model.js';
import { score } from './engine/score.js';
import { encodeState } from './state/encode.js';
import { useContent } from './ui/useContent.js';
import { Questionnaire } from './ui/Questionnaire.js';
import { LivePanel } from './ui/LivePanel.js';
import { Breakdown } from './ui/Breakdown.js';
import { ExportView } from './ui/ExportView.js';
import { CardCanvas } from './ui/CardCanvas.js';

type Mode = 'cards' | 'classic';

/** Read the view + state off the URL once at module load (no router lib). */
function readUrl(): { view: string | null; state: string | null } {
  if (typeof window === 'undefined') return { view: null, state: null };
  const q = new URLSearchParams(window.location.search);
  return { view: q.get('view'), state: q.get('state') };
}

export function App() {
  const loaded = useContent();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('cards');
  const { view, state } = readUrl();

  if (loaded.status === 'loading') {
    return <main className="app app--status">Loading…</main>;
  }
  if (loaded.status === 'error') {
    return (
      <main className="app app--status app--error">
        Could not load the advisor content ({loaded.message}). If you are running locally,
        build it first with <code>npm run content:build</code>.
      </main>
    );
  }

  const content = loaded.content;

  if (view === 'export') {
    return <ExportView content={content} state={state} />;
  }

  const result = score(answers, content);
  const anyAnswered = content.questions.some((q) => answers[q.id] != null);

  const onChange = (questionId: string, optionId: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));

  const onClear = (questionId: string) =>
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });

  const onReset = () => {
    setAnswers({});
    setDetailOpen(false);
  };

  const onCreateOnePager = () => {
    const encoded = encodeState(answers, content);
    const url = `${window.location.pathname}?view=export&state=${encodeURIComponent(encoded)}`;
    window.location.assign(url);
  };

  const modeToggle = (
    <div className="modeswitch no-print" role="group" aria-label="View mode">
      <button
        type="button"
        className={`modeswitch__btn${mode === 'cards' ? ' modeswitch__btn--on' : ''}`}
        aria-pressed={mode === 'cards'}
        onClick={() => setMode('cards')}
      >
        Card board
      </button>
      <button
        type="button"
        className={`modeswitch__btn${mode === 'classic' ? ' modeswitch__btn--on' : ''}`}
        aria-pressed={mode === 'classic'}
        onClick={() => setMode('classic')}
      >
        Questionnaire
      </button>
    </div>
  );

  if (mode === 'cards') {
    return (
      <div className="app app--cards">
        {modeToggle}
        <CardCanvas
          content={content}
          answers={answers}
          result={result}
          onPlace={onChange}
          onClear={onClear}
          onReset={onReset}
          onCreateOnePager={onCreateOnePager}
        />
        {anyAnswered && detailOpen && (
          <Breakdown content={content} answers={answers} result={result} />
        )}
      </div>
    );
  }

  return (
    <div className="app app--split">
      {modeToggle}
      <header className="app__header">
        <h1 className="app__title">Agent Adoption Advisor</h1>
        <p className="app__lede">
          Answer the questions to see which Microsoft agent approach fits your scenario. The
          recommendation on the right updates live — with honest tradeoffs and a shareable one-pager.
        </p>
      </header>

      <div className="split">
        <div className="split__questions">
          <Questionnaire
            content={content}
            answers={answers}
            onChange={onChange}
            onReset={onReset}
          />
        </div>
        <div className="split__panel">
          <LivePanel
            content={content}
            answers={answers}
            result={result}
            onCreateOnePager={onCreateOnePager}
            onToggleDetail={() => setDetailOpen((v) => !v)}
            detailOpen={detailOpen}
          />
        </div>
      </div>

      {anyAnswered && detailOpen && (
        <Breakdown content={content} answers={answers} result={result} />
      )}
    </div>
  );
}
