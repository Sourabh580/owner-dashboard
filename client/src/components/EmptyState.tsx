import { CheckCircle2, Clock } from "lucide-react";

interface EmptyStateProps {
  type: "pending" | "completed";
}

export default function EmptyState({ type }: EmptyStateProps) {
  const isPending = type === "pending";
  
  return (
    <div 
      className="flex flex-col items-center justify-center py-12 text-center"
      data-testid={`empty-${type}`}
    >
      {isPending ? (
        <CheckCircle2 className="w-12 h-12 text-muted-foreground/40 mb-3" />
      ) : (
        <Clock className="w-12 h-12 text-muted-foreground/40 mb-3" />
      )}
      <p className="text-muted-foreground">
        {isPending 
          ? "All caught up! No pending orders."
          : "Completed orders will appear here"}
      </p>
    </div>
  );
}
