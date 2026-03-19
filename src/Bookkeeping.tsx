import { DollarSign } from 'lucide-react';

export function Bookkeeping() {
  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-5">
        <h3 className="text-2xl font-semibold leading-6 text-stone-900">Bookkeeping</h3>
        <p className="mt-2 text-sm text-stone-500">
          Sync with QuickBooks and manage Plaid bank feeds. (Phase 2)
        </p>
      </div>
      <div className="rounded-xl bg-white p-12 text-center shadow-sm border border-stone-200">
        <DollarSign className="mx-auto h-12 w-12 text-stone-400" />
        <h3 className="mt-2 text-sm font-semibold text-stone-900">Coming Soon</h3>
        <p className="mt-1 text-sm text-stone-500">
          The bookkeeping operations layer will be built in Phase 2.
        </p>
      </div>
    </div>
  );
}
