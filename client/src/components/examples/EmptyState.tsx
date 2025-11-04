import EmptyState from '../EmptyState';
import { Card } from '@/components/ui/card';

export default function EmptyStateExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
      <Card>
        <EmptyState type="pending" />
      </Card>
      <Card>
        <EmptyState type="completed" />
      </Card>
    </div>
  );
}
