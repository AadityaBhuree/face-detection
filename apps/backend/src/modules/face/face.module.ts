import { Module } from '@nestjs/common';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';
import { FaceRegistrationService } from './face-registration.service';

@Module({
  controllers: [FaceController],
  providers: [FaceService, FaceRegistrationService],
  exports: [FaceService, FaceRegistrationService],
})
export class FaceModule {}
