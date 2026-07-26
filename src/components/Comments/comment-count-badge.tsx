import { MessageSquare } from 'lucide-react'

// Compact comment counter for pallet cards so notes left on the detail page
// are visible from queues and lists. Renders nothing when there are none.
export function CommentCountBadge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-[#888] tabular-nums"
      title={`${count} comment${count === 1 ? '' : 's'}`}
    >
      <MessageSquare className="w-3 h-3" />
      {count}
    </span>
  )
}
