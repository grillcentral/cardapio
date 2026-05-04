# Header Specification

## Overview
- **Target file:** `src/components/Header.tsx`
- **Screenshot:** `docs/design-references/header.png`
- **Interaction model:** static

## DOM Structure
- Full-width row div (`.row.nopadding.logo-left`)
  - Inner `.container` (max-width ~1140px, centered)
    - `<img class="logo-rounded">` — restaurant logo, position absolute

## Computed Styles (exact values from getComputedStyle)

### Outer row (`.row.nopadding.logo-left`)
- display: flex
- width: 100%
- height: 250px
- margin-bottom: 35px
- background: url("/images/header-banner.png") no-repeat center/contain
- position: relative

### Inner container
- position: relative
- width: 100% (max ~1140px centered)
- height: 250px
- padding: 0px 15px

### Logo image (`.logo-rounded`)
- position: absolute
- bottom: -30px (overlaps below header into content area)
- left: 15px
- width: 120px
- height: 120px
- border-radius: 5px
- display: block

## States & Behaviors
- Static — no scroll/hover/click behaviors on the header itself

## Assets
- Background banner: `public/images/header-banner.png`
- Logo: `public/images/restaurant-logo.jpeg`

## Text Content
- No text in header (all in banner image)

## Responsive Behavior
- Desktop (1440px): full width, height 250px, logo bottom-left
- Mobile (390px): same height, logo stays bottom-left but smaller container
- Breakpoint: ~576px (Bootstrap sm)
