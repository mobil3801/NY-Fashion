// React Import Checker - Ensures all React components have proper imports
export interface ImportCheckResult {
  file: string;
  hasReactImport: boolean;
  hasHookImports: boolean;
  missingImports: string[];
  suggestions: string[];
}

const commonReactHooks = [
  'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useImperativeHandle', 'useLayoutEffect', 'useDebugValue'
];

const reactImportPatterns = {
  defaultImport: /import\s+React\s+from\s+['"]react['"]/,
  namedImports: /import\s*\{\s*([^}]+)\s*\}\s*from\s+['"]react['"]/,
  combinedImport: /import\s+React,\s*\{\s*([^}]+)\s*\}\s*from\s+['"]react['"]/
};

export const checkReactImports = (fileContent: string, fileName: string): ImportCheckResult => {
  const result: ImportCheckResult = {
    file: fileName,
    hasReactImport: false,
    hasHookImports: false,
    missingImports: [],
    suggestions: []
  };

  // Check if file uses JSX or React components
  const hasJSX = /<[A-Z][^>]*>/g.test(fileContent);
  const hasReactComponents = /React\./g.test(fileContent);
  
  // Check for React imports
  const hasDefaultImport = reactImportPatterns.defaultImport.test(fileContent);
  const namedImportsMatch = fileContent.match(reactImportPatterns.namedImports);
  const combinedImportsMatch = fileContent.match(reactImportPatterns.combinedImport);

  result.hasReactImport = hasDefaultImport || !!namedImportsMatch || !!combinedImportsMatch;

  // Extract currently imported hooks
  let importedHooks: string[] = [];
  if (namedImportsMatch) {
    importedHooks = namedImportsMatch[1].split(',').map(hook => hook.trim());
  }
  if (combinedImportsMatch) {
    importedHooks = combinedImportsMatch[1].split(',').map(hook => hook.trim());
  }

  result.hasHookImports = importedHooks.length > 0;

  // Check for used but not imported hooks
  const usedHooks: string[] = [];
  commonReactHooks.forEach(hook => {
    const hookPattern = new RegExp(`\\b${hook}\\b`, 'g');
    if (hookPattern.test(fileContent) && !importedHooks.includes(hook)) {
      usedHooks.push(hook);
    }
  });

  // Check for missing imports
  if (hasJSX && !hasDefaultImport && !combinedImportsMatch) {
    result.missingImports.push('React');
  }

  if (usedHooks.length > 0) {
    result.missingImports.push(...usedHooks);
  }

  // Generate suggestions
  if (result.missingImports.length > 0) {
    if (result.missingImports.includes('React')) {
      result.suggestions.push("Add React import: import React from 'react';");
    }
    
    const hookImports = result.missingImports.filter(imp => imp !== 'React');
    if (hookImports.length > 0) {
      if (hasDefaultImport) {
        result.suggestions.push(`Add hook imports: import React, { ${hookImports.join(', ')} } from 'react';`);
      } else {
        result.suggestions.push(`Add hook imports: import { ${hookImports.join(', ')} } from 'react';`);
      }
    }
  }

  return result;
};

export const generateFixedImport = (currentContent: string, checkResult: ImportCheckResult): string => {
  if (checkResult.missingImports.length === 0) {
    return currentContent;
  }

  // Find existing React import line
  const existingImportMatch = currentContent.match(/import.*from\s+['"]react['"]/g);
  
  if (!existingImportMatch) {
    // No React import exists, add one
    const reactImport = checkResult.missingImports.includes('React') ? 'React' : '';
    const hookImports = checkResult.missingImports.filter(imp => imp !== 'React');
    
    let newImport = 'import ';
    if (reactImport && hookImports.length > 0) {
      newImport += `${reactImport}, { ${hookImports.join(', ')} }`;
    } else if (reactImport) {
      newImport += reactImport;
    } else {
      newImport += `{ ${hookImports.join(', ')} }`;
    }
    newImport += " from 'react';\n";
    
    return newImport + currentContent;
  } else {
    // React import exists, update it
    const existingImport = existingImportMatch[0];
    let updatedImport = existingImport;
    
    // Add missing hooks to existing import
    const hooksToAdd = checkResult.missingImports.filter(imp => imp !== 'React');
    if (hooksToAdd.length > 0) {
      if (existingImport.includes('{')) {
        // Add to existing named imports
        updatedImport = existingImport.replace(/}\s*from/, `, ${hooksToAdd.join(', ')} } from`);
      } else {
        // Convert default import to combined import
        updatedImport = existingImport.replace(/React\s*from/, `React, { ${hooksToAdd.join(', ')} } from`);
      }
    }
    
    return currentContent.replace(existingImport, updatedImport);
  }
};

// Batch check multiple files
export const batchCheckReactImports = async (filePaths: string[]): Promise<ImportCheckResult[]> => {
  const results: ImportCheckResult[] = [];
  
  for (const filePath of filePaths) {
    try {
      // In a real implementation, you would read the file content
      // For now, we'll simulate the check
      const mockContent = `// Simulated content for ${filePath}`;
      const result = checkReactImports(mockContent, filePath);
      results.push(result);
    } catch (error) {
      console.error(`Error checking ${filePath}:`, error);
    }
  }
  
  return results;
};

// Development helper to check common React patterns
export const validateReactPatterns = (content: string): {
  warnings: string[];
  suggestions: string[];
} => {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Check for deprecated patterns
  if (content.includes('React.FC<')) {
    suggestions.push('Consider using function component syntax without React.FC for simpler types');
  }
  
  if (content.includes('useEffect(() => {'), !content.includes('// eslint-disable-next-line')) {
    const useEffectCount = (content.match(/useEffect\(/g) || []).length;
    if (useEffectCount > 3) {
      suggestions.push('Consider extracting some useEffect logic into custom hooks for better organization');
    }
  }
  
  // Check for missing dependency arrays
  const useEffectWithoutDeps = /useEffect\([^)]+\)(?!\s*,\s*\[)/g;
  if (useEffectWithoutDeps.test(content)) {
    warnings.push('useEffect without dependency array detected - this may cause infinite re-renders');
  }
  
  return { warnings, suggestions };
};

export default {
  checkReactImports,
  generateFixedImport,
  batchCheckReactImports,
  validateReactPatterns
};