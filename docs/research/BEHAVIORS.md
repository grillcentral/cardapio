# Behaviors — instadelivery.com.br/restauranteadonay

## Scroll Behavior
- No scroll-driven animations detected
- No sticky header changes
- No parallax
- No smooth scroll library detected (standard browser scroll)

## Click Behaviors
- Category tabs: clicking scrolls page to that section (anchor navigation)
- Menu items: clicking would open an item detail modal (out of scope for clone)
- Login button: would open auth flow (out of scope)
- WhatsApp link: opens WhatsApp with pre-filled message

## Hover States
- Category buttons: slight visual change (not clearly animated)
- Menu item cards: subtle hover state (cursor: pointer implied)
- Login button: standard button hover

## Responsive
- Desktop (1440px): two-column layout (menu + cart sidebar)
- Mobile (390px): single column, cart sidebar hidden (`hidden-sm-down`)
- Category nav scrolls horizontally on mobile

## Interaction Models
- Header/Banner: static
- Restaurant Info: static
- Welcome Banner: static
- Category Nav: click-to-scroll
- Search: filter-on-type
- Menu Items: click-to-open-modal (not implemented in clone)
- Cart Sidebar: static (empty state)
