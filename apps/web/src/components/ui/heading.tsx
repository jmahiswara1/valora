'use client';



export function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="app-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</div></div>; }
