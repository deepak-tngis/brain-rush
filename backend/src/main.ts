import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/**
 * Brain Rush's optional companion service.
 *
 * The game itself never calls this: puzzles are generated on the device and
 * progress is stored on the device, so the app works with no network at all.
 * This exists purely so a deployment has something to health-check.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // 0.0.0.0 so the service is reachable from outside a container.
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();
