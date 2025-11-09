import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/useSound";

export default function Dashboard() {
  const [completedOrders, setCompletedOrders] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const { playNotification } = useSound();

  // 🟢 Load completed orders from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("completedOrders") || "[]");
    const now = Date.now();

    // Filter valid (within 24 hours)
    const valid = saved.filter(
      (order) => now - order.timestamp < 24 * 60 * 60 * 1000
    );

    setCompletedOrders(valid.map((o) => o.data));
    setRevenue(valid.reduce((sum, o) => sum + (o.data.total_price || 0), 0));

    // Save only valid ones back
    localStorage.setItem("completedOrders", JSON.stringify(valid));
  }, []);

  // 🟢 Fetch orders from backend
  const fetchOrders = useCallback(async () => {
    const restaurant_id = localStorage.getItem("restaurant_id");
    const res = await fetch(
      `https://nevolt-backend.onrender.com/api/orders?restaurant_id=${restaurant_id}`
    );
    if (!res.ok) throw new Error("Failed to fetch orders");
    return res.json();
  }, []);

  const { data: orders = [], refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    refetchInterval: 5000, // auto refresh
  });

  // 🟡 Handle marking an order as completed
  const handleComplete = async (order) => {
    try {
      const res = await fetch(
        `https://nevolt-backend.onrender.com/api/orders/${order.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        }
      );

      if (!res.ok) throw new Error("Failed to update order");

      const updatedOrder = { ...order, status: "completed" };
      playNotification();

      // Save completed order locally
      const saved = JSON.parse(localStorage.getItem("completedOrders") || "[]");
      const updatedLocal = [
        ...saved,
        { data: updatedOrder, timestamp: Date.now() },
      ];

      localStorage.setItem("completedOrders", JSON.stringify(updatedLocal));
      setCompletedOrders((prev) => [...prev, updatedOrder]);
      setRevenue((prev) => prev + (order.total_price || 0));

      await refetch();
    } catch (err) {
      console.error("❌ Error completing order:", err);
    }
  };

  // 🔴 Reset handler
  const handleReset = () => {
    if (window.confirm("Do you want to reset dashboard data?")) {
      localStorage.removeItem("completedOrders");
      setCompletedOrders([]);
      setRevenue(0);
      alert("✅ Dashboard reset successfully!");
    }
  };

  // 🧾 Split orders
  const pendingOrders = orders.filter((o) => o.status !== "completed");
  const completedFromBackend = orders.filter((o) => o.status === "completed");

  // Merge backend completed + locally saved
  const mergedCompleted = [
    ...completedFromBackend,
    ...completedOrders.filter(
      (o) => !completedFromBackend.some((b) => b.id === o.id)
    ),
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Owner Dashboard</h1>
        <button
          onClick={handleReset}
          className="bg-red-500 text-white px-4 py-2 rounded-lg"
        >
          Reset
        </button>
      </div>

      <RevenueCard total={revenue} />

      {/* Pending Orders Section */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Pending Orders</h2>
        {pendingOrders.length > 0 ? (
          <div className="grid gap-3">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onComplete={() => handleComplete(order)}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No pending orders" />
        )}
      </section>

      {/* Completed Orders Section */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Completed Orders (Last 24h)</h2>
        {mergedCompleted.length > 0 ? (
          <div className="grid gap-3">
            {mergedCompleted.map((order) => (
              <OrderCard key={order.id} order={order} isCompleted />
            ))}
          </div>
        ) : (
          <EmptyState message="No completed orders yet" />
        )}
      </section>
    </div>
  );
}
