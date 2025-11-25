import {

  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhookService, WebhookEndpoint } from './services/webhook.service';

interface CreateEndpointDto {
  url: string;
  secret: string;
  events: string[];
  active?: boolean;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

interface UpdateEndpointDto {
  url?: string;
  secret?: string;
  events?: string[];
  active?: boolean;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

interface TriggerWebhookDto {
  event: string;
  data: any;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Register a new webhook endpoint
   */
  @Post('endpoints')
  @HttpCode(HttpStatus.CREATED)
  registerEndpoint(@Body() createDto: CreateEndpointDto) {
    const endpoint: WebhookEndpoint = {
      id: `endpoint-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      url: createDto.url,
      secret: createDto.secret,
      events: createDto.events,
      active: createDto.active ?? true,
      retryConfig: createDto.retryConfig,
    };

    this.webhookService.registerEndpoint(endpoint);

    return {
      success: true,
      message: 'Webhook endpoint registered successfully',
      data: endpoint,
    };
  }

  /**
   * Get all webhook endpoints
   */
  @Get('endpoints')
  getEndpoints(@Query('active') active?: string) {
    let endpoints = this.webhookService.getEndpoints();

    if (active !== undefined) {
      const isActive = active === 'true';
      endpoints = endpoints.filter((e) => e.active === isActive);
    }

    return {
      success: true,
      data: endpoints,
      count: endpoints.length,
    };
  }

  /**
   * Update webhook endpoint
   */
  @Put('endpoints/:endpointId')
  updateEndpoint(
    @Param('endpointId') endpointId: string,
    @Body() updateDto: UpdateEndpointDto
  ) {
    const updated = this.webhookService.updateEndpoint(endpointId, updateDto);

    if (!updated) {
      return {
        success: false,
        message: 'Endpoint not found',
      };
    }

    return {
      success: true,
      message: 'Webhook endpoint updated successfully',
    };
  }

  /**
   * Delete webhook endpoint
   */
  @Delete('endpoints/:endpointId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEndpoint(@Param('endpointId') endpointId: string) {
    this.webhookService.unregisterEndpoint(endpointId);
  }

  /**
   * Enable webhook endpoint
   */
  @Post('endpoints/:endpointId/enable')
  enableEndpoint(@Param('endpointId') endpointId: string) {
    const enabled = this.webhookService.enableEndpoint(endpointId);

    if (!enabled) {
      return {
        success: false,
        message: 'Endpoint not found',
      };
    }

    return {
      success: true,
      message: 'Endpoint enabled successfully',
    };
  }

  /**
   * Disable webhook endpoint
   */
  @Post('endpoints/:endpointId/disable')
  disableEndpoint(@Param('endpointId') endpointId: string) {
    const disabled = this.webhookService.disableEndpoint(endpointId);

    if (!disabled) {
      return {
        success: false,
        message: 'Endpoint not found',
      };
    }

    return {
      success: true,
      message: 'Endpoint disabled successfully',
    };
  }

  /**
   * Test webhook endpoint
   */
  @Post('endpoints/:endpointId/test')
  async testEndpoint(@Param('endpointId') endpointId: string) {
    const result = await this.webhookService.testEndpoint(endpointId);

    if (!result) {
      return {
        success: false,
        message: 'Failed to test endpoint',
      };
    }

    return {
      success: true,
      message: 'Test webhook sent successfully',
    };
  }

  /**
   * Trigger a webhook event manually (for testing)
   */
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerWebhook(@Body() triggerDto: TriggerWebhookDto) {
    await this.webhookService.trigger(triggerDto.event, triggerDto.data);

    return {
      success: true,
      message: 'Webhook triggered successfully',
    };
  }

  /**
   * Get webhook delivery by ID
   */
  @Get('deliveries/:deliveryId')
  getDelivery(@Param('deliveryId') deliveryId: string) {
    const delivery = this.webhookService.getDelivery(deliveryId);

    if (!delivery) {
      return {
        success: false,
        message: 'Delivery not found',
      };
    }

    return {
      success: true,
      data: delivery,
    };
  }

  /**
   * Get deliveries for an endpoint
   */
  @Get('endpoints/:endpointId/deliveries')
  getEndpointDeliveries(@Param('endpointId') endpointId: string) {
    const deliveries = this.webhookService.getEndpointDeliveries(endpointId);

    return {
      success: true,
      data: deliveries,
      count: deliveries.length,
    };
  }

  /**
   * Get recent deliveries
   */
  @Get('deliveries')
  getRecentDeliveries(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const deliveries = this.webhookService.getRecentDeliveries(limitNum);

    return {
      success: true,
      data: deliveries,
      count: deliveries.length,
    };
  }

  /**
   * Retry failed delivery
   */
  @Post('deliveries/:deliveryId/retry')
  async retryDelivery(@Param('deliveryId') deliveryId: string) {
    const result = await this.webhookService.retryDelivery(deliveryId);

    if (!result) {
      return {
        success: false,
        message: 'Cannot retry delivery (not found or not failed)',
      };
    }

    return {
      success: true,
      message: 'Delivery retry initiated',
    };
  }

  /**
   * Get webhook statistics
   */
  @Get('stats')
  getStats() {
    const stats = this.webhookService.getStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Clear old deliveries
   */
  @Delete('deliveries/old')
  clearOldDeliveries(@Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld, 10) : 7;
    const cleared = this.webhookService.clearOldDeliveries(days);

    return {
      success: true,
      message: `Cleared ${cleared} old deliveries`,
      count: cleared,
    };
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  @Post('verify')
  verifySignature(
    @Body() body: { payload: any; signature: string; secret: string }
  ) {
    const isValid = this.webhookService.verifySignature(
      body.payload,
      body.secret
    );

    return {
      success: true,
      valid: isValid,
    };
  }
}

export default WebhooksController;

