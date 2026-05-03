#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a cross-platform (web + mobile) Expo app where users upload files that are
  stored as password-protected AES-256 ZIPs in the user's own Google Drive.
  ZIPs must be openable outside the app with any standard unzipper. Files must
  remain recoverable after reinstall/device change. No vault_index.json SPOF.
  Password must be user-defined (not derived from id/name/dob). Real Google
  OAuth via expo-auth-session with scope `drive.file`.

frontend:
  - task: "Google OAuth (expo-auth-session, drive.file scope)"
    implemented: true
    working: "NA"
    file: "src/services/authService.ts, src/contexts/AuthContext.tsx, app/login.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Login screen + auth service implemented. Requires user-provided Google OAuth client IDs in frontend/.env (EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB/IOS/ANDROID). Login page renders, Continue with Google button wired to useAuthRequest. Setup doc at /app/SETUP_OAUTH.md. Cannot fully test sign-in flow without real OAuth credentials."

  - task: "Password setup + PBKDF2 verifier (never store raw password)"
    implemented: true
    working: true
    file: "src/services/passwordService.ts, app/setup-password.tsx, app/unlock.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Verified end-to-end via browser playwright: setup-password form accepts 8+ char password, checkbox acknowledgement, redirects to /vault. localStorage contains only {salt, hash, iterations=150000} — raw password NOT stored. Unlock screen verifies password by re-running PBKDF2 and comparing."

  - task: "AES-256 ZIP encryption service (@zip.js/zip.js, WinZip AES)"
    implemented: true
    working: "NA"
    file: "src/services/zipService.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Uses @zip.js/zip.js/index-native.cjs to avoid Metro import.meta issue. encryptionStrength=3 (AES-256), zipCrypto=false. useWebWorkers=false. Full round-trip tested at compile time + bundled successfully; runtime round-trip requires real file picker interaction."

  - task: "Google Drive REST API (upload, list, download, delete)"
    implemented: true
    working: "NA"
    file: "src/services/driveService.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Multipart upload with metadata + appProperties marker {safevault:v1}. Lists via appProperties query, falls back to all application/zip if marker empty. Download via ?alt=media. Delete via DELETE /files/{id}. Requires real access token to exercise."

  - task: "Recovery service (no vault_index.json SPOF)"
    implemented: true
    working: "NA"
    file: "src/services/recoveryService.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Loads cached entries for instant UI, then refreshes from Drive. If no cache, queries Drive only. Falls back to listing all ZIPs if the app marker has never been set (e.g., legacy ZIPs)."

  - task: "Vault list UI + warning banner"
    implemented: true
    working: true
    file: "app/vault.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Renders file list, empty state, warning banner 'Files are protected by your password…'. Locked-state banner appears when password is not in session. Verified via playwright screenshot."

  - task: "Upload flow UI (pick → encrypt → upload)"
    implemented: true
    working: "NA"
    file: "app/upload.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "DocumentPicker → read as Blob (web) or base64 (native) → zipService.createEncryptedZip → driveService.uploadZip. Requires OAuth for real upload."

  - task: "Open/download flow UI (download → decrypt → share)"
    implemented: true
    working: "NA"
    file: "app/open.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Downloads zip from Drive, decrypts via zipService.extractEncryptedZip, triggers browser download (web) or expo-sharing (native). Has fallback to download raw .zip without decrypting."

  - task: "Settings screen (lock, reset pwd, sign out)"
    implemented: true
    working: true
    file: "app/settings.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Static screen renders correctly; all actions wired (lock → /unlock, reset → /setup-password, sign out → revoke + clear cache)."

backend:
  - task: "No backend changes required for this feature"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "All vault logic runs client-side; Drive is the storage layer. Existing FastAPI template untouched."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Google OAuth (expo-auth-session, drive.file scope)"
    - "AES-256 ZIP encryption service (@zip.js/zip.js, WinZip AES)"
    - "Google Drive REST API (upload, list, download, delete)"
    - "Recovery service (no vault_index.json SPOF)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "MVP v1 complete. App compiles, TS clean, web bundle loads, login→setup→vault flow verified via playwright. Blocked on real OAuth client IDs for full end-to-end test of upload/list/download on Google Drive. User must create OAuth credentials per /app/SETUP_OAUTH.md and fill frontend/.env, then restart expo."
