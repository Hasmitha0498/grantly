import { daysBetween, earliestDate, isValidDateOnly } from './date';
import type { Application, ApplicationTask, Scholarship } from './types';

export type DeadlineBucket = 'overdue' | 'within-48h' | 'within-7d' | 'later' | 'undated';
export type ActionKind = 'task' | 'follow-up' | 'offer-response';

export interface NextAction {
  id: string;
  kind: ActionKind;
  applicationId: string;
  taskId: string | null;
  title: string;
  scholarshipTitle: string;
  dueDate: string | null;
  bucket: DeadlineBucket;
  tier: number;
  reason: string;
  cta: string;
  href: string;
  warning: string | null;
}

export interface WaitingItem {
  id: string;
  applicationId: string;
  title: string;
  scholarshipTitle: string;
  nextFollowUpOn: string | null;
}

export interface ActionPlan {
  actions: NextAction[];
  waiting: WaitingItem[];
}

export function bucketFor(today: string, due: string | null): DeadlineBucket {
  if (!isValidDateOnly(due)) return 'undated';
  const d = daysBetween(today, due);
  if (d < 0) return 'overdue';
  if (d <= 2) return 'within-48h';
  if (d <= 7) return 'within-7d';
  return 'later';
}

function whenPhrase(today: string, due: string | null): string {
  if (!isValidDateOnly(due)) return 'it has no deadline yet';
  const d = daysBetween(today, due);
  if (d < 0) return `its deadline passed ${Math.abs(d)} day${d === -1 ? '' : 's'} ago`;
  if (d === 0) return 'it is due today';
  if (d === 1) return 'it is due tomorrow';
  return `it is due in ${d} days`;
}

function ctaFor(task: ApplicationTask): string {
  switch (task.type) {
    case 'essay':
      return 'Finish essay';
    case 'document':
      return 'Prepare document';
    case 'recommendation':
      return 'Check recommendation';
    case 'review':
      return 'Review application';
    default:
      return 'Complete step';
  }
}

/**
 * Deterministic priority list of student-actionable work.
 * `today` is the student's current calendar date (YYYY-MM-DD), injected.
 */
export function getNextActions(
  applications: Application[],
  tasks: ApplicationTask[],
  scholarships: (id: string) => Scholarship | undefined,
  today: string,
): ActionPlan {
  const actions: NextAction[] = [];
  const waiting: WaitingItem[] = [];

  for (const app of applications) {
    const sch = scholarships(app.scholarshipId);
    if (!sch) continue;
    const appTasks = tasks.filter((t) => t.applicationId === app.id);
    const base = `/applications/${encodeURIComponent(app.id)}`;

    if (app.status === 'awarded') {
      if (app.offerResponseStatus === 'pending') {
        const due = isValidDateOnly(app.offerResponseDeadlineOn) ? app.offerResponseDeadlineOn : null;
        const bucket = bucketFor(today, due);
        actions.push({
          id: `offer-${app.id}`,
          kind: 'offer-response',
          applicationId: app.id,
          taskId: null,
          title: 'Respond to your award offer',
          scholarshipTitle: sch.shortTitle,
          dueDate: due,
          bucket,
          tier: due ? 2 : 4,
          reason: `you recorded an award from ${sch.shortTitle} and ${whenPhrase(today, due)}`,
          cta: 'Record your response',
          href: `${base}#status`,
          warning: bucket === 'overdue' ? 'The response date you entered has passed.' : null,
        });
      }
      continue;
    }
    if (app.status === 'withdrawn' || app.status === 'not-selected') continue;

    const preparing = app.status === 'preparing' || app.status === 'action-required';

    for (const task of appTasks) {
      if (task.status === 'complete') continue;

      // Third-party dependencies: only actionable when the student's follow-up date arrives.
      if (task.status === 'waiting' || task.owner !== 'student') {
        const followUp = isValidDateOnly(task.nextFollowUpOn) ? task.nextFollowUpOn : null;
        if (followUp && daysBetween(today, followUp) <= 0) {
          const due = preparing ? earliestDate(task.dueDate, app.closesOn) : task.dueDate;
          actions.push({
            id: `follow-${task.id}`,
            kind: 'follow-up',
            applicationId: app.id,
            taskId: task.id,
            title: `Follow up: ${task.label}`,
            scholarshipTitle: sch.shortTitle,
            dueDate: due,
            bucket: bucketFor(today, due),
            tier: 3,
            reason: `the follow-up date you set has arrived and someone else is still working on this`,
            cta: 'Check status',
            href: `${base}#task-${task.id}`,
            warning: null,
          });
        } else {
          waiting.push({ id: task.id, applicationId: app.id, title: task.label, scholarshipTitle: sch.shortTitle, nextFollowUpOn: followUp });
        }
        continue;
      }

      // Student-owned preparation only matters before submission.
      if (!preparing) continue;

      const due = earliestDate(task.dueDate, app.closesOn);
      const bucket = bucketFor(today, due);
      let tier: number;
      if (!task.required) tier = 5;
      else if (bucket === 'overdue' || bucket === 'within-48h') tier = 1;
      else if (bucket === 'within-7d') tier = 3;
      else tier = 4;

      const inherited = !isValidDateOnly(task.dueDate) && due !== null;
      actions.push({
        id: `task-${task.id}`,
        kind: 'task',
        applicationId: app.id,
        taskId: task.id,
        title: task.label,
        scholarshipTitle: sch.shortTitle,
        dueDate: due,
        bucket,
        tier,
        reason: `${task.required ? 'it is required' : 'it is optional but helpful'} for ${sch.shortTitle} and ${whenPhrase(today, due)}${inherited ? ' (the application deadline)' : ''}`,
        cta: ctaFor(task),
        href: task.type === 'essay' && task.essayPromptId ? `${base}/essay/${encodeURIComponent(task.essayPromptId)}` : `${base}#task-${task.id}`,
        warning: bucket === 'overdue' ? 'Deadline may be missed' : null,
      });
    }
  }

  actions.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { actions, waiting };
}
