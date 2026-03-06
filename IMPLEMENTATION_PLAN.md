# GoyCattleHerder CRM Project Write-up & Implementation Plan

## Project Context
**GoyCattleHerder CRM** is a Next.js 14-based construction project management platform integrated with **Supabase**. It tracks projects, permits, commissions, and blueprints (files).

### Current State
- **Backend (Supabase)**: A robust schema is defined in `schema.sql` covering `profiles`, `projects`, `permits`, `commissions`, and `blueprints`. RLS is enabled.
- **Service Layer (`lib/projectService.ts`)**: Basic data fetching and insertion methods are implemented (create project, complete project, get stats).
- **Frontend (`app/page.tsx`)**: A high-fidelity but non-functional dashboard.
  - "New Project" button is just a placeholder.
  - Project tracker table is empty and non-interactive.
  - "Vault" (blueprints) drag-and-drop area is UI-only.
  - No way to edit or delete existing data.

---

## Action Plan for Claude

### 1. Project Creation Flow
- **Task**: Create a `NewProjectModal` component.
- **Details**:
  - Add a form with fields for Project Name, Client Name, Contract Value, and Sales Rep (Select dropdown from `profiles`).
  - Connect this form to `projectService.createProject()`.
  - Update the "New Project" button in `app/page.tsx` to trigger this modal.
  - **Validation**: After creation, the dashboard stats and project table should refresh automatically.

### 2. Project Detail & Edit View
- **Task**: Create an `EditProjectModal` or detail view for each project.
- **Details**:
  - Allow users to click on a project in the tracker table.
  - Implement a view to edit project details (Name, Address, Contract Value).
  - Add a "Status" dropdown to change between 'lead', 'in_progress', 'completed', and 'cancelled'.
  - Implement "Delete Project" functionality with a confirmation dialog.

### 3. Functional Blueprint Vault
- **Task**: Implement real file uploads to Supabase Storage.
- **Details**:
  - Connect the "Vault" area to a file input or drag-and-drop handler.
  - Upload files to a Supabase Storage bucket named `blueprints`.
  - Record the metadata (file_url, file_name, project_id) in the `blueprints` table using `supabase.from('blueprints').insert()`.
  - Display a list of uploaded blueprints for the currently selected project.

### 4. Permit & Commission Tracking
- **Task**: Surface permit and commission data in the UI.
- **Details**:
  - Show a summary of permits for each project in the detail view.
  - Add a way to update permit status (Pending -> Submitted -> Approved).
  - Automatically trigger the commission logic (already in `projectService.completeProject`) when a project status is changed to 'completed'.

### 5. Dynamic Data Grid
- **Task**: Enhance the Project Tracker in `app/page.tsx`.
- **Details**:
  - Fetch and map real project data from Supabase into the table.
  - Add status-based color badges (e.g., green for 'completed', yellow for 'in_progress').
  - Add action buttons (Edit, Delete, Mark as Complete) directly in the table rows.

### Technical Implementation Notes
- **Supabase Hooks**: Consider using `@supabase/auth-helpers-nextjs` or simple `useEffect` hooks with `supabase.channel()` for real-time updates if the project gets complex.
- **Styling**: Maintain the "GoyCattleHerder" aesthetic (dark theme, Lucide icons, blue accents). Avoid adding Tailwind if not already there, but use it if it's the current standard. (Wait, the project *does* use Tailwind, so use it!).
- **Error Handling**: Add toast notifications or clear error messages for failed Supabase operations.

---

## Goal
The goal is to transition from a "static mockup" to a "live CRM" where a user can manage the entire project lifecycle from lead to commission payout.
