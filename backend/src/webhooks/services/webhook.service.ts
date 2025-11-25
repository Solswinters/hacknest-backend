import { Injectable, Logger } from '@nestjs/common';

import { createHmac } from 'crypto';

export interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
  signature?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };
  error?: string;
  createdAt: Date;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private deliveryQueue: WebhookDelivery[] = [];
  private isProcessing: boolean = false;
  private nextDeliveryId: number = 0;

  /**
   * Register a webhook endpoint
   */
  registerEndpoint(endpoint: WebhookEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    this.logger.log(`Webhook endpoint registered: ${endpoint.id} -> ${endpoint.url}`);
  }

  /**
   * Unregister a webhook endpoint
   */
  unregisterEndpoint(endpointId: string): void {
    this.endpoints.delete(endpointId);
    this.logger.log(`Webhook endpoint unregistered: ${endpointId}`);
  }

  /**
   * Update webhook endpoint
   */
  updateEndpoint(endpointId: string, updates: Partial<WebhookEndpoint>): boolean {
    const endpoint = this.endpoints.get(endpointId);

    if (!endpoint) {
      return false;
    }

    Object.assign(endpoint, updates);
    this.logger.log(`Webhook endpoint updated: ${endpointId}`);

    return true;
  }

  /**
   * Trigger a webhook event
   */
  async trigger(event: string, data: any): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: Date.now(),
      data,
    };

    // Find all endpoints subscribed to this event
    const subscribedEndpoints = Array.from(this.endpoints.values()).filter(
      (endpoint) => endpoint.active && endpoint.events.includes(event)
    );

    if (subscribedEndpoints.length === 0) {
      this.logger.debug(`No endpoints subscribed to event: ${event}`);
      return;
    }

    // Create delivery for each endpoint
    for (const endpoint of subscribedEndpoints) {
      await this.createDelivery(endpoint, payload);
    }
  }

  /**
   * Create a webhook delivery
   */
  private async createDelivery(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<void> {
    const deliveryId = `delivery-${this.nextDeliveryId++}`;

    // Sign the payload
    const signedPayload = this.signPayload(payload, endpoint.secret);

    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      event: payload.event,
      payload: signedPayload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    };

    this.deliveries.set(deliveryId, delivery);
    this.deliveryQueue.push(delivery);

    this.logger.debug(
      `Webhook delivery created: ${deliveryId} for event ${payload.event}`
    );

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Sign webhook payload
   */
  private signPayload(payload: WebhookPayload, secret: string): WebhookPayload {
    const payloadString = JSON.stringify(payload);
    const signature = createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    return {
      ...payload,
      signature,
    };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: WebhookPayload, secret: string): boolean {
    const { signature, ...dataToSign } = payload;

    if (!signature) {
      return false;
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(JSON.stringify(dataToSign))
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Process webhook delivery queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.deliveryQueue.length > 0) {
      const delivery = this.deliveryQueue[0];

      // Check if we should retry
      if (delivery.nextRetryAt && delivery.nextRetryAt > new Date()) {
        // Skip this delivery for now
        this.deliveryQueue.push(this.deliveryQueue.shift()!);
        continue;
      }

      try {
        await this.sendWebhook(delivery);
        this.deliveryQueue.shift(); // Remove from queue on success
      } catch (error) {
        this.handleDeliveryError(delivery, error);
      }

      // Small delay between deliveries
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  /**
   * Send webhook to endpoint
   */
  private async sendWebhook(delivery: WebhookDelivery): Promise<void> {
    const endpoint = this.endpoints.get(delivery.endpointId);

    if (!endpoint) {
      throw new Error(`Endpoint ${delivery.endpointId} not found`);
    }

    delivery.attempts++;
    delivery.lastAttemptAt = new Date();
    delivery.status = 'retrying';

    this.logger.debug(
      `Sending webhook: ${delivery.id} to ${endpoint.url} (attempt ${delivery.attempts})`
    );

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Signature': delivery.payload.signature || '',
          'X-Webhook-Delivery-Id': delivery.id,
        },
        body: JSON.stringify(delivery.payload),
      });

      const responseBody = await response.text();

      delivery.response = {
        statusCode: response.status,
        body: responseBody,
        headers: Object.fromEntries(response.headers.entries()),
      };

      if (response.ok) {
        delivery.status = 'success';
        this.logger.log(`Webhook delivered successfully: ${delivery.id}`);
      } else {
        throw new Error(
          `HTTP ${response.status}: ${responseBody.substring(0, 100)}`
        );
      }
    } catch (error: any) {
      delivery.error = error.message;
      throw error;
    }
  }

  /**
   * Handle delivery error and retry logic
   */
  private handleDeliveryError(delivery: WebhookDelivery, error: any): void {
    const endpoint = this.endpoints.get(delivery.endpointId);

    if (!endpoint) {
      this.deliveryQueue.shift();
      return;
    }

    const retryConfig = endpoint.retryConfig || {
      maxRetries: 3,
      retryDelay: 5000,
    };

    if (delivery.attempts >= retryConfig.maxRetries) {
      delivery.status = 'failed';
      this.logger.error(
        `Webhook delivery failed after ${delivery.attempts} attempts: ${delivery.id}`,
        error
      );
      this.deliveryQueue.shift();
    } else {
      // Schedule retry with exponential backoff
      const delay = retryConfig.retryDelay * Math.pow(2, delivery.attempts - 1);
      delivery.nextRetryAt = new Date(Date.now() + delay);

      this.logger.warn(
        `Webhook delivery failed, will retry: ${delivery.id} (attempt ${delivery.attempts}/${retryConfig.maxRetries})`
      );

      // Move to back of queue
      this.deliveryQueue.push(this.deliveryQueue.shift()!);
    }
  }

  /**
   * Get delivery status
   */
  getDelivery(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  /**
   * Get all deliveries for an endpoint
   */
  getEndpointDeliveries(endpointId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values()).filter(
      (d) => d.endpointId === endpointId
    );
  }

  /**
   * Get recent deliveries
   */
  getRecentDeliveries(limit: number = 50): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Retry failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveries.get(deliveryId);

    if (!delivery || delivery.status !== 'failed') {
      return false;
    }

    delivery.status = 'pending';
    delivery.attempts = 0;
    delivery.error = undefined;
    delivery.nextRetryAt = undefined;

    this.deliveryQueue.push(delivery);

    if (!this.isProcessing) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Get webhook statistics
   */
  getStats(): {
    totalEndpoints: number;
    activeEndpoints: number;
    totalDeliveries: number;
    pendingDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
  } {
    const deliveriesArray = Array.from(this.deliveries.values());

    const successful = deliveriesArray.filter((d) => d.status === 'success').length;
    const failed = deliveriesArray.filter((d) => d.status === 'failed').length;
    const pending = deliveriesArray.filter((d) => d.status === 'pending' || d.status === 'retrying').length;

    const total = deliveriesArray.length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      totalEndpoints: this.endpoints.size,
      activeEndpoints: Array.from(this.endpoints.values()).filter((e) => e.active).length,
      totalDeliveries: total,
      pendingDeliveries: pending,
      successfulDeliveries: successful,
      failedDeliveries: failed,
      successRate,
    };
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);

    if (!endpoint) {
      return false;
    }

    const testPayload: WebhookPayload = {
      event: 'test',
      timestamp: Date.now(),
      data: { message: 'This is a test webhook' },
    };

    try {
      await this.createDelivery(endpoint, testPayload);
      return true;
    } catch (error) {
      this.logger.error(`Test webhook failed for endpoint ${endpointId}`, error);
      return false;
    }
  }

  /**
   * Clear old deliveries
   */
  clearOldDeliveries(daysOld: number = 7): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    let cleared = 0;

    for (const [id, delivery] of this.deliveries.entries()) {
      if (delivery.createdAt < cutoff && delivery.status !== 'pending') {
        this.deliveries.delete(id);
        cleared++;
      }
    }

    this.logger.log(`Cleared ${cleared} old webhook deliveries`);
    return cleared;
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get active endpoints
   */
  getActiveEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter((e) => e.active);
  }

  /**
   * Enable endpoint
   */
  enableEndpoint(endpointId: string): boolean {
    return this.updateEndpoint(endpointId, { active: true });
  }

  /**
   * Disable endpoint
   */
  disableEndpoint(endpointId: string): boolean {
    return this.updateEndpoint(endpointId, { active: false });
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.endpoints.clear();
    this.deliveries.clear();
    this.deliveryQueue = [];
    this.logger.log('All webhook data cleared');
  }
}

