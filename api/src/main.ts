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
}

bootstrap();
