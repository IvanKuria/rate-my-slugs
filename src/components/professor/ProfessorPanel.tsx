import React, { Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/hooks/useSettings';
import { stagger, professorSwitch } from '@/lib/animations';
import { deriveProfessorViewModel } from '@/lib/professorViewModel';
import ProfessorHeader from '@/components/professor/ProfessorHeader';
import ContactInfo from '@/components/professor/ContactInfo';
import ExpandedDetails from '@/components/professor/ExpandedDetails';
import RatingSummary from '@/components/professor/RatingSummary';
import RatingTags from '@/components/professor/RatingTags';
import ReviewCarousel from '@/components/professor/ReviewCarousel';
import { Settings } from 'lucide-react';
import type { ProfessorData, SettingsSections } from '@/types';

const GradeDistribution = lazy(() => import('@/components/GradeDistribution'));

/**
 * Main professor panel component for the side panel.
 * Orchestrates all decomposed professor sub-components,
 * respects user settings for section visibility, and
 * provides animated professor transitions.
 */
export default function ProfessorPanel(data: ProfessorData) {
  const {
    campusProfile,
    rateMyProfessor,
    reviews,
    localResearchTopic,
    instructorName,
    course,
  } = data;
  const { settings, loading: settingsLoading } = useSettings();

  if (!campusProfile && !rateMyProfessor) return null;

  // Derive display data from raw API/LDAP/RMP fields.
  const vm = deriveProfessorViewModel(data);
  const {
    name,
    department,
    division,
    email,
    phone,
    officeHours,
    researchInterest,
    courses,
    website,
    publicationLinks,
    overallRating,
    difficulty,
    takeAgainPercent,
    numRatings,
    topTags,
    rmpUrl,
    professorKey,
  } = vm;
  const rmpNode = rateMyProfessor;

  // Photo: a real directory photo, or the bundled default avatar.
  const photoSrc =
    vm.directoryPhoto ??
    (typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('images/default_pfp.png')
      : null);

  // Section visibility from settings
  const sections: SettingsSections = settingsLoading
    ? {
        campusInfo: true,
        rmpRatings: true,
        gradeDistribution: true,
        reviews: true,
        tags: true,
      }
    : settings.sections;

  // Slug logo URL
  const slugLogoUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icons/sammy/slug.png')
      : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Frosted glass header */}
      <header
        className={cn(
          'sticky top-0 z-10 flex items-center gap-3 px-4 py-3',
          'border-b bg-background/80 backdrop-blur-xl'
        )}
      >
        {slugLogoUrl && (
          <img src={slugLogoUrl} alt="UCSC Slug" className="size-6" />
        )}
        <h2 className="text-sm font-semibold tracking-tight flex-1">
          Rate My Slugs
        </h2>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={professorKey}
            initial={professorSwitch.initial}
            animate={professorSwitch.animate}
            exit={professorSwitch.exit}
            transition={professorSwitch.transition}
          >
            <motion.div
              className="flex flex-col gap-0 p-4"
              variants={stagger.container}
              initial="hidden"
              animate="visible"
            >
              {/* Professor Header - always shown */}
              <motion.div variants={stagger.item} className="mb-3">
                <ProfessorHeader
                  name={name}
                  department={department}
                  division={division}
                  photoSrc={photoSrc}
                />
              </motion.div>

              {/* Campus Info section */}
              {sections.campusInfo && campusProfile && (
                <>
                  <motion.div variants={stagger.item} className="mb-2">
                    <ContactInfo email={email} phone={phone} />
                  </motion.div>

                  <motion.div variants={stagger.item} className="mb-1">
                    <ExpandedDetails
                      officeHours={officeHours}
                      courses={courses}
                      researchInterest={researchInterest}
                      researchTopics={localResearchTopic}
                      website={website}
                      publicationLinks={publicationLinks}
                    />
                  </motion.div>

                  <Separator className="my-3" />
                </>
              )}

              {/* RMP Ratings section */}
              {sections.rmpRatings && rmpNode && (
                <motion.div variants={stagger.item} className="mb-1">
                  <h4 className="text-sm font-semibold text-foreground px-1 mb-2">
                    Rate My Professor
                  </h4>
                  <RatingSummary
                    overallRating={overallRating}
                    difficulty={difficulty}
                    takeAgainPercent={takeAgainPercent}
                    numRatings={numRatings}
                    rmpUrl={rmpUrl}
                  />
                  <Separator className="my-3" />
                </motion.div>
              )}

              {/* Tags section */}
              {sections.tags && topTags.length > 0 && (
                <motion.div variants={stagger.item} className="mb-1">
                  <h4 className="text-sm font-semibold text-foreground px-1 mb-2">
                    Top Tags
                  </h4>
                  <RatingTags tags={topTags} />
                  <Separator className="my-3" />
                </motion.div>
              )}

              {/* Grade Distribution section */}
              {sections.gradeDistribution && instructorName && (
                <motion.div variants={stagger.item} className="mb-1">
                  <Suspense
                    fallback={
                      <div className="space-y-2 px-1">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-40 w-full rounded-xl" />
                      </div>
                    }
                  >
                    <GradeDistribution
                      instructorName={instructorName}
                      course={course}
                    />
                  </Suspense>
                  <Separator className="my-3" />
                </motion.div>
              )}

              {/* Reviews section */}
              {sections.reviews &&
                Array.isArray(reviews) &&
                reviews.length > 0 && (
                  <motion.div variants={stagger.item} className="mb-1">
                    <ReviewCarousel reviews={reviews} />
                  </motion.div>
                )}

              {/* Feedback link */}
              <motion.div
                variants={stagger.item}
                className="flex justify-center pt-4 pb-6"
              >
                <a
                  href="mailto:ikuria@ucsc.edu?subject=Rate My Slugs Feedback"
                  className={cn(
                    'text-xs text-muted-foreground',
                    'hover:text-foreground transition-colors',
                    'underline underline-offset-2'
                  )}
                >
                  Have feedback? Let me know
                </a>
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
