import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { sanitizeAiText } from 'src/common/sanitize-ai-text';

interface FellowshipApiResponse {
  answer?: string;
  response?: string;
  message?: string;
  result?: string;
  data?: { answer?: string; response?: string; message?: string };
}

/**
 * Proxies chat to the dedicated Fellowship AI model. Same shape as
 * HofAiService — routed through the backend so the Space URL is hidden
 * and the endpoint is auth-gated like the rest of the platform's agents.
 */
@Injectable()
export class FellowshipAiService {
  private readonly logger = new Logger(FellowshipAiService.name);

  private readonly AI_API_URL =
    process.env.FELLOWSHIP_AI_API_URL ??
    'https://olayimika01-fellowship.hf.space/api/v1/chat';

  async chat(message: string): Promise<{ reply: string }> {
    if (!message?.trim()) {
      throw new BadRequestException('Message is required');
    }

    try {
      const response = await fetch(this.AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: message }),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Fellowship AI request failed with status ${response.status}`,
        );
      }

      const data = (await response.json()) as FellowshipApiResponse;
      const reply =
        data.answer ||
        data.response ||
        data.message ||
        data.result ||
        data.data?.answer ||
        data.data?.response ||
        data.data?.message;

      if (!reply) {
        throw new BadRequestException('Fellowship AI returned an empty response');
      }

      return { reply: sanitizeAiText(reply) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Fellowship AI call failed', error as Error);
      throw new BadRequestException('Could not reach the Fellowship AI right now');
    }
  }
}
