// Re-export all schemas and types

// Helpers
export { handleZodError, buddhistYearField, emailField, passwordField } from "./helpers";

// Alumni
export {
  alumniFormSchema,
  alumniCreateSchema,
  alumniUpdateSchema,
  profileFormSchema,
  alumniEditFormSchema,
  DEGREE_LEVEL_VALUES,
} from "./alumni";
export type {
  AlumniFormData,
  AlumniCreateInput,
  AlumniUpdateInput,
  ProfileFormData,
  AlumniEditFormData,
} from "./alumni";

// Award
export {
  awardFormSchema,
  awardPageFormSchema,
  awardCreateSchema,
  awardUpdateSchema,
  AWARD_TYPE_VALUES,
} from "./award";
export type {
  AwardFormData,
  AwardPageFormData,
  AwardCreateInput,
  AwardUpdateInput,
} from "./award";

// Association
export {
  associationFormSchema,
  associationPageFormSchema,
  associationCreateSchema,
  associationUpdateSchema,
} from "./association";
export type {
  AssociationFormData,
  AssociationPageFormData,
  AssociationCreateInput,
  AssociationUpdateInput,
} from "./association";

// Graduate Committee
export {
  committeeFormSchema,
  committeePageFormSchema,
  committeeCreateSchema,
  committeeUpdateSchema,
} from "./graduate-committee";
export type {
  CommitteeFormData,
  CommitteePageFormData,
  CommitteeCreateInput,
  CommitteeUpdateInput,
} from "./graduate-committee";

// Potential
export {
  potentialFormSchema,
  potentialPageFormSchema,
  potentialCreateSchema,
  potentialUpdateSchema,
} from "./potential";
export type {
  PotentialFormData,
  PotentialPageFormData,
  PotentialCreateInput,
  PotentialUpdateInput,
} from "./potential";

// Model Representative
export {
  modelRepFormSchema,
  modelRepPageFormSchema,
  modelRepCreateSchema,
  modelRepUpdateSchema,
} from "./model-representative";
export type {
  ModelRepFormData,
  ModelRepPageFormData,
  ModelRepCreateInput,
  ModelRepUpdateInput,
} from "./model-representative";

// Alumni Agency
export {
  alumniAgencyFormSchema,
  alumniAgencyCreateSchema,
  alumniAgencyUpdateSchema,
} from "./alumni-agency";
export type {
  AlumniAgencyFormData,
  AlumniAgencyCreateInput,
  AlumniAgencyUpdateInput,
} from "./alumni-agency";

// User
export {
  userCreateSchema,
  userUpdateSchema,
  USER_ROLE_VALUES,
} from "./user";
export type {
  UserCreateInput,
  UserUpdateInput,
} from "./user";

// Auth
export {
  adminLoginSchema,
  alumniLoginSchema,
  alumniSignupSchema,
  alumniReapplySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "./auth";
export type {
  AdminLoginData,
  AlumniLoginData,
  AlumniSignupData,
  AlumniReapplyData,
  ForgotPasswordData,
  ResetPasswordData,
  VerifyEmailData,
  ResendVerificationData,
} from "./auth";

// News
export {
  newsFormSchema,
  newsCreateSchema,
  newsUpdateSchema,
  NEWS_STATUS_VALUES,
} from "./news";
export type {
  NewsFormData,
  NewsCreateInput,
  NewsUpdateInput,
} from "./news";

// Forum (alumni community)
export {
  forumTopicFormSchema,
  forumTopicCreateSchema,
  forumTopicUpdateSchema,
  forumReplyFormSchema,
  forumReplyCreateSchema,
  forumReplyUpdateSchema,
  forumReportCreateSchema,
  forumReportActionSchema,
  communityMembershipSchema,
  FORUM_REPORT_RESOURCE_VALUES,
  CONTENT_REPORT_REASON_VALUES,
  CONTENT_REPORT_STATUS_VALUES,
  COMMUNITY_ACTION_VALUES,
  FORUM_REPORT_REASON_LABELS,
  CONTENT_REPORT_STATUS_LABELS,
  FORUM_SORT_VALUES,
  FORUM_SORT_LABELS,
} from "./forum";
export type {
  ForumTopicFormData,
  ForumTopicCreateInput,
  ForumTopicUpdateInput,
  ForumReplyFormData,
  ForumReplyCreateInput,
  ForumReplyUpdateInput,
  ForumReportCreateInput,
  ForumReportActionInput,
  CommunityMembershipInput,
} from "./forum";

// Events (alumni community)
export {
  eventFormSchema,
  eventCreateSchema,
  eventUpdateSchema,
  rsvpSchema,
  RSVP_STATUS_VALUES,
  RSVP_STATUS_LABELS,
} from "./event";
export type {
  EventFormData,
  EventCreateInput,
  EventUpdateInput,
  RsvpInput,
} from "./event";

// Activity feed (alumni community)
export {
  feedPostFormSchema,
  feedPostCreateSchema,
  feedPostUpdateSchema,
  feedCommentFormSchema,
  feedCommentCreateSchema,
  feedCommentUpdateSchema,
} from "./feed";
export type {
  FeedPostFormData,
  FeedPostCreateInput,
  FeedPostUpdateInput,
  FeedCommentFormData,
  FeedCommentCreateInput,
  FeedCommentUpdateInput,
} from "./feed";

// Community profile (alumni community V2)
export { communityProfileSchema } from "./community-profile";
export type { CommunityProfileInput } from "./community-profile";

// Groups (alumni community V2)
export {
  groupCreateSchema,
  groupUpdateSchema,
  GROUP_KIND_VALUES,
  GROUP_KIND_LABELS,
} from "./group";
export type { GroupCreateInput, GroupUpdateInput } from "./group";

// Alumni with Related (composite)
export {
  alumniWithRelatedFormSchema,
  alumniWithRelatedCreateSchema,
  alumniWithRelatedUpdateSchema,
  alumniProfileWithRelatedFormSchema,
  alumniProfileUpdateSchema,
} from "./alumni-with-related";
export type {
  AlumniWithRelatedFormData,
  AlumniWithRelatedCreateInput,
  AlumniWithRelatedUpdateInput,
  AlumniProfileWithRelatedFormData,
  AlumniProfileUpdateInput,
} from "./alumni-with-related";
