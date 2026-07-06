import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://lotsy.pages.dev',
      'http://localhost:4200',
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],
    methods: ['GET'],
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API running on port ${process.env.PORT ?? 3000}`);

  // Render free spins the service down after 15 min without traffic, and
  // external cron pingers (GitHub Actions) proved unreliable. Hitting our own
  // public URL goes through Render's ingress, so it counts as traffic — once
  // awake, the process keeps itself awake. RENDER_EXTERNAL_URL is injected by
  // Render; locally it is unset and the loop never starts.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    const KEEPALIVE_INTERVAL_MS = 10 * 60_000;
    setInterval(() => {
      fetch(`${selfUrl}/health`).catch((err) =>
        console.warn('[keepalive] self-ping failed:', err),
      );
    }, KEEPALIVE_INTERVAL_MS).unref();
    console.log(`[keepalive] self-ping every 10 min -> ${selfUrl}/health`);
  }
}

void bootstrap();
