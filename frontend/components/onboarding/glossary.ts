/**
 * Plain-language meanings of the terms a first-time visitor will not know. Kept in one place so the
 * tooltips, the tour and the documents say the same thing. Every definition describes what the
 * system does, no more.
 */
export type GlossaryKey =
  | 'riskScore'
  | 'riskLevel'
  | 'projectedExposure'
  | 'forecast'
  | 'forecastRange'
  | 'standardCost'
  | 'stockCover'
  | 'supplierConcentration'
  | 'scenario'
  | 'validation'
  | 'weightVersion'
  | 'riskTrend'

export const GLOSSARY: Record<GlossaryKey, { term: string; meaning: string }> = {
  riskScore: {
    term: 'Risk score',
    meaning:
      'A score from 0 to 100 for how worried TRIS is about a material\'s cost. It combines up to nine factors, such as a recent price rise or dependence on one supplier. Open a material to see each factor\'s points and the reason for them.',
  },
  riskLevel: {
    term: 'Risk level',
    meaning:
      'Low, Moderate, High or Critical, taken from the score. The score thresholds are set by the risk weights an administrator can change.',
  },
  projectedExposure: {
    term: 'Projected exposure',
    meaning:
      'The extra cost (plus sign) or saving (minus sign) if the stored forecast price holds, over the next 90 days of usual use, compared with buying at the latest monthly price.',
  },
  forecast: {
    term: 'Forecast',
    meaning:
      'A stored estimate of the monthly purchase price ahead. It shows which model made it and from which data, and a new run never replaces an earlier one.',
  },
  forecastRange: {
    term: 'Forecast range',
    meaning:
      'The band the price is expected to stay inside about 8 times in 10, according to the model. Not every model gives one, and then none is shown.',
  },
  standardCost: {
    term: 'Standard cost',
    meaning:
      'The planned price per unit. "Vs standard" shows how far today\'s purchase price is above or below it.',
  },
  stockCover: {
    term: 'Stock cover',
    meaning: 'How many days the stock on hand would last at the usual rate of use.',
  },
  supplierConcentration: {
    term: 'Supplier concentration',
    meaning:
      'Materials where one supplier has most of the spend (70% or more by default). If that supplier raises prices or cannot deliver, there are few alternatives.',
  },
  scenario: {
    term: 'Scenario',
    meaning:
      'A what-if calculation that changes inputs such as price or demand and shows the result. It is labelled as a scenario, is never saved, and is not a prediction.',
  },
  validation: {
    term: 'Validation',
    meaning:
      'A check on past dates: what TRIS would have forecast and warned about using only the data known at the time, compared with what actually happened. False alarms and misses are kept and shown.',
  },
  weightVersion: {
    term: 'Weight version',
    meaning:
      'Each time the risk weights are changed a new version is saved. Earlier scores keep the version they were made with, so they can be reproduced.',
  },
  riskTrend: {
    term: 'Risk trend',
    meaning:
      'One bar for each set of saved scores: how many materials were High or Critical in that set. A new set appears each time scores are calculated.',
  },
}
