import type { Response } from 'express';
import logger from '../logger.js';
import { isRedisAvailable, getPublisher, getSubscriber } from '../lib/redis.js';

interface SSEClient {
  id: string;
  res: Response;
  subscriptions: Set<string>;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private shuttingDown = false;

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async initRedisSubscription(): Promise<void> {
    const sub = getSubscriber();
    if (!sub) return;

    await sub.psubscribe('sse:stream:*', 'sse:user:*');
    sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
      try {
        const { event, data } = JSON.parse(message) as { event: string; data: unknown };
        if (channel.startsWith('sse:stream:')) {
          this._localBroadcastToStream(channel.slice('sse:stream:'.length), event, data);
        } else if (channel.startsWith('sse:user:')) {
          this._localBroadcastToUser(channel.slice('sse:user:'.length), event, data);
        }
      } catch (err) {
        logger.warn('[Redis SSE] Failed to handle pub/sub message:', err);
      }
    });

    logger.info('[SSEService] Redis pub/sub subscription active.');
  }

  addClient(clientId: string, res: Response, subscriptions: string[] = []): void {
    const client: SSEClient = {
      id: clientId,
      res,
      subscriptions: new Set(subscriptions),
    };

    this.clients.set(clientId, client);
    logger.info(`SSE client connected: ${clientId}, subscriptions: ${subscriptions.join(', ')}`);

    res.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`SSE client disconnected: ${clientId}`);
    });
  }

  sendReconnectToAll(): void {
    this.shuttingDown = true;
    const message = 'event: reconnect\ndata: {}\n\n';
    for (const client of this.clients.values()) {
      try {
        client.res.write(message);
      } catch {
        // ignore write errors during shutdown
      }
    }
    logger.info(`[SSEService] Sent reconnect to ${this.clients.size} client(s).`);
  }

  broadcast(event: string, data: unknown, filter?: (client: SSEClient) => boolean): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (!filter || filter(client)) {
        client.res.write(message);
      }
    }
  }

  broadcastToStream(streamId: string, event: string, data: unknown): void {
    if (isRedisAvailable()) {
      getPublisher()?.publish(`sse:stream:${streamId}`, JSON.stringify({ event, data }));
    } else {
      this._localBroadcastToStream(streamId, event, data);
    }
  }

  broadcastToUser(publicKey: string, event: string, data: unknown): void {
    if (isRedisAvailable()) {
      getPublisher()?.publish(`sse:user:${publicKey}`, JSON.stringify({ event, data }));
    } else {
      this._localBroadcastToUser(publicKey, event, data);
    }
  }

  private _localBroadcastToStream(streamId: string, event: string, data: unknown): void {
    this.broadcast(event, data, (client) =>
      client.subscriptions.has(streamId) || client.subscriptions.has('*')
    );
  }

  private _localBroadcastToUser(publicKey: string, event: string, data: unknown): void {
    this.broadcast(event, data, (client) =>
      client.subscriptions.has(`user:${publicKey}`) || client.subscriptions.has('*')
    );
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseService = new SSEService();
