# CategoryNav Specification

## Overview
- **Target file:** `src/components/CategoryNav.tsx`
- **Interaction model:** click-driven (scroll to section)

## DOM Structure
- Outer row div with overflow-x: auto (horizontal scroll)
  - Left arrow button (scroll left)
  - Scrollable inner div
    - Multiple `.btn-category` buttons
  - Right arrow button (scroll right)
- Below: search input full-width

## Computed Styles

### Outer wrapper
- display: flex
- flex-direction: row
- overflow-x: auto (or scroll)
- position: relative
- margin-top: 8px

### Category button (default & selected - same styles)
- display: inline-block
- background-color: rgb(247, 247, 244)
- color: rgb(33, 37, 41)
- font-size: 15px
- font-weight: 700
- border-radius: 5px
- padding: 7px 8px
- margin-right: 8px
- height: 36.5px
- cursor: pointer
- border: none

### Scroll arrows
- Small arrow buttons on left/right of the scrollable area
- Color: rgba or similar neutral

### Search input
- width: 100%
- border: 1px solid rgb(24, 188, 156) (teal)
- border-radius: 4px (or similar)
- padding: left with search icon
- placeholder color: gray
- placeholder text: "Digite para buscar um item"
- Has search icon (magnifying glass) on left side

## Tabs (in order)
1. Topo
2. Pratos Executivos
3. Combos
4. X-Saladas
5. Porções de Batata
6. Porções de pastelzinhos
7. Refrigerantes
8. Sucos naturais

## States & Behaviors
- Clicking a tab scrolls page to that section (anchor link / smooth scroll)
- Search filters menu items on type

## Responsive Behavior
- Mobile: tabs scroll horizontally
- Desktop: all tabs visible or scrollable
