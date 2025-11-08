import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/use-sound";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

const BACKEND_URL = "https://nevolt-backend.onrender.com";
const RESTAURANT_ID = "res-1";
const RESET_KEY = "dashboard-reset-timestamp";

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();

  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [resetTimestamp, setResetTimestamp] = useState<number>(
    Number(localStorage.getItem(RESET_KEY)) || 0
  );

  // 🧠 Fetch all orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}`);
      if (!res.ok) throw new Error("Failed to fetch orders");

      const rawData = await res.json();
      return rawData.map((order: any) => ({
        ...order,
        items:
          typeof order.items === "string"
            ? JSON.parse(order.items || "[]")
            : Array.isArray(order.items)
            ? order.items
            : [],
      }));
    },
    refetchInterval: 7000,
  });

  // 🟢 Complete order mutation
  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to complete order");
      return res.json();
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) =>
        oldOrders.map((o) =>
          o.id === updatedOrder.id ? { ...o, status: "completed" } : o
        )
      );

      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked completed.`,
      });
    },
    onError: () =>
      toast({
        title: "Error",
        description: "Failed to complete order.",
        variant: "destructive",
      }),
  });

  // 🛎 Handle new orders (WebSocket)
  const handleNewOrder = useCallback(
    (order: Order) => {
      const orderTime = new Date(order.created_at).getTime();
      if (orderTime < resetTimestamp) return; // ignore old ones after reset

      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) => {
        const exists = oldOrders.find((o) => o.id === order.id);
        if (exists) return oldOrders;
        return [order, ...oldOrders];
      });

      setNewOrderIds((prev) => new Set(prev).add(order.id));
      playNotificationSound();
      toast({
        title: "🆕 New Order Received",
        description: `Table ${order.table_no} placed an order.`,
      });
    },
    [resetTimestamp, playNotificationSound, toast]
  );

  // 🔔 WebSocket connection
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  // 🧹 Remove highlight after few seconds
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 4000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  // 🧾 Filter orders created after reset
  const filteredOrders = orders.filter((o) => {
    const orderTime = new Date(o.created_at).getTime();
    return !isNaN(orderTime) && orderTime >= resetTimestamp;
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === "pending");
  const completedOrders = filteredOrders.filter((o) => o.status === "completed");

  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + parseFloat(o.total || 0),
    0
  );

  const avgValue =
    completedOrders.length > 0
      ? (totalRevenue / completedOrders.length).toFixed(2)
      : "0.00";

  // 🔴 Reset Button
  const handleReset = () => {
    if (confirm("Do you want to reset?")) {
      const now = Date.now();
      localStorage.setItem(RESET_KEY, String(now));
      setResetTimestamp(now);

      toast({
        title: "Reset Done",
        description: "Dashboard counters reset successfully.",
      });
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header with Reset */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button
          variant="destructive"
          className="bg-red-600 hover:bg-red-700 text-white"
          onClick={handleReset}
        >
          Reset
        </Button>
      </div>

      {/* Revenue Summary */}
      <RevenueCard
        todayRevenue={totalRevenue.toFixed(2)}
        completedOrders={completedOrders.length}
        averageOrderValue={avgValue}
      />

      {/* Active Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Active Orders</h2>
        {pendingOrders.length === 0 ? (
          <EmptyState message="No active orders right now." />
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

      {/* Completed Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Completed Orders</h2>
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
