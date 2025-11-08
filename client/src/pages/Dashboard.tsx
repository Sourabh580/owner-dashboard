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

  // 👇 reset-based counters only (not affecting actual orders)
  const [baseRevenue, setBaseRevenue] = useState<number>(
    parseFloat(localStorage.getItem("base_revenue") || "0")
  );
  const [baseCompleted, setBaseCompleted] = useState<number>(
    parseInt(localStorage.getItem("base_completed") || "0")
  );

  // 🟢 Fetch orders
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
    refetchInterval: 8000,
  });

  // 🟡 Complete Order
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
        oldOrders.map((o) => (o.id === updatedOrder.id ? { ...o, status: "completed" } : o))
      );
      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked as completed.`,
      });
    },
    onError: () =>
      toast({
        title: "Error",
        description: "Failed to complete order.",
        variant: "destructive",
      }),
  });

  // 🔔 Handle new orders (WebSocket)
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
        title: "🔔 New Order",
        description: `Order #${order.id} from table ${order.table_no}`,
      });
    },
    [playNotificationSound, toast]
  );

  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 4000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  // ✅ Filter orders
  const validOrders = Array.isArray(orders) ? orders : [];
  const pendingOrders = validOrders.filter((o) => o.status === "pending");
  const completedOrders = validOrders.filter((o) => o.status === "completed");

  // 💰 Counters
  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + parseFloat(o.total || 0),
    0
  );

  const displayedRevenue = totalRevenue - baseRevenue;
  const displayedCompleted = completedOrders.length - baseCompleted;
  const avgOrderValue =
    displayedCompleted > 0
      ? (displayedRevenue / displayedCompleted).toFixed(2)
      : "0.00";

  // 🔴 Reset only counters (not affecting orders)
  const handleReset = () => {
    if (confirm("Do you want to reset the dashboard counters?")) {
      localStorage.setItem("base_revenue", totalRevenue.toString());
      localStorage.setItem("base_completed", completedOrders.length.toString());
      setBaseRevenue(totalRevenue);
      setBaseCompleted(completedOrders.length);
      toast({ title: "Reset Done", description: "Counters restarted from zero." });
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <Button variant="destructive" onClick={handleReset}>
          Reset
        </Button>
      </div>

      <RevenueCard
        todayRevenue={displayedRevenue.toFixed(2)}
        completedOrders={Math.max(displayedCompleted, 0)}
        averageOrderValue={avgOrderValue}
      />

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
