<?php
/**
 * API Router — Digital LEAP Internship Management System
 * Maps HTTP method + URI path to the appropriate controller method.
 * Version: 1.0 (clean, no duplicates)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/UserController.php';
require_once __DIR__ . '/../controllers/HostController.php';
require_once __DIR__ . '/../controllers/PlacementController.php';
require_once __DIR__ . '/../controllers/LogbookController.php';
require_once __DIR__ . '/../controllers/VisitController.php';
require_once __DIR__ . '/../controllers/AssessmentController.php';
require_once __DIR__ . '/../controllers/AttendanceController.php';
require_once __DIR__ . '/../controllers/ReportController.php';
require_once __DIR__ . '/../utils/Response.php';

$database   = new Database();
$db         = $database->getConnection();

// Parse request
$request_uri = $_SERVER['REQUEST_URI'] ?? '/';
$script_name = dirname($_SERVER['SCRIPT_NAME']);
$path        = str_replace($script_name, '', parse_url($request_uri, PHP_URL_PATH));
$path        = '/' . trim($path, '/');
$method      = $_SERVER['REQUEST_METHOD'];
$seg         = explode('/', trim($path, '/'));
$s0          = $seg[0] ?? '';
$s1          = $seg[1] ?? '';
$s2          = $seg[2] ?? '';
$id1         = is_numeric($s1) ? (int)$s1 : null;
$id2         = is_numeric($s2) ? (int)$s2 : null;
$n           = count($seg);

// Controller instances
$auth       = new AuthController($db);
$users      = new UserController($db);
$hosts      = new HostController($db);
$placements = new PlacementController($db);
$logbooks   = new LogbookController($db);
$visits     = new VisitController($db);
$assessment = new AssessmentController($db);
$attendance = new AttendanceController($db);
$reports    = new ReportController($db);

// =============================================================================
// AUTH
// =============================================================================
if      ($method==='POST' && $path==='/auth/register')                       { $auth->register(); }
elseif  ($method==='POST' && $path==='/auth/login')                          { $auth->login(); }
elseif  ($method==='POST' && $path==='/auth/logout')                         { $auth->logout(); }
elseif  ($method==='POST' && $n===3 && $s0==='auth' && $s1==='unlock' && $id2){ $auth->manualUnlock($id2); }

// =============================================================================
// USERS
// =============================================================================
elseif  ($method==='GET'   && $path==='/users/pending')                       { $users->listPending(); }
elseif  ($method==='GET'   && $n===2 && $s0==='users'  && $id1)              { $users->getProfile($id1); }
elseif  ($method==='PUT'   && $n===2 && $s0==='users'  && $id1)              { $users->updateProfile($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='users'  && $id1 && $s2==='status')      { $users->updateStatus($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='users'  && $id1 && $s2==='eligibility') { $users->updateEligibility($id1); }

// =============================================================================
// HOST ORGANISATIONS & VACANCIES
// =============================================================================
elseif  ($method==='GET'   && $path==='/hosts')                               { $hosts->list(); }
elseif  ($method==='POST'  && $path==='/hosts')                               { $hosts->create(); }
elseif  ($method==='GET'   && $n===2 && $s0==='hosts' && $id1)               { $hosts->get($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='hosts' && $id1 && $s2==='status')     { $hosts->updateStatus($id1); }
elseif  ($method==='POST'  && $n===3 && $s0==='hosts' && $id1 && $s2==='vacancies')  { $hosts->addVacancy($id1); }

// =============================================================================
// PLACEMENTS
// =============================================================================
elseif  ($method==='GET'   && $path==='/placements')                          { $placements->list(); }
elseif  ($method==='POST'  && $path==='/placements')                          { $placements->apply(); }
elseif  ($method==='GET'   && $n===2 && $s0==='placements' && $id1)          { $placements->get($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='placements' && $id1 && $s2==='status')  { $placements->updateStatus($id1); }

// =============================================================================
// LOGBOOK
// =============================================================================
elseif  ($method==='GET'   && $n===3 && $s0==='placements' && $id1 && $s2==='logbook') { $logbooks->listEntries($id1); }
elseif  ($method==='POST'  && $n===3 && $s0==='placements' && $id1 && $s2==='logbook') { $logbooks->submitEntry($id1); }
elseif  ($method==='GET'   && $n===2 && $s0==='logbook' && $id1)             { $logbooks->getEntry($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='logbook' && $id1 && $s2==='review')     { $logbooks->reviewEntry($id1); }

// =============================================================================
// SUPERVISORY VISITS
// =============================================================================
elseif  ($method==='GET'   && $path==='/visits')                              { $visits->list(); }
elseif  ($method==='POST'  && $path==='/visits')                              { $visits->schedule(); }
elseif  ($method==='POST'  && $n===3 && $s0==='visits' && $id1 && $s2==='report') { $visits->submitReport($id1); }

// =============================================================================
// ASSESSMENT COMPONENTS & MARKS
// =============================================================================
elseif  ($method==='GET'   && $path==='/assessment/components')               { $assessment->listComponents(); }
elseif  ($method==='POST'  && $path==='/assessment/components')               { $assessment->createComponent(); }
elseif  ($method==='PATCH' && $n===3 && $s0==='assessment' && $s1==='components' && $id2) { $assessment->updateComponent($id2); }
elseif  ($method==='POST'  && $path==='/assessment/marks')                    { $assessment->submitMarks(); }

// =============================================================================
// HOST EVALUATION
// =============================================================================
elseif  ($method==='POST'  && $n===2 && $s0==='evaluation' && $id1)          { $assessment->submitEvaluation($id1); }
elseif  ($method==='GET'   && $n===2 && $s0==='evaluation' && $id1)          { $assessment->getEvaluation($id1); }

// =============================================================================
// GRADES & CONFIGURATION (D-02, D-03, FR-11, FR-12)
// =============================================================================
elseif  ($method==='GET'   && $path==='/grades/all')                          { $assessment->listAllGrades(); }
elseif  ($method==='GET'   && $path==='/grades/config')                       { $assessment->listGradeConfig(); }
elseif  ($method==='POST'  && $path==='/grades/config')                       { $assessment->saveGradeConfig(); }
elseif  ($method==='GET'   && $n===2 && $s0==='grades' && $id1)              { $assessment->getGrade($id1); }
elseif  ($method==='POST'  && $n===3 && $s0==='grades' && $id1 && $s2==='compute') { $assessment->computeGrade($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='grades' && $id1 && $s2==='verify')  { $assessment->verifyGrade($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='grades' && $id1 && $s2==='approve') { $assessment->approveGrade($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='grades' && $id1 && $s2==='publish') { $assessment->publishGrade($id1); }

// =============================================================================
// GPS ATTENDANCE (D-04 — additional lecturer requirement)
// =============================================================================
elseif  ($method==='POST'  && $path==='/attendance')                          { $attendance->record(); }
elseif  ($method==='GET'   && $n===2 && $s0==='attendance' && $id1)          { $attendance->list($id1); }
elseif  ($method==='PATCH' && $n===3 && $s0==='attendance' && $id1 && $s2==='verify') { $attendance->verify($id1); }

// =============================================================================
// NOTIFICATIONS (FR-13)
// =============================================================================
elseif  ($method==='GET'   && $path==='/notifications') {
    require_once __DIR__ . '/../middleware/Auth.php';
    $actor = Auth::requireAuth();
    $stmt  = $db->prepare(
        'SELECT notification_id, title, message, type, is_read, created_at
         FROM   notifications
         WHERE  recipient_id = :uid
         ORDER  BY created_at DESC LIMIT 50'
    );
    $stmt->execute([':uid' => $actor['user_id']]);
    Response::success($stmt->fetchAll());
}
elseif  ($method==='PATCH' && $n===3 && $s0==='notifications' && $id1 && $s2==='read') {
    require_once __DIR__ . '/../middleware/Auth.php';
    $actor = Auth::requireAuth();
    $db->prepare(
        'UPDATE notifications SET is_read = 1
         WHERE  notification_id = :id AND recipient_id = :uid'
    )->execute([':id' => $id1, ':uid' => $actor['user_id']]);
    Response::success(null, 'Notification marked as read.');
}

// =============================================================================
// REPORTS (FR-14)
// =============================================================================
elseif  ($method==='GET'   && $path==='/reports/placements')                  { $reports->placements(); }
elseif  ($method==='GET'   && $path==='/reports/progress')                    { $reports->progress(); }
elseif  ($method==='GET'   && $path==='/reports/results')                     { $reports->results(); }

// =============================================================================
// 404 FALLBACK
// =============================================================================
else {
    Response::notFound("Endpoint not found: [{$method}] {$path}");
}
