import { isOpen } from '@flyms/shared';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFieldMap, usePrograms } from '@/features/programs/api';
import { DataState } from '@/features/programs/DataState';
import { sortPrograms } from '@/features/programs/filters';
import { ProgramCard } from '@/features/programs/ProgramCard';

export function UniversityPage() {
  const { slug = '' } = useParams();
  const { programs, isPending, isError, refetch } = usePrograms();
  const fieldMap = useFieldMap();
  const list = sortPrograms(
    programs.filter((p) => p.university_slug === slug),
    'deadline',
    'asc',
  );
  const uni = list[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <DataState isPending={isPending} isError={isError} onRetry={() => void refetch()}>
        {!uni ? (
          <EmptyState
            title="University not found"
            action={
              <Link to="/explore" className="font-semibold text-primary hover:underline">
                Browse all programs
              </Link>
            }
          />
        ) : (
          <>
            <header>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {uni.university_name}
              </h1>
              <p className="mt-1 text-muted">
                {uni.city}, {uni.german_state}
                {uni.qs_ranking && ` · QS ${uni.qs_ranking}`} · {list.length} program
                {list.length === 1 ? '' : 's'} ·{' '}
                {list.filter((p) => isOpen(p.status.status)).length} open now
              </p>
              <Link
                to={`/map?uni=${slug}&status=all`}
                className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Show on map
              </Link>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => (
                <ProgramCard
                  key={p.id}
                  program={p}
                  fieldColor={fieldMap.get(p.field_slug)?.color}
                />
              ))}
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
