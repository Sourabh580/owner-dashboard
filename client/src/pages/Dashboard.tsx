import { useState, useEffect } from "react";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/use-sound";

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  items: string[];
  totalPrice: string;
  status: "pending" | "completed";
  createdAt: Date;
}

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const [orders, setOrders] = useState<Order[]>([
    {
      id: "1",
      orderNumber: 1234,
      customerName: "Sarah Johnson",
      items: ["2x Margherita Pizza", "1x Caesar Salad", "2x Coca Cola"],
      totalPrice: "45.50",
      status: "pending",
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: "2",
      orderNumber: 1233,
      customerName: "Michael Chen",
      items: ["1x Beef Burger", "1x French Fries", "1x Milkshake"],
      totalPrice: "28.75",
      status: "completed",
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    },
    {
      id: "3",
      orderNumber: 1232,
      customerName: "Emma Williams",
      items: ["3x Chicken Wings", "1x Onion Rings", "2x Sprite"],
      totalPrice: "32.00",
      status: "pending",
      createdAt: new Date(Date.now() - 8 * 60 * 1000),
    },
    {
      id: "4",
      orderNumber: 1231,
      customerName: "David Martinez",
      items: ["1x Pasta Carbonara", "1x Garlic Bread", "1x Water"],
      totalPrice: "24.50",
      status: "completed",
      createdAt: new Date(Date.now() - 25 * 60 * 1000),
    },
    {
      id: "5",
      orderNumber: 1230,
      customerName: "Lisa Anderson",
      items: ["2x Chocolate Cake", "2x Cappuccino"],
      totalPrice: "18.00",
      status: "completed",
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
    },
  ]);

  const pendingOrders = orders.filter(order => order.status === "pending");
  const completedOrders = orders.filter(order => order.status === "completed");

  const todayRevenue = completedOrders.reduce(
    (sum, order) => sum + parseFloat(order.totalPrice),
    0
  ).toFixed(2);

  const averageOrderValue = completedOrders.length > 0
    ? (parseFloat(todayRevenue) / completedOrders.length).toFixed(2)
    : "0.00";

  const handleCompleteOrder = (orderId: string) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId ? { ...order, status: "completed" as const } : order
      )
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const newOrder: Order = {
        id: String(Date.now()),
        orderNumber: 1235,
        customerName: "James Wilson",
        items: ["1x Supreme Pizza", "1x Garden Salad", "1x Lemonade"],
        totalPrice: "38.25",
        status: "pending",
        createdAt: new Date(),
      };
      
      setOrders(prev => [newOrder, ...prev]);
      setNewOrderIds(prev => new Set(prev).add(newOrder.id));
      playNotificationSound();

      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          next.delete(newOrder.id);
          return next;
        });
      }, 3000);
    }, 5000);

    return () => clearTimeout(timer);
  }, [playNotificationSound]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">
            Restaurant Dashboard
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4" data-testid="text-pending-header">
                Pending Orders
              </h2>
              {pendingOrders.length === 0 ? (
                <EmptyState type="pending" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      orderNumber={order.orderNumber}
                      customerName={order.customerName}
                      items={order.items}
                      totalPrice={order.totalPrice}
                      status={order.status}
                      createdAt={order.createdAt}
                      onComplete={() => handleCompleteOrder(order.id)}
                      isNew={newOrderIds.has(order.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4" data-testid="text-completed-header">
                Completed Orders
              </h2>
              {completedOrders.length === 0 ? (
                <EmptyState type="completed" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      orderNumber={order.orderNumber}
                      customerName={order.customerName}
                      items={order.items}
                      totalPrice={order.totalPrice}
                      status={order.status}
                      createdAt={order.createdAt}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-1">
            <RevenueCard
              todayRevenue={todayRevenue}
              completedOrders={completedOrders.length}
              averageOrderValue={averageOrderValue}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
