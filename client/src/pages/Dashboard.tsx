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

export default function Dashboard() {
  const { playNotificationSound } = useSound();
  const { toast } = useToast();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest('PATCH', `/api/orders/${orderId}/status`, { status: 'completed' });
      return res.json();
    },
    onSuccess: (updatedOrder: Order) => {
      queryClient.setQueryData<Order[]>(['/api/orders'], (oldOrders = []) => {
        return oldOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
      });
      toast({
        title: "Order completed",
        description: "The order has been marked as completed.",
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

  const handleNewOrder = useCallback((order: Order) => {
    queryClient.setQueryData<Order[]>(['/api/orders'], (oldOrders = []) => {
      const exists = oldOrders.find(o => o.id === order.id);
      if (exists) return oldOrders;
      return [order, ...oldOrders];
    });
    
    setNewOrderIds(prev => new Set(prev).add(order.id));
    playNotificationSound();

    toast({
      title: "New Order Received!",
      description: `Order #${order.orderNumber} from ${order.customerName}`,
    });

    setTimeout(() => {
      setNewOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }, 3000);
  }, [playNotificationSound, toast]);

  const handleOrderUpdated = useCallback((order: Order) => {
    queryClient.setQueryData<Order[]>(['/api/orders'], (oldOrders = []) => {
      return oldOrders.map(o => o.id === order.id ? order : o);
    });
  }, []);

  useWebSocket({
    onNewOrder: handleNewOrder,
    onOrderUpdated: handleOrderUpdated,
  });

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
    completeOrderMutation.mutate(orderId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4" data-testid="text-pending-header">
              Pending Orders
            </h2>
            {pendingOrders.length === 0 ? (
              <EmptyState type="pending" />
            ) : (
              <div className="space-y-4">
                {pendingOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    orderNumber={order.orderNumber}
                    customerName={order.customerName}
                    items={order.items}
                    totalPrice={order.totalPrice}
                    status={order.status as "pending" | "completed"}
                    createdAt={new Date(order.createdAt)}
                    onComplete={() => handleCompleteOrder(order.id)}
                    isNew={newOrderIds.has(order.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4" data-testid="text-completed-header">
              Completed Orders
            </h2>
            {completedOrders.length === 0 ? (
              <EmptyState type="completed" />
            ) : (
              <div className="space-y-4">
                {completedOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    orderNumber={order.orderNumber}
                    customerName={order.customerName}
                    items={order.items}
                    totalPrice={order.totalPrice}
                    status={order.status as "pending" | "completed"}
                    createdAt={new Date(order.createdAt)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-1">
            <RevenueCard
              todayRevenue={todayRevenue}
              completedOrders={completedOrders.length}
              averageOrderValue={averageOrderValue}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
