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
