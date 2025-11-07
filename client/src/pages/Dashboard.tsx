import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/use-sound";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Order } from "@shared/schema";
import { Button } from "@/components/ui/button";

const BACKEND_URL = "https://nevolt-backend.onrender.com";
const RESTAURANT_ID = "res-1";

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [baseRevenue, setBaseRevenue] = useState<number>(() =>
    parseFloat(localStorage.getItem("base_revenue") || "0")
  );
  const [baseCompleted, setBaseCompleted] = useState<number>(() =>
    parseInt(localStorage.getItem("base_completed") || "0")
  );
  const [resetTime, setResetTime] = useState<number>(() => {
    const saved = localStorage.getItem("reset_time");
    return saved ? parseInt(saved) : 0;
  });

  // 🟢 Fetch all orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
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

      const revenue = parsed
        .filter((o: any) => o.status === "completed")
        .reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0);

      setTotalRevenue(revenue);
      return parsed;
    },
    refetchInterval: 10000,
  });

  // 🟡 Complete order mutation
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
      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) => {
        const exists = oldOrders.find((o) => o.id === order.id);
        if (exists) return oldOrders;
        return [order, ...oldOrders];
      });
      setNewOrderIds((prev) => new Set(prev).add(order.id));
      playNotificationSound();
      toast({
        title: "🔔 New Order Received!",
        description: `Order #${order.id} from table ${order.table_no}`,
      });
    },
    [playNotificationSound, toast]
  );

  // 🔔 WebSocket (optional)
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  // Clear highlight after few seconds
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  // 🧾 Split orders by status
  const validOrders = Array.isArray(orders) ? orders : [];
  const pendingOrders = validOrders.filter((o) => o.status === "pending");
  const completedOrders = validOrders.filter((o) => {
    if (o.status !== "completed") return false;
    if (!resetTime) return true;
    const createdAt = new Date(o.created_at).getTime();
    return createdAt >= resetTime;
  });

  // 📊 Revenue & average
  const displayedRevenue = totalRevenue - baseRevenue;
  const displayedCompleted = completedOrders.length - baseCompleted;
  const averageOrderValue =
    displayedCompleted > 0
      ? (displayedRevenue / displayedCompleted).toFixed(2)
      : "0.00";

  // 🔴 Reset button
  const handleReset = () => {
    if (confirm("Do you want to reset the dashboard?")) {
      const now = Date.now();
      localStorage.setItem("base_revenue", totalRevenue.toString());
      localStorage.setItem("base_completed", completedOrders.length.toString());
      localStorage.setItem("reset_time", now.toString());

      setBaseRevenue(totalRevenue);
      setBaseCompleted(completedOrders.length);
      setResetTime(now);

      toast({ title: "Reset Done" });
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header with Reset Button */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="destructive" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {/* 💰 Revenue Summary */}
      <div className="grid grid-cols-1 gap-4">
        <RevenueCard
          todayRevenue={displayedRevenue.toFixed(2)}
          completedOrders={Math.max(displayedCompleted, 0)}
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
        <h2 className="text-xl font-semibold mb-2">Completed Orders</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Showing orders completed after last reset
        </p>
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
