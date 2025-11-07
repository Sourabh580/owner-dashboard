import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useSound } from "@/hooks/use-sound";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

const BACKEND_URL = "https://nevolt-backend.onrender.com";
const RESTAURANT_ID = "res-1";

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [resetTime, setResetTime] = useState<number>(() => {
    const saved = localStorage.getItem("reset_time");
    return saved ? parseInt(saved) : 0;
  });
  const [visibleOrderIds, setVisibleOrderIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("visible_order_ids");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // 🟢 Fetch all orders
  const { data: allOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const rawData = await res.json();

      const parsed = rawData.map((order: any) => ({
        ...order,
        items:
          typeof order.items === "string"
            ? JSON.parse(order.items || "[]")
            : Array.isArray(order.items)
            ? order.items
            : [],
      }));

      // Filter only orders after last reset or explicitly visible
      const filtered = parsed.filter((o: any) => {
        const createdAt = new Date(o.created_at).getTime();
        return createdAt >= resetTime || visibleOrderIds.has(o.id);
      });

      // 💰 Calculate revenue (completed orders only)
      const revenue = filtered
        .filter((o: any) => o.status === "completed")
        .reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0);
      setTotalRevenue(revenue);

      return filtered;
    },
    refetchInterval: 8000,
  });

  // 🟡 Complete order mutation — updates local state & revenue
  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update order");
      return res.json();
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) =>
        oldOrders.map((o) =>
          o.id === updatedOrder.id ? { ...o, status: "completed" } : o
        )
      );

      // 💰 Increase revenue instantly using `total`
      const added = parseFloat(updatedOrder.total || 0);
      setTotalRevenue((prev) => prev + (isNaN(added) ? 0 : added));

      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked as completed.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // 🧠 Handle new order event
  const handleNewOrder = useCallback(
    (order: Order) => {
      const createdAt = new Date(order.created_at).getTime();

      // Only add order if it's after reset
      if (createdAt < resetTime) return;

      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) => {
        const exists = oldOrders.find((o) => o.id === order.id);
        if (exists) return oldOrders;
        return [order, ...oldOrders];
      });

      setVisibleOrderIds((prev) => {
        const updated = new Set(prev).add(order.id);
        localStorage.setItem("visible_order_ids", JSON.stringify([...updated]));
        return updated;
      });

      setNewOrderIds((prev) => new Set(prev).add(order.id));
      playNotificationSound();
      toast({
        title: "🔔 New Order Received!",
        description: `Order #${order.id} from table ${order.table_no}`,
      });
    },
    [playNotificationSound, toast, resetTime]
  );

  // 🧩 WebSocket for live orders
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  // 🧹 Reset handler
  const handleReset = () => {
    if (confirm("Do you want to reset the dashboard?")) {
      setTotalRevenue(0);
      setResetTime(Date.now());
      setVisibleOrderIds(new Set());
      localStorage.setItem("reset_time", Date.now().toString());
      localStorage.setItem("visible_order_ids", JSON.stringify([]));
      toast({ title: "Reset Done" });
    }
  };

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  const validOrders = Array.isArray(allOrders) ? allOrders : [];
  const pendingOrders = validOrders.filter((o) => o.status === "pending");
  const completedOrders = validOrders.filter((o) => o.status === "completed");

  // 📊 Average order value
  const averageOrderValue =
    completedOrders.length > 0
      ? (totalRevenue / completedOrders.length).toFixed(2)
      : "0.00";

  return (
    <div className="p-4 space-y-6">
      {/* 🔴 Reset button (top-right) */}
      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {/* 💰 Revenue Summary */}
      <div className="grid grid-cols-1 gap-4">
        <RevenueCard
          todayRevenue={totalRevenue.toFixed(2)}
          completedOrders={completedOrders.length}
          averageOrderValue={averageOrderValue}
        />
      </div>

      {/* 🧾 Active Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
        {pendingOrders.length === 0 ? (
          <EmptyState message="No active orders at the moment." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isNew={newOrderIds.has(order.id)}
                onComplete={() => completeOrderMutation.mutate(order.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ✅ Completed Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Completed Orders</h2>
        {completedOrders.length === 0 ? (
          <EmptyState message="No completed orders yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedOrders.map((order) => (
              <OrderCard key={order.id} order={order} isNew={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
