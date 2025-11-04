import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, ShoppingBag } from "lucide-react";

interface RevenueCardProps {
  todayRevenue: string;
  completedOrders: number;
  averageOrderValue: string;
}

export default function RevenueCard({
  todayRevenue,
  completedOrders,
  averageOrderValue,
}: RevenueCardProps) {
  return (
    <Card className="p-6 space-y-6 sticky top-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Today's Revenue
        </h2>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold" data-testid="text-revenue-total">
              ${todayRevenue}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Total earnings today</p>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Orders Completed</span>
            </div>
            <span className="font-semibold" data-testid="text-orders-completed">
              {completedOrders}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Average Order</span>
            </div>
            <span className="font-semibold" data-testid="text-avg-order">
              ${averageOrderValue}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
