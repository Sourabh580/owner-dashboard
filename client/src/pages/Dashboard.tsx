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
  const [uiOrders, setUiOrders] = useState<Order[]>([]);
  const [resetTimestamp, setResetTimestamp] = useState<number | null>(null);

  // 🟢 Fetch Orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const rawData = await res.json();

      const parsed = rawData.map((order: any) => ({
        ...order,
        created_at: order.created_at || new Date().toISOString(),
        items:
          typeof order.items === "string"
            ? JSON.parse(order.items || "[]")
            : Array.isArray(order.items)
            ? order.items
            : [],
      }));

      // ⚡ Filter orders after reset timestamp only
      const filteredOrders =
        resetTimestamp
          ? parsed.filter((o: any) => new Date(o.created_at).getTime() > resetTimestamp)
          : parsed;

      const revenue = filteredOrders
        .filter((o: any) => o.status === "completed")
        .reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0);

      setUiOrders(filteredOrders);
      setTotalRevenue(revenue);

      return parsed;
    },
    refetchInterval: 5000,
  });

  // 🟡 Complete Order
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
      setUiOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? { ...o, status: "completed" } : o))
      );

      const added = parseFloat(updatedOrder.total || 0);
      if (!isNaN(added)) {
        // ✅ Only count if after reset
        if (!resetTimestamp || new Date(updatedOrder.created_at).getTime() > resetTimestamp) {
          setTotalRevenue((prev) => prev + added);
        }
      }

      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked as completed.`,
      });
    },
  });

  // 🧠 New Order Event
  const handleNewOrder = useCallback(
    (order: Order) => {
      const orderTime = new Date(order.created_at || Date.now()).getTime();
      if (resetTimestamp && orderTime < resetTimestamp) return; // ignore old orders

      setUiOrders((prev) => {
        const exists = prev.find((o) => o.id === order.id);
        if (exists) return prev;
        return [order, ...prev];
      });

      setNewOrderIds((prev) => new Set(prev).add(order.id));
      playNotificationSound();

      toast({
        title: "🔔 New Order Received!",
        description: `Order #${order.id} from table ${order.table_no}`,
      });
    },
    [playNotificationSound, toast, resetTimestamp]
  );

  // 🔴 Reset Dashboard
  const handleReset = () => {
    if (window.confirm("Do you really want to reset the dashboard?")) {
      const now = Date.now();
      setResetTimestamp(now);
      setUiOrders([]);
      setTotalRevenue(0);
      toast({ title: "✅ Reset Done", description: "Revenue counter restarted." });
    }
  };

  // 🔄 WebSocket for live updates
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  const pendingOrders = uiOrders.filter((o) => o.status === "pending");
  const completedOrders = uiOrders.filter((o) => o.status === "completed");

  const avgValue =
    completedOrders.length > 0
      ? (totalRevenue / completedOrders.length).toFixed(2)
      : "0.00";

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Header with Reset */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">📊 Owner Dashboard</h1>
        <Button
          onClick={handleReset}
          variant="destructive"
          className="bg-red-600 hover:bg-red-700 text-white px-4"
        >
          Reset
        </Button>
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 gap-4">
        <RevenueCard
          todayRevenue={totalRevenue.toFixed(2)}
          completedOrders={completedOrders.length}
          averageOrderValue={avgValue}
        />
      </div>

      {/* Active Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
        {pendingOrders.length === 0 ? (
          <EmptyState message="No active orders right now." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isNew={newOrderIds.has(o.id)}
                onComplete={() => completeOrderMutation.mutate(o.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Completed Orders</h2>
        {completedOrders.length === 0 ? (
          <EmptyState message="No completed orders yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedOrders.map((o) => (
              <OrderCard key={o.id} order={o} isNew={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