/**
 * Common webhook events
 */
export enum WebhookEvents {
  // Event lifecycle
  EVENT_CREATED = 'event.created',
  EVENT_UPDATED = 'event.updated',
  EVENT_STARTED = 'event.started',
  EVENT_ENDED = 'event.ended',
  EVENT_CANCELLED = 'event.cancelled',

  // Submissions
  SUBMISSION_CREATED = 'submission.created',
  SUBMISSION_UPDATED = 'submission.updated',
  SUBMISSION_APPROVED = 'submission.approved',
  SUBMISSION_REJECTED = 'submission.rejected',

  // Judging
  JUDGING_STARTED = 'judging.started',
  JUDGING_COMPLETED = 'judging.completed',
  SCORE_SUBMITTED = 'score.submitted',

  // Prizes
  PRIZE_CREATED = 'prize.created',
  PRIZE_AWARDED = 'prize.awarded',
  PRIZE_PAID = 'prize.paid',

  // Teams
  TEAM_CREATED = 'team.created',
  TEAM_UPDATED = 'team.updated',
  MEMBER_JOINED = 'member.joined',
  MEMBER_LEFT = 'member.left',

  // Users
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',

  // Sponsors
  SPONSOR_ADDED = 'sponsor.added',
  SPONSOR_UPDATED = 'sponsor.updated',
}

export default WebhookService;

