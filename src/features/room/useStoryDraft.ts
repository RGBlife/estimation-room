import { useEffect, useRef, useState } from 'react';

const STORY_MAX_LENGTH = 200;
const STORY_DEBOUNCE_MS = 300;

interface UseStoryDraftResult {
  storyDraft: string;
  storyInputRef: React.RefObject<HTMLInputElement | null>;
  handleStoryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// The story input is edited locally and written to Firestore debounced, so
// we don't do one write per keystroke and the snapshot echo can't fight the
// creator's in-progress typing.
export function useStoryDraft(
  roomStory: string,
  onSetStory: (story: string) => void,
): UseStoryDraftResult {
  const [storyDraft, setStoryDraft] = useState(roomStory);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (document.activeElement !== storyInputRef.current) setStoryDraft(roomStory);
  }, [roomStory]);
  useEffect(() => () => clearTimeout(storyTimerRef.current ?? undefined), []);

  const handleStoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, STORY_MAX_LENGTH);
    setStoryDraft(value);
    clearTimeout(storyTimerRef.current ?? undefined);
    storyTimerRef.current = setTimeout(() => {
      onSetStory(value);
    }, STORY_DEBOUNCE_MS);
  };

  return { storyDraft, storyInputRef, handleStoryChange };
}

export { STORY_MAX_LENGTH };
