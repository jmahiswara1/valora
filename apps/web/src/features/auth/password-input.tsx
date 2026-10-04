'use client';

import { type ComponentPropsWithRef, useState } from 'react';
import { Input } from "../../components/ui/primitives";
import { EyeOff, Eye } from 'lucide-react';

export function AccountPasswordInput(props: ComponentPropsWithRef<'input'>) {
  const [visible, setVisible] = useState(false);
  return <div className="account-password"><Input {...props} type={visible ? 'text' : 'password'} /><button type="button" className="account-password-toggle" disabled={props.disabled} aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={visible} aria-controls={props.id} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>;
}
