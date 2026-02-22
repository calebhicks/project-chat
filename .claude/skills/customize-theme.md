# Customize Theme

Match the project-chat widget's appearance to the host project's design system.

## When to use

- The default indigo accent doesn't match the project's brand
- The project uses dark mode and the widget should respect it
- Custom fonts, border radii, or colors are needed

## Quick theme

```tsx
<AgentChatProvider config={{
  endpoint: '/api/chat',
  theme: {
    mode: 'dark',               // 'light' | 'dark'
    accentColor: '#3b82f6',     // Primary/brand color — used for bubble, header, send button
    fontFamily: 'Inter, sans-serif',
  },
}}>
```

## Auto-detect from host

Read the host's design system to extract values:

1. **Tailwind** — Check `tailwind.config.js` for `theme.extend.colors.primary`, `fontFamily`, `borderRadius`
2. **CSS variables** — Look for `--primary`, `--accent`, `--font-family` in global CSS
3. **Theme provider** — If the host has a ThemeProvider, extract its values
4. **Brand guidelines** — Check README, design docs, or Figma links for brand colors

## ThemeConfig reference

```typescript
interface ThemeConfig {
  mode: 'light' | 'dark'
  accentColor?: string        // Default: '#6366f1' (indigo-500)
  fontFamily?: string         // Default: system font stack
  borderRadius?: string       // Default: '12px'
  chatBubbleColor?: string    // Default: uses accentColor
  userBubbleColor?: string    // Default: uses accentColor
}
```

## System theme detection

Pass `theme: 'system'` to auto-detect from the user's OS preference:

```tsx
<AgentChatProvider config={{
  endpoint: '/api/chat',
  theme: 'system',  // respects prefers-color-scheme
}}>
```

## Advanced: CSS custom properties

The widget uses inline styles for isolation, but you can override specific elements by wrapping the widget and using CSS specificity. The widget root has a z-index of `2147483647` (max) to stay above all content.
