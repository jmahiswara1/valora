'use client';

import { ApiClientError, api } from '@/lib/api';
import { registerSchema, type UserDto } from '@valora/contracts';
import { z } from 'zod';
import { type ComponentPropsWithRef, useState, useRef, type FormEvent } from 'react';
import { Input, Notice, Button } from "../../components/ui/primitives";
import { EyeOff, Eye } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { CityPicker } from '../../components/ui/city-picker';
import { safeNext } from '@/lib/route-policy';

function message(error: unknown) { return error instanceof ApiClientError ? error.message : 'Koneksi gagal. Coba lagi.'; }

const signupSchema = registerSchema.extend({ confirm: z.string().min(12, 'Konfirmasi kata sandi minimal 12 karakter') }).refine((value) => value.password === value.confirm, { path: ['confirm'], message: 'Konfirmasi kata sandi tidak sama.' });

type SignupValues = z.infer<typeof signupSchema>;

function PasswordInput(props: ComponentPropsWithRef<'input'>) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-password">
    <Input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="auth-password-toggle" aria-label={`Tampilkan ${props.id === 'confirm' ? 'konfirmasi kata sandi' : 'kata sandi'}`} aria-pressed={visible} aria-controls={props.id} onClick={() => setVisible((value) => !value)}>
      {visible ? <EyeOff size={19} strokeWidth={1.6} aria-hidden="true" /> : <Eye size={19} strokeWidth={1.6} aria-hidden="true" />}
    </button>
  </div>;
}

function AuthField({ label, hint, error, ...props }: ComponentPropsWithRef<'input'> & { id: string; label: string; hint?: string; error?: string }) {
  const describedBy = [hint && `${props.id}-hint`, error && `${props.id}-error`].filter(Boolean).join(' ') || undefined;
  const inputProps = { ...props, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };
  return <div className="field">
    <label htmlFor={props.id}>{label}</label>
    {props.type === 'password' ? <PasswordInput {...inputProps} /> : <Input {...inputProps} />}
    {hint && <p id={`${props.id}-hint`} className="field-hint">{hint}</p>}
    {error && <p id={`${props.id}-error`} className="field-error" role="alert">{error}</p>}
  </div>;
}

export function RegisterForm() {
  const router = useRouter(); const session = useSession();
  const [error, setError] = useState('');
  const pending = useRef(false);
  const form = useForm<SignupValues>({ resolver: zodResolver(signupSchema), defaultValues: { displayName: '', email: '', cityId: '', password: '', confirm: '' } });
  const cityId = useWatch({ control: form.control, name: 'cityId' });
  async function submit(values: SignupValues) {
    if (pending.current) return;
    pending.current = true;
    setError('');
    try {
      await api('/auth/register', { method: 'POST', body: { displayName: values.displayName, email: values.email, password: values.password, cityId: values.cityId } });
      router.push('/verifikasi-email?email=' + encodeURIComponent(values.email));
    } catch (e) { setError(message(e)); }
    finally { pending.current = false; }
  }
  if (session.state === 'CHECKING') return <p role="status">Memeriksa sesi…</p>;
  if (session.state === 'AUTHENTICATED') return <Notice>Kamu sudah masuk. <Link href="/app">Lanjut ke akun</Link></Notice>;
  return <form className="form-stack" onSubmit={(event) => { void form.handleSubmit(submit)(event); }} noValidate aria-busy={form.formState.isSubmitting}>
    {error && <Notice kind="error">{error}</Notice>}
    <AuthField label="Nama tampilan" id="displayName" required maxLength={80} autoComplete="name" error={form.formState.errors.displayName?.message} {...form.register('displayName')} />
    <AuthField label="Email" id="email" required type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
    <input type="hidden" {...form.register('cityId')} />
    <CityPicker value={cityId ?? ''} onChange={(city) => form.setValue('cityId', city.id, { shouldValidate: true })} error={form.formState.errors.cityId?.message} required />
    <AuthField label="Kata sandi" id="password" required type="password" autoComplete="new-password" hint="Minimal 12 karakter." error={form.formState.errors.password?.message} {...form.register('password')} />
    <AuthField label="Ulangi kata sandi" id="confirm" required type="password" autoComplete="new-password" error={form.formState.errors.confirm?.message} {...form.register('confirm')} />
    <Button disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Mendaftarkan…' : 'Buat akun'}</Button>
    <p className="auth-other">Sudah punya akun? <Link href="/masuk">Masuk</Link></p>
  </form>;
}

