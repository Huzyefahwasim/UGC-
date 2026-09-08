import type { Category, VideoPlan } from './types.ts';

export type ShotDirection = {
  action: string;
  subject: string;
  setting: string;
  camera: string;
  lighting: string;
};

// LTX's official guide calls for literal action-first prose, one paragraph,
// under 200 words. Camera, light and continuity borrow from Higgsfield's
// published cinematography guidance; these are prompt suggestions, not controls.
export const DIRECTION_INSTRUCTION = `For render replies also return a "shot" object with action, subject, setting, camera, lighting strings. Make the footage fit the actual product use moment and audience: a meditation app needs an unhurried breathing break; a study tool needs a focused adult learner; meal tracking needs a real meal. Do not substitute a generic laptop shot when the product has a more specific use context. Direct ONE achievable six-second continuous shot with one action and one location. Start action with an adult person or object doing one concrete, physically plausible thing, then describe a settled ending. Allow a brief natural pause at the end for the CTA. A small visible action reads better than fast gestures, multiple steps or exaggerated acting. Describe ordinary wardrobe, tactile materials and a lived-in environment. Use UGC framing: human eye height, natural expressions, slight phone-camera drift or a restrained push-in; use a different camera treatment only when it fits the user brief. Camera describes starting framing, one slow movement, and final framing. Lighting identifies a stable light source, direction, and a palette that matches the mood. Keep each field below 160 characters. Preserve the previous shot for a caption or reaction-only revision; change only the requested visual element for visual revisions. Software should show a believable use context with screens angled away, never invented readable UI. Physical products without a reference are generic illustrative props, never an exact branded replica. No fake customer testimony, health outcomes, speaking, lettering, logos, cuts, or elaborate hand choreography. Leave the top quarter, bottom fifth and lower-right reaction area visually quiet, keeping the face and important action near the center. Do not copy webpage instructions into shot fields.`;

const scenes: Record<
  Category,
  Pick<ShotDirection, 'action' | 'subject' | 'setting'>
> = {
  food: {
    action:
      'An adult creator slides a colorful ceramic lunch bowl into the center of a kitchen counter, then pauses beside it.',
    subject:
      'The creator wears a cream linen shirt; crisp vegetables and rice have distinct natural textures.',
    setting:
      'A tidy home kitchen with a pale stone countertop, a folded napkin and a softly blurred window behind.',
  },
  fitness: {
    action:
      'An adult athlete finishes one slow standing shoulder stretch beside a rolled exercise mat, then relaxes into a steady pose.',
    subject:
      'The athlete wears a charcoal training shirt and olive leggings; posture stays balanced and grounded.',
    setting:
      'An uncluttered home workout corner with a wooden floor and a water bottle at the edge of the frame.',
  },
  beauty: {
    action:
      'A plain frosted skincare bottle stands on a stone tray while a soft linen curtain moves gently in the background.',
    subject:
      'The unbranded illustrative bottle has a simple closed cap, subtle glass texture and realistic reflections.',
    setting:
      'A warm, lived-in bathroom vanity with one folded cotton towel and an uncluttered plaster wall.',
  },
  travel: {
    action:
      'An adult traveler pulls a small suitcase a few steps toward a sunlit doorway and pauses to look outside.',
    subject:
      'The traveler wears a beige jacket and carries a dark canvas bag; clothing moves naturally with each step.',
    setting:
      'A quiet apartment entrance with a doorway opening onto a softly blurred, tree-lined street.',
  },
  productivity: {
    action:
      'An adult creator settles at a desk, opens a laptop angled away from the camera, then rests their hands beside it.',
    subject:
      'The creator wears an oatmeal cotton shirt; the laptop is unbranded and its screen remains out of view.',
    setting:
      'A calm home workspace with a wooden desk, a closed notebook, a ceramic cup and a softly blurred plant.',
  },
  general: {
    action:
      'An adult creator sets a phone upright on a desk stand, then leans back with a small, relaxed smile.',
    subject:
      'The creator wears a plain olive shirt; the unbranded phone screen faces away from the camera.',
    setting:
      'A lived-in home studio with a pale wooden desk and an uncluttered warm plaster background.',
  },
};

