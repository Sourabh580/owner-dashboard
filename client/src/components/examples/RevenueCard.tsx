import RevenueCard from '../RevenueCard';

export default function RevenueCardExample() {
  return (
    <div className="max-w-sm p-6">
      <RevenueCard
        todayRevenue="1,247.50"
        completedOrders={28}
        averageOrderValue="44.55"
      />
    </div>
  );
}
