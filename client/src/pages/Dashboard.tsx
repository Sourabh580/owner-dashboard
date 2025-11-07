import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/use-sound";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import type { Order } from "@shared/schema";

const BACKEND_URL = "https://nevolt-backend.onrender.com";
const RESTAURANT_ID = "res-1";

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();

  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [resetTime, setResetTime] = useState<number>(() => {
    const saved = localStorage.getItem("dashboard_reset_time");
    return saved ? parseInt(saved) : 0;
  });

  const [visibleOrderIds, setVisibleOrderIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("visible_order_ids");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // 🟢 Fetch orders
  const { data: allOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const raw = await res.json();

      return raw.map((o: any) => ({
        ...o,
        items:
          typeof o.items === "string"
            ? JSON.parse(o.items || "[]")
            : Array.isArray(o.items)
            ? o.items
            : [],
      }));
    },
    refetchInterval: 10000,
  });

  // 🧠 Filter orders to only show post-reset ones
  const filteredOrders = allOrders.filter((o) => visibleOrderIds.has(o.id));

  // 💰 Calculate revenue
  useEffect(() => {
    const revenue = filteredOrders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    setTotalRevenue(revenue);
  }, [filteredOrders]);

  // 🟡 Complete order
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
    onSuccess: (updated) => {
      queryClient.setQueryData<Order[]>(["/api/orders"], (old = []) =>
        old.map((o) => (o.id === updated.id ? { ...o, status: "completed" } : o))
      );

      const added = parseFloat(updated.total || 0);
      setTotalRevenue((prev) => prev + (isNaN(added) ? 0 : added));
      toast({ title: "✅ Order Completed", description: `Order #${updated.id} marked done.` });
    },
  });

  // 🧩 Reset handler
  const handleReset = () => {
    if (window.confirm("Do you really want to reset the dashboard?")) {
      const now = Date.now();
      localStorage.setItem("dashboard_reset_time", now.toString());
      localStorage.setItem("visible_order_ids", JSON.stringify([]));
      setResetTime(now);
      setVisibleOrderIds(new Set());
      setTotalRevenue(0);
      toast({ title: "✅ Reset Done", description: "Dashboard restarted from zero." });
    }
  };

  // 🔔 Handle new order
  const handleNewOrder = useCallback(
    (order: Order) => {
      const createdAt = new Date(order.created_at).getTime();
      if (createdAt < resetTime) return; // ignore pre-reset orders

      queryClient.setQueryData<Order[]>(["/api/orders"], (old = []) => {
        const exists = old.find((o) => o.id === order.id);
        return exists ? old : [order, ...old];
      });

      setVisibleOrderIds((prev) => {
        const updated = new Set(prev);
        updated.add(order.id);
        localStorage.setItem("visible_order_ids", JSON.stringify(Array.from(updated)));
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

  // WebSocket for real-time orders
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  const pending = filteredOrders.filter((o) => o.status === "pending");
  const completed = filteredOrders.filter((o) => o.status === "completed");

  const avgValue =
    completed.length > 0 ? (totalRevenue / completed.length).toFixed(2) : "0.00";

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          variant="destructive"
          onClick={handleReset}
          className="bg-red-600 hover:bg-red-700"
        >
          Reset
        </Button>
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 gap-4">
        <RevenueCard
          todayRevenue={totalRevenue.toFixed(2)}
          completedOrders={completed.length}
          averageOrderValue={avgValue}
        />
      </div>

      {/* Active Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
        {pending.length === 0 ? (
          <EmptyState message="No active orders." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((order) => (
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

      {/* Completed Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Completed Orders</h2>
        {completed.length === 0 ? (
          <EmptyState message="No completed orders yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
