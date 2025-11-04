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
  orderNumber: number;
  customerName: string;
  items: string[];
  totalPrice: string;
  status: "pending" | "completed";
  createdAt: Date;
  onComplete?: () => void;
  isNew?: boolean;
}

export default function OrderCard({
  orderNumber,
  customerName,
  items,
  totalPrice,
  status,
  createdAt,
  onComplete,
  isNew = false,
}: OrderCardProps) {
  const parseItems = (items: string[]): OrderItem[] => {
    return items.map(item => {
      const match = item.match(/^(\d+)x\s+(.+)$/);
      if (match) {
        return { quantity: parseInt(match[1]), name: match[2] };
      }
      return { quantity: 1, name: item };
    });
  };

  const parsedItems = parseItems(items);
  const isPending = status === "pending";

  return (
    <Card 
      className={`p-6 space-y-4 transition-all duration-300 ${
        isNew ? 'ring-2 ring-primary animate-pulse' : ''
      } ${isPending ? 'hover:shadow-md' : 'opacity-75'}`}
      data-testid={`card-order-${orderNumber}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={isPending ? "default" : "secondary"} data-testid={`badge-status-${orderNumber}`}>
            {isPending ? (
              <><Clock className="w-3 h-3 mr-1" />Order #{orderNumber}</>
            ) : (
              <><CheckCircle2 className="w-3 h-3 mr-1" />Order #{orderNumber}</>
            )}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground" data-testid={`text-time-${orderNumber}`}>
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </span>
      </div>

      <div>
        <h3 className="font-medium text-base" data-testid={`text-customer-${orderNumber}`}>
          {customerName}
        </h3>
      </div>

      <div className="space-y-2">
        {parsedItems.map((item, index) => (
          <div 
            key={index} 
            className="flex justify-between text-sm"
            data-testid={`text-item-${orderNumber}-${index}`}
          >
            <span className="text-muted-foreground">
              {item.quantity}x {item.name}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t flex items-center justify-between">
        <span className="text-lg font-bold" data-testid={`text-price-${orderNumber}`}>
          ${totalPrice}
        </span>
        {isPending && onComplete && (
          <Button 
            onClick={onComplete}
            size="sm"
            data-testid={`button-complete-${orderNumber}`}
          >
            Mark Complete
          </Button>
        )}
      </div>
    </Card>
  );
}
