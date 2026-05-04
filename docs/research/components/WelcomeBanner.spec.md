# WelcomeBanner Specification

## Overview
- **Target file:** `src/components/WelcomeBanner.tsx`
- **Interaction model:** static

## DOM Structure
- `<div class="welcome-container mt-3">`
  - Single text string

## Computed Styles

### Container
- display: block
- background-color: rgb(83, 113, 209)
- color: rgb(255, 255, 255)
- font-size: 13px
- font-weight: 400
- line-height: 19.5px
- border-radius: 17px
- padding: 20px
- margin-top: 16px
- width: 100%

## Text Content
"Seja bem vindo(a) a Restaurante Adonay. Faça seu pedido abaixo!"

## States & Behaviors
- Static — no hover or scroll effects

## Responsive Behavior
- Desktop: full width of content column
- Mobile: full width
