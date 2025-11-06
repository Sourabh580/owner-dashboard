import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface OrderCardProps {
  order?: any;
  isNew?: boolean;
  onComplete?: () => void;
}

export default function OrderCard({ order, onComplete, isNew = false }: OrderCardProps) {
  if (!order) return null;

  const { id, customer_name, items = [], total_price, status, created_at } = order;

  // Safely parse items and include quantity + price
  const safeItems: OrderItem[] = Array.isArray(items)
    ? items.map((item: any) => {
        if (typeof item === "string") {
          const match = item.match(/^(\d+)x\s+(.+)$/);
          return match
            ? { quantity: parseInt(match[1]), name: match[2], price: 0 }
            : { quantity: 1, name: item, price: 0 };
        } else if (typeof item === "object" && item !== null) {
          return {
            name: item.name || "Unknown",
            quantity: item.quantity || item.qty || 1,
            price: item.price || 0,
          };
        }
        return { name: "Unknown", quantity: 1, price: 0 };
      })
    : [];

  const isPending = status === "pending";

  return (
    <Card
      className={`p-6 space-y-4 transition-all duration-300 ${
        isNew ? "ring-2 ring-primary animate-pulse" : ""
      } ${isPending ? "hover:shadow-md" : "opacity-75"}`}
    >
      {/* Header */}
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
          {created_at
            ? formatDistanceToNow(new Date(created_at), { addSuffix: true })
            : ""}
        </span>
      </div>

      {/* Customer name */}
      <div>
        <h3 className="font-medium text-base">{customer_name || "Guest"}</h3>
      </div>

      {/* Items with quantity and price */}
      <div className="space-y-2">
        {safeItems.length > 0 ? (
          safeItems.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.name} × {item.quantity}
              </span>
              {item.price ? (
                <span className="font-medium">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No items listed</p>
        )}
      </div>

      {/* Total */}
      {total_price && (
        <div className="flex justify-between font-semibold pt-2 border-t">
          <span>Total:</span>
          <span>₹{total_price}</span>
        </div>
      )}

      {/* Complete button */}
      {isPending && onComplete && (
        <Button className="w-full mt-2" onClick={onComplete}>
          Mark as Completed
        </Button>
      )}
    </Card>
  );
}
