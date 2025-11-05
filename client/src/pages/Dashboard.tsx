import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/use-sound";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

const BACKEND_URL = "https://nevolt-backend.onrender.com"; // ✅ backend URL
const RESTAURANT_ID = "res-1"; // 🏪 static restaurant id

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  // 🟢 Fetch all orders from backend
  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}`);
      if (!res.ok) throw new Error("Failed to fetch orders");

      const rawData = await res.json();

      // 🧩 Parse JSON stringified fields safely
      return rawData.map((order: any) => ({
        ...order,
        items:
          typeof order.items === "string"
            ? JSON.parse(order.items)
            : order.items || [],
      }));
    },
    refetchInterval: 10000, // Auto refresh every 10 seconds
  });

  // 🟡 Complete order mutation (PATCH to backend)
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
    onSuccess: () => {
      toast({
        title: "✅ Order Completed",
        description: "The order has been marked as completed.",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // 🧠 Handle new orders (toast + ding + UI update)
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

  // 🧩 WebSocket handler (optional, for real-time)
  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"), // only works if WS is enabled
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  // 🕓 Reset highlight after 5 seconds
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  // ⏳ Loading
  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  // 🧾 Split by status
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const completedOrders = orders.filter((o) => o.status === "completed");

  return (
    <div className="p-4 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <RevenueCard title="Pending Orders" value={pendingOrders.length} />
        <RevenueCard title="Completed Orders" value={completedOrders.length} />
        <RevenueCard title="Total Orders" value={orders.length} />
      </div>

      {/* Active Orders */}
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
    </div>
  );
}
