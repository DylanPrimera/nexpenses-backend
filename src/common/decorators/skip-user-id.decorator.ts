import { SetMetadata } from '@nestjs/common';

export const SKIP_USER_ID_KEY = 'skipUserId';
export const SkipUserId = () => SetMetadata(SKIP_USER_ID_KEY, true);