export function LoginForm() {
  const router = useRouter(); const session = useSession(); const params = useSearchParams();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError('');
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const user = await api<UserDto>('/auth/login', { method: 'POST', body: { email: data.get('email'), password: data.get('password') } });
      await session.changed();
      router.replace(safeNext(params.get('next'), user.role));
    } catch (e) { setError(message(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  if (session.state === 'CHECKING') return <p role="status">Memeriksa sesi…</p>;
  if (session.state === 'AUTHENTICATED') {
    const next = safeNext(params.get('next'), session.session?.user?.role);
    return <Notice>Kamu sudah masuk. <Link href={next}>{next.startsWith('/market') ? 'Kembali ke Market' : 'Lanjut ke akun'}</Link></Notice>;
  }
  return <form className="form-stack" onSubmit={submit} aria-busy={busy}>
    {params.get('reset') === 'success' && <Notice kind="success">Kata sandi diperbarui. Masuk dengan kata sandi baru.</Notice>}
    {error && <Notice kind="error">{error}</Notice>}
    <AuthField label="Email" id="email" name="email" type="email" required autoComplete="email" />
    <AuthField label="Kata sandi" id="password" name="password" type="password" required autoComplete="current-password" />
    <Link href="/lupa-kata-sandi" className="auth-recovery-link">Lupa kata sandi?</Link>
    <Button disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</Button>
    <p className="auth-other">Belum punya akun? <Link href="/daftar">Daftar</Link></p>
  </form>;
}

export function ResetRequestForm() {
  const [success, setSuccess] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const email = new FormData(event.currentTarget).get('email');
    try { await api('/auth/password-reset/request', { method: 'POST', body: { email } }); setSuccess(true); }
    catch (e) { setError(message(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="form-stack">
    {success ? <Notice kind="success">Jika akun tersedia, tautan pemulihan telah dikirim. Periksa email kamu.</Notice> : <form className="form-stack" onSubmit={submit} aria-busy={busy}>
      {error && <Notice kind="error">{error}</Notice>}
      <AuthField label="Email akun" id="email" type="email" name="email" required autoComplete="email" />
      <Button disabled={busy}>{busy ? 'Mengirim tautan…' : 'Kirim tautan pemulihan'}</Button>
    </form>}
    <p className="auth-other"><Link href="/masuk">Kembali ke masuk</Link></p>
  </div>;
}

export function ResetConfirmForm() {
  const session = useSession(); const router = useRouter();
  const params = useSearchParams(); const token = params.get('token');
  const [error, setError] = useState(''); const [confirmError, setConfirmError] = useState(''); const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    setError('');
    if (data.get('password') !== data.get('confirm')) {
      setConfirmError('Konfirmasi kata sandi tidak sama.');
      event.currentTarget.querySelector<HTMLInputElement>('#confirm')?.focus();
      return;
    }
    setConfirmError(''); pending.current = true; setBusy(true);
    try {
      await api('/auth/password-reset/confirm', { method: 'POST', body: { token, password: data.get('password') } });
      await session.changed(); router.replace('/masuk?reset=success');
    } catch (e) { setError(message(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!token) return <div className="form-stack"><Notice kind="error">Tautan pemulihan tidak lengkap. Minta tautan baru untuk melanjutkan.</Notice><p className="auth-other"><Link href="/lupa-kata-sandi">Minta tautan pemulihan baru</Link></p></div>;
  return <form className="form-stack" onSubmit={submit} aria-busy={busy}>
    {error && <Notice kind="error">{error}</Notice>}
    <AuthField label="Kata sandi baru" id="password" name="password" type="password" minLength={12} required autoComplete="new-password" hint="Minimal 12 karakter." />
    <AuthField label="Ulangi kata sandi" id="confirm" name="confirm" type="password" minLength={12} required autoComplete="new-password" error={confirmError} onChange={() => setConfirmError('')} />
    <Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kata sandi'}</Button>
    <p className="auth-other"><Link href="/masuk">Kembali ke masuk</Link></p>
  </form>;
}

export function VerifyEmailForm() {
  const session = useSession();
  const params = useSearchParams(); const token = params.get('token'); const email = params.get('email') ?? '';
  const [result, setResult] = useState(''); const [error, setError] = useState(''); const [action, setAction] = useState<'verify' | 'resend' | null>(null);
  const pending = useRef(false);
  const busy = action !== null;
  async function verify() {
    if (!token || pending.current) return;
    pending.current = true; setAction('verify'); setError('');
    try { await api('/auth/verify-email', { method: 'POST', body: { token } }); await session.changed(); setResult('Email berhasil diverifikasi. Kamu dapat masuk.'); }
    catch (e) { setError(message(e)); }
    finally { pending.current = false; setAction(null); }
  }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setAction('resend'); setError('');
    const email = new FormData(event.currentTarget).get('email');
    try { await api('/auth/verification/resend', { method: 'POST', body: { email } }); setResult('Jika email dapat diverifikasi, tautan baru telah dikirim.'); }
    catch (e) { setError(message(e)); }
    finally { pending.current = false; setAction(null); }
  }
  return <div className="form-stack" aria-busy={busy}>
    {error && <Notice kind="error">{error}</Notice>}
    {result && <Notice kind="success">{result}</Notice>}
    {token && !result && <Button onClick={verify} disabled={busy}>{action === 'verify' ? 'Memverifikasi…' : 'Verifikasi email'}</Button>}
    {!token && <Notice>Tautan verifikasi dikirim saat pendaftaran. Periksa kotak masuk atau email demo lokal.</Notice>}
    <form className="form-stack" onSubmit={resend}>
      <AuthField label="Kirim ulang ke email" id="email" type="email" name="email" required autoComplete="email" defaultValue={email} />
      <Button variant="secondary" disabled={busy}>{action === 'resend' ? 'Mengirim ulang…' : 'Kirim ulang tautan'}</Button>
    </form>
    <p className="auth-other"><Link href="/masuk">Kembali ke masuk</Link></p>
  </div>;
}
