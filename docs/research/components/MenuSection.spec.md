# MenuSection Specification

## Overview
- **Target file:** `src/components/MenuSection.tsx`
- **Interaction model:** static (click-to-order modal out of scope)

## DOM Structure
- `.card.mb-4.border-0`
  - `.card-header` — category name
  - For each item: `.item-container.w-100`
    - `.col-md-12.item` (padding: 5px 0 7px 4px, margin: 5px 0 10px)
      - `.col-md-12.p-0`
        - `.row.mb-1` — image row
          - `.col-md-3.col-sm-3.col-4` — image column
            - `<img>` 75×75px, border-radius: 5px
          - `.col-md-9.col-sm-9.col-8` — text column
            - `.col-md-12.nopadding.pr-3` — item name (15px, color: rgb(33,37,41))
            - `.col-md-12.nopadding.item-desc` — description (15px, color: rgb(144,144,144))
        - `.price` div — price (15px, color: rgb(33,37,41))

## Computed Styles

### Category header (`.card-header`)
- background-color: rgb(247, 247, 244)
- color: rgb(33, 37, 41)
- font-size: 15px
- font-weight: 400
- text-align: center (the text "Pratos Executivos" is centered)
- border-radius: 3px 3px 0 0
- height: ~44px

### Item container
- display: block
- width: 100%
- height: ~172px
- padding: 0

### Item inner
- padding: 5px 0 7px 4px
- margin: 5px 0 10px

### Item image
- width: 75px (col-4/col-md-3)
- height: 75px
- border-radius: 5px
- object-fit: cover

### Item name
- font-size: 15px
- font-weight: 400
- color: rgb(33, 37, 41)

### Item description
- font-size: 15px
- color: rgb(144, 144, 144)

### Price
- font-size: 15px
- color: rgb(33, 37, 41)
- margin-top: ~8px

### Separator between items
- 1px solid light gray border at bottom of each item

## Menu Data (all categories)

### Pratos Executivos
- Carne na Chapa (em iscas) — (arroz macarrão, maionese, farofa, fritas, queijo coalho) — R$ 25,00
- Filé de frango grelhado — (arroz, macarrão, maionese ,fritas e farofa) — R$ 20,00
- Strogonoff de frango — (arroz, purê, batata palha e farofa) — R$ 22,00
- Strogonoff de carne — arroz, purê, batata palha e farofa — R$ 22,00
- Panqueca gratinada de frango — (arroz, purê, batata palha e farofa) — R$ 20,00
- Panqueca gratinada de carne — (arroz, purê, batata palha e farofa) — R$ 20,00
- Parmegiana de frango — (arroz, purê e fritas) — R$ 25,00
- Parmegiana de carne — (arroz, purê e fritas) — R$ 25,00
- Filé de frango a milanesa — (arroz, macarrão, feijão, maionese, e farofa) — R$ 22,00

### Combos
- Combo Solteirinho — (1 x-salada + 150g de batata + 1 coca em lata) — R$ 25,00
- (additional combos)

### X-Saladas
- (x-burger items)

### Porções de Batata
- • Batata P (150g) — R$ 10,00
- • Batata M (200g) — R$ 15,00
- • Batata G (300g) — R$ 20,00

### Porções de pastelzinhos
- (pastel items)

### Refrigerantes
- (soda items)

### Sucos naturais
- (juice items at R$ 7,00 for 300ml and R$ 18,00 for 1 litro)

## Responsive Behavior
- Desktop: 2-col layout (image left, text right) as Bootstrap grid
- Mobile: image col-4, text col-8
