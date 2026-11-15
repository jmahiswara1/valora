import { Body, Controller, Post, Req } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { DatabaseService } from '../../infrastructure/database.service.js';
import { reserveAiBudget } from '../../infrastructure/ai-budget.js';
import { AppException, ZodPipe, type AppRequest } from '../../shared/http.js';
import { serial } from '../../shared/transactions.js';
import { explainerConfig } from '../assessments/explainer/config.js';
import { generateReuseAnswer } from './reuse-provider.js';

const questionSchema = z.object({
  question: z.string().trim().min(4).max(600),
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
    const config = explainerConfig();
    if (!config.configured) {
      throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', 'Asisten Valora belum dikonfigurasi. Periksa pengaturan AI di backend.');
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
        config,
        now,
      );

      if (limit) {
        const message = limit.reason === 'BUSY'
          ? 'Asisten sedang menjawab pertanyaan lain. Coba lagi sebentar.'
          : 'Batas pertanyaan harian tercapai. Coba lagi besok.';

        throw new AppException(429, 'RATE_LIMITED', message);
      }

      // Slot sementara untuk membatasi jumlah panggilan AI bersamaan.
      // Kolom actorId pada tabel lease bertipe UUID, tanpa relasi ke akun.
      await tx.photoAnalysisLease.create({
        data: {
          key: leaseKey,
          token,
          actorId: token,
          expiresAt: new Date(now.getTime() + config.timeoutMs + 15000),
        },
      });
    });

    try {
      return { answer: await generateReuseAnswer(input.question, instructions, config) };
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