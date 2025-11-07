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
const RESET_STORAGE_KEY = "dashboardReset";

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isReset, setIsReset] = useState<boolean>(() => {
    return localStorage.getItem(RESET_STORAGE_KEY) === "true";
  });
  const [manualResetOrders, setManualResetOrders] = useState<Order[]>([]);

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

      if (!isReset) {
        const revenue = parsed
          .filter((o: any) => o.status === "completed")
          .reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0);
        setTotalRevenue(revenue);
      }

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
        oldOrders.map((o) => (o.id === updatedOrder.id ? { ...o, status: "completed" } : o))
      );

      const added = parseFloat(updatedOrder.total || 0);
      setTotalRevenue((prev) => prev + (isNaN(added) ? 0 : added));

      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked as completed.`,
      });
    },
  });

  // 🧠 Handle new order
  const handleNewOrder = useCallback(
    (order: Order) => {
      if (isReset) {
        // Reset se nikal jao, fresh start
        setIsReset(false);
        localStorage.removeItem(RESET_STORAGE_KEY);
        setManualResetOrders([]); // old reset list clear
      }

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
    [isReset, playNotificationSound, toast]
  );

  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  // Reset ke baad UI clean dikhane ke liye
  const validOrders = isReset ? manualResetOrders : Array.isArray(orders) ? orders : [];

  const pendingOrders = validOrders.filter((o) => o.status === "pending");
  const completedOrders = validOrders.filter((o) => o.status === "completed");

  const averageOrderValue =
    completedOrders.length > 0
      ? (totalRevenue / completedOrders.length).toFixed(2)
      : "0.00";

  // 🔴 Reset handler
  const handleReset = () => {
    const confirmed = window.confirm("⚠️ Are you sure you want to reset the dashboard? This will start fresh.");
    if (confirmed) {
      setTotalRevenue(0);
      setManualResetOrders([]); // UI clear
      setIsReset(true);
      localStorage.setItem(RESET_STORAGE_KEY, "true");
      toast({
        title: "Dashboard Reset",
        description: "UI has been reset to zero. New orders will start fresh.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Header with Reset Button */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <Button onClick={handleReset} className="bg-red-500 hover:bg-red-600 text-white">
          Reset
        </Button>
      </div>

      {/* 💰 Revenue Summary */}
      <div className="grid grid-cols-1 gap-4">
        <RevenueCard
          todayRevenue={isReset ? "0.00" : totalRevenue.toFixed(2)}
          completedOrders={isReset ? 0 : completedOrders.length}
          averageOrderValue={isReset ? "0.00" : averageOrderValue}
        />
      </div>

      {/* 🧾 Active Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
        {isReset || pendingOrders.length === 0 ? (
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
        {isReset || completedOrders.length === 0 ? (
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
