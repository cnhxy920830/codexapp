const NO_MATCH = -2147483648;
const PATH_SEPARATOR_PLACEHOLDER = "\0";
const PATH_SEPARATORS = ["/", "\\"];
const PATH_SCORE_BONUS = 10000;
const SCORE_MULTIPLIER = 10;

export function scoreQueryMatch(target: string, query: string) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return 0;
  }

  const matcher = createMatcher(trimmedQuery);
  const candidate = containsPathSeparators(trimmedQuery) ? normalizePathLikeCandidate(target) : target;
  const score = matcher.matchingDegree(candidate);
  if (score === NO_MATCH) {
    return 0;
  }

  const adjustedScore = score * SCORE_MULTIPLIER - target.length;
  return adjustedScore <= 0 ? 1 : adjustedScore;
}

function createMatcher(query: string) {
  const containsPaths = containsPathSeparators(query);
  const primaryPattern = containsPaths ? expandPathPattern(query) : `*${query}`;
  const fallbackPattern = basenameQuery(query);
  return new CombinedMatcher(
    new PatternMatcher(primaryPattern),
    containsPaths && query !== fallbackPattern ? new PatternMatcher(fallbackPattern) : null,
  );
}

function expandPathPattern(query: string) {
  let expanded = `*${query}`;
  for (const separator of PATH_SEPARATORS) {
    expanded = expanded.split(separator).join(`*${PATH_SEPARATOR_PLACEHOLDER}*`);
  }
  return expanded;
}

function basenameQuery(query: string) {
  let separatorIndex = -1;
  for (const separator of PATH_SEPARATORS) {
    const nextIndex = query.lastIndexOf(separator);
    if (nextIndex >= 0 && nextIndex < query.length - 1) {
      separatorIndex = Math.max(separatorIndex, nextIndex);
    }
  }
  return query.slice(separatorIndex + 1);
}

function normalizePathLikeCandidate(candidate: string) {
  let normalized = candidate;
  for (const separator of PATH_SEPARATORS) {
    normalized = normalized.split(separator).join(PATH_SEPARATOR_PLACEHOLDER);
  }
  return normalized;
}

function containsPathSeparators(value: string) {
  return PATH_SEPARATORS.some((separator) => value.includes(separator));
}

class CombinedMatcher {
  constructor(
    private readonly primaryMatcher: PatternMatcher,
    private readonly fallbackMatcher: PatternMatcher | null,
  ) {}

  matchingDegree(candidate: string) {
    const primaryMatch = this.primaryMatcher.match(candidate);
    if (primaryMatch) {
      return applyPathBonus(this.primaryMatcher.matchingDegree(candidate, primaryMatch), primaryMatch);
    }

    if (!this.fallbackMatcher) {
      return NO_MATCH;
    }

    const fallbackMatch = this.fallbackMatcher.match(candidate);
    if (!fallbackMatch) {
      return NO_MATCH;
    }

    return applyPathBonus(this.fallbackMatcher.matchingDegree(candidate, fallbackMatch), fallbackMatch);
  }
}

class PatternMatcher {
  private readonly patternCharacters: string[];
  private readonly lowerPattern: string;
  private readonly minMeaningfulLength: number;

  constructor(pattern: string) {
    this.patternCharacters = [...pattern];
    this.lowerPattern = this.patternCharacters.filter((character) => character !== "*").join("").toLowerCase();
    this.minMeaningfulLength = this.lowerPattern.length;
  }

  match(candidate: string) {
    if (candidate.length < this.minMeaningfulLength) {
      return null;
    }

    const wildcardPrefix = this.patternCharacters[0] === "*";
    if (wildcardPrefix) {
      const index = candidate.toLowerCase().indexOf(this.lowerPattern);
      if (index === -1) {
        return null;
      }
      return [{ startOffset: index, endOffset: index + this.lowerPattern.length }];
    }

    if (!candidate.toLowerCase().startsWith(this.lowerPattern)) {
      return null;
    }
    return [{ startOffset: 0, endOffset: this.lowerPattern.length }];
  }

  matchingDegree(candidate: string, segments: MatchSegment[]) {
    if (segments.length === 0) {
      return 0;
    }

    let score = 0;
    for (const segment of segments) {
      score += segment.endOffset - segment.startOffset;
    }

    if (segments[0]?.startOffset === 0) {
      score += 1000;
    }

    if (segments[segments.length - 1]?.endOffset === candidate.length) {
      score += 1;
    }

    return score;
  }
}

type MatchSegment = {
  startOffset: number;
  endOffset: number;
};

function applyPathBonus(score: number, segments: MatchSegment[]) {
  return segments[0]?.startOffset === 0 ? score + PATH_SCORE_BONUS : score;
}