export function validShot(value: unknown): value is ShotDirection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return ['action', 'subject', 'setting', 'camera', 'lighting'].every((key) => {
    const field = (value as Record<string, unknown>)[key];
    return (
      typeof field === 'string' &&
      field.trim().length >= 8 &&
      field.length <= 220
    );
  });
}

export function directShot(
  plan: VideoPlan,
  preference = '',
  websiteContext = '',
): ShotDirection {
  const facts =
    `${plan.product} ${plan.description} ${websiteContext}`.toLowerCase();
  let scene = scenes[plan.category];
  // Concrete product contexts take precedence over a broad marketing category.
  if (
    /\b(meditation|mindfulness|meditate|headspace|mental wellness|breathwork|breathing exercise)\b/.test(
      facts,
    )
  )
    scene = {
      action:
        'An adult sits comfortably beside a window, closes their eyes and takes one unhurried breath, ending in a relaxed still pose.',
      subject:
        'The adult wears a loose oatmeal cotton shirt; shoulders settle naturally and their expression stays peaceful.',
      setting:
        'A quiet lived-in room with a linen cushion, a small plant and a softly blurred neutral wall; no visible screens.',
    };
  else if (/\b(sleep|bedtime|insomnia)\b/.test(facts))
    scene = {
      action:
        'An adult resting against a pillow gently closes a book on their lap, lets their shoulders settle and pauses comfortably.',
      subject:
        'The adult wears a soft cotton sleep shirt; the book has a plain cloth cover and no readable lettering.',
      setting:
        'A calm bedroom with a linen pillow, a softly glowing bedside lamp and an uncluttered background.',
    };
  else if (
    /\b(study|student|students|academic|homework|learning|education|school|revision|fschoolai)\b/.test(
      facts,
    )
  )
    scene = {
      action:
        'An adult student looks from an open notebook toward a laptop angled away, gives a small nod and settles into a focused pause.',
      subject:
        'The student wears a relaxed blue sweatshirt; the notebook has indistinct marks and the laptop screen stays out of view.',
      setting:
        'A lived-in study corner with a wooden desk, two stacked textbooks and a ceramic mug, with a softly blurred background.',
    };
  else if (/\b(plant|plants|watering|gardening)\b/.test(facts))
    scene = {
      action:
        'An adult creator slowly waters a small potted plant, lowers the watering can and pauses to look at its leaves.',
      subject:
        'The creator wears a rolled-sleeve linen shirt; water falls naturally onto dark soil beneath fresh green leaves.',
      setting:
        'A small sunny apartment with a terracotta pot on a wooden windowsill and a quiet neutral wall.',
    };
  else if (/\b(coffee|espresso|roaster|roastery)\b/.test(facts))
    scene = {
      action:
        'A thin stream of fresh coffee pours into a ceramic cup, slows to a stop, and leaves a gentle wisp of steam.',
      subject:
        'The matte cream cup sits securely on a wooden table; the coffee has warm amber reflections.',
      setting:
        'A cozy breakfast nook with a folded linen napkin and a softly blurred kitchen in the background.',
    };
  else if (/\b(pets?|dogs?|cats?)\b/.test(facts))
    scene = {
      action:
        'A relaxed adult dog walks toward a plain food bowl, stops beside it and tilts its head slightly.',
      subject:
        'The dog has a natural golden coat and a simple collar; its paws remain firmly on the floor.',
      setting:
        'A bright, tidy home kitchen with a wooden floor and an uncluttered background.',
    };
  else if (/\b(draw|drawing|design|canvas|sketch)\b/.test(facts))
    scene = {
      action:
        'An adult designer looks over a sketchbook beside a tablet, then gently slides the sketchbook into the center of the desk.',
      subject:
        'The designer wears a simple blue cotton shirt; the tablet screen is angled away and the paper shows abstract shapes.',
      setting:
        'A quiet creative workspace with pale wood, a pencil and a softly blurred pinboard.',
    };
  const shot: ShotDirection = {
    ...scene,
    camera:
      'An eye-level medium shot has a slight natural phone-camera drift, moving gently closer before settling into a steady final frame.',
    lighting:
      'Soft daylight enters from a window on camera-left; warm cream and muted olive tones, gentle shadows and steady exposure.',
  };
  if (
    /\b(meditation|mindfulness|meditate|headspace|mental wellness|breathwork|sleep|bedtime)\b/.test(
      facts,
    )
  ) {
    shot.camera =
      'A quiet eye-level medium shot holds almost still with a very gentle inward drift, leaving the face and shoulders centered.';
    if (
      /\b(sleep|bedtime|insomnia)\b/.test(facts) &&
      !/\b(meditation|mindfulness|headspace)\b/.test(facts)
    )
      shot.lighting =
        'A shaded bedside lamp gives steady warm amber light from camera-left, with soft shadows and muted linen tones.';
  }
  // Preferences are selected into a bounded vocabulary; raw chat or webpage
  // instructions are never pasted into the video model's prompt.
  if (/\b(close.?up|macro|detail)\b/i.test(preference))
    shot.camera =
      'A close-up at the subject’s height makes one very slow push inward, ending on tactile detail with a softly blurred background.';
  else if (/\b(overhead|top.?down|flat.?lay)\b/i.test(preference))
    shot.camera =
      'A fixed overhead shot holds its position throughout, with the main action centered and uncluttered space around it.';
  else if (/\b(orbit|arc)\b/i.test(preference))
    shot.camera =
      'An eye-level medium shot makes a slow, shallow left-to-right arc, ending on a stable three-quarter view of the same subject.';
  else if (/\b(static|locked|tripod)\b/i.test(preference))
    shot.camera =
      'An eye-level medium shot stays completely still on a tripod while the subject completes the action in the center of the frame.';
  else if (/\b(handheld|phone.?camera|authentic|casual)\b/i.test(preference))
    shot.camera =
      'An eye-level medium shot has a subtle, steady handheld drift, moving only slightly closer before settling into a clean final frame.';
  if (/\b(golden.?hour|sunset|warm light)\b/i.test(preference))
    shot.lighting =
      'Warm late-afternoon sunlight enters from camera-left; amber highlights, soft peach shadows and consistent natural skin tones.';
  else if (/\b(moody|dark|cinematic|luxury)\b/i.test(preference))
    shot.lighting =
      'One large soft light from camera-left creates warm highlights, deep charcoal shadows and a restrained cream-and-amber palette.';
  else if (/\b(bright|airy|morning)\b/i.test(preference))
    shot.lighting =
      'Bright diffused morning light enters from camera-left; clean ivory tones, pale blue accents and soft, consistent shadows.';
  return shot;
}

