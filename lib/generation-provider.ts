import * as ltx from './ltx.ts';
import * as wan from './wan.ts';
import type { VideoPlan } from './types.ts';
export const configured = ltx.configured;
export const authenticated = ltx.authenticated;
export const submitVideo = (plan: VideoPlan, direction: string) =>
  plan.engine === 'wan'
    ? wan.submitVideo(plan, direction)
    : ltx.submitVideo(plan, direction);
export const getVideoStatus = (id: string) =>
  id.startsWith('wan:') ? wan.getVideoStatus(id) : ltx.getVideoStatus(id);
