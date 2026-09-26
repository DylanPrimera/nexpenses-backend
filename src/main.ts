import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import {
  ApiFailureResponseDto,
  createAppValidationPipe,
} from './common/http/index.js';

const DEV_DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
];

function resolveCorsOrigins(): string[] {
  const stage = (process.env.STAGE ?? 'dev').toLowerCase();
  const raw = process.env.CORS_ORIGINS ?? '';
  const fromEnv = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const hasWildcard = fromEnv.some((o) => o === '*');

  if (stage === 'prod') {
    if (fromEnv.length === 0 || hasWildcard) {
      throw new Error(
        'CORS_ORIGINS must list explicit origins in production (STAGE=prod); empty or "*" is rejected',
      );
    }
    return fromEnv;
  }

  const merged = new Set<string>(DEV_DEFAULT_CORS_ORIGINS);
  if (!hasWildcard) {
    for (const o of fromEnv) {
      merged.add(o);
    }
  }
  return [...merged];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(createAppValidationPipe());

  const corsOrigins = resolveCorsOrigins();
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-User-Id',
    ],
    credentials: false,
  });

  const config = new DocumentBuilder()
    .setTitle('Nexpenses')
    .setDescription(
      'Nexpenses cloud API — personal COP budget tracker. Identify users via X-User-Id header (no JWT). ' +
        'Global rate limit: 60 req/min per IP; POST /users is limited to 10 req/min.\n\n' +
        '**Response envelope:** every response is `{ success, data, message }`. ' +
        'Errors also include `error: { statusCode, code, details? }`. ' +
        'Paginated lists use `data: { items, total, limit, offset }`.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Id',
        description: 'UUID of an existing User (required on protected routes)',
      },
      'X-User-Id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiFailureResponseDto],
  });
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Nexpenses API listening on http://localhost:${port}/api/v1`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
  console.log(`CORS origins: ${corsOrigins.join(', ')}`);
}

await bootstrap();
