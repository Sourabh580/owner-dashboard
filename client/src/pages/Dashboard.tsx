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
const COMPLETED_EXPIRY = 24 * 60 * 60 * 1000; // 24h

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();

  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [lastResetOrderId, setLastResetOrderId] = useState<number>(() =>
    parseInt(localStorage.getItem("last_reset_order_id") || "0")
  );

  // 🟢 Load stored completed orders from localStorage
  const [storedCompleted, setStoredCompleted] = useState<Order[]>(() => {
    const raw = JSON.parse(localStorage.getItem("completed_orders") || "[]");
    const now = Date.now();
    return raw
      .filter((o: any) => now - o.timestamp < COMPLETED_EXPIRY)
      .map((o: any) => o.data);
  });

  // 🟢 Fetch all orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders", lastResetOrderId],
    queryFn: async () => {
      const res = await fetch(
        `${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}&after_id=${lastResetOrderId}`
      );
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return data.map((order: any) => ({
        ...order,
        items:
          typeof order.items === "string"
            ? JSON.parse(order.items || "[]")
            : Array.isArray(order.items)
            ? order.items
            : [],
      }));
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
      // Update React Query cache
      queryClient.setQueryData<Order[]>(["/api/orders", lastResetOrderId], (oldOrders = []) =>
        oldOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );

      // 🟢 Save completed order to localStorage
      const saved = JSON.parse(localStorage.getItem("completed_orders") || "[]");
      const updated = [...saved, { data: updatedOrder, timestamp: Date.now() }];
      localStorage.setItem("completed_orders", JSON.stringify(updated));
      setStoredCompleted((prev) => [...prev, updatedOrder]);

      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked as completed.`,
      });
    },
  });

  // 🧠 Handle new order
  const handleNewOrder = useCallback(
    (order: Order) => {
      queryClient.setQueryData<Order[]>(["/api/orders", lastResetOrderId], (oldOrders = []) => {
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
    [playNotificationSound, toast, lastResetOrderId]
  );

  // 🔔 WebSocket
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  // 🕒 Highlight reset after 5s
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const completedOrders = [
    ...storedCompleted,
    ...orders.filter(
      (o) => o.status === "completed" && !storedCompleted.some((s) => s.id === o.id)
    ),
  ];

  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + parseFloat(o.total_price || 0),
    0
  );

  // 🔴 Reset
  const handleReset = () => {
    if (confirm("Do you want to reset the dashboard?")) {
      const latestId = Math.max(...orders.map((o) => o.id), 0);
      localStorage.setItem("last_reset_order_id", latestId.toString());
      localStorage.removeItem("completed_orders");
      setLastResetOrderId(latestId);
      setStoredCompleted([]);
      toast({ title: "Reset Done" });
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="destructive" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {/* 💰 Revenue */}
      <RevenueCard
        todayRevenue={totalRevenue.toFixed(2)}
        completedOrders={completedOrders.length}
        averageOrderValue={
          completedOrders.length > 0
            ? (totalRevenue / completedOrders.length).toFixed(2)
            : "0.00"
        }
      />

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
        <h2 className="text-xl font-semibold mb-2">Completed Orders (Last 24 Hours)</h2>
        {completedOrders.length === 0 ? (
          <EmptyState message="No completed orders yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
