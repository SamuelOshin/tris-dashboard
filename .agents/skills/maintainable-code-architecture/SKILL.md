---
name: maintainable-code-architecture
description: >-
  Engineering standards and runbook for writing clean, maintainable, modular, and testable code across frontend and backend applications. Use when building new pages, designing complex UI workflows, refactoring monolithic files, separating concerns (SRP), extracting custom hooks and domain logic, preventing 'god files' (>250 lines), and avoiding state pollution or unnecessary re-renders.
---

# Senior Maintainable Code Architecture & Component Decomposition

A practical architectural guide for writing clean, decoupled, maintainable code and eliminating monolithic "god files" in production web applications.

---

## 1. The Core Engineering Axioms

1. **Hard 250–300 Line Limit Per File**:
   - Any UI file or service exceeding ~250–300 lines violates the **Single Responsibility Principle (SRP)**.
   - Large files conflate presentation, orchestration, API calls, and domain business rules into an unmaintainable tangle.
2. **Page as Conductor (<100–150 Lines)**:
   - Page route files (`app/**/page.tsx`) must only extract route parameters, manage top-level layout, and mount subcomponents.
   - Pages must never directly own 10+ `useState` form variables, raw API mutation calls, or long JSX tab sections.
3. **Strict Re-render & State Isolation**:
   - Form inputs belong inside the active tab/section or an isolated form hook.
   - Typing a single character into a form must never trigger a whole-page or navigation re-render.
4. **Pure Domain Logic Isolation**:
   - Business predicates, workflow guards (e.g. `isInvestigationLocked`, `canCloseCase`), and badge color mappers must be pure functions in a dedicated utility file.
   - Pure functions can be unit-tested to 100% code coverage without mounting React trees or mocking the DOM.

---

## 2. Monolithic "God Component" Anti-Patterns (Junior vs Senior)

| Junior Anti-Pattern | Senior Architecture Standard |
| :--- | :--- |
| **Monolithic God File**: 1,000–2,000 lines in `page.tsx` containing all tabs, modals, and headers. | **Feature-Based Decomposition**: Decompose into `components/<feature>/tabs/`, `modals/`, and `case-header.tsx`. |
| **Root State Pollution**: 15+ `useState` calls at the page root causing entire page re-renders on keystroke. | **Encapsulated Form State**: State is localized to the active tab or managed via a focused custom hook. |
| **Inline Business Predicates**: Complex boolean checks inline in JSX (`disabled={status === 'New' \|\| status === 'Assigned' ...}`). | **Pure Domain Guards**: Extracted pure functions (`isInvestigationLocked(caseData)`) in `<feature>-workflow-guards.ts`. |
| **Mixed Concerns**: Routing, data fetching, localStorage drafts, and UI rendering tangled together. | **Orchestrator Hook**: Dedicated `use<Feature>Workspace(id)` custom hook managing data, drafts, and lifecycle actions. |
| **Untestable UI**: Cannot test a tab form or checklist without mounting the entire route and mocking APIs. | **Isolated Presentation Components**: Every tab is independently testable with typed props. |

---

## 3. Frontend Feature-Folder Pattern

Organize complex multi-step workflows or dashboards into feature directories:

```
frontend/
├── app/cases/[id]/
│   └── page.tsx                         # ~80 lines: Lightweight conductor only
└── components/cases/
    ├── types.ts                         # Shared interfaces, TabId, form DTOs, and draft types
    ├── case-workflow-guards.ts          # Pure domain functions (isTabLocked, badge styling)
    ├── case-header.tsx                  # Case title, status/priority badges, lifecycle action buttons
    ├── case-tab-nav.tsx                 # Tab navigation strip with dynamic stage lock indicators
    ├── hooks/
    │   └── use-case-workspace.ts        # API mutations, draft sync, lifecycle events, closure checks
    ├── modals/
    │   └── reopen-modal.tsx             # Case reopening dialog with rationale prompt
    └── tabs/
        ├── overview-tab.tsx             # Case summary, triggered rules, supplier baseline
        ├── investigation-tab.tsx        # Investigation form, sample autofill, evidence dropzone
        ├── corrective-action-tab.tsx    # Remediation actions, dates, responsible party
        ├── closure-tab.tsx              # 8-field verification checklist and system closure action
        ├── history-tab.tsx              # Chronological vertical timeline & append-only audit entries
        └── recurrence-tab.tsx           # 90-day post-closure monitoring (Rule R-006)
```

