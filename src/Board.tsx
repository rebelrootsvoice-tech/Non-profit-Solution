import { FileText } from 'lucide-react';

export function Board() {
  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-5">
        <h3 className="text-2xl font-semibold leading-6 text-stone-900">Board Management</h3>
        <p className="mt-2 text-sm text-stone-500">
          Governance, meetings, tasks, votes, and document library. (Phase 4)
        </p>
      </div>
      <div className="rounded-xl bg-white p-12 text-center shadow-sm border border-stone-200">
        <FileText className="mx-auto h-12 w-12 text-stone-400" />
        <h3 className="mt-2 text-sm font-semibold text-stone-900">Coming Soon</h3>
        <p className="mt-1 text-sm text-stone-500">
          The board management module will be built in Phase 4.
        </p>
      </div>
    </div>
  );
}
