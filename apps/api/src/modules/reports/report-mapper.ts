import type { GeneratedReportItem, NormalizedActivity } from './report.types.js';

const conventionalPrefix = /^(feat|fix|docs|test|refactor|chore|perf|build|ci)(\([^)]*\))?!?:\s*/i;

export function deduplicateActivities(activities: NormalizedActivity[]): NormalizedActivity[] {
  const unique = new Map<string, NormalizedActivity>();
  for (const activity of activities) {
    const key = [
      activity.provider,
      activity.repositoryId,
      activity.category,
      activity.externalId,
    ].join(':');
    if (!unique.has(key)) unique.set(key, activity);
  }
  return [...unique.values()];
}

function topicFor(title: string): string {
  const normalized = title.replace(conventionalPrefix, '').trim();
  return normalized.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
}

function displayTitle(topic: string): string {
  return topic.length === 0
    ? 'Development activity'
    : topic.charAt(0).toUpperCase() + topic.slice(1);
}

export function groupActivities(activities: NormalizedActivity[]): GeneratedReportItem[] {
  const groups = new Map<string, NormalizedActivity[]>();
  for (const activity of activities) {
    const key = [
      activity.provider,
      activity.repositoryId,
      activity.category,
      topicFor(activity.title),
    ].join(':');
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    if (!first) throw new Error('Activity group cannot be empty.');
    const uniqueTitles = [...new Set(group.map((activity) => activity.title.trim()))];
    return {
      provider: first.provider,
      repositoryName: first.repositoryName,
      category: first.category,
      title: displayTitle(topicFor(first.title)),
      description: uniqueTitles.map((title) => `- ${title}`).join('\n'),
      activityCount: group.length,
      sourceData: group.map((activity) => ({
        category: activity.category,
        externalId: activity.externalId,
        title: activity.title,
        url: activity.url,
      })),
    };
  });
}
