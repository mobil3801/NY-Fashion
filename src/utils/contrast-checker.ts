
/**
 * WCAG 2.1 AA Contrast Ratio Checker
 * Ensures all UI elements meet accessibility standards
 */

interface ColorInfo {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface ContrastResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'AA18' | 'FAIL';
  passes: {
    normalAA: boolean;
    normalAAA: boolean;
    largeAA: boolean;
    largeAAA: boolean;
  };
}

/**
 * Parse color string to RGB values
 */
function parseColor(colorStr: string): ColorInfo | null {
  // Handle rgb/rgba
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    };
  }

  // Handle hex colors
  const hexMatch = colorStr.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    } else {
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16),
        a: 1
      };
    }
  }

  // Handle named colors (basic set)
  const namedColors: {[key: string]: ColorInfo;} = {
    white: { r: 255, g: 255, b: 255, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 128, b: 0, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
    transparent: { r: 0, g: 0, b: 0, a: 0 }
  };

  return namedColors[colorStr.toLowerCase()] || null;
}

/**
 * Calculate relative luminance according to WCAG
 */
function getLuminance(color: ColorInfo): number {
  const { r, g, b } = color;

  // Convert to sRGB
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 */
function calculateContrastRatio(color1: ColorInfo, color2: ColorInfo): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG guidelines
 */
function checkContrastCompliance(ratio: number, fontSize: number, fontWeight: string | number): ContrastResult {
  const isLarge = fontSize >= 18 || fontSize >= 14 && (fontWeight === 'bold' || parseInt(String(fontWeight)) >= 700);

  const normalAA = ratio >= 4.5;
  const normalAAA = ratio >= 7;
  const largeAA = ratio >= 3;
  const largeAAA = ratio >= 4.5;

  let level: ContrastResult['level'] = 'FAIL';

  if (isLarge) {
    if (ratio >= 4.5) level = 'AAA';else
    if (ratio >= 3) level = 'AA';
  } else {
    if (ratio >= 7) level = 'AAA';else
    if (ratio >= 4.5) level = 'AA';
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    passes: {
      normalAA,
      normalAAA,
      largeAA,
      largeAAA
    }
  };
}

/**
 * Check contrast for a DOM element
 */
export function checkElementContrast(element: Element): ContrastResult | null {
  const styles = getComputedStyle(element);
  const color = parseColor(styles.color);
  const backgroundColor = parseColor(styles.backgroundColor);

  if (!color) return null;

  // If no background color, check against parent or assume white
  let bgColor = backgroundColor;
  if (!bgColor || bgColor.a === 0) {
    // Look for parent background or use white as default
    let parent = element.parentElement;
    while (parent && (!bgColor || bgColor.a === 0)) {
      const parentStyles = getComputedStyle(parent);
      bgColor = parseColor(parentStyles.backgroundColor);
      parent = parent.parentElement;
    }

    if (!bgColor || bgColor.a === 0) {
      bgColor = { r: 255, g: 255, b: 255, a: 1 }; // Default to white
    }
  }

  const fontSize = parseFloat(styles.fontSize);
  const fontWeight = styles.fontWeight;

  const ratio = calculateContrastRatio(color, bgColor);
  return checkContrastCompliance(ratio, fontSize, fontWeight);
}

/**
 * Audit page for contrast issues
 */
export function auditPageContrast(): {element: Element;result: ContrastResult;info: any;}[] {
  const results: {element: Element;result: ContrastResult;info: any;}[] = [];

  // Target common elements that might have contrast issues
  const selectors = [
  'button', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  '[class*="badge"]', '[class*="text-"]', '[class*="bg-"]',
  '.opacity-90', '.opacity-75', '.opacity-50'];


  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      const result = checkElementContrast(element);
      if (result) {
        const styles = getComputedStyle(element);
        const info = {
          selector: `${element.tagName.toLowerCase()}${element.className ? '.' + element.className.split(' ').join('.') : ''}`,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          textContent: element.textContent?.slice(0, 50) || ''
        };

        results.push({ element, result, info });
      }
    });
  });

  return results;
}

/**
 * Report contrast issues (dev only)
 */
export function reportContrastIssues(): void {
  if (!import.meta.env.DEV) return;

  console.group('[A11y] Contrast Audit Results');

  const results = auditPageContrast();
  const failures = results.filter((r) => r.result.level === 'FAIL' || r.result.ratio < 4.5);

  if (failures.length === 0) {
    console.log('✅ All elements pass WCAG AA contrast requirements!');
  } else {
    console.warn(`⚠️ Found ${failures.length} contrast issues:`);

    failures.forEach(({ element, result, info }, index) => {
      console.group(`${index + 1}. ${info.selector} (${result.ratio}:1)`);
      console.log('Element:', element);
      console.log('Styles:', {
        color: info.color,
        backgroundColor: info.backgroundColor,
        fontSize: info.fontSize,
        fontWeight: info.fontWeight
      });
      console.log('Text:', `"${info.textContent}"`);
      console.log('Required ratio:', info.fontSize >= 18 || info.fontWeight === 'bold' ? '3:1 (large text)' : '4.5:1 (normal text)');
      console.groupEnd();
    });
  }

  console.groupEnd();
}

/**
 * Get accessible color suggestions
 */
export function getAccessibleColorSuggestions(baseColor: string, backgroundColor: string = '#ffffff'): string[] {
  const base = parseColor(baseColor);
  const bg = parseColor(backgroundColor);

  if (!base || !bg) return [];

  const suggestions: string[] = [];

  // Generate darker variants for better contrast
  for (let factor = 0.7; factor >= 0.2; factor -= 0.1) {
    const adjusted = {
      r: Math.round(base.r * factor),
      g: Math.round(base.g * factor),
      b: Math.round(base.b * factor),
      a: 1
    };

    const ratio = calculateContrastRatio(adjusted, bg);
    if (ratio >= 4.5) {
      suggestions.push(`rgb(${adjusted.r}, ${adjusted.g}, ${adjusted.b})`);
    }
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
}

// Dev tools integration
if (import.meta.env.DEV) {
  (window as any).a11y = {
    checkContrast: reportContrastIssues,
    checkElement: checkElementContrast,
    getSuggestions: getAccessibleColorSuggestions
  };
}