# Text Editing & Merge Selection Feature

## Overview

Add ability to place text directly on canvas and merge multiple elements (images, text, logos, stickers) into a single flattened image.

## Step 1: Text Elements on Canvas

### 1.1 Replace Star Sticker with Pencil

**File**: `src/components/sidebar/StickerSection.tsx`

- Replace ⭐ with ✏️ (pencil emoji)
- When dragged to canvas → open TextEditDialog (similar to post-it flow)

### 1.2 Create TextEditDialog Component

**File**: `src/components/canvas/TextEditDialog.tsx`

Similar to PostItEditDialog, includes:
- Text content (textarea)
- Font family (dropdown)
- Font size (number input or slider, e.g., 12-144px)
- Text color (color picker)
- Text align (left/center/right buttons)
- Shadow toggle (on/off with default style)

**Fonts to preload** (via next/font/google in layout.tsx):
- Inter (clean sans-serif)
- Playfair Display (elegant serif)
- Bebas Neue (bold display)
- Caveat (handwritten)
- Roboto Mono (monospace)
- Orbitron (futuristic)
- Geist (already loaded, include in dropdown)

### 1.3 Create TextElement Component

**File**: `src/components/canvas/TextElement.tsx`

Using Konva's `<Text>` component:

```typescript
<Text
  x={x}
  y={y}
  text={text}
  fontSize={fontSize}
  fontFamily={fontFamily}
  fill={color}
  width={width} // Controls text wrapping
  align={textAlign} // 'left' | 'center' | 'right'
  padding={10}
  rotation={rotation}
  scaleX={scaleX}
  scaleY={scaleY}
  shadowColor={shadow ? "black" : undefined}
  shadowBlur={shadow ? 10 : 0}
  shadowOffsetX={shadow ? 5 : 0}
  shadowOffsetY={shadow ? 5 : 0}
  shadowOpacity={shadow ? 0.5 : 0}
  draggable
  onClick={onSelect}
  onDragEnd={onDragEnd}
  onTransformEnd={onTransformEnd}
/>
```

**Key features**:
- Width controls text reflow (resize box = reflow text)
- All transforms supported (move, rotate, scale)
- Double-click to reopen TextEditDialog
- Selected state shows transformer

### 1.4 Update Canvas Store

**File**: `src/stores/canvasStore.ts`

Add new `sourceType: "text"` with properties:
- `text: string`
- `fontFamily: string`
- `fontSize: number`
- `color: string`
- `textAlign: 'left' | 'center' | 'right'`
- `shadow: boolean`
- `width: number` (for text wrapping)

### 1.5 Update Canvas.tsx

**File**: `src/components/canvas/Canvas.tsx`

- Handle pencil emoji drop → open TextEditDialog
- Render TextElement for `sourceType === "text"`
- Support double-click to edit
- Include text in transformer (multi-select with images/logos)

### 1.6 Context Menu for Text

Add to dropdown menu when text selected:
- Edit (pencil icon) - reopens TextEditDialog
- Delete (trash icon)

---

## Step 2: Merge Selection Feature

### 2.1 Add "Merge Selection" Menu Item

**File**: `src/components/canvas/Canvas.tsx`

When multiple items selected (or single item with shift for future workflow):
- Add dropdown menu item: **"Merge Selection"** (with Layers/Combine icon)
- Only show when 2+ items selected

### 2.2 Implement Merge Handler

**Function**: `handleMergeSelection()`

**Process**:
1. Calculate bounding box of all selected elements (accounting for rotations)
2. Add padding (e.g., 20px)
3. Save current stage transforms
4. Temporarily hide non-selected items (set `visible(false)`)
5. Reset stage transforms (scale=1, position={0,0})
6. Force layer redraw with `layer.batchDraw()`
7. Export layer section to blob:
   ```typescript
   const blob = await layer.toBlob({
     x: minX - padding,
     y: minY - padding,
     width: boundingWidth + padding * 2,
     height: boundingHeight + padding * 2,
     pixelRatio: 2, // High-res export (2x or 3x)
   });
   ```
8. Restore stage transforms
9. Restore visibility of hidden items
10. Upload blob to S3 via `/api/upload`
11. Create new image on canvas with uploaded URL
12. Position new image near selection (e.g., offset by 50px)
13. Show success toast: "Selection merged successfully!"

**Key details**:
- Use `pixelRatio: 2` (or 3) for high-resolution output independent of screen zoom
- Keep original elements (non-destructive workflow)
- New image placed as `sourceType: "merged"` (or just "uploaded")
- Include ALL selected types: images, text, logos, stickers, post-its

### 2.3 Reuse Existing Export Logic

Reference existing `handleDownloadBoard()` function (Canvas.tsx:823-970):
- Already handles bounding box calculation with rotation
- Already handles hiding items temporarily
- Already handles stage transform reset/restore
- Adapt for selection subset instead of all images

---

## Implementation Order

1. **Font setup** - Add fonts to layout.tsx and globals.css
2. **TextEditDialog** - Create dialog component
3. **TextElement** - Create Konva Text component
4. **Canvas integration** - Wire up pencil drop, render, edit
5. **Store updates** - Add text sourceType support
6. **Test Step 1** - Verify text creation, editing, transforms work
7. **Merge Selection** - Implement merge handler
8. **Test Step 2** - Verify high-res export, upload, placement

---

## Files to Create/Modify

### New files:
- `src/components/canvas/TextEditDialog.tsx`
- `src/components/canvas/TextElement.tsx`

### Modified files:
- `src/app/layout.tsx` (add fonts)
- `src/components/sidebar/StickerSection.tsx` (pencil emoji)
- `src/components/canvas/Canvas.tsx` (text drop, render, merge handler)
- `src/stores/canvasStore.ts` (text sourceType)
- `src/db/schema/types.ts` (if using strict types for sourceType)

---

## Edge Cases to Handle

1. **Text with no content** - Show placeholder or prevent creation
2. **Very long text** - Ensure wrapping works correctly
3. **Font loading** - Show fallback until Google Font loads
4. **Merge with rotated elements** - Bounding box must account for rotation (already solved in downloadBoard)
5. **Merge single item** - Allow or require 2+ items?
6. **Empty selection merge** - Disable button when nothing selected
7. **Uploading/generating images in selection** - Warn or filter out

---

## User Preferences

Store last-used text settings in localStorage (via usePreferences hook):
- `lastTextFont`
- `lastTextSize`
- `lastTextColor`
- `lastTextAlign`
- `lastTextShadow`

Similar to how `lastPostItColor` is stored.
