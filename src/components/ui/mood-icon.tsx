import { Angry, Frown, Laugh, Meh, Smile, type LucideIcon, type LucideProps } from "lucide-react";
import { moodPreset } from "@/types";

// One face per mood level (1 = awful … 5 = great) — line icons instead of emoji so
// moods match the rest of the UI and take the mood's color in both themes.
const FACES: Record<number, LucideIcon> = { 1: Angry, 2: Frown, 3: Meh, 4: Smile, 5: Laugh };

/** A mood's face icon, tinted with the mood color unless `muted` (then it inherits text color). */
export function MoodIcon({ mood, muted = false, style, ...props }: { mood: number; muted?: boolean } & LucideProps) {
  const preset = moodPreset(mood);
  const Face = FACES[preset.value];
  return <Face aria-hidden style={muted ? style : { color: preset.color, ...style }} {...props} />;
}
