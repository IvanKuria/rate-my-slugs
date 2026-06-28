import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Contact info row: email (mailto link) and phone, with lucide icons.
 */
export default function ContactInfo({ email, phone }) {
  if (!email && !phone) return null;

  return (
    <div className="flex flex-col gap-2 px-1">
      {email && (
        <div className="flex items-center gap-2.5 text-sm">
          <Mail className="size-3.5 shrink-0 text-muted-foreground" />
          <a
            href={`mailto:${email}`}
            className={cn(
              'text-primary hover:underline underline-offset-2',
              'truncate transition-colors'
            )}
          >
            {email}
          </a>
        </div>
      )}

      {email && phone && <Separator className="my-0.5" />}

      {phone && (
        <div className="flex items-center gap-2.5 text-sm">
          <Phone className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground">{phone}</span>
        </div>
      )}
    </div>
  );
}
