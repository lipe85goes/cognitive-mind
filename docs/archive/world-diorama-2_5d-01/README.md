# WORLD-DIORAMA-2_5D-01 review

Review-only sheets for the Home hero-world modular diorama pass.

Runtime assets live in:

- `public/illustrations/home/dioramas/route/`
- `public/illustrations/home/dioramas/circuit/`

The flat hero renders `world-route-hero.webp` and `world-circuit-hero.webp` remain as documented fallback/source history. The active Home and entry transition use DOM-layered diorama components for Route and Circuit.

Regenerate assets and sheets with:

```powershell
node tools/assets/create_world_diorama_layers.mjs
```

Each world uses one shared 1040x780 coordinate system so layers align pixel-for-pixel in Home and transition.
