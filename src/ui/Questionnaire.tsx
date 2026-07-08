import type { AnswerMap, Content } from '../engine/model.js';

interface QuestionnaireProps {
  content: Content;
  answers: AnswerMap;
  onChange: (questionId: string, optionId: string) => void;
  onReset: () => void;
}

/**
 * Pure renderer: radio group per question, in content order. Answering is live
 * — the parent recomputes the recommendation on every change. No submit step,
 * no validation gates; unanswered questions are allowed and surfaced as
 * assumptions in the result.
 */
export function Questionnaire({ content, answers, onChange, onReset }: QuestionnaireProps) {
  const answeredCount = content.questions.filter((q) => answers[q.id] != null).length;

  return (
    <section className="questionnaire" aria-label="Questionnaire">
      <div className="questionnaire__head">
        <p className="questionnaire__progress" aria-live="polite">
          {answeredCount} of {content.questions.length} answered
        </p>
        {answeredCount > 0 && (
          <button type="button" className="btn btn--ghost" onClick={onReset}>
            Start over
          </button>
        )}
      </div>

      <ol className="questionnaire__list">
        {content.questions.map((q, i) => (
          <li key={q.id} className="question">
            <fieldset className="question__set">
              <legend className="question__prompt">
                <span className="question__num">{i + 1}</span>
                {q.prompt}
              </legend>
              <div className="question__options">
                {q.options.map((opt) => {
                  const id = `${q.id}--${opt.id}`;
                  const checked = answers[q.id] === opt.id;
                  return (
                    <label
                      key={opt.id}
                      htmlFor={id}
                      className={`option${checked ? ' option--checked' : ''}`}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={q.id}
                        value={opt.id}
                        checked={checked}
                        onChange={() => onChange(q.id, opt.id)}
                      />
                      <span className="option__label">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
    </section>
  );
}
