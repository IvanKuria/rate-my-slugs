import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ExternalLink,
  BookOpen,
  Clock,
  FlaskConical,
  Globe,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/animations';

/**
 * Strips HTML tags from a string, returning plain text.
 * Converts <li> items to comma-separated values.
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return html;
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  return html
    .replace(/<li[^>]*>/gi, '')
    .replace(/<\/li>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/,\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collapsible expanded details section:
 * office hours, courses taught, research, website, publications.
 */
export default function ExpandedDetails({
  officeHours,
  courses,
  researchInterest,
  researchTopics,
  website,
  publicationLinks,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Bail out if nothing to show
  const hasContent =
    officeHours ||
    (Array.isArray(courses) && courses.length > 0) ||
    researchInterest ||
    researchTopics ||
    website ||
    (Array.isArray(publicationLinks) && publicationLinks.length > 0);

  if (!hasContent) return null;

  const normalizedWebsite =
    website && !website.startsWith('http') ? `https://${website}` : website;

  return (
    <div className="px-1">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'Hide Details' : 'More Info'}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </Button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="expanded-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.gentle}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3.5 pt-3 pb-1">
              {officeHours && (
                <DetailBlock icon={Clock} label="Office Hours">
                  <p className="text-sm text-foreground">{officeHours}</p>
                </DetailBlock>
              )}

              {Array.isArray(courses) && courses.length > 0 && (
                <DetailBlock icon={BookOpen} label="Courses Taught">
                  <ul className="space-y-1">
                    {courses.map((c, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground leading-snug"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </DetailBlock>
              )}

              {(researchInterest || researchTopics) && (
                <DetailBlock icon={FlaskConical} label="Research">
                  {researchInterest && (
                    <p className="text-sm text-foreground">
                      {stripHtml(researchInterest)}
                    </p>
                  )}
                  {researchTopics && (
                    <p className="text-sm text-foreground mt-1">
                      {stripHtml(researchTopics)}
                    </p>
                  )}
                </DetailBlock>
              )}

              {website && (
                <DetailBlock icon={Globe} label="Website">
                  <a
                    href={normalizedWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 transition-colors"
                  >
                    {website}
                    <ExternalLink className="size-3" />
                  </a>
                </DetailBlock>
              )}

              {Array.isArray(publicationLinks) &&
                publicationLinks.length > 0 && (
                  <DetailBlock icon={FileText} label="Publications">
                    <ul className="space-y-1.5">
                      {publicationLinks.map((link, i) => (
                        <li key={i}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 transition-colors"
                          >
                            {link.length > 40
                              ? link.slice(0, 40) + '...'
                              : link}
                            <ExternalLink className="size-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </DetailBlock>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailBlock({ icon: Icon, label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="pl-5.5">{children}</div>
    </div>
  );
}
