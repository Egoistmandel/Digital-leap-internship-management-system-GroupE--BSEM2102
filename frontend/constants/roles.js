/**
 * Role Constants — Digital LEAP
 * Must match the role_name values in the database roles table exactly.
 */

export const Roles = {
  STUDENT:              'student',
  LEAP_COORDINATOR:     'leap_coordinator',
  ACADEMIC_SUPERVISOR:  'academic_supervisor',
  FACULTY_COORDINATOR:  'faculty_coordinator',
  FACULTY_MENTOR:       'faculty_mentor',
  HOST_SUPERVISOR:      'host_supervisor',
  MANAGEMENT:           'management',
};

/**
 * Returns the display label for a given role key.
 */
export function getRoleLabel(role) {
  const labels = {
    student:             'Student',
    leap_coordinator:    'LEAP Coordinator',
    academic_supervisor: 'Academic Supervisor',
    faculty_coordinator: 'Faculty Coordinator',
    faculty_mentor:      'Faculty Mentor',
    host_supervisor:     'Host Supervisor',
    management:          'University Management',
  };
  return labels[role] ?? role;
}

/**
 * Roles that can self-register through the app.
 * leap_coordinator and management are created by admin only.
 */
export const REGISTERABLE_ROLES = [
  { label: 'Student',              value: Roles.STUDENT },
  { label: 'Academic Supervisor',  value: Roles.ACADEMIC_SUPERVISOR },
  { label: 'Faculty Coordinator',  value: Roles.FACULTY_COORDINATOR },
  { label: 'Faculty Mentor',       value: Roles.FACULTY_MENTOR },
  { label: 'Host Supervisor',      value: Roles.HOST_SUPERVISOR },
];
