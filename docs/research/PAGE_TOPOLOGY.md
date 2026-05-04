# Page Topology — instadelivery.com.br/restauranteadonay

## Overall Layout
- Full-width page, white background
- Two-column layout at desktop: main content (col-md-8, ~730px) + right cart sidebar (col-md-4, 350px)
- Single column on mobile
- No sticky/fixed elements except share button (position: absolute top-right)

## Sections (top to bottom)

### 1. Share Button
- Position: absolute, top: 36px, right: 20px, z-index: 998
- Teal color icon (Font Awesome `fas fa-share-alt-square`)

### 2. Header Banner (logo-left row)
- Full-width, height: 250px, margin-bottom: 35px
- Background image: cover banner (Adonay Alimentação Delivery + phone numbers)
- Contains restaurant square logo (120×120px) positioned absolute, bottom-left

### 3. Restaurant Info Card
- Inside `.container > .card.border-0 > .card-body`
- Row 1: Status badge ("Fechado temp." red) + Login button (dark navy)
- Row 2: Restaurant name (not found as text — implied by logo) + WhatsApp link (green icon)
- Interaction model: static

### 4. Welcome Banner
- `.welcome-container.mt-3`
- Full width of content column, blue/purple bg (rgb(83,113,209)), border-radius: 17px
- Text: "Seja bem vindo(a) a Restaurante Adonay. Faça seu pedido abaixo!"
- Interaction model: static

### 5. Category Navigation Bar
- Horizontal scrollable row of buttons
- Tabs: Topo, Pratos Executivos, Combos, X-Saladas, Porções de Batata, Porções de pastelzinhos, Refrigerantes, Sucos naturais
- Background: rgb(247,247,244), border-radius: 5px
- Scroll arrows on left/right
- Interaction model: click-driven (scroll to section)

### 6. Search Bar
- Full-width input with border-color teal (rgb(24,188,156))
- Placeholder: "Digite para buscar um item"
- Interaction model: filter items on type

### 7. Menu Sections (repeating)
- Each section: `.card.mb-4.border-0` containing `.card-header` + multiple `.item-container`
- card-header: bg rgb(247,247,244), border-radius: 3px 3px 0 0, center-aligned text
- Items in a list, each with: image (left, 75×75, border-radius: 5px), name + description (middle), price (bottom-left)
- Interaction model: click item to add to cart (modal would open — out of scope)

### 8. Cart Sidebar
- `.card.hidden-sm-down` — hidden on mobile
- Header: "Carrinho" with shopping cart icon
- Body: "Sem itens no carrinho!"
- Interaction model: static (no items)

## Dependencies
- Share button overlays everything (z-index: 998)
- Logo image overlaps bottom of header banner
- Cart sidebar is right column, sticks at top