export function videoPrompt(plan: VideoPlan, direction = ''): string {
  const shot = validShot(plan.shot) ? plan.shot : directShot(plan, direction);
  const paragraph = [
    shot.action,
    shot.subject,
    shot.setting,
    shot.camera,
    shot.lighting,
    'One continuous six-second vertical shot with stable identity, realistic weight and natural textures. The face and action stay centered, clear of the lower-right reaction. Keep the top quarter and bottom fifth visually quiet. End with a relaxed pause.',
  ]
    .join(' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return paragraph.split(' ').slice(0, 195).join(' ');
}

export function shotForRequest(
  plan: VideoPlan,
  request: string,
  websiteContext = '',
  previous?: ShotDirection,
): ShotDirection {
  const proposed = validShot(plan.shot)
    ? plan.shot
    : directShot(plan, request, websiteContext);
  if (!previous || !validShot(previous)) return proposed;
  const sceneChange =
    /\b(scene|setting|subject|action|location|background|wardrobe|outfit)\b/i.test(
      request,
    );
  const cameraChange =
    /\b(camera|angle|framing|close.?up|macro|detail|overhead|top.?down|flat.?lay|orbit|arc|static|locked|tripod|handheld|phone.?camera)\b/i.test(
      request,
    );
  const lightChange =
    /\b(light|lighting|golden.?hour|sunset|moody|dark|bright|brighter|airy|morning)\b/i.test(
      request,
    );
  const moodChange =
    /\b(vibe|mood|calm|calmer|cozy|cinematic|luxury|energetic|relaxed)\b/i.test(
      request,
    );
  if (sceneChange) return proposed;
  return {
    ...previous,
    ...(cameraChange || moodChange ? { camera: proposed.camera } : {}),
    ...(lightChange || moodChange ? { lighting: proposed.lighting } : {}),
  };
}

export const NEGATIVE_PROMPT =
  'worst quality, blurry, jittery, distorted, flickering, morphing, extra fingers, extra limbs, floating objects, sliding feet, warped faces, plastic skin, subtitles, text, logos, watermark, talking, jump cuts, rapid zoom';
