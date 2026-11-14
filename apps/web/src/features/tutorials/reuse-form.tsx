'use client';

import { useRef, useState, type FormEvent } from 'react';
import { api, ApiClientError } from '@/lib/api';

interface Reply {
  question: string;
  answer: string;
}

function getErrorMessage(cause: unknown): string {
  if (!(cause instanceof ApiClientError)) {
    return 'Koneksi ke Valora terputus. Periksa koneksimu lalu coba lagi.';
  }

  if (cause.status === 429) {
    return 'Batas permintaan Valora sedang tercapai. Coba lagi nanti.';
  }

  if (cause.status >= 500) {
    return 'Asisten Valora belum bisa menjawab. Coba lagi sebentar.';
  }

  return cause.message;
}

export function ReuseIdeas() {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sending = useRef(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedQuestion = question.trim();
    if (sending.current || submittedQuestion.length < 4) return;

    sending.current = true;
    setLoading(true);
    setError('');

    try {
      const result = await api<{ answer: string }>('/reuse-ideas', {
        method: 'POST',
        body: { question: submittedQuestion },
        timeoutMs: 75000,
      });

      setReply({
        question: submittedQuestion,
        answer: result.answer,
      });
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      sending.current = false;
      setLoading(false);
    }
  }

  return (
    <section
      id="tanya-ai"
      aria-labelledby="reuse-ai-title"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        marginBlock: 28,
        padding: 'clamp(20px, 4vw, 44px)',
        borderRadius: 20,
        background: '#f3f6ef',
        color: '#22352b',
        border: '1px solid #dce5d9',
      }}
    >
      <div style={{ maxWidth: 760, marginInline: 'auto' }}>
        <h2
          id="reuse-ai-title"
          style={{ margin: '0 0 10px', lineHeight: 1.2 }}
        >
          Barang bekas ini bisa jadi apa?
        </h2>

        <p style={{ margin: '0 0 20px', lineHeight: 1.6 }}>
          Ceritakan barang dan alat yang kamu punya. Valora akan
          menyarankan ide beserta cara membuatnya.
        </p>

        <form onSubmit={ask}>
          <label
            htmlFor="reuse-question"
            style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}
          >
            Pertanyaanmu
          </label>

          <textarea
            id="reuse-question"
            rows={3}
            maxLength={600}
            required
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="Aku punya kardus sepatu, lem, dan gunting. Bisa dibuat apa untuk meja belajar?"
            style={{
              display: 'block',
              boxSizing: 'border-box',
              width: '100%',
              padding: 14,
              border: '1px solid #9daa9c',
              borderRadius: 10,
              background: '#fff',
              color: '#22352b',
              resize: 'vertical',
              font: 'inherit',
            }}
          />

          <button
            type="submit"
            className="button button-primary"
            disabled={loading || question.trim().length < 4}
            style={{ marginTop: 12 }}
          >
            {loading ? 'Valora sedang menjawab…' : 'Tanya Valora'}
          </button>
        </form>

        {error && <p role="alert">{error}</p>}

        <div aria-live="polite" aria-busy={loading}>
          {reply && (
            <article
              style={{
                marginTop: 24,
                padding: 'clamp(16px, 3vw, 26px)',
                borderRadius: 14,
                background: '#fff',
              }}
            >
              <p style={{ marginTop: 0, overflowWrap: 'anywhere' }}>
                <strong>Pertanyaanmu</strong>
                <br />
                {reply.question}
              </p>

              <h3 style={{ marginBottom: 8 }}>Jawaban Valora</h3>

              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.75,
                }}
              >
                {reply.answer}
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}