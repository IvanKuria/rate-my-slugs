import React, { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/animations";
import ReviewItem from "@/components/professor/ReviewItem";

/**
 * Review carousel with class filter dropdown, review counter,
 * and prev/next navigation with animated transitions.
 */
export default function ReviewCarousel({ reviews }) {
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const allReviews = useMemo(
    () => (Array.isArray(reviews) ? reviews : []),
    [reviews]
  );

  const uniqueClasses = useMemo(
    () =>
      Array.from(
        new Set(
          allReviews
            .map((r) => r.className)
            .filter((c) => c && c.trim().length > 0)
        )
      ),
    [allReviews]
  );

  const filteredReviews = useMemo(() => {
    const filtered =
      selectedClass === "ALL"
        ? allReviews
        : allReviews.filter((r) => r.className === selectedClass);

    // When showing all classes, cap at 10 if there are 10+ reviews
    if (selectedClass === "ALL" && allReviews.length >= 10) {
      return filtered.slice(0, 10);
    }
    return filtered;
  }, [allReviews, selectedClass]);

  if (allReviews.length === 0) return null;

  const handleClassChange = (e) => {
    setSelectedClass(e.target.value);
    setCurrentIndex(0);
    setDirection(0);
  };

  const goToPrev = () => {
    setDirection(-1);
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex((i) => Math.min(filteredReviews.length - 1, i + 1));
  };

  const slideVariants = {
    enter: (dir) => ({
      x: dir >= 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir) => ({
      x: dir >= 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header row: title + review counter */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-sm font-semibold text-foreground">Reviews</h4>
        {filteredReviews.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1} of {filteredReviews.length}
          </span>
        )}
      </div>

      {/* Class filter — native select matching grade distribution style */}
      {uniqueClasses.length > 0 && (
        <div className="grade-dist-filters" style={{ marginBottom: 0 }}>
          <div className="grade-dist-filter">
            <label htmlFor="review-class-filter">Class</label>
            <select
              id="review-class-filter"
              value={selectedClass}
              onChange={handleClassChange}
            >
              <option value="ALL">All</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Review display */}
      {filteredReviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No reviews match the selected filter.
        </p>
      ) : (
        <>
          <div className="relative min-h-[120px] overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={filteredReviews[currentIndex]?.id ?? currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springs.gentle}
              >
                <ReviewItem review={filteredReviews[currentIndex]} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              aria-label="Previous review"
              className="rounded-lg"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={goToNext}
              disabled={currentIndex === filteredReviews.length - 1}
              aria-label="Next review"
              className="rounded-lg"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
