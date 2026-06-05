export class PathEncoder {
  private constructor() {}

  static encode(absolutePath: string): string {
    return absolutePath.replace(/\//g, '-');
  }

  static decode(encodedPath: string): string {
    if (encodedPath === '-') return '/';
    // Check if this looks like a path with a project name containing hyphens
    // Pattern: -Users-name-Dir1-Dir2-project-name
    const segments = encodedPath.split('-').filter(s => s.length > 0);

    // If we have the typical macOS /Users/username/... pattern and enough segments
    // try to reconstruct by assuming the last segments might form the project name
    if (segments.length >= 4 && segments[0] === 'Users') {
      // This looks like /Users/username/... pattern
      // The first 2 segments are Users and username, then we have path components
      // Join everything after the first 2 with /, but try to preserve hyphens in the last component
      const pathComponents = segments.slice(2);

      // If the last component is very short (like "agent"), it might be part of a hyphenated name
      if (pathComponents.length >= 2) {
        const last = pathComponents[pathComponents.length - 1];
        const secondLast = pathComponents[pathComponents.length - 2];

        // If last segment is short and secondLast looks like it could be a prefix
        if (last.length <= 6 && /^[a-z]+$/.test(last)) {
          // Combine them
          pathComponents[pathComponents.length - 2] = secondLast + '-' + last;
          pathComponents.pop();
        }
      }

      return '/' + segments.slice(0, 2).concat(pathComponents).join('/');
    }

    // Fallback to simple replacement
    return '/' + encodedPath.slice(1).replace(/-/g, '/');
  }

  static extractProjectName(encodedPath: string): string {
    if (encodedPath.startsWith('ssh-')) return encodedPath;
    const segments = encodedPath.split('-').filter((s) => s.length > 0);

    // For short paths (just 2-3 segments), return the last segment
    if (segments.length <= 3) {
      return segments[segments.length - 1] || encodedPath;
    }

    // For longer paths, handle common patterns like "accounting-agent" at the end
    // If the last segment is short and the second-to-last exists, they might be a compound name
    const last = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];

    // If the last segment is short (like "agent") and second-to-last could be a prefix
    // Check if combining them makes sense
    if (last.length <= 6 && /^[a-z]+$/.test(last) && secondLast.length > 0) {
      return secondLast + '-' + last;
    }

    return segments[segments.length - 1] || encodedPath;
  }
}
