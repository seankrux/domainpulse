# ♿ Accessibility Statement - DomainPulse

**Last Updated:** February 24, 2026  
**Commitment:** WCAG 2.1 Level AA Compliance

DomainPulse is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.

---

## ✅ Accessibility Features

### ♿ Keyboard Navigation

DomainPulse supports comprehensive keyboard navigation:

| Action | Key |
|--------|-----|
| Navigate between elements | `Tab` / `Shift+Tab` |
| Navigate dropdown menus | `↑` `↓` arrows |
| Select item | `Enter` or `Space` |
| Close modal/dropdown | `Escape` |
| First/Last item | `Home` / `End` |
| Focus search | `⌘K` (Cmd+K) |
| Check all domains | `⌘Enter` (Cmd+Enter) |

### 🗣️ Screen Reader Support

- **Skip links** - Jump to main content, domain table, or filters
- **ARIA labels** - All interactive elements properly labeled
- **Live regions** - Dynamic content announced to screen readers
- **Focus management** - Focus trapped in modals, restored on close
- **Semantic HTML** - Proper heading hierarchy and landmark regions

### 🎨 Visual Accessibility

- **High contrast** - All text meets WCAG AA contrast requirements (4.5:1 minimum)
- **Focus indicators** - 2px visible focus rings on all interactive elements
- **Dark mode** - Reduced eye strain with dark theme option
- **Responsive design** - Works at any zoom level up to 200%
- **Color independence** - Status conveyed through text + icons, not color alone

### ⌨️ Motor Accessibility

- **Large click targets** - All buttons minimum 44x44px
- **No time limits** - No actions require rapid or timed input
- **Keyboard only** - Full functionality without mouse
- **Touch friendly** - Adequate spacing between interactive elements

---

## 📊 WCAG 2.1 Compliance Status

| Principle | Level A | Level AA | Status |
|-----------|---------|----------|--------|
| **Perceivable** | ✅ | ✅ | Compliant |
| **Operable** | ✅ | ✅ | Compliant |
| **Understandable** | ✅ | ✅ | Compliant |
| **Robust** | ✅ | ✅ | Compliant |

### Specific Criteria Met

- ✅ **1.1.1** Non-text Content (all images have alt text)
- ✅ **1.3.1** Info and Relationships (proper semantic structure)
- ✅ **1.4.3** Contrast (Minimum) (4.5:1 for normal text)
- ✅ **2.1.1** Keyboard (all functionality keyboard accessible)
- ✅ **2.1.2** No Keyboard Trap (focus can be moved away)
- ✅ **2.4.1** Bypass Blocks (skip links provided)
- ✅ **2.4.3** Focus Order (logical tab sequence)
- ✅ **2.4.7** Focus Visible (clear focus indicators)
- ✅ **3.1.1** Language of Page (HTML lang attribute set)
- ✅ **3.2.1** On Focus (no unexpected context changes)
- ✅ **3.3.1** Error Identification (form errors clearly described)
- ✅ **4.1.2** Name, Role, Value (proper ARIA attributes)

---

## 🛠 Technologies Used

DomainPulse accessibility relies on:

- **HTML5** - Semantic elements and ARIA attributes
- **CSS** - Focus styles, high contrast colors
- **React 19** - Component-based accessibility
- **WAI-ARIA** - Screen reader support
- **TypeScript** - Type-safe accessibility props

### Compatibility

Tested with:

- **NVDA** + Firefox (Windows)
- **JAWS** + Chrome (Windows)
- **VoiceOver** + Safari (macOS, iOS)
- **TalkBack** + Chrome (Android)
- **Keyboard only** navigation (all browsers)

---

## 📝 Known Limitations

Despite our best efforts, some areas may have limitations:

1. **Third-party content** - External tools (WHOIS, DNS lookup) may not be fully accessible
2. **Charts** - Recharts library has limited screen reader support (working on improvements)
3. **Legacy browsers** - Older browsers may not support all ARIA features

We are actively working to address these limitations.

---

## 🎯 Ongoing Efforts

### Current Initiatives

- Adding text descriptions for charts and graphs
- Improving mobile touch accessibility
- Adding more keyboard shortcuts
- Creating accessibility user guide

### Future Goals

- WCAG 2.1 Level AAA compliance
- Audio descriptions for visual elements
- Customizable accessibility preferences
- Accessibility statement in multiple languages

---

## 📞 Feedback & Support

We welcome your feedback on the accessibility of DomainPulse. Please let us know if you encounter accessibility barriers:

- **Email:** contact@domainpulse.app
- **GitHub Issues:** https://github.com/seankrux/domainpulse/issues
- **Twitter:** @domainpulse

We try to respond to accessibility feedback within 48 hours.

---

## 🔍 Assessment Approach

DomainPulse's accessibility was assessed through:

- **Self-evaluation** - Internal testing with accessibility tools
- **Automated testing** - axe-core, Lighthouse accessibility audits
- **Manual testing** - Keyboard-only navigation, screen reader testing
- **User testing** - Feedback from users with disabilities

### Tools Used

- axe DevTools
- WAVE Evaluation Tool
- Lighthouse Accessibility Audit
- WebAIM Contrast Checker
- Screen readers (NVDA, VoiceOver, JAWS)

---

## 📅 Technical Specifications

Accessibility of DomainPulse relies on the following technologies:

- HTML5
- CSS3
- JavaScript (ES2020)
- React 19
- TypeScript 5.8

Works with:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- iOS Safari (latest 2 versions)
- Android Chrome (latest 2 versions)

---

**This statement was created on February 24, 2026 and is reviewed annually.**
