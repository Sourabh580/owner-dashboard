import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertOrderSchema } from "@shared/schema";
import { sampleOrders } from "./test-order";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('error', console.error);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  let orderIndex = 0;
  setInterval(async () => {
    if (orderIndex < sampleOrders.length) {
      const sampleOrder = sampleOrders[orderIndex];
      try {
        const order = await storage.createOrder(sampleOrder);
        broadcast({ type: 'NEW_ORDER', order });
        console.log(`Simulated new order: #${order.orderNumber}`);
        orderIndex++;
      } catch (error) {
        console.error('Error creating simulated order:', error);
      }
    }
  }, 8000);

  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      
      broadcast({ type: 'NEW_ORDER', order });
      
      res.status(201).json(order);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error('Validation error:', error);
        return res.status(400).json({ error: 'Invalid order data', details: error.errors });
      }
      console.error('Server error creating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || (status !== 'pending' && status !== 'completed')) {
        return res.status(400).json({ error: 'Invalid status. Must be "pending" or "completed"' });
      }

      const order = await storage.updateOrderStatus(id, status);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      broadcast({ type: 'ORDER_UPDATED', order });

      res.json(order);
    } catch (error) {
      console.error('Server error updating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return httpServer;
}