---

## 4. Step-by-Step Refactoring Runbook

When encountering a file exceeding 300 lines:

### Step 1: Extract Types (`types.ts`)
Identify all distinct data shapes, tab identifiers, form inputs, and draft structures:
```typescript
// components/<feature>/types.ts
export type TabId = 'overview' | 'investigation' | 'closure'

export interface InvestigationFormData {
  evidenceReviewed: string
  rootCause: string
  findingDisposition: string
}
```

### Step 2: Extract Pure Domain Guards (`<feature>-workflow-guards.ts`)
Move inline status checks and styling logic into pure functions:
```typescript
// components/<feature>/case-workflow-guards.ts
export function isInvestigationLocked(caseData: RiskCase | null): boolean {
  if (!caseData) return true
  return caseData.status === 'New' || caseData.status === 'Closed'
}

export function getPriorityBadgeStyle(priority?: string): string {
  switch (priority?.toLowerCase()) {
    case 'high': return 'bg-rose-500 text-white'
    case 'medium': return 'bg-amber-500 text-white'
    default: return 'bg-slate-500 text-white'
  }
}
```

### Step 3: Extract the State Orchestrator Hook (`hooks/use-<feature>-workspace.ts`)
Encapsulate data fetching, draft persistence in `localStorage`, status transitions, and error handling:
```typescript
// components/<feature>/hooks/use-case-workspace.ts
export function useCaseWorkspace(caseId: string) {
  const [caseData, setCaseData] = useState<RiskCase | null>(null)
  const [loading, setLoading] = useState(true)
  // ... local draft & lifecycle mutations ...
  return {
    caseData,
    loading,
    error,
    actions: { handleAcceptCase, handleTransition, executeClosure }
  }
}
```

### Step 4: Split Presentation Tabs into Dedicated Files (`tabs/*.tsx`)
Each tab must be its own component receiving clean props. Keep each under 150–200 lines:
```tsx
// components/<feature>/tabs/investigation-tab.tsx
export function InvestigationTab({
  caseData,
  formData,
  onChangeField,
  onSave,
  isActionLoading,
}: InvestigationTabProps) {
  const isLocked = isInvestigationLocked(caseData)
  return (
    <Card className="p-5 space-y-4">
      {/* Tab content */}
    </Card>
  )
}
```

### Step 5: Slim Down the Page Orchestrator (`app/**/page.tsx`)
The page simply wires the hook to the tab navigation and subcomponents:
```tsx
// app/cases/[id]/page.tsx (< 100 lines)
export default function CaseDetailPage() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const workspace = useCaseWorkspace(id as string)

  if (workspace.loading) return <LoadingSpinner />
  if (workspace.error) return <ErrorCard error={workspace.error} />

  return (
    <DashboardLayout title={`Case ${id}`}>
      <CaseHeader caseData={workspace.caseData} ... />
      <CaseTabNav activeTab={activeTab} onSelectTab={setActiveTab} ... />
      {activeTab === 'overview' && <OverviewTab ... />}
      {activeTab === 'investigation' && <InvestigationTab ... />}
      {activeTab === 'closure' && <ClosureTab ... />}
    </DashboardLayout>
  )
}
```

---

## 5. Verification Checklist

Before considering any refactor or feature complete:
1. **Line Count**: No single file exceeds 250–300 lines.
2. **Type Safety**: Run `npx tsc --noEmit` — 0 TypeScript errors.
3. **Build Check**: Run `npm run build` — all routes compile without warning.
4. **Backend Contract**: Run test suite (`uv run pytest tests/ -v`) to confirm API contract integrity.
5. **No Regressions**: Verify toasts, events, and persistence behave identically to the baseline.
