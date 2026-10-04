'use client';



export const dateTime = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
