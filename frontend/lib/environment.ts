/**
 * The "Evaluation environment, synthetic data" labels (login page and top bar) are shown unless the
 * deployment says it holds real data: set NEXT_PUBLIC_EVALUATION_LABEL=off there.
 */
export const SHOW_EVALUATION_LABEL = process.env.NEXT_PUBLIC_EVALUATION_LABEL !== 'off'
