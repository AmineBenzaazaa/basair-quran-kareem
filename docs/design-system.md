#  بصائر القرآن الكريم Design System

This document captures the visual language already established in the main Expo app and defines how the dashboard should implement the same design aspect.

## Source Of Truth

- App tokens:
  - `src/theme/colors.ts`
  - `src/theme/typography.ts`
  - `src/theme/spacing.ts`
- App surface patterns:
  - `src/components/ScreenContainer.tsx`
  - `src/components/CardButton.tsx`
  - `src/components/IconButton.tsx`
  - `src/components/SectionTitle.tsx`

## Visual Direction

- Tone: calm, scholarly, and tactile.
- Layout: airy RTL composition with generous padding and visible breathing room.
- Shapes: rounded cards and pills, never sharp panels.
- Contrast: soft background, crisp dark text, berry/plum accents for action and emphasis.
- Decoration: low-contrast background washes and orbs, used as atmosphere rather than noise.

## Core Tokens

### Colors

- Background: `#F8F9FC`
- Surface: `#FFFFFF`
- Surface alt: `#F1F4FA`
- Primary text: `#111F35`
- Secondary text: `rgba(17, 31, 53, 0.7)`
- Primary accent: `#F63049`
- Accent/plum: `#8A244B`
- Accent strong: `#6F1C3F`
- Deep shadow plum: `#28132A`
- Border: `rgba(17, 31, 53, 0.15)`
- Highlight wash: `rgba(246, 48, 73, 0.1)`

### Typography

- Main family: `Amiri`
- Regular weight: `400`
- Bold weight: `700`
- Base reading size: `18px`
- Base reading line height: `32px`

### Spacing

- `xs`: `6px`
- `sm`: `10px`
- `md`: `16px`
- `lg`: `22px`
- `xl`: `30px`
- `xxl`: `40px`

## Component Rules

### Page Shell

- Use a pale background with layered translucent washes.
- Keep content on a centered column with strong top spacing and roomy section gaps.
- Preserve full RTL alignment in headings, labels, and metadata.

### Cards

- White surface with a faint border.
- Radius between `18px` and `20px`.
- Soft plum shadow with subtle depth.
- Optional internal glow at one corner.
- Hover/press feedback should be restrained: slight lift or slight scale.

### Pills And Badges

- Full-pill radius.
- Use translucent accent fills rather than solid saturated blocks.
- Keep label size small and compact.

### Buttons

- Rounded pill or circular icon treatment.
- Same border and surface logic as cards.
- Accent fill only for primary actions.
- Avoid flat browser-default button styles.

### Section Headings

- Bold Amiri title.
- Small accent line preceding the title.
- Subtitle stays lighter and quieter than the heading.

## Dashboard Translation

The dashboard should mirror the app in these concrete ways:

- Use Amiri for the main UI.
- Replace the old sand/teal palette with the app palette.
- Restyle module cards to match the mobile `CardButton` logic.
- Bring the app’s ornamental background washes into the dashboard shell.
- Keep editor panels and form controls on white surfaces with soft borders and rounded corners.
- Maintain monospaced font only for raw JSON areas.

## Implementation Notes

- Home page should feel like an extension of the main menu, not a separate admin product.
- Editor pages should preserve clarity first, but still use the same visual grammar as the app.
- Any new dashboard component should inherit these tokens before introducing new values.
