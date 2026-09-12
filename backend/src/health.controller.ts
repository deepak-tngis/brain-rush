import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
}

/**
 * Liveness endpoint.
 *
 * The response shape is fixed by contract — `{"status":"ok"}` and nothing else —
 * so uptime checks and container probes can match on it exactly.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
