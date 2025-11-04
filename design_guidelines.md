# Restaurant Owner Dashboard - Design Guidelines

## Design Approach

**Selected System:** Linear-inspired dashboard aesthetics with Notion's card-based organization
**Rationale:** This is a utility-focused business management tool requiring clarity, efficiency, and elegant information hierarchy. Linear's clean, professional aesthetic paired with Notion's flexible card system provides the perfect foundation for a "beautiful and classy" dashboard while maintaining operational efficiency.

**Core Design Principles:**
1. Information clarity above decoration
2. Sophisticated restraint with purposeful hierarchy
3. Seamless real-time updates without visual disruption
4. Professional elegance suitable for business operations

## Typography System

**Font Stack:** Inter (primary), SF Pro Display (fallback)
**Hierarchy:**
- Dashboard Title: 2xl, font-semibold (24px)
- Section Headers: xl, font-semibold (20px)
- Order Titles/Customer Names: base, font-medium (16px)
- Order Details: sm, font-normal (14px)
- Prices/Revenue: lg-2xl, font-bold for emphasis
- Timestamps: xs, font-normal, subdued (12px)

## Layout System

**Spacing Primitives:** Consistent use of Tailwind units: 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Card spacing: p-6
- Button padding: px-4 py-2

**Grid Structure:**
- Three-column dashboard layout for desktop (70% orders + 30% revenue sidebar)
- Two-column order section (Pending | Completed) with equal widths
- Single column mobile stack (Revenue → Pending → Completed)
- Container: max-w-7xl with px-6

## Component Library

### Dashboard Header
- Full-width sticky header with restaurant name/logo
- Subtle border separator
- Height: h-16
- Padding: px-6 py-4

### Revenue Card (Sidebar)
- Prominent display with large numerical typography
- Today's total revenue: 3xl-4xl font-bold
- Secondary metrics: Orders completed count, average order value
- Sticky positioning on desktop (top-20)
- Subtle border treatment, rounded-lg

### Order Cards
**Card Structure:**
- Rounded-lg with subtle border
- Padding: p-6
- Spacing: space-y-3 for content sections
- Shadow: Minimal elevation (shadow-sm), increased on hover (shadow-md)
- Transition: smooth transform and shadow changes

**Card Content Hierarchy:**
1. Order Number + Timestamp (top row, space-between)
2. Customer Name (font-medium, prominent)
3. Order Items List (space-y-2, each item with quantity × name)
4. Price Total (font-bold, text-lg, aligned right)
5. Action Button (full-width or right-aligned)

**New Order Indicator:**
- Subtle pulsing border or highlight for newly arrived orders
- Auto-dismiss after 3 seconds
- No intrusive animations, just gentle visual cue

### Order Sections
**Pending Orders:**
- Grid layout: grid-cols-1 md:grid-cols-2 gap-4
- "Mark Complete" button: Prominent, full-width within card
- Empty state: Centered message with icon placeholder

**Completed Orders:**
- Same grid structure as pending
- Visual distinction through subtle opacity or muted treatment
- No action buttons (read-only state)
- Chronological order (most recent first)

### Buttons
**Complete Order Button:**
- Size: px-6 py-3, rounded-md
- Typography: font-medium
- Width: w-full on mobile, auto on desktop (right-aligned)
- Transition: Fast transform and shadow on interaction

### Audio Notification
- Non-visual but critical UX element
- Pleasant, professional "ding" sound (avoid harsh alerts)
- Browser notification permission prompt on first load
- Volume: Moderate, not startling

### Empty States
**No Pending Orders:**
- Centered icon (utensils or checkmark)
- Friendly message: "All caught up! No pending orders."
- Adequate vertical spacing: py-12

**No Completed Orders:**
- Simple message: "Completed orders will appear here"
- Less prominent than pending empty state

## Interaction Patterns

### Order Flow Animation
- Pending → Completed transition: Smooth fade and slide
- Duration: 300-400ms
- Card removal: Collapse height smoothly before removal
- Avoid abrupt content shifts

### Real-time Updates
- New orders: Appear at top of pending section with gentle fade-in
- Sound notification triggers simultaneously
- Visual indicator: Brief highlight border (2-3s duration)
- No page refresh or jarring movements

### Responsive Behavior
**Desktop (lg:):** Three-column layout, sticky sidebar
**Tablet (md:):** Revenue top, two-column order grid
**Mobile (base:):** Single column stack, revenue card condensed

## Accessibility Considerations

- Semantic HTML throughout (header, main, section, article for cards)
- ARIA labels for real-time updates and notifications
- Keyboard navigation for all interactive elements
- Focus states: Clear, consistent ring treatment
- Screen reader announcements for new orders (aria-live="polite")
- Sufficient contrast ratios for all text
- Touch targets: Minimum 44×44px for mobile buttons

## Performance & Polish

- Order cards: Virtualization if list exceeds 50 items
- Smooth transitions without jank (transform/opacity only)
- Optimistic UI updates (instant feedback, sync after)
- Loading states for initial data fetch
- Error handling: Inline messages, non-blocking

## Visual Refinement

- Consistent border radius: rounded-lg for cards, rounded-md for buttons
- Subtle shadows: Layered depth without heavy drop-shadows
- Whitespace: Generous breathing room between sections
- Typography scale: Clear hierarchy without excessive size jumps
- Icon usage: Minimal, purposeful (clock for timestamp, checkmark for completed)