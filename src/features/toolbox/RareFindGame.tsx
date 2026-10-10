import { useEffect, useState, type FormEvent } from 'react';
import type { RareAnswerCount, RareMove, RareView } from '../../types/games.ts';

// Matches RareFind.MaxAnswer in the room service.
const MAX_ANSWER = 40;
const NORMS_URL = 'https://osf.io/jgcu6/';

function percent(count: number, total: number): string {
  const share = (count / total) * 100;
  return share < 1 ? `${share.toFixed(1)}%` : `${Math.round(share)}%`;
}

function Answers({ heading, answers }: { heading: string; answers: RareAnswerCount[] }) {
  return (
    <div className="sp-rare-answers">
      <h4>{heading}</h4>
      <ol>
        {answers.map(a => <li key={a.answer}><span>{a.answer}</span><b>{a.count}</b></li>)}
      </ol>
    </div>
  );
}

// "Name a fruit": find a right answer few other people gave. The service
// counts it and pays for its rarity; this keeps only what's being typed.
export default function RareFindGame({ play }: { play: (move: RareMove) => Promise<RareView> }) {
  const [view, setView] = useState<RareView | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (move: RareMove) => {
    setBusy(true); setError(null);
    try {
      setView(await play(move));
      if (move.operation !== 'answer') setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the game. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void run({ operation: 'open' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const heading = (
    <div className="sp-sorted-heading">
      <h3>Rare Find{view ? ` #${view.number}` : ''}</h3>
      <p className="sp-sorted-hint">Name something few people would. The rarer a right answer, the more it pays.</p>
    </div>
  );
  if (!view) {
    return <div className="sp-sorted">{heading}{error ? <p role="alert" className="sp-toolbox-error">{error}</p> : <p className="sp-sorted-hint">Finding a question…</p>}</div>;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim()) void run({ operation: 'answer', answer: draft.trim() });
  };
  const answered = view.answer !== undefined;
  const count = view.count ?? 0;
  const total = view.total ?? 1;

  return (
    <div className="sp-sorted">
      {heading}
      <div className="sp-rare-question">
        <p className="sp-rare-prompt">{view.prompt}</p>
        {!answered && view.asked !== undefined && <p className="sp-sorted-hint">{view.asked} people asked so far</p>}
      </div>

      {!answered ? (
        <form className="sp-rare-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="sp-rare-answer">Your answer</label>
          <input id="sp-rare-answer" className="sp-rare-input" value={draft} maxLength={MAX_ANSWER} autoComplete="off" autoFocus
            placeholder="Your answer" disabled={busy} onChange={event => setDraft(event.target.value)} />
          <button type="submit" className="sp-planning-primary" disabled={busy || !draft.trim()}>Answer</button>
        </form>
      ) : (
        <div className="sp-rare-result">
          <p className="sp-rare-verdict" role="status">
            <strong>{view.match ?? view.answer}</strong>
            {view.valid
              ? <span>{count} of {total} people said that ({percent(count, total)})</span>
              : <span>Nobody else has said that yet. It counts once someone does.</span>}
            <span className="sp-rare-paid">{view.replay ? "Replays don't earn coins." : view.paid ? `+${view.paid} coins` : "You've reached today's coin limit."}</span>
          </p>
          {view.valid && (
            <div className="sp-rare-meter" aria-hidden="true">
              <span style={{ width: `${Math.max(2, (count / total) * 100)}%` }} />
            </div>
          )}
          <div className="sp-rare-lists">
            {view.common && <Answers heading="Most said" answers={view.common} />}
            {view.rarest && <Answers heading="Rarest on the list" answers={view.rarest} />}
          </div>
          <button type="button" className="sp-planning-primary" disabled={busy} onClick={() => void run({ operation: 'next' })}>Next question</button>
        </div>
      )}
      {error && <p role="alert" className="sp-toolbox-error">{error}</p>}
      <p className="sp-rare-credit">
        Counts from players here and the <a href={NORMS_URL} target="_blank" rel="noreferrer">category norms</a> by Banks and Connell (CC BY 4.0).
      </p>
    </div>
  );
}
