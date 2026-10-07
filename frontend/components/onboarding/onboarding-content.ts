import { canViewManufacturing } from '@/components/manufacturing/manufacturing-navigation'

/** Key under which the browser remembers that the welcome has been shown. */
export const WELCOME_STORAGE_KEY = 'tris.welcome.seen'

export const WELCOME_INTRO =
  'TRIS brings financial, supplier, approval and access information into one review workflow, so a reviewer can see why an exception needs attention, investigate it, document the fix and close it with evidence.'

export const WHATS_NEW: { title: string; body: string }[] = [
  {
    title: 'Material cost intelligence',
    body: 'Import purchase and bill-of-materials files, and TRIS spots price rises, prices above standard cost and dependence on one supplier.',
  },
  {
    title: 'Forecasts and exposure',
    body: 'Stored 30- and 90-day price forecasts with the model used, and what they could cost. What-if scenarios are labelled and never saved.',
  },
  {
    title: 'An explainable risk score',
    body: 'Each material gets a 0 to 100 score. Every point is explained, and the weights are versioned so scores can be reproduced.',
  },
  {
    title: 'Cases from a material signal',
    body: 'A High-risk material can open a case in the same workflow as every other case, with the same sign-off rules.',
  },
  {
    title: 'A check against the past',
    body: 'Validation replays past dates using only what was known then, and shows the false alarms and misses as well as the hits.',
  },
]

export interface TourStep {
  id: string
  /** The element to point at: matches the `data-tour` attribute on the page. */
  target: string
  title: string
  body: string
  /** Only roles for which this returns true see the step. */
  forRole?: (role: string | undefined) => boolean
}

const manufacturing = (role: string | undefined) => canViewManufacturing(role)
const admin = (role: string | undefined) => role?.toLowerCase() === 'admin'

/** The tour, in order. A step whose target is not on the page is skipped. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'summary',
    target: 'mfg-summary',
    title: 'Material cost at a glance',
    body: 'These figures come from the data you import and the results TRIS has stored. Where nothing is stored yet, a card says so instead of showing zero.',
    forRole: manufacturing,
  },
  {
    id: 'manufacturing',
    target: 'manufacturing-nav',
    title: 'The Manufacturing section',
    body: 'Everything for material cost lives here. The pages follow the order of the work: import, review, forecast, check.',
    forRole: manufacturing,
  },
  {
    id: 'erp-mapping',
    target: 'nav-erp-mapping',
    title: '1. Bring your data in',
    body: 'Upload a CSV or Excel file and match its columns to TRIS fields. Nothing connects to an ERP system; the SAP-style and Dynamics-style options are layouts of an uploaded file.',
    forRole: manufacturing,
  },
  {
    id: 'material-cost',
    target: 'nav-material-cost',
    title: '2. Review the materials',
    body: 'One row per material with its price trend, signals and risk score. Open a row to see why each point of the score was given.',
    forRole: manufacturing,
  },
  {
    id: 'forecasting',
    target: 'nav-forecasting',
    title: '3. Forecast and test what-ifs',
    body: 'See the stored forecasts, what they could cost, and try a scenario such as a price rise. A scenario never changes the stored forecast.',
    forRole: manufacturing,
  },
  {
    id: 'validation',
    target: 'nav-validation',
    title: '4. Check the method',
    body: 'Replay past dates to see how the forecasts and warnings would have done, including the ones that were wrong.',
    forRole: manufacturing,
  },
  {
    id: 'administration',
    target: 'nav-administration',
    title: 'Administration',
    body: 'For administrators: switch forecast models on or off, change the risk weights, label datasets and read the audit log.',
    forRole: admin,
  },
  {
    id: 'cases',
    target: 'nav-risk-cases',
    title: 'Risk Cases',
    body: 'Signals that need a person become cases here. A case moves through investigation, corrective action and verified closure, and nobody closes a case they investigated.',
  },
  {
    id: 'user-menu',
    target: 'user-menu',
    title: 'Your account',
    body: 'Your role decides what you can do. On a demonstration deployment, you can also switch role here to see what each one sees.',
  },
  {
    id: 'help',
    target: 'help',
    title: 'Help is always here',
    body: 'Reopen this tour or the welcome page from this button at any time. A small ? beside a term explains it in plain words.',
  },
]

export function stepsFor(role: string | undefined): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.forRole || step.forRole(role))
}
