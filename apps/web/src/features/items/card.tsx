'use client';

import type { ItemDto } from '@valora/contracts';
import Link from 'next/link';
import { PrivatePhoto } from './photo';

const categoryNames: Record<string, string> = { electronics: 'Elektronik', furniture: 'Furnitur', fashion: 'Pakaian', books: 'Buku', household: 'Rumah tangga', sports: 'Olahraga', hobby: 'Hobi' };

export function ItemCard({ item }: { item: ItemDto }) { return <Link className="item-card" href={`/app/barang/${item.id}`}><div className="item-card-media"><PrivatePhoto mediaId={item.media[0]?.id} alt={`Foto ${item.title}`} /></div><div className="item-card-body"><span className="item-category">{categoryNames[item.categoryCode] ?? item.categoryCode}</span><h3>{item.title}</h3><p>Diperbarui {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(item.updatedAt))}</p>{item.reservedByTransactionId && <span className="badge">Dalam transaksi</span>}</div></Link>; }
