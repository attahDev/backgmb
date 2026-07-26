/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { CreateNewsletterDto } from './dto/create-newsletter.dto';
import { Throttle } from '@nestjs/throttler';
import { CreatePartnerRequestDto } from './dto/create-partnership.dto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('newsletter')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async subscribe(@Body() dto: CreateNewsletterDto) {
    return await this.contactService.suscribe(dto);
  }

  @Post('partnership-request')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async partnershipRequest(@Body() dto: CreatePartnerRequestDto) {
    return await this.contactService.partnershipRequest(dto);
  }

  @Post('contact-message')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async createMessage(@Body() dto: CreateContactMessageDto) {
    return await this.contactService.createMessage(dto);
  }

  // ───────────────────────── Admin: read-only listings ─────────────────────────

  @Get('admin/contact-messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAllMessages(@Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return await this.contactService.findAllMessages(take);
  }

  @Get('admin/subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAllSubscriptions(@Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return await this.contactService.findAllSubscriptions(take);
  }

  @Get('admin/partnership-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAllPartnerRequests(@Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return await this.contactService.findAllPartnerRequests(take);
  }
}
