// An enrollment inquiry captured from the public site's "Find your batch"
// flow — name/phone/email plus which course + batch they picked — before
// they're handed off to WhatsApp. Persisted on the shared portal state (see
// lib/portalState.ts) so Yana can see every inquiry from the admin panel
// even if the visitor never actually messages her.

import type { BatchCourse } from "./batchData";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  course: BatchCourse;
  batchId: string;
  batchName: string;
  createdAt: string; // ISO timestamp
};
