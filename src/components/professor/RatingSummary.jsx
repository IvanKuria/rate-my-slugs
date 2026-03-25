import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { stagger } from "@/lib/animations";
import {
  getQualityPalette,
  getDifficultyPalette,
  buildCardStyle,
  formatDate,
} from "@/utils/colors";
import {
  formatNumber,
  roundToOneDecimal,
  roundToWhole,
  StarRating,
} from "@/utils/utils";
import SlugRating from "@/components/SlugRating";

/**
 * 2x2 grid of summary rating cards:
 * Quality (with SlugRating), Difficulty, Would Take Again %, Total Reviews.
 */
export default function RatingSummary({
  overallRating,
  difficulty,
  takeAgainPercent,
  numRatings,
  rmpUrl,
}) {
  const qualityPalette = getQualityPalette(overallRating);
  const difficultyPalette = getDifficultyPalette(difficulty);

  if (numRatings === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Profile exists but no ratings yet.
        </p>
        {rmpUrl && (
          <a
            href={rmpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center justify-center rounded-lg px-4 py-2",
              "bg-primary text-primary-foreground text-sm font-medium",
              "hover:bg-primary/90 transition-colors"
            )}
          >
            Leave a rating
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Star rating row */}
      <div className="flex items-center gap-2 px-1">
        <StarRating rating={roundToWhole(overallRating)} numRatings={numRatings} />
        <span className="text-xs text-muted-foreground">
          ({numRatings} rating{numRatings !== 1 ? "s" : ""})
        </span>
      </div>

      {/* 2x2 summary grid */}
      <motion.div
        className="grid grid-cols-2 gap-2"
        variants={stagger.container}
        initial="hidden"
        animate="visible"
      >
        {/* Quality */}
        <motion.div variants={stagger.item}>
          <Card
            className="rounded-xl border-0 shadow-sm overflow-hidden py-3"
            style={buildCardStyle(qualityPalette)}
          >
            <CardContent className="flex flex-col items-center gap-1 px-3 py-0">
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                Quality
              </span>
              <div className="flex items-center gap-1.5">
                <SlugRating rating={overallRating || 0} />
                <span className="text-lg font-bold leading-none">
                  {overallRating != null ? `${formatNumber(overallRating)}/5` : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Difficulty */}
        <motion.div variants={stagger.item}>
          <Card
            className="rounded-xl border-0 shadow-sm overflow-hidden py-3"
            style={buildCardStyle(difficultyPalette)}
          >
            <CardContent className="flex flex-col items-center gap-1 px-3 py-0">
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                Difficulty
              </span>
              <span className="text-lg font-bold leading-none">
                {difficulty != null ? `${formatNumber(difficulty)}/5` : "N/A"}
              </span>
            </CardContent>
          </Card>
        </motion.div>

        {/* Would Take Again */}
        <motion.div variants={stagger.item}>
          <Card className="rounded-xl border-0 shadow-sm bg-secondary/40 py-3">
            <CardContent className="flex flex-col items-center gap-1 px-3 py-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Would take again
              </span>
              <span className="text-lg font-bold leading-none text-foreground">
                {takeAgainPercent != null
                  ? `${roundToOneDecimal(takeAgainPercent)}%`
                  : "N/A"}
              </span>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Reviews */}
        <motion.div variants={stagger.item}>
          <Card className="rounded-xl border-0 shadow-sm bg-secondary/40 py-3">
            <CardContent className="flex flex-col items-center gap-1 px-3 py-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total reviews
              </span>
              <span className="text-lg font-bold leading-none text-foreground">
                {numRatings}
              </span>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* RMP profile link */}
      {rmpUrl && (
        <a
          href={rmpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-xs text-center text-primary hover:underline",
            "underline-offset-2 transition-colors mt-1"
          )}
        >
          View full profile on RateMyProfessors
        </a>
      )}
    </div>
  );
}
