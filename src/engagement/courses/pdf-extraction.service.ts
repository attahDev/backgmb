import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
// pdf-parse's default export is the parse function itself.
import pdfParse from 'pdf-parse';

// llama-3.3-70b-versatile is being retired by Groq — gpt-oss-120b is the
// current recommended general-purpose replacement as of this writing.
// Overridable via env without a code change if Groq's lineup shifts again.
const GROQ_MODEL = process.env.GROQ_EXTRACTION_MODEL || 'openai/gpt-oss-120b';

// pdf-parse has no hard limit, but a whole book blows past any model's
// context window, and the point of this feature is "draft one chapter",
// not "summarize an entire book" — cap what gets sent per call.
const MAX_CHARS = 24000;

type SectionType = 'content' | 'example' | 'case-study' | 'activity' | 'summary' | 'questions';

export interface ExtractedSection {
  id: string;
  title: string;
  type: SectionType;
  paragraphs: string[];
  points: string[];
}

export interface ExtractedModuleContent {
  suggestedTitle: string;
  description: string;
  duration: string;
  learningOutcomes: string[];
  sections: ExtractedSection[];
  truncated: boolean;
}

const SYSTEM_PROMPT = `You turn raw book/document text into a single structured course chapter. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "suggestedTitle": string,
  "description": string (1-2 sentences),
  "duration": string (estimated read/study time, e.g. "25 min"),
  "learningOutcomes": string[] (3-5 items),
  "sections": [
    { "id": string (kebab-case slug), "title": string, "type": "content"|"example"|"case-study"|"activity"|"summary"|"questions", "paragraphs": string[], "points": string[] }
  ]
}
Break the material into 3-6 logical sections. Use "summary" as the type for a final recap section. Paraphrase and organize the material in your own words — don't just copy giant blocks of the original text verbatim into one paragraph.`;

@Injectable()
export class PdfExtractionService {
  async extractModuleContent(file: Express.Multer.File): Promise<ExtractedModuleContent> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(`Expected a PDF, got '${file.mimetype}'`);
    }

    const parsed = await pdfParse(file.buffer);
    const text = parsed.text.trim();
    if (!text) {
      throw new BadRequestException(
        "Could not extract any text from this PDF — it may be scanned images rather than real text, which this can't OCR.",
      );
    }

    const truncated = text.length > MAX_CHARS;
    const excerpt = text.slice(0, MAX_CHARS);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('GROQ_API_KEY is not configured on the server.');
    }

    const userPrompt = truncated
      ? `The document is longer than fits in one request; below is the first ~${MAX_CHARS} characters. Draft a single chapter from this excerpt.\n\n${excerpt}`
      : excerpt;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new InternalServerErrorException(
        `Extraction request to Groq failed (${response.status}): ${errText.slice(0, 300)}`,
      );
    }

    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    if (!raw) throw new InternalServerErrorException('Groq returned no content to parse.');

    let extracted: Partial<ExtractedModuleContent>;
    try {
      extracted = JSON.parse(raw);
    } catch {
      throw new InternalServerErrorException("Groq's response wasn't valid JSON — try again.");
    }

    // Guarantee stable, unique-enough section ids even if the model
    // forgot one or produced a duplicate — these ids are what a student's
    // "mark as done" checkbox gets recorded against once saved.
    const sections: ExtractedSection[] = (extracted.sections ?? []).map((s, i) => ({
      id: s.id || `section-${i + 1}`,
      title: s.title || `Section ${i + 1}`,
      type: s.type ?? 'content',
      paragraphs: s.paragraphs ?? [],
      points: s.points ?? [],
    }));

    return {
      suggestedTitle: extracted.suggestedTitle ?? file.originalname.replace(/\.pdf$/i, ''),
      description: extracted.description ?? '',
      duration: extracted.duration ?? '',
      learningOutcomes: extracted.learningOutcomes ?? [],
      sections,
      truncated,
    };
  }
}
