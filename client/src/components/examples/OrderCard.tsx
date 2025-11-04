import OrderCard from '../OrderCard';

export default function OrderCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
      <OrderCard
        orderNumber={1234}
        customerName="Sarah Johnson"
        items={["2x Margherita Pizza", "1x Caesar Salad", "2x Coca Cola"]}
        totalPrice="45.50"
        status="pending"
        createdAt={new Date(Date.now() - 5 * 60 * 1000)}
        onComplete={() => console.log('Order completed')}
      />
      
      <OrderCard
        orderNumber={1233}
        customerName="Michael Chen"
        items={["1x Beef Burger", "1x French Fries", "1x Milkshake"]}
        totalPrice="28.75"
        status="completed"
        createdAt={new Date(Date.now() - 15 * 60 * 1000)}
      />
      
      <OrderCard
        orderNumber={1235}
        customerName="Emma Williams"
        items={["3x Chicken Wings", "1x Onion Rings", "2x Sprite"]}
        totalPrice="32.00"
        status="pending"
        createdAt={new Date(Date.now() - 2 * 60 * 1000)}
        onComplete={() => console.log('Order completed')}
        isNew={true}
      />
    </div>
  );
}
