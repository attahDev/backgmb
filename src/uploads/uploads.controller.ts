import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  /** Image or video for a course chapter section. Returns { url, type } —
   *  the frontend stores the url directly on ModuleSectionDto.media. */
  @Post('course-media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 300 * 1024 * 1024 } }))
  async uploadCourseMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadsService.uploadCourseMedia(file);
  }
}
