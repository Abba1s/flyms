import { BookmarkIcon } from '@/components/icons';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { useLocalStore } from '@/stores/local';
import { track } from '@/lib/analytics';
import { trackProgramSave } from './api';

interface SaveButtonProps {
  programId: string;
  programName: string;
  variant?: 'icon' | 'full';
  className?: string;
}

export function SaveButton({
  programId,
  programName,
  variant = 'icon',
  className,
}: SaveButtonProps) {
  const saved = useLocalStore((s) => s.saved.some((x) => x.id === programId));
  const toggleSaved = useLocalStore((s) => s.toggleSaved);
  const toast = useToast();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowSaved = toggleSaved(programId);
    trackProgramSave(programId, nowSaved);
    if (nowSaved) track('Program Save');
    toast(nowSaved ? 'Saved to My List' : 'Removed from My List', {
      label: 'Undo',
      onClick: () => {
        toggleSaved(programId);
        trackProgramSave(programId, !nowSaved);
      },
    });
  };

  const label = saved ? `Remove ${programName} from My List` : `Save ${programName} to My List`;

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors',
          saved
            ? 'border-primary bg-primary/12 text-primary'
            : 'border-border bg-surface text-text hover:bg-surface-2',
          className,
        )}
      >
        <BookmarkIcon filled={saved} className="h-4 w-4" />
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? 'Saved' : 'Save to My List'}
      className={cn(
        // Above the card's full-card link overlay.
        'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-md transition-colors hover:bg-surface-2',
        saved ? 'text-primary' : 'text-muted hover:text-text',
        className,
      )}
    >
      <BookmarkIcon filled={saved} className="h-5 w-5" />
    </button>
  );
}
