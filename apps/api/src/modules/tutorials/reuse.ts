import { Body, Controller, Post, Req } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { DatabaseService } from '../../infrastructure/database.service.js';
import { reserveAiBudget } from '../../infrastructure/ai-budget.js';
import { AppException, ZodPipe, type AppRequest } from '../../shared/http.js';
import { serial } from '../../shared/transactions.js';
import { explainerConfig } from '../assessments/explainer/config.js';

const questionSchema = z.object({
  question: z.string().trim().min(4).max(600),
});

const responseSchema = z.object({
  promptFeedback: z.object({
    blockReason: z.string().optional(),
  }).optional(),
  candidates: z.array(
    z.object({
      finishReason: z.string().optional(),
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string().optional(),
            thought: z.boolean().optional(),
          }),
        ),
      }).optional(),
    }),
  ).optional(),
});

const instructions = [
  'Kamu adalah asisten Valora yang membantu orang memanfaatkan barang bekas.',
  'Jawab dalam bahasa Indonesia yang ramah dan mudah dipahami pemula.',
  'Perhatikan barang, jumlah, kondisi, alat, dan batasan yang disebut pengguna.',
  'Jika pengguna meminta ide, berikan maksimal tiga ide lalu pilih satu yang paling cocok.',
  'Untuk ide pilihan, sebutkan alat dan bahan, lalu tulis langkah pembuatan bernomor.',
  'Jika pengguna sudah meminta satu hasil tertentu, langsung berikan tutorial untuk hasil tersebut.',
  'Jika barang belum disebutkan atau informasi penting belum jelas, ajukan satu pertanyaan klarifikasi.',
  'Hindari petunjuk berbahaya seperti membongkar baterai, mengolah wadah beracun, atau mengerjakan listrik aktif.',
  'Gunakan teks biasa dengan paragraf pendek. Tanpa tabel, HTML, JSON, atau tanda bintang Markdown.',
].join('\n');

@Controller('reuse-ideas')
export class ReuseIdeasController {
  constructor(private readonly db: DatabaseService) {}

  @Post()
  async generate(
    @Req() request: AppRequest,
    @Body(new ZodPipe(questionSchema))
    input: z.infer<typeof questionSchema>,
  ): Promise<{ answer: string }> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim().replace(/^models\//, '');

    if (!apiKey || !model || !/^[\w.-]+$/.test(model)) {
      throw new AppException(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Asisten Valora belum dikonfigurasi. Periksa pengaturan Gemini di backend.',
      );
    }

    // Middleware Valora sudah memvalidasi token ini untuk semua POST.
    // Pengunjung dan pengguna login sama-sama memperoleh token melalui api().
    const browserToken = request.get('x-csrf-token');

    if (!browserToken) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Token keamanan formulir tidak ada.',
      );
    }

    const browserKey = createHash('sha256')
      .update('valora-public-reuse:' + browserToken)
      .digest('hex');

    const token = randomUUID();
    const leaseKey = `reuse:${token}`;

    await serial(this.db, async tx => {
      const now = new Date();
      const limit = await reserveAiBudget(
        tx,
        browserKey,
        explainerConfig(),
        now,
      );

      if (limit) {
        const message = limit.reason === 'BUSY'
          ? 'Asisten sedang menjawab pertanyaan lain. Coba lagi sebentar.'
          : 'Batas pertanyaan harian tercapai. Coba lagi besok.';

        throw new AppException(429, 'RATE_LIMITED', message);
      }

      // Slot sementara untuk membatasi jumlah panggilan Gemini bersamaan.
      // Kolom actorId pada tabel lease bertipe UUID, tanpa relasi ke akun.
      await tx.photoAnalysisLease.create({
        data: {
          key: leaseKey,
          token,
          actorId: token,
          expiresAt: new Date(now.getTime() + 75000),
        },
      });
    });

    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instructions }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: input.question }],
            },
          ],
          generationConfig: {
            responseMimeType: 'text/plain',
            maxOutputTokens: 4096,
          },
        }),
      });

      if (response.status === 429) {
        throw new AppException(
          429,
          'RATE_LIMITED',
          'Kuota Gemini sedang terbatas. Silakan coba lagi nanti.',
        );
      }

      if (!response.ok) {
  const detail = await response.json().catch(() => null) as {
    error?: {
      status?: string;
      message?: string;
      details?: Array<{ reason?: string }>;
    };
  } | null;

  const reason = detail?.error?.details
    ?.map(entry => entry.reason)
    .filter(Boolean)
    .join(', ');

  console.error('[Valora Gemini]', {
    http: response.status,
    status: detail?.error?.status,
    reason,
    message: detail?.error?.message?.replaceAll(apiKey, '[disembunyikan]'),
    model,
  });

  throw new AppException(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Gemini belum bisa menjawab. Lihat detail [Valora Gemini] di terminal.',
  );
}

      const data = responseSchema.parse(await response.json());
      const candidate = data.candidates?.[0];

      if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
        return {
          answer: 'Aku belum bisa menyarankan tutorial yang aman untuk permintaan ini. Ada barang rumah tangga lain yang ingin kamu manfaatkan?',
        };
      }

      const answer = candidate?.content?.parts
        .filter(part => !part.thought)
        .map(part => part.text ?? '')
        .join('')
        .trim();

      if (candidate?.finishReason !== 'STOP' || !answer) {
        throw new AppException(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Jawabannya belum selesai. Coba kirim ulang pertanyaanmu.',
        );
      }

      return { answer };
    } catch (error) {
      if (error instanceof AppException) throw error;

      throw new AppException(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Asisten belum bisa dihubungi. Coba lagi sebentar.',
      );
    } finally {
      await this.db.photoAnalysisLease.deleteMany({
        where: { key: leaseKey, token },
      });
    }
  }
}