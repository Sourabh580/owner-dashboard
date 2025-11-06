import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderItem {
  name: string;
  quantity: number;
}

interface OrderCardProps {
  order?: any;
  isNew?: boolean;
  onComplete?: () => void;
}

export default function OrderCard({ order, onComplete, isNew = false }: OrderCardProps) {
  if (!order) return null;

  const {
    id,
    customer_name,
    items = [],
    total_price,
    status,
    created_at,
  } = order;

  const safeItems: OrderItem[] = Array.isArray(items)
    ? items.map((item: any) => {
        if (typeof item === "string") {
          const match = item.match(/^(\d+)x\s+(.+)$/);
          return match
            ? { quantity: parseInt(match[1]), name: match[2] }
            : { quantity: 1, name: item };
        } else if (typeof item === "object" && item !== null) {
          return { name: item.name || "Unknown", quantity: item.quantity || 1 };
        }
        return { name: "Unknown", quantity: 1 };
      })
    : [];

  const isPending = status === "pending";

  return (
    <Card
      className={`p-6 space-y-4 transition-all duration-300 ${
        isNew ? "ring-2 ring-primary animate-pulse" : ""
      } ${isPending ? "hover:shadow-md" : "opacity-75"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <Badge variant={isPending ? "default" : "secondary"}>
          {isPending ? (
            <>
              <Clock className="w-3 h-3 mr-1" /> Order #{id}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Order #{id}
            </>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {created_at ? formatDistanceToNow(new Date(created_at), { addSuffix: true }) : ""}
        </span>
      </div>

      <div>
        <h3 className="font-medium text-base">{customer_name || "Guest"}</h3>
      </div>

      <div className="space-y-2">
        {safeItems.length > 0 ? (
          safeItems.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}x {item.name}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No items listed</p>
        )}
      </div>

      {isPending && onComplete && (
        <Button className="w-full mt-2" onClick={onComplete}>
          Mark as Completed
        </Button>
      )}
    </Card>
  );
}
