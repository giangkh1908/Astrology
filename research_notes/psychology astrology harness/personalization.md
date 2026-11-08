# Personalization and psychological risks in horoscope chatbots

## Why can a broad horoscope feel personally accurate?

### Takeaway
Subjective resonance is not independent validation of a chart interpretation: general, favorable statements can fit many people, and people can map them onto their own experiences. The effect is documented in laboratory personality feedback, but its magnitude and mechanisms vary, and it should not be equated with universal gullibility.

### Cited Findings
- Forer gave introductory psychology students identical purportedly individualized personality sketches and found high acceptance; broad applicability and partial agreement can encourage endorsement of the overall sketch or method. This was a classroom demonstration in 1949, not a representative modern estimate of chatbot effects. [Forer, original paper](https://criticalthinkingtext.wordpress.com/wp-content/uploads/2015/04/forer_the-fallacy-of-personal-validation_1949.pdf)
- A review reports that acceptance varies with perceived relevance, favorability, and to some extent assessment type. [Dickson and Kelly, 1985](https://journals.sagepub.com/doi/10.2466/pr0.1985.57.2.367)
- An earlier critical review argues that participants may recognize the triviality and real accuracy of general feedback, complicating the simple interpretation that acceptance demonstrates gullibility. [Snyder et al., review record](https://eric.ed.gov/?id=EJ223039)
- A double-blind test examined Western natal chart personality claims, matching astrological readings and psychological profiles under controlled conditions. Its findings do not establish whether Zi Wei Dou Shu specifically works, and its Western chart and student-heavy sample limit transfer. [Carlson, 1985](https://doi.org/10.1038/318419a0); [full paper](https://muller.lbl.gov/papers/Astrology-Carlson.pdf)

### Inferences
- Do not use statements such as “you sometimes value independence but also want support” as proof of special individual insight. A positive reaction is a usability or subjective resonance measure, not an accuracy metric.
- For evaluation, blind and randomize chart-to-reading assignments; compare correct and swapped charts and generic statements, and separately score discriminating, pre-specified claims, contradictions, and misses. Do not conflate chart calculation correctness with interpretation validity.

### Gaps
- No controlled study was located establishing effect size or clinical impact specifically for conversational Zi Wei Dou Shu prompts. Avoid applying Western astrology results as direct tests of this system.

## How should user statements and chart interpretations remain distinct?

### Takeaway
Maintain an explicit provenance boundary: distinguish self-reported information, calculated chart data, interpretive tradition, and uncertain inference. Confirmation of an observation does not independently validate its alleged chart-based source.

### Cited Findings
- Forer explains that the same prediction can follow from incompatible propositions, and that confirming a broad prediction does not prove the underlying theory. Individual item evaluations may differ from overall acceptance. [Forer, original paper](https://criticalthinkingtext.wordpress.com/wp-content/uploads/2015/04/forer_the-fallacy-of-personal-validation_1949.pdf)
- WHO recommends protecting human autonomy and transparency in health-related AI; this is relevant ethical guidance by analogy when a divination product discusses health, but it is not a Zi Wei Dou Shu-specific standard. [WHO AI ethics guidance](https://www.who.int/publications/i/item/9789240037403)

### Inferences
- Tag each claim internally as USER_STATED, CALCULATED_CHART, TRADITIONAL_INTERPRETATION, or UNKNOWN/ASSUMPTION; retain source and uncertainty when carrying information forward. A user saying “I changed jobs” is a user report, not a chart discovery, and a user saying “that resonates” is agreement with an interpretation, not confirmation of its mechanism.
- Model language: “You mentioned changing jobs. In this tradition, [specific chart feature] is associated with [tentative theme]. Does that interpretation fit, or would you describe it differently?” Avoid implying the chart revealed the previously disclosed job change.
- Offer non-leading opt-out/correction; preserve corrections and never restate hypothetical options as established facts. Record actual supplied birth details separately from assumptions or incomplete time/location.
- Test source contamination by presenting identical chart data with different fictional user histories and then hiding or changing the histories; verify that recollection is attributed and that user disclosures are not credited to the chart. Use factual consistency and provenance as separate rubrics from users' satisfaction.

### Gaps
- These provenance tags and tests are design recommendations, not a validated intervention shown to reduce harm in astrology chatbots. No direct head-to-head research on these labels was located.

## What psychological and decision-making risks should the prompt address?

### Takeaway
Treat deterministic, high-stakes or emotionally reinforcing claims with caution while preserving user agency. Evidence for chatbot-related mental health harms is developing: plausible mechanisms and case reports warrant safeguards, but population incidence and causality remain uncertain.

### Cited Findings
- A 2026 scoping review identifies sycophancy, misinformation, privacy, potentially inappropriate responses and dependency among proposed risks; it explicitly says that the frequency and impact of many mental health harms remain unclear and much conceptual work is speculative. [npj Digital Medicine scoping review](https://www.nature.com/articles/s41746-026-03054-x)
- WHO urges caution using LLMs for health and emphasizes safety, autonomy and appropriate governance. [WHO guidance](https://www.who.int/news/item/16-05-2023-who-calls-for-safe-and-ethical-ai-for-health)

### Inferences
- Avoid fatalistic predictions of death, illness, betrayal, financial ruin or guaranteed outcomes; present interpretations as optional and uncertain, and preserve ordinary decision processes and access to qualified professionals for high-stakes decisions.
- If a user expresses severe distress or beliefs that they are being persecuted or specially commanded, respond supportively without affirming the alleged supernatural threat or chart as proof; prioritize appropriate human help and immediate safety over completing the reading.
- Minimize collection and retention of sensitive biographical or health information, avoid nudging disclosure, and avoid claims of unique emotional connection or exclusive authority.

### Gaps
- No source found quantifies whether these specific safeguards reduce harm in this application, or estimates the incidence of chatbot-induced delusion; correlation and selected case reports cannot establish general causal risk.
