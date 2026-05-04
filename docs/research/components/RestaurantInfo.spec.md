# RestaurantInfo Specification

## Overview
- **Target file:** `src/components/RestaurantInfo.tsx`
- **Interaction model:** static

## DOM Structure
- `.card.border-0 > .card-body` (padding: 0 0 20px)
  - Row 1 (space-between): status badge LEFT + login button RIGHT
  - Row 2 (space-between): WhatsApp link LEFT (empty right)
  - Welcome banner below

## Computed Styles

### card-body
- display: block
- padding-bottom: 20px

### Row 1 wrapper
- display: flex
- justify-content: space-between
- align-items: center

### Status badge (`.badge.badge-danger`)
- display: inline-block
- background-color: rgb(231, 76, 60)
- color: rgb(255, 255, 255)
- fontSize: 12px
- fontWeight: 700
- padding: 3px 4.8px
- border-radius: 4px
- margin-right: 4px
- text: "Fechado temp."

### Info icon (next to badge)
- Font Awesome icon `fas fa-info-circle` or similar
- Small, inline with badge

### Login button
- background-color: rgb(44, 62, 80)
- color: white
- fontSize: 15px
- padding: 0px 10px
- border-radius: 4px
- height: 24.5px
- text: "Login"

### WhatsApp link
- color: rgb(41, 43, 44)
- fontSize: 16px
- fontWeight: 700
- icon: `fab fa-whatsapp` (green)
- text: "WhatsApp"
- href: "https://wa.me/5592986210138?text=Oi"

## States & Behaviors
- All static

## Responsive Behavior
- Desktop: rows visible
- Mobile: same layout
