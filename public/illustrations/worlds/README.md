# MindFlow Home Diorama Assets

Production Home world pieces look for these final rendered WebP files:

- `memory-diorama.webp`
- `route-diorama.webp`
- `command-diorama.webp`
- `logic-diorama.webp`
- `garden-diorama.webp`

Current asset sources:

- `memory-diorama.webp`: rendered attachment provided in the visual target set.
- `route-diorama.webp`: rendered attachment provided in the visual target set.
- `command-diorama.webp`: rendered attachment provided in the visual target set.
- `garden-diorama.webp`: rendered attachment provided in the visual target set.
- `logic-diorama.webp`: temporary WebP generated from the existing local
  `station-logic.png` asset because no dedicated rendered logic-world image was
  included in the attachment set.

Recommended art direction:

- 2.5D / rendered 3D-style diorama, not flat icons.
- Transparent or softly blended background works best.
- Keep the main object centered and readable at small sizes.
- Avoid text inside the image; the UI already renders titles and labels.
- Suggested canvas: 1200x900 or 1600x1200, exported as high-quality WebP.

If any of these files are missing, the production Home automatically falls back
to the existing CSS/React diorama artwork for that world. Replacing any WebP
with final art under the same filename updates the Home without code changes.
